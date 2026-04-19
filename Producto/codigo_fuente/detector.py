import cv2
import time
import threading
import os
import re
import subprocess
import socket
from ultralytics import YOLO
from analizador import analizar_frame # Importando el LLaVA estable

# --- CONFIGURACIÓN DE RED INTELIGENTE (MULTI-CÁMARA) ---

CONFIGURACION_CAMARAS = [
    {
        "nombre": "Camara_Principal",
        "mac": "08:EA:40:54:9B:F5",
        "usuario": "admin",
        "password": "123456",
        "ruta_rtsp": "live/ch0",
        "ip_respaldo": "192.168.1.15"
    },
    {
        "nombre": "Camara_Sonoff",
        "mac": "68:B9:D3:5C:CC:FC",
        "usuario": "rtsp",
        "password": "itqC6sAd",
        "ruta_rtsp": "av_stream/ch0",
        "ip_respaldo": "192.168.1.17"
    }
]

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
    ip = obtener_ip_camara(cam["mac"])
    if ip:
        print(f"[✅] {cam['nombre']} encontrada en IP: {ip}")
        enlaces_rtsp[cam["nombre"]] = f'rtsp://{cam["usuario"]}:{cam["password"]}@{ip}:554/{cam["ruta_rtsp"]}'
    else:
        print(f"[❌] {cam['nombre']} no encontrada. Usando IP de respaldo ({cam['ip_respaldo']})")
        enlaces_rtsp[cam["nombre"]] = f'rtsp://{cam["usuario"]}:{cam["password"]}@{cam["ip_respaldo"]}:554/{cam["ruta_rtsp"]}'

# --- CONFIGURACIÓN DE IA ---
MODELO_PATH = 'yolov8n.pt'
CONFIANZA_VISUAL = 0.45
CONFIANZA_ALERTA = 0.67
PROCESAR_CADA_N_FRAMES = 2
DURACION_ALERTA_SEG = 5
FRAMES_AUSENCIA = 92

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
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(1)
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
    def __init__(self):
        self.analizando = False
        self.lock = threading.Lock()

    def esta_ocupado(self):
        with self.lock:
            return self.analizando

    def analizar(self, frame, alerta_num, zona):
        with self.lock:
            if self.analizando: return
            self.analizando = True

        def tarea():
            try:
                print(f"\n[LLaVA] Analizando alerta #{alerta_num} de {zona}...")
                resultado = analizar_frame(frame, contexto=zona)
                print(f"\n{'='*45}\n  ANÁLISIS ALERTA #{alerta_num} | ZONA: {zona}\n{'='*45}")
                print(f"  Sospechoso:  {resultado.get('sospechoso', False)}")
                
                # Blindaje anti-errores al imprimir nivel
                nivel = str(resultado.get('nivel', 'desconocido'))
                print(f"  Nivel:       {nivel.upper()}")
                
                print(f"  Personas:    {resultado.get('personas', 1)}\n  Acciones:    {resultado.get('acciones', 'N/A')}")
                print(f"  Descripcion: {resultado.get('descripcion', 'N/A')}\n  Tiempo:      {resultado.get('tiempo_analisis', 'N/A')}s\n{'='*45}\n")
            finally:
                with self.lock:
                    self.analizando = False

        threading.Thread(target=tarea, daemon=True).start()

print("\n--- Iniciando Sistema Híbrido de Vigilancia ---")
model = YOLO(MODELO_PATH)
try:
    model.to('cuda')
    print("Estado: GPU")
except:
    print("Estado: CPU")

analizador = AnalizadorAsync()

# Diccionario maestro para manejar cámaras y sus ESTADOS
camaras = [
    {
        "nombre": "Camara_Principal", 
        "vs": VideoStream(enlaces_rtsp["Camara_Principal"]).start(), 
        "personas": {}, "alerta": False, "texto": "", "hasta": 0, "ultimo_frame": None,
        "activa": False # <--- INICIA APAGADA
    },
    {
        "nombre": "Camara_Sonoff", 
        "vs": VideoStream(enlaces_rtsp["Camara_Sonoff"]).start(), 
        "personas": {}, "alerta": False, "texto": "", "hasta": 0, "ultimo_frame": None,
        "activa": True  # <--- INICIA ENCENDIDA
    }
]

time.sleep(2) # Esperar a que los streams conecten
frame_count = 0
alertas_totales = 0

print("\n[CONTROLES]")
print("- Presiona 'Q' para salir del sistema.")
print("- Presiona 'C' para encender/apagar la Camara_Principal (Modo Ultrarrápido YOLO).")
print("\nMonitoreando Camara_Sonoff (Modo Análisis Profundo LLaVA)...")

while True:
    frame_count += 1
    procesar_ia = (frame_count % PROCESAR_CADA_N_FRAMES == 0)
    
    for cam in camaras:
        # Si la cámara está apagada, saltamos el procesamiento para no gastar CPU
        if not cam["activa"]:
            continue

        frame = cam["vs"].read()
        if frame is None:
            continue
            
        annotated_frame = frame.copy()

        if procesar_ia:
            # Optimizamos YOLO para que busque solo humanos (classes=[0])
            results = model.track(frame, persist=True, imgsz=640, verbose=False, conf=CONFIANZA_VISUAL, classes=[0])
            
            if len(results) > 0 and results[0].boxes is not None:
                annotated_frame = results[0].plot(line_width=3, font_size=1.2)
                cam["ultimo_frame"] = annotated_frame.copy()
                detecciones = results[0].boxes
            else:
                detecciones = []
                if cam["ultimo_frame"] is not None: annotated_frame = cam["ultimo_frame"].copy()

            ids_detectados = set()

            if len(detecciones) > 0:
                for d in detecciones:
                    cls = int(d.cls[0])
                    conf = float(d.conf[0])

                    if model.names[cls] == 'person' and conf >= CONFIANZA_ALERTA:
                        track_id = int(d.id[0]) if d.id is not None else None
                        if track_id is None: continue

                        ids_detectados.add(track_id)

                        if track_id not in cam["personas"]:
                            cam["personas"][track_id] = 0
                            alertas_totales += 1
                            print(f"\n[ALERTA #{alertas_totales} | {cam['nombre']}] Persona ID: {track_id} | Certeza: {conf:.0%}")

                            cam["alerta"] = True
                            cam["texto"] = f"ALERTA #{alertas_totales}: PERSONA DETECTADA"
                            cam["hasta"] = time.time() + DURACION_ALERTA_SEG

                            # --- LÓGICA DE INTELIGENCIA DIVIDIDA CORREGIDA ---
                            # LLaVA SOLO analiza si la alerta viene de la Camara_Sonoff
                            if cam["nombre"] == "Camara_Sonoff":
                                if not analizador.esta_ocupado():
                                    analizador.analizar(frame.copy(), alertas_totales, zona=cam["nombre"])
                                else:
                                    print(f"[INFO] LLaVA ocupado, saltando análisis profundo en {cam['nombre']}")
                            # Si es la Principal, no hacemos análisis (se queda solo con YOLO)

                        else:
                            cam["personas"][track_id] = 0

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
                    print("\n[INFO] Camara_Principal ENCENDIDA (Modo YOLO Rápido).")
                else:
                    print("\n[INFO] Camara_Principal APAGADA.")
                    cv2.destroyWindow(f'Sistema de Vigilancia IA - {cam["nombre"]}')

print("Cerrando sistema y conexiones...")
for cam in camaras:
    cam["vs"].stop()
cv2.destroyAllWindows()