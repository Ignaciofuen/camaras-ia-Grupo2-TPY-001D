import cv2
import time
import threading
from ultralytics import YOLO

MODELO_PATH = 'yolov8n.pt'
STREAM_URL = ''

CONFIANZA_VISUAL = 0.45
CONFIANZA_ALERTA = 0.60
PROCESAR_CADA_N_FRAMES = 2
DURACION_ALERTA_SEG = 5
FRAMES_AUSENCIA = 30  # frames sin ver a alguien para olvidar su ID

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

print("--- Iniciando Sistema de Vigilancia Inteligente ---")
model = YOLO(MODELO_PATH)

try:
    model.to('cuda')
    print("Estado: GPU")
except:
    print("Estado: CPU")

vs = VideoStream(STREAM_URL).start()
time.sleep(1)

frame_count = 0
alertas_totales = 0
ultimo_annotated = None
alerta_activa = False
alerta_texto = ""
alerta_hasta = 0

# {track_id: frames_sin_ver} — personas actualmente en pantalla
personas_activas = {}

print("Presiona 'Q' para cerrar la ventana.")

while not vs.stopped:
    frame = vs.read()
    if frame is None:
        continue

    frame_count += 1

    if frame_count % PROCESAR_CADA_N_FRAMES == 0:
        results = model.track(frame, persist=True, imgsz=640, verbose=False, conf=CONFIANZA_VISUAL)
        annotated_frame = results[0].plot(line_width=3, font_size=1.2)
        ultimo_annotated = annotated_frame.copy()

        detecciones = results[0].boxes
        ids_detectados = set()

        if detecciones is not None and len(detecciones) > 0:
            for d in detecciones:
                cls = int(d.cls[0])
                conf = float(d.conf[0])

                if model.names[cls] == 'person' and conf >= CONFIANZA_ALERTA:
                    track_id = int(d.id[0]) if d.id is not None else None
                    if track_id is None:
                        continue

                    ids_detectados.add(track_id)

                    # Persona nueva — no estaba en activas
                    if track_id not in personas_activas:
                        personas_activas[track_id] = 0
                        alertas_totales += 1
                        print(f"ALERTA #{alertas_totales} | Nueva persona | ID: {track_id} | {conf:.0%}")
                        alerta_activa = True
                        alerta_texto = f"ALERTA #{alertas_totales}: NUEVA PERSONA"
                        alerta_hasta = time.time() + DURACION_ALERTA_SEG
                    else:
                        # Resetea contador de ausencia
                        personas_activas[track_id] = 0

        # Incrementa ausencia de personas no detectadas
        for tid in list(personas_activas.keys()):
            if tid not in ids_detectados:
                personas_activas[tid] += 1
                # Si lleva suficientes frames sin verse → olvidar
                if personas_activas[tid] >= FRAMES_AUSENCIA:
                    del personas_activas[tid]
                    print(f"Persona ID {tid} se fue")

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
