# --- path setup: permite importar modulos hermanos (base_datos/, backend/, telegram/) ---
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
for _sub in ("base_datos", "backend", "telegram"):
    _p = _os.path.join(_ROOT, _sub)
    if _p not in _sys.path:
        _sys.path.insert(0, _p)
# --- end path setup ---

import cv2
import time
import threading
import queue  # [COLA] para el buffer de análisis LLaVA
import os
import re
import subprocess
import socket
from datetime import datetime, timezone  # [DB] timestamps UTC para eventos
from ultralytics import YOLO

# -----------------------------------------------------------------------------
# [ANALIZADOR] Toggle por variable de entorno CAMARAS_ANALIZADOR.
#   - "v1" (default) → analizador.py  (rápido, ~76s, descripción genérica)
#   - "v2"           → analizador2.py (lento, ~115-135s, detección de amenazas:
#                                       armas, capucha, merodeo, trepar, etc.)
# Uso (PowerShell):
#   $env:CAMARAS_ANALIZADOR="v2"; python detector.py
# Uso (CMD):
#   set CAMARAS_ANALIZADOR=v2 && python detector.py
# -----------------------------------------------------------------------------
_ANALIZADOR_VERSION = os.getenv("CAMARAS_ANALIZADOR", "v1").lower().strip()
if _ANALIZADOR_VERSION == "v2":
    from analizador2 import analizar_frame
    print("[ANALIZADOR] Usando analizador2 (v2-seguridad · armas/capucha/merodeo)")
else:
    from analizador import analizar_frame
    print("[ANALIZADOR] Usando analizador (v1-rápido · descripción genérica)")

from db import db  # [DB] capa de persistencia (PostgreSQL)
from storage import storage  # [MINIO] capa de objetos para snapshots JPG
from redis_cache import cache  # [REDIS] cooldown anti-spam + cache de estado
from salud import reportar as reportar_salud, Heartbeat  # [SALUD] heartbeats

# =============================================================================
# [DB] INICIALIZACIÓN DE POSTGRES (antes que nada)
# =============================================================================
# Si la DB no responde, seguimos vigilando igual (graceful degradation).
DB_OK = db.init()
if DB_OK:
    db.cargar_configuracion()
    print("[DB] Conectado y configuración cargada desde PostgreSQL")
else:
    print("[DB] Postgres no disponible → el detector seguirá sin persistencia")

# =============================================================================
# [MINIO] INICIALIZACIÓN DE STORAGE DE OBJETOS (snapshots)
# =============================================================================
# Si MinIO no responde, seguimos detectando igual (graceful degradation).
# Los eventos simplemente quedarán sin snapshot_key.
STORAGE_OK = storage.init()
if STORAGE_OK:
    print("[MINIO] Conectado. Los snapshots se subirán al bucket de MinIO.")
else:
    print("[MINIO] No disponible → los eventos se guardarán sin snapshot JPG.")

# =============================================================================
# [REDIS] INICIALIZACIÓN DE CACHE (cooldown de LLaVA + estado por cámara)
# =============================================================================
# Si Redis no responde, el detector sigue funcionando sin anti-spam
# (mismo patrón de degradación que MinIO). cache.init() ya reporta salud.
CACHE_OK = cache.init()
if CACHE_OK:
    print("[REDIS] Conectado. Cooldown anti-spam activo para LLaVA.")
else:
    print("[REDIS] No disponible → sin cooldown, LLaVA puede disparar repetido.")

# =============================================================================
# [SALUD] Reportes iniciales + estado compartido para los heartbeats
# =============================================================================
# Al arrancar marcamos el estado de cada dependencia. Después el heartbeat
# del detector y de yolo actualizan cada 30s.
if DB_OK:
    reportar_salud("postgres", "online")
else:
    reportar_salud("postgres", "offline", error_msg="db.init() devolvió False")

if STORAGE_OK:
    reportar_salud("minio", "online")
else:
    reportar_salud("minio", "offline", error_msg="storage.init() devolvió False")

reportar_salud("detector", "online")

# Estado compartido que el heartbeat de YOLO publica cada 30s
_salud_stats = {
    "latencia_yolo_ms": 0,
    "frames_procesados": 0,
    "frames_con_personas": 0,
    "alertas_totales": 0,
}

_hb_detector = Heartbeat(
    "detector",
    intervalo_s=30,
    callback_metrica=lambda: {
        "frames_procesados": _salud_stats["frames_procesados"],
        "alertas_totales":   _salud_stats["alertas_totales"],
    },
).start()

_hb_yolo = Heartbeat(
    "yolo",
    intervalo_s=30,
    callback_metrica=lambda: {
        "latencia_ms":          _salud_stats["latencia_yolo_ms"],
        "frames_procesados":    _salud_stats["frames_procesados"],
        "frames_con_personas":  _salud_stats["frames_con_personas"],
    },
).start()

# --- CONFIGURACIÓN DE RED INTELIGENTE (MULTI-CÁMARA) ---

# [MIGRATION 008] Las passes ahora viven en `camaras.password_rtsp` (DB).
# Este dict es FALLBACK por MAC: se usa solo cuando la DB devuelve NULL para
# una cámara (ej. migration no aplicada, o cámara nueva creada sin pass).
# Mantener actualizado para no quedarte sin acceso si la DB pierde el campo.
CAMERA_PASSWORDS_FALLBACK = {
    "08:ea:40:54:9b:f5": "123456",
    "68:b9:d3:5c:cc:fc": "Camaras2026",
}

# [DB] Fallback hardcoded: si la DB no está disponible, arrancamos con esto.
CONFIGURACION_CAMARAS_FALLBACK = [
    {
        "nombre": "Camara_Principal",
        "mac": "08:EA:40:54:9B:F5",
        "usuario": "admin",
        "ruta_rtsp": "live/ch0",
        "ip_respaldo": "192.168.1.15",
        "modo_analisis": "solo_yolo",
    },
    {
        "nombre": "Camara_Sonoff",
        "mac": "68:B9:D3:5C:CC:FC",
        "usuario": "rtsp",
        "ruta_rtsp": "av_stream/ch0",
        "ip_respaldo": "192.168.1.17",
        "modo_analisis": "yolo_llava",
    },
]


def _cargar_camaras():
    """
    [DB] Devuelve la lista de cámaras a monitorear.
         Primero intenta la tabla `camaras` (Postgres); si falla, fallback.
         Siempre inyecta el password desde CAMERA_PASSWORDS (por MAC).
    """
    fuente = []
    if DB_OK:
        for c in db.camaras_activas():
            fuente.append({
                "id_db":          c["id"],                # UUID para FK
                "nombre":         c["nombre"],
                "mac":            c["direccion_mac"],
                "usuario":        c["usuario_rtsp"],
                # [MIGRATION 008] pass desde DB; fallback al dict por MAC.
                "password":       c.get("password_rtsp") or CAMERA_PASSWORDS_FALLBACK.get(c["direccion_mac"].lower(), ""),
                "ruta_rtsp":      c["ruta_rtsp"],
                "puerto_rtsp":    c.get("puerto_rtsp") or 554,
                "ip_respaldo":    c["ip_respaldo"],
                "modo_analisis":  c["modo_analisis"],     # solo_yolo | yolo_llava | solo_llava
                "contexto_zona":  c["contexto_zona"] or c["nombre"],
                # [MEDIAMTX] Si esta poblado, el detector consume desde MediaMTX
                # en lugar de la camara directa. Evita conflictos de "1 conexion
                # RTSP simultanea" que tienen las camaras IP baratas.
                "mediamtx_path":  c.get("mediamtx_path"),
            })
    if not fuente:
        print("[DB] Usando configuración hardcoded de fallback")
        for c in CONFIGURACION_CAMARAS_FALLBACK:
            fuente.append({
                "id_db":          None,
                "nombre":         c["nombre"],
                "mac":            c["mac"],
                "usuario":        c["usuario"],
                "password":       CAMERA_PASSWORDS_FALLBACK.get(c["mac"].lower(), ""),
                "ruta_rtsp":      c["ruta_rtsp"],
                "puerto_rtsp":    554,
                "ip_respaldo":    c["ip_respaldo"],
                "modo_analisis":  c["modo_analisis"],
                "contexto_zona":  c["nombre"],
                "mediamtx_path":  c.get("mediamtx_path"),  # opcional en fallback
            })
    return fuente


CONFIGURACION_CAMARAS = _cargar_camaras()  # [DB] reemplaza al dict hardcoded


