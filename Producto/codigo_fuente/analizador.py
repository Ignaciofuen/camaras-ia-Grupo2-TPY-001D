import requests
import base64
import cv2
import json
import time

OLLAMA_URL = "http://localhost:11434/api/generate"
MODELO = "llava"
TIMEOUT = 200

def frame_a_base64(frame):
    frame_reducido = cv2.resize(frame, (320, 240))
    _, buffer = cv2.imencode('.jpg', frame_reducido, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return base64.b64encode(buffer).decode('utf-8')

def analizar_frame(frame, contexto="camara de seguridad"):
    imagen_b64 = frame_a_base64(frame)
    inicio = time.time()

    prompt = """Describe what you see in this image as JSON:
{"sospechoso": false, "nivel": "bajo", "descripcion": "escena descrita", "personas": 1, "acciones": "actividades"}
Respond only with the JSON, in Spanish. 
RULES:
1. "descripcion" MUST be extremely short (MAXIMUM 10 WORDS).
2. "acciones" MUST be extremely short (MAXIMUM 6 WORDS)."""

    try:
        print(f"  Analizando escena ({contexto})...")

        response = requests.post(OLLAMA_URL, json={
            "model": MODELO,
            "prompt": prompt,
            "images": [imagen_b64],
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.0,
                "num_predict": 150,
                "num_ctx": 1024,
                "seed": 42
            }
        }, timeout=TIMEOUT)

        tiempo = time.time() - inicio
        texto = response.json().get('response', '{}').strip()

        print(f"  Respuesta en {tiempo:.1f}s")
        print(f"  Raw: {texto[:120]}")

        inicio_json = texto.find('{')
        fin_json = texto.rfind('}') + 1

        if inicio_json >= 0:
            resultado = json.loads(texto[inicio_json:fin_json])

            descripcion = resultado.get("descripcion", resultado.get("description", "sin descripción"))
            acciones = resultado.get("acciones", resultado.get("actions", "sin datos"))
            nivel = resultado.get("nivel", resultado.get("level", "bajo")).lower()

            if nivel not in ["alto", "medio", "bajo"]:
                nivel = "bajo"

            return {
                "sospechoso": bool(resultado.get("sospechoso", resultado.get("suspicious", False))),
                "nivel": nivel,
                "descripcion": descripcion,
                "personas": int(resultado.get("personas", resultado.get("people", 0))),
                "acciones": acciones,
                "zona": contexto,
                "tiempo_analisis": round(tiempo, 1)
            }

        return _resultado_vacio(contexto, "json no encontrado")

    except requests.exceptions.Timeout:
        print(f"  Timeout después de {TIMEOUT}s")
        return _resultado_vacio(contexto, "timeout")

    except json.JSONDecodeError as e:
        print(f"  Error JSON: {e}")
        return _resultado_vacio(contexto, "error json")

    except Exception as e:
        print(f"  Error: {e}")
        return _resultado_vacio(contexto, str(e))

def _resultado_vacio(contexto, motivo):
    return {
        "sospechoso": False,
        "nivel": "bajo",
        "descripcion": f"sin análisis ({motivo})",
        "personas": 0,
        "acciones": "sin datos",
        "zona": contexto,
        "tiempo_analisis": 0
    }