import cv2
import time
import threading
import os
import re
import subprocess
from ultralytics import YOLO
from analizador import analizar_frame

# --- CONFIGURACIÓN DE RED AUTOMÁTICA (NIVEL PRO) ---
MAC_CAMARA = "08:EA:40:54:9B:F5"  # La MAC de tu cámara
USUARIO_CAMARA = "admin"
PASSWORD_CAMARA = "123456"
BASE_IP = "192.168.1."  # Cambia a "192.168.0." si tu red lo requiere

def hacer_ping(ip):
    # Envía un solo paquete muy rápido (200ms de tiempo de espera) silenciando la salida
    subprocess.run(['ping', '-n', '1', '-w', '200', ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def despertar_red(base_ip):
    print("Enviando pulso de red para despertar dispositivos (1-2 segundos)...")
    hilos = []
    # Escaneamos de la IP 1 a la 254 al mismo tiempo
    for i in range(1, 255):
        ip = f"{base_ip}{i}"
        hilo = threading.Thread(target=hacer_ping, args=(ip,), daemon=True)
        hilos.append(hilo)
        hilo.start()
    
    # Esperamos a que todos los mensajes terminen
    for hilo in hilos:
        hilo.join()

def obtener_ip_camara(mac_address):
    mac_windows = mac_address.replace(':', '-').lower()
    try:
        resultado = os.popen('arp -a').read()
        for linea in resultado.split('\n'):
            if mac_windows in linea.lower():
                ip = re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', linea)
                if ip:
                    return ip.group(0)
    except Exception as e:
        print(f"Error al leer la tabla ARP: {e}")
    return None

# 1. Despertamos a la cámara
despertar_red(BASE_IP)

# 2. Ahora sí buscamos su MAC en la memoria fresca de Windows
print("Buscando la cámara...")
ip_encontrada = obtener_ip_camara(MAC_CAMARA)

if ip_encontrada:
    print(f"✅ Cámara encontrada automáticamente en IP: {ip_encontrada}")
    STREAM_URL = f'rtsp://{USUARIO_CAMARA}:{PASSWORD_CAMARA}@{ip_encontrada}:554/live/ch0'
else:
    print("❌ No se encontró la cámara. Usando IP de respaldo (192.168.1.15)...")
    STREAM_URL = 'rtsp://admin:123456@192.168.1.15:554/live/ch0'
# ---------------------------------------

MODELO_PATH = 'yolov8n.pt'
CONFIANZA_VISUAL = 0.45
CONFIANZA_ALERTA = 0.67
PROCESAR_CADA_N_FRAMES = 2
DURACION_ALERTA_SEG = 5
FRAMES_AUSENCIA = 92

class VideoStream:
    def __init__(self, src):
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
                print("Reconectando camara...")
                self.cap.open(STREAM_URL)
                time.sleep(1)
            else:
                with self.lock:
                    self.frame = frame

    def read(self):
        with self.lock:
            return self.frame.copy()

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

    def analizar(self, frame, alerta_num):
        with self.lock:
            if self.analizando:
                return
            self.analizando = True

        def tarea():
            try:
                print(f"\n[LLaVA] Analizando alerta #{alerta_num}...")
                resultado = analizar_frame(frame, contexto="camara de seguridad")
                print(f"\n{'='*45}")
                print(f"  ANÁLISIS ALERTA #{alerta_num}")
                print(f"{'='*45}")
                print(f"  Sospechoso:  {resultado['sospechoso']}")
                print(f"  Nivel:       {resultado['nivel'].upper()}")
                print(f"  Personas:    {resultado['personas']}")
                print(f"  Acciones:    {resultado['acciones']}")
                print(f"  Descripcion: {resultado['descripcion']}")
                print(f"  Tiempo:      {resultado.get('tiempo_analisis', 'N/A')}s")
                print(f"{'='*45}\n")
            finally:
                with self.lock:
                    self.analizando = False

        threading.Thread(target=tarea, daemon=True).start()

print("--- Iniciando Sistema de Vigilancia Inteligente ---")
model = YOLO(MODELO_PATH)

try:
    model.to('cuda')
    print("Estado: GPU")
except:
    print("Estado: CPU")

vs = VideoStream(STREAM_URL).start()
analizador = AnalizadorAsync()
time.sleep(1)

frame_count = 0
alertas_totales = 0
ultimo_annotated = None
alerta_activa = False
alerta_texto = ""
alerta_hasta = 0
personas_activas = {}

print("Presiona 'Q' para cerrar la ventana.")

while not vs.stopped:
    frame = vs.read()
    if frame is None:
        continue

    frame_count += 1

    if frame_count % PROCESAR_CADA_N_FRAMES == 0:
        results = model.track(frame, persist=True, imgsz=640, verbose=False, conf=CONFIANZA_VISUAL)
        
        # Validación extra para evitar errores si results viene vacío o sin gráfica
        if len(results) > 0 and results[0].boxes is not None:
            annotated_frame = results[0].plot(line_width=3, font_size=1.2)
            ultimo_annotated = annotated_frame.copy()
            detecciones = results[0].boxes
        else:
            detecciones = []
            if ultimo_annotated is not None:
                annotated_frame = ultimo_annotated.copy()
            else:
                annotated_frame = frame.copy()

        ids_detectados = set()

        if len(detecciones) > 0:
            for d in detecciones:
                cls = int(d.cls[0])
                conf = float(d.conf[0])

                if model.names[cls] == 'person' and conf >= CONFIANZA_ALERTA:
                    track_id = int(d.id[0]) if d.id is not None else None
                    if track_id is None:
                        continue

                    ids_detectados.add(track_id)

                    if track_id not in personas_activas:
                        personas_activas[track_id] = 0
                        alertas_totales += 1
                        print(f"\n[ALERTA #{alertas_totales}] Nueva persona | ID: {track_id} | {conf:.0%}")

                        alerta_activa = True
                        alerta_texto = f"ALERTA #{alertas_totales}: NUEVA PERSONA"
                        alerta_hasta = time.time() + DURACION_ALERTA_SEG

                        # Lanza LLaVA solo si no está ocupado
                        if not analizador.esta_ocupado():
                            analizador.analizar(frame.copy(), alertas_totales)
                        else:
                            print(f"[INFO] LLaVA ocupado, saltando análisis de alerta #{alertas_totales}")
                    else:
                        personas_activas[track_id] = 0

        for tid in list(personas_activas.keys()):
            if tid not in ids_detectados:
                personas_activas[tid] += 1
                if personas_activas[tid] >= FRAMES_AUSENCIA:
                    del personas_activas[tid]
                    print(f"[INFO] Persona ID {tid} se fue")

    else:
        if ultimo_annotated is not None:
            annotated_frame = ultimo_annotated.copy()
        else:
            annotated_frame = frame.copy()

    if alerta_activa:
        if time.time() < alerta_hasta:
            cv2.rectangle(annotated_frame, (0, 0), (annotated_frame.shape[1], 55), (0, 0, 200), -1)
            cv2.putText(annotated_frame, alerta_texto, (15, 38),
                        cv2.FONT_HERSHEY_DUPLEX, 1.1, (255, 255, 255), 2)
        else:
            alerta_activa = False

    cv2.imshow('Camara IA - YOLO', annotated_frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

print("Cerrando sistema...")
vs.stop()
cv2.destroyAllWindows()