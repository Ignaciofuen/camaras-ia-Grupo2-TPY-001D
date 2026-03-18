from ultralytics import YOLO
import cv2

model = YOLO('yolov8n.pt')
stream_url = 'rtsp://localhost:8554/camara1'

print('Conectando al stream...')
cap = cv2.VideoCapture(stream_url)

if not cap.isOpened():
    print('ERROR: No se pudo conectar al stream')
    exit(1)

print('Stream conectado. Detectando...')
frame_count = 0

while frame_count < 10:
    ret, frame = cap.read()
    if not ret:
        break
    
    results = model(frame, verbose=False)
    frame_count += 1
    
    for r in results:
        for box in r.boxes:
            nombre = model.names[int(box.cls)]
            confianza = box.conf.item()
            if confianza > 0.4:
                print(f'Frame {frame_count} | {nombre} | {confianza:.0%}')

cap.release()
print('Listo - procesados 10 frames')