def obtener_base_ip_actual():
    """Detecta automáticamente en qué red está conectada la PC hoy"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Hacemos una conexión falsa hacia internet para que Windows nos diga qué adaptador de red está usando
        s.connect(('10.255.255.255', 1))
        mi_ip = s.getsockname()[0]
    except Exception:
        mi_ip = '127.0.0.1'
    finally:
        s.close()

    # Recorta el último número para darnos la base de la red
    partes = mi_ip.split('.')
    base_ip = f"{partes[0]}.{partes[1]}.{partes[2]}."
    print(f"\n[RED] Red detectada automáticamente. Base IP: {base_ip}X")
    return base_ip

# Detectamos la red dinámicamente
BASE_IP = obtener_base_ip_actual()

def hacer_ping(ip):
    subprocess.run(['ping', '-n', '1', '-w', '200', ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def despertar_red(base_ip):
    print("Enviando pulso de red para despertar dispositivos...")
    hilos = []
    for i in range(1, 255):
        ip = f"{base_ip}{i}"
        hilo = threading.Thread(target=hacer_ping, args=(ip,), daemon=True)
        hilos.append(hilo)
        hilo.start()
    for hilo in hilos:
        hilo.join(timeout=0.01)

def obtener_ip_camara(mac_address):
    mac_windows = mac_address.replace(':', '-').lower()
    try:
        resultado = os.popen('arp -a').read()
        for linea in resultado.split('\n'):
            if mac_windows in linea.lower():
                ip = re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', linea)
                if ip: return ip.group(0)
    except Exception as e:
        print(f"Error tabla ARP: {e}")
    return None

# Buscar las IPs de todas las cámaras dinámicamente
enlaces_rtsp = {}
despertar_red(BASE_IP)

print("\nBuscando cámaras en la red...")
for cam in CONFIGURACION_CAMARAS:
    # [MEDIAMTX] Si la cámara tiene mediamtx_path configurado, consumimos
    # el stream desde MediaMTX en vez de hablarle directo a la cámara IP.
    # Esto evita el conflicto típico de "1 sola conexión RTSP simultánea"
    # que tienen las cámaras IP chinas baratas. MediaMTX se queda con
    # la única conexión a la cámara y todos los demás (detector, frontend
    # vía HLS, etc.) consumen desde MediaMTX.
    if cam.get("mediamtx_path"):
        mtx_path = cam["mediamtx_path"]
        # [SYNC] Si la camara usa un transcode FFmpeg (cam_*_lite), el detector
        # consume el path BASE (sin _lite). Razon: el FFmpeg agrega ~500ms de
        # delay que desincroniza el bbox del video. El detector lee el frame
        # raw "antes" que llegue al cliente -> bbox aparece en sync con video.
        # El frontend sigue consumiendo el _lite (720p, menos CPU del browser).
        if mtx_path.endswith("_lite"):
            base_path = mtx_path[:-len("_lite")]
            url = f"rtsp://localhost:8554/{base_path}"
            print(f"[MEDIAMTX] {cam['nombre']} consume PATH BASE para sync: {url}")
        else:
            url = f"rtsp://localhost:8554/{mtx_path}"
            print(f"[MEDIAMTX] {cam['nombre']} consume desde MediaMTX: {url}")
        enlaces_rtsp[cam["nombre"]] = url
        # [SALUD] NO marcamos online aqui: esperamos al primer frame real
        #         en el loop principal para evitar falsos positivos.
        continue

    # Modo legacy: conexión RTSP directa a la cámara IP (con descubrimiento ARP)
    ip = obtener_ip_camara(cam["mac"])
    if ip:
        print(f"[✅] {cam['nombre']} encontrada en IP: {ip}")
        enlaces_rtsp[cam["nombre"]] = (
            f'rtsp://{cam["usuario"]}:{cam["password"]}@{ip}:{cam["puerto_rtsp"]}/{cam["ruta_rtsp"]}'
        )
        # [DB] Persistimos la IP descubierta (si la cámara vino de la DB)
        if cam["id_db"]:
            db.actualizar_ip_camara(cam["id_db"], ip)
            db.actualizar_salud_camara(cam["id_db"], estado="online")
    else:
        print(f"[❌] {cam['nombre']} no encontrada. Usando IP de respaldo ({cam['ip_respaldo']})")
        enlaces_rtsp[cam["nombre"]] = (
            f'rtsp://{cam["usuario"]}:{cam["password"]}@{cam["ip_respaldo"]}:{cam["puerto_rtsp"]}/{cam["ruta_rtsp"]}'
        )
        # [DB] Marcamos la cámara como degradada (usando IP de respaldo)
        if cam["id_db"]:
            db.actualizar_salud_camara(
                cam["id_db"], estado="degradada",
                error_msg="ARP no encontró la cámara, usando ip_respaldo",
            )

# --- CONFIGURACIÓN DE IA ---
# [DB] Estos valores ahora salen de configuracion_sistema (con fallback a los originales).
MODELO_PATH             = 'yolov8n.pt'
CONFIANZA_VISUAL        = float(db.config("CONFIANZA_VISUAL", 0.45))           # [DB]
CONFIANZA_ALERTA        = float(db.config("CONFIANZA_ALERTA", 0.67))           # [DB]
PROCESAR_CADA_N_FRAMES  = int(db.config("PROCESAR_CADA_N_FRAMES", 2))          # [DB]
DURACION_ALERTA_SEG     = int(db.config("DURACION_ALERTA_SEG", 5))             # [DB]
FRAMES_AUSENCIA         = int(db.config("FRAMES_AUSENCIA", 92))                # [DB]

# Cooldown global por camara para CREACION de alertas (evita spam cuando una
# misma persona aparece y desaparece, o cuando YOLO le asigna un track_id
# nuevo). Default 30s. Sobrescribir con CAMARAS_ALERT_COOLDOWN_S en .env.
ALERT_COOLDOWN_S = int(os.getenv("CAMARAS_ALERT_COOLDOWN_S",
                                 db.config("ALERT_COOLDOWN_S", 30)))
print(f"[COOLDOWN] ALERT_COOLDOWN_S = {ALERT_COOLDOWN_S}s (cooldown global por camara para creacion de alerta)")

class VideoStream:
    def __init__(self, src):
        self.src = src
        self.cap = cv2.VideoCapture(src)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.ret, self.frame = self.cap.read()
        self.stopped = False
        self.lock = threading.Lock()

    def start(self):
        threading.Thread(target=self.update, args=(), daemon=True).start()
        return self

    def update(self):
        while not self.stopped:
            try:
                ret, frame = self.cap.read()
            except cv2.error:
                # [FIX] El cap.release() del stop() puede dispararse mientras
                #      este thread está en read(). Salimos limpio.
                break
            if self.stopped:
                break
            if not ret:
                time.sleep(1)
                if not self.stopped:
                    self.cap.open(self.src)
            else:
                with self.lock:
                    self.frame = frame

    def read(self):
        with self.lock:
            if self.frame is not None:
                return self.frame.copy()
            return None

    def stop(self):
        self.stopped = True
        self.cap.release()

class AnalizadorAsync:
    """
    [COLA] Worker único con cola FIFO.
    Antes: si LLaVA estaba ocupado, la alerta se descartaba.
    Ahora: se encola. Si el worker está libre, la toma al toque.
           Si la cola se llena (pico de alertas), descarta las NUEVAS con aviso.
    """

    def __init__(self, max_cola=5):
        self.max_cola = max_cola
        self.cola: queue.Queue = queue.Queue(maxsize=max_cola)
        self._lock = threading.Lock()
        self._worker_iniciado = False

    def _iniciar_worker(self):
        """Arranca el worker consumidor en el primer analizar() que se llame."""
        with self._lock:
            if self._worker_iniciado:
                return
            self._worker_iniciado = True
            threading.Thread(target=self._worker, daemon=True).start()

    def _worker(self):
        """Consumidor único: saca trabajos de la cola y los procesa 1 a 1."""
        while True:
            trabajo = self.cola.get()  # bloquea hasta que haya algo
            try:
                self._procesar(**trabajo)
            except Exception as e:
                print(f"[LLaVA] Error en worker: {e}")
            finally:
                self.cola.task_done()

    def _procesar(self, frame, alerta_num, zona, evento_id, alerta_id, camara_nombre=None):
        print(f"\n[LLaVA] Analizando alerta #{alerta_num} de {zona} "
              f"(cola restante: {self.cola.qsize()})...")
        resultado = analizar_frame(frame, contexto=zona)
        print(f"\n{'='*45}\n  ANÁLISIS ALERTA #{alerta_num} | ZONA: {zona}\n{'='*45}")
        print(f"  Sospechoso:  {resultado.get('sospechoso', False)}")

        # Blindaje anti-errores al imprimir nivel
        nivel = str(resultado.get('nivel', 'desconocido'))
        print(f"  Nivel:       {nivel.upper()}")

        print(f"  Personas:    {resultado.get('personas', 1)}\n  Acciones:    {resultado.get('acciones', 'N/A')}")
        print(f"  Descripcion: {resultado.get('descripcion', 'N/A')}\n  Tiempo:      {resultado.get('tiempo_analisis', 'N/A')}s\n{'='*45}\n")

        # [REDIS] Actualizamos estado + cooldown con TTL variable según el nivel.
        #         Esto corre POST-análisis; el cooldown "in-flight" lo setea el
        #         dispatcher antes de encolar (para evitar pile-up).
        if camara_nombre:
            nivel_str = str(resultado.get("nivel", "bajo")).lower()
            if nivel_str not in ("alto", "medio", "bajo"):
                nivel_str = "bajo"
            # Más peligroso = re-analizamos antes (el estado puede escalar rápido)
            ttl_por_nivel = {"alto": 15, "medio": 30, "bajo": 60}
            ttl = ttl_por_nivel[nivel_str]
            cache.set_estado_camara(camara_nombre, {
                "nivel":       nivel_str,
                "personas":    int(resultado.get("personas", 0) or 0),
                "descripcion": str(resultado.get("descripcion", ""))[:120],
                "acciones":    str(resultado.get("acciones", ""))[:80],
                "alerta_num":  alerta_num,
                "evento_id":   evento_id,
                "sospechoso":  bool(resultado.get("sospechoso", False)),
            })
            cache.set_cooldown(camara_nombre, "analisis", ttl_s=ttl)
            print(f"[REDIS] Estado={nivel_str} | cooldown={ttl}s para {camara_nombre}")

            # [REDIS PUBSUB] Publicamos al canal 'alertas' para que cualquier
            #                cliente conectado vía SSE/WebSocket reciba la alerta
            #                en tiempo real (dashboard, app móvil, etc.)
            n_subs = cache.publish_alerta({
                "tipo":        "analisis",
                "camara":      camara_nombre,
                "zona":        zona,
                "nivel":       nivel_str,
                "personas":    int(resultado.get("personas", 0) or 0),
                "descripcion": str(resultado.get("descripcion", ""))[:200],
                "acciones":    str(resultado.get("acciones", ""))[:120],
                "sospechoso":  bool(resultado.get("sospechoso", False)),
                "alerta_num":  alerta_num,
                "evento_id":   evento_id,
                "ts":          time.time(),
            })
            if n_subs and n_subs > 0:
                print(f"[REDIS] Publicado a canal 'alertas' ({n_subs} subs)")

        # [DB] Persistimos el veredicto y lo vinculamos a la alerta
        if evento_id is not None:
            analisis_id = db.guardar_analisis(evento_id, resultado)
            if alerta_id and analisis_id:
                db.vincular_analisis_alerta(alerta_id, analisis_id)
                print(f"[DB] Análisis {analisis_id} vinculado a alerta {alerta_id[:8]}...")

        # [TELEGRAM] Solo notifica casos reales: sospechoso=True o nivel=alto.
        #            El worker aparte (telegram_worker.py) la envía.
        if alerta_id:
            es_sospechoso = bool(resultado.get("sospechoso", False))
            nivel = str(resultado.get("nivel", "bajo")).lower()
            if es_sospechoso or nivel in ("bajo", "alto", "medio"):
                chat_id = db.config("TELEGRAM_CHAT_ID")
                if chat_id:
                    texto = (
                        f"🚨 Alerta #{alerta_num}\n"
                        f"Zona: {zona}\n"
                        f"Nivel: {nivel.upper()}\n"
                        f"Sospechoso: {'Sí' if es_sospechoso else 'No'}\n"
                        f"Personas: {resultado.get('personas', 0)}\n\n"
                        f"Descripción: {resultado.get('descripcion', 'N/A')}\n"
                        f"Acciones: {resultado.get('acciones', 'N/A')}"
                    )
                    db.encolar_notificacion(alerta_id, int(chat_id), texto)
                    print(f"[TELEGRAM] Notificación encolada para alerta #{alerta_num}")

    def esta_ocupado(self):
        """Retrocompat: ahora devuelve True solo si la cola está saturada."""
        return self.cola.qsize() >= self.max_cola

    # [DB] firma extendida: recibe evento_id y alerta_id para persistir el
    #      análisis y vincularlo a la alerta.
    # [REDIS] camara_nombre se usa para setear el cooldown/estado post-análisis.
    def analizar(self, frame, alerta_num, zona, evento_id=None, alerta_id=None,
                 camara_nombre=None):
        """
        [COLA] Encola el trabajo. Si la cola está llena, descarta con aviso.
               El worker corre en un único thread, así que LLaVA nunca procesa
               dos frames a la vez (Ollama tampoco se banca paralelismo real).
        """
        self._iniciar_worker()
        trabajo = {
            "frame": frame,
            "alerta_num": alerta_num,
            "zona": zona,
            "evento_id": evento_id,
            "alerta_id": alerta_id,
            "camara_nombre": camara_nombre,
        }
        try:
            self.cola.put_nowait(trabajo)
            print(f"[LLaVA] Alerta #{alerta_num} encolada "
                  f"(posición {self.cola.qsize()}/{self.max_cola})")
        except queue.Full:
            print(f"[LLaVA] ⚠ Cola LLENA ({self.max_cola} pendientes). "
                  f"Descarta alerta #{alerta_num} de {zona}.")

print("\n--- Iniciando Sistema Híbrido de Vigilancia ---")
model = YOLO(MODELO_PATH)
try:
    model.to('cuda')
    print("Estado: GPU")
except:
    print("Estado: CPU")

analizador = AnalizadorAsync()

# [DB] Construimos el diccionario maestro a partir de CONFIGURACION_CAMARAS
#      (que puede venir de DB o del fallback). Ya no está hardcoded.
camaras = []
for cfg in CONFIGURACION_CAMARAS:
    cam_obj = {
        "nombre":         cfg["nombre"],
        "id_db":          cfg["id_db"],             # [DB] UUID para FK en eventos/alertas
        "modo_analisis":  cfg["modo_analisis"],     # [DB] controla si dispara LLaVA
        "contexto_zona":  cfg["contexto_zona"],     # [DB] texto que se manda al prompt
        "url_rtsp":       enlaces_rtsp[cfg["nombre"]],  # [FIX] guardada para lazy-start
        "vs":             None,                     # [FIX] el stream se abre solo si la cámara arranca activa
        "personas":       {},
        "alerta":         False,
        "texto":          "",
        "hasta":          0,
        "ultimo_frame":    None,
        # [SALUD] Seguimiento del estado real del stream (basado en frames).
        # Se actualiza en el loop principal: online cuando llegan frames,
        # offline si pasan >15s sin ninguno.
        "ultimo_frame_ok":  None,   # timestamp del ultimo frame exitoso
        "estado_reportado": None,   # ultimo estado enviado a la DB
        # [DB] Arranca encendida solo la que tiene análisis profundo (LLaVA).
        #      La "solo_yolo" inicia apagada y se prende con la tecla 'C' (como antes).
        "activa":         cfg["modo_analisis"] == "yolo_llava",
    }
    # [FIX] Solo abrimos el RTSP si la cámara arranca activa — así evitamos
    #      el timeout de 30s al inicio para las cámaras que arrancan apagadas.
    if cam_obj["activa"]:
        cam_obj["vs"] = VideoStream(cam_obj["url_rtsp"]).start()
    camaras.append(cam_obj)

time.sleep(2) # Esperar a que los streams conecten

# [SALUD] Limpiar estados residuales de sesiones anteriores.
# Las cámaras inactivas (solo_yolo, activa=False) nunca pasan por el loop
# principal, así que su estado_salud en la DB puede quedar en 'online'
# de una sesión previa. Lo marcamos offline explícitamente al arrancar.
for cam in camaras:
    if not cam["activa"] and cam["id_db"]:
        db.actualizar_salud_camara(
            cam["id_db"], estado="offline",
            error_msg="Cámara inactiva al arrancar el detector",
        )
        print(f"[SALUD] {cam['nombre']} → offline (inactiva al arrancar)")

frame_count = 0
alertas_totales = 0

print("\n[CONTROLES]")
print("- Presiona 'Q' para salir del sistema.")
print("- Presiona 'C' para encender/apagar la Camara_Principal (Modo Ultrarrápido YOLO).")
print("\nMonitoreando cámaras...")

while True:
    frame_count += 1
    procesar_ia = (frame_count % PROCESAR_CADA_N_FRAMES == 0)

    for cam in camaras:
        # Si la cámara está apagada, saltamos el procesamiento para no gastar CPU
        if not cam["activa"]:
            continue

        frame = cam["vs"].read()
        if frame is None:
            # [SALUD] Si la camara alguna vez entrego frames pero ahora lleva
            # mas de 15s sin datos → marcar offline en la DB.
            if (
                cam["ultimo_frame_ok"] is not None
                and time.time() - cam["ultimo_frame_ok"] > 15
                and cam["estado_reportado"] != "offline"
                and cam["id_db"]
            ):
                cam["estado_reportado"] = "offline"
                db.actualizar_salud_camara(
                    cam["id_db"], estado="offline",
                    error_msg="Sin frames del stream >15s",
                )
                print(f"[SALUD] {cam['nombre']} → offline (sin frames)")
            continue

        # [SALUD] Frame OK → si no estaba online, actualizamos la DB.
        cam["ultimo_frame_ok"] = time.time()
        if cam["estado_reportado"] != "online" and cam["id_db"]:
            cam["estado_reportado"] = "online"
            db.actualizar_salud_camara(cam["id_db"], estado="online")
            print(f"[SALUD] {cam['nombre']} → online (frames OK)")

        annotated_frame = frame.copy()

        if procesar_ia:
            inicio_yolo = time.time()  # [DB] medimos latencia de YOLO
            # Optimizamos YOLO para que busque solo humanos (classes=[0])
            results = model.track(frame, persist=True, imgsz=640, verbose=False, conf=CONFIANZA_VISUAL, classes=[0])
            latencia_yolo_ms = int((time.time() - inicio_yolo) * 1000)  # [DB]

            # [SALUD] stats compartidos para el heartbeat de YOLO
            _salud_stats["latencia_yolo_ms"] = latencia_yolo_ms
            _salud_stats["frames_procesados"] += 1

            if len(results) > 0 and results[0].boxes is not None:
                annotated_frame = results[0].plot(line_width=3, font_size=1.2)
                cam["ultimo_frame"] = annotated_frame.copy()
                detecciones = results[0].boxes
            else:
                detecciones = []
                if cam["ultimo_frame"] is not None: annotated_frame = cam["ultimo_frame"].copy()

            ids_detectados = set()

            # [DB] Acumuladores para persistencia ATÓMICA del frame
            #      (un evento por frame-con-alerta, N detecciones, 1 alerta por id_rastreo nuevo)
            todas_detecciones_bbox = []
            nuevas_personas = []  # [(track_id, conf), ...]

            if len(detecciones) > 0:
                h_frame, w_frame = frame.shape[:2]  # [DB] dimensiones para el evento

                for d in detecciones:
                    cls = int(d.cls[0])
                    conf = float(d.conf[0])

                    if model.names[cls] == 'person' and conf >= CONFIANZA_ALERTA:
                        track_id = int(d.id[0]) if d.id is not None else None
                        if track_id is None: continue

                        ids_detectados.add(track_id)

                        # [DB] Extraer bbox normalizado (xywhn → center x/y, w, h en 0-1)
                        bbox_dict = None
                        try:
                            cx, cy, bw, bh = d.xywhn[0].tolist()
                            bbox_dict = {
                                "clase_nombre": "person",
                                "clase_id":     cls,
                                "confianza":    round(conf, 4),
                                "bbox_x":       round(max(0.0, cx - bw / 2), 5),
                                "bbox_y":       round(max(0.0, cy - bh / 2), 5),
                                "bbox_w":       round(bw, 5),
                                "bbox_h":       round(bh, 5),
                                "id_rastreo":   track_id,
                            }
                            todas_detecciones_bbox.append(bbox_dict)
                        except Exception as e:
                            print(f"[DB] No pude extraer bbox: {e}")

                        if track_id not in cam["personas"]:
                            # [REDIS] Cooldown global de CREACION de alerta por
                            # camara. Evita spam cuando una persona aparece y
                            # desaparece varias veces, o cuando YOLO le asigna
                            # un track_id nuevo a la misma persona. El track se
                            # sigue registrando en cam["personas"] para no
                            # romper la logica de FRAMES_AUSENCIA.
                            if cache.cooldown_activo(cam["nombre"], "alerta_db"):
                                # [DEBUG COOLDOWN] log temporal para verificar que dispara
                                restante = cache.cooldown_restante_s(cam["nombre"], "alerta_db")
                                print(f"[COOLDOWN] BLOQUEADO {cam['nombre']} track_id={track_id} restante={restante}s")
                                cam["personas"][track_id] = 0
                                continue

                            cache.set_cooldown(cam["nombre"], "alerta_db",
                                               ttl_s=ALERT_COOLDOWN_S)
                            print(f"[COOLDOWN] SET {cam['nombre']} ttl={ALERT_COOLDOWN_S}s")

                            cam["personas"][track_id] = 0
                            alertas_totales += 1
                            _salud_stats["alertas_totales"] = alertas_totales  # [SALUD]
                            _salud_stats["frames_con_personas"] += 1            # [SALUD]
                            ts_alerta = datetime.now().strftime("%H:%M:%S")
                            print(f"\n[{ts_alerta}] [ALERTA #{alertas_totales} | {cam['nombre']}] Persona ID: {track_id} | Certeza: {conf:.0%}")

                            cam["alerta"] = True
                            cam["texto"] = f"ALERTA #{alertas_totales}: PERSONA DETECTADA"
                            cam["hasta"] = time.time() + DURACION_ALERTA_SEG

                            nuevas_personas.append((track_id, conf))  # [DB]
                        else:
                            cam["personas"][track_id] = 0

                # [DB] --- PERSISTENCIA: un evento por frame con al menos 1 persona NUEVA ---
                evento_id = None
                alerta_principal_id = None  # la primera alerta creada en este frame → la que vincula LLaVA

                if nuevas_personas and cam["id_db"]:
                    # [MINIO] Subimos el frame anotado (con bboxes) antes de
                    #         insertar el evento. Si falla, el evento igual
                    #         queda — solo con snapshot_key=NULL.
                    snapshot_key = storage.upload_snapshot(
                        annotated_frame,
                        camara_nombre=cam["nombre"],
                        anotado=True,
                    )

                    evento_id = db.guardar_evento(
                        camara_id=cam["id_db"],
                        capturado_en=datetime.now(timezone.utc),
                        cantidad_personas=len(todas_detecciones_bbox),
                        latencia_yolo_ms=latencia_yolo_ms,
                        frame_width=w_frame,
                        frame_height=h_frame,
                        modelo_yolo="yolov8n",
                        snapshot_key=snapshot_key,
                        snapshot_anotado=bool(snapshot_key),
                    )
                    if snapshot_key:
                        print(f"[MINIO] Snapshot subido: {snapshot_key}")
                    if evento_id and todas_detecciones_bbox:
                        db.guardar_detecciones(evento_id, todas_detecciones_bbox)

                    # Una alerta por persona nueva
                    for (track_id, conf) in nuevas_personas:
                        resultado_alerta = db.crear_alerta(
                            evento_id=evento_id,
                            camara_id=cam["id_db"],
                            id_rastreo=track_id,
                            titulo=f"Persona detectada en {cam['nombre']}",
                            severidad="alta",
                            mensaje=f"YOLO conf={conf:.0%} id_rastreo={track_id}",
                        )
                        if resultado_alerta:
                            alerta_db_id, numero_alerta = resultado_alerta
                            print(f"[DB] Evento={evento_id} Alerta#{numero_alerta} ({alerta_db_id[:8]}...)")
                            if alerta_principal_id is None:
                                alerta_principal_id = alerta_db_id

                            # [REDIS PUBSUB] Opcion D: publicamos una alerta
                            # PROVISIONAL con texto YOLO para que el frontend
                            # la muestre YA, sin esperar los ~80s de LLaVA.
                            # Cuando LLaVA termine, _procesar() vuelve a publicar
                            # con descripcion enriquecida (mismo alerta_num).
                            try:
                                cache.publish_alerta({
                                    "tipo":        "yolo",
                                    "camara":      cam["nombre"],
                                    "zona":        cam.get("contexto_zona"),
                                    "nivel":       "medio",  # provisional
                                    "personas":    len(todas_detecciones_bbox),
                                    "descripcion": "Persona detectada (analizando...)",
                                    "acciones":    "",
                                    "sospechoso":  False,
                                    "alerta_num":  numero_alerta,
                                    "evento_id":   evento_id,
                                    "ts":          time.time(),
                                })
                            except Exception:
                                pass

                # [DB] --- ANÁLISIS PROFUNDO: ahora controlado por modo_analisis (no por nombre) ---
                #      Antes era: if cam["nombre"] == "Camara_Sonoff"
                # [COLA] Ya no hace falta chequear si LLaVA está ocupado:
                #        analizador.analizar() encola y el worker consume 1 a 1.
                # [REDIS] Cooldown inteligente: si la escena NO cambió (mismas
                #         personas visibles) y hay cooldown activo, salteamos
                #         LLaVA. Si Redis está caído, get/cooldown devuelven
                #         None/False y el sistema vuelve al comportamiento viejo.
                if nuevas_personas and cam["modo_analisis"] == "yolo_llava":
                    personas_visibles = len(ids_detectados)
                    estado_prev = cache.get_estado_camara(cam["nombre"])

                    saltar_llava = False
                    if (cache.cooldown_activo(cam["nombre"], "analisis")
                            and estado_prev
                            and estado_prev.get("personas") == personas_visibles):
                        restante = cache.cooldown_restante_s(cam["nombre"], "analisis")
                        nivel_prev = estado_prev.get("nivel", "?")
                        print(f"[REDIS] Skip LLaVA en {cam['nombre']} "
                              f"(cooldown {restante}s, último nivel={nivel_prev}, "
                              f"{personas_visibles} persona(s))")
                        saltar_llava = True

                    if not saltar_llava:
                        # Cooldown "in-flight" para evitar pile-up mientras
                        # LLaVA está corriendo (~76-135s). El _procesar() lo
                        # sobreescribe con un TTL más fino cuando termina.
                        cache.set_cooldown(cam["nombre"], "analisis", ttl_s=90)
                        analizador.analizar(
                            frame.copy(),
                            alertas_totales,
                            zona=cam["contexto_zona"],
                            evento_id=evento_id,              # [DB]
                            alerta_id=alerta_principal_id,    # [DB]
                            camara_nombre=cam["nombre"],      # [REDIS]
                        )

            # [REDIS] Publicar bboxes en realtime al canal "detecciones".
            # El throttle interno del cache deja max ~5 fps por camara, asi que
            # podemos llamarlo en cada frame sin saturar a Redis.
            # Coordenadas ya normalizadas (0..1) para que el frontend escale.
            try:
                boxes_publish = [
                    {
                        "id":    b["id_rastreo"],
                        "label": b["clase_nombre"],
                        "conf":  b["confianza"],
                        "x":     b["bbox_x"],
                        "y":     b["bbox_y"],
                        "w":     b["bbox_w"],
                        "h":     b["bbox_h"],
                    }
                    for b in todas_detecciones_bbox
                ]
                cache.publish_detecciones(cam["nombre"], boxes_publish)
            except Exception as e:
                # No queremos que un fallo de Redis frene el detector
                pass

            # Limpieza de IDs de personas que ya no están en la imagen
            for tid in list(cam["personas"].keys()):
                if tid not in ids_detectados:
                    cam["personas"][tid] += 1
                    if cam["personas"][tid] >= FRAMES_AUSENCIA:
                        del cam["personas"][tid]
        else:
            if cam["ultimo_frame"] is not None:
                annotated_frame = cam["ultimo_frame"].copy()

        # Dibujar cartel rojo de alerta
        if cam["alerta"]:
            if time.time() < cam["hasta"]:
                cv2.rectangle(annotated_frame, (0, 0), (annotated_frame.shape[1], 55), (0, 0, 200), -1)
                cv2.putText(annotated_frame, cam["texto"], (15, 38), cv2.FONT_HERSHEY_DUPLEX, 1.1, (255, 255, 255), 2)
            else:
                cam["alerta"] = False

        # Redimensionar y mostrar ventana
        frame_redimensionado = cv2.resize(annotated_frame, (640, 480))
        cv2.imshow(f'Sistema de Vigilancia IA - {cam["nombre"]}', frame_redimensionado)

    # --- CONTROLES INTERACTIVOS ---
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('c'):
        for cam in camaras:
            if cam["nombre"] == "Camara_Principal":
                cam["activa"] = not cam["activa"]
                if cam["activa"]:
                    # [FIX] Lazy-start: abrimos el RTSP solo al prender la camara
                    if cam["vs"] is None:
                        print("\n[INFO] Abriendo stream de Camara_Principal...")
                        cam["vs"] = VideoStream(cam["url_rtsp"]).start()
                    print("\n[INFO] Camara_Principal ENCENDIDA (Modo YOLO Rapido).")
                else:
                    print("\n[INFO] Camara_Principal APAGADA.")
                    cv2.destroyWindow(f'Sistema de Vigilancia IA - {cam["nombre"]}')

# =============================================================================
# CLEANUP AL SALIR
# =============================================================================
print("\n[INFO] Cerrando recursos...")
for cam in camaras:
    if cam.get("vs"):
        try: cam["vs"].stop()
        except Exception: pass
    if cam.get("id_db"):
        try: db.actualizar_salud_camara(cam["id_db"], estado="offline")
        except Exception: pass

cv2.destroyAllWindows()

try:
    if _hb_detector: _hb_detector.stop()
    if _hb_yolo:     _hb_yolo.stop()
except Exception:
    pass

try:
    reportar_salud("detector", "offline")
    reportar_salud("yolo",     "offline")
except Exception:
    pass

try:
    cache.cerrar()
    db.cerrar()
except Exception:
    pass

print("[OK] Detector cerrado limpiamente.")
