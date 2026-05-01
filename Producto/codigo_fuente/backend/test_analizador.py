# --- path setup: permite importar modulos hermanos (base_datos/, backend/, telegram/) ---
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
for _sub in ("base_datos", "backend", "telegram"):
    _p = _os.path.join(_ROOT, _sub)
    if _p not in _sys.path:
        _sys.path.insert(0, _p)
# --- end path setup ---

from analizador import analizar_frame
import cv2
import os
import re
import threading
import subprocess

# --- CONFIGURACIÓN DE RED AUTOMÁTICA ---
MAC_CAMARA = "08:EA:40:54:9B:F5"
USUARIO_CAMARA = "admin"
PASSWORD_CAMARA = "123456"
BASE_IP = "192.168.1."

def hacer_ping(ip):
    subprocess.run(['ping', '-n', '1', '-w', '200', ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def despertar_red(base_ip):
    print("Enviando pulso de red para despertar cámara...")
    hilos = []
    for i in range(1, 255):
        ip = f"{base_ip}{i}"
        hilo = threading.Thread(target=hacer_ping, args=(ip,), daemon=True)
        hilos.append(hilo)
        hilo.start()
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
        pass
    return None

despertar_red(BASE_IP)
ip_encontrada = obtener_ip_camara(MAC_CAMARA)

if ip_encontrada:
    print(f"✅ Cámara encontrada en IP: {ip_encontrada}")
    stream_url = f'rtsp://{USUARIO_CAMARA}:{PASSWORD_CAMARA}@{ip_encontrada}:554/live/ch0'
else:
    print("❌ Cámara no encontrada. Usando respaldo (192.168.1.15)...")
    stream_url = 'rtsp://admin:123456@192.168.1.15:554/live/ch0'
# ---------------------------------------

print("\nConectando a camara...")
cap = cv2.VideoCapture(stream_url)

if not cap.isOpened():
    print("ERROR: No se pudo conectar")
    exit(1)

ret, frame = cap.read()
cap.release()

if not ret:
    print("ERROR: No se pudo capturar frame")
    exit(1)

print("Frame capturado. Enviando a LLaVA...")

resultado = analizar_frame(frame, contexto="oficina")

print(f"\n{'='*40}")
print("RESULTADO DEL ANÁLISIS")
print(f"{'='*40}")
print(f"  Sospechoso:  {resultado['sospechoso']}")
print(f"  Nivel:       {resultado['nivel'].upper()}")
print(f"  Personas:    {resultado['personas']}")
print(f"  Acciones:    {resultado['acciones']}")
print(f"  Descripcion: {resultado['descripcion']}")
# Usamos .get() por si acaso el diccionario no trae la llave 'zona' o 'tiempo_analisis' en este test
print(f"  Zona:        {resultado.get('zona', 'oficina')}")
print(f"  Tiempo:      {resultado.get('tiempo_analisis', 'N/A')}s")
print(f"{'='*40}")