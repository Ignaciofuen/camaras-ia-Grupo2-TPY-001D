from ultralytics import YOLO
import cv2

model = YOLO('yolov8s.pt')

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print('ERROR: No se encontró webcam')
    exit(1)

print('Webcam conectada. Presiona Q para salir.')

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_small = cv2.resize(frame, (416, 416))
    results = model(frame_small, verbose=False)
    annotated = results[0].plot()

    cv2.imshow('Camara IA - YOLO', annotated)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()