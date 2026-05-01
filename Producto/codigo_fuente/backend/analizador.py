import requests
import base64
import cv2
import json
import time

# [SALUD] Reportes de heartbeat para el servicio LLaVA
try:
    from salud import reportar as reportar_salud
except Exception:
    def reportar_salud(*args, **kwargs):  # fallback no-op si salud.py no está
        pass

OLLAMA_URL = "http://localhost:11434/api/generate"
MODELO = "llava"
TIMEOUT = 200

# [TUNING] Analizador genérico / rápido.
#   Tamaño pensado para velocidad — ~76s de inferencia a 256x192.
#   Para detección de amenazas (armas, capucha, etc.) usar analizador2.py.
FRAME_ANCHO  = 256
FRAME_ALTO   = 192
JPEG_QUALITY = 75

def frame_a_base64(frame):
    frame_reducido = cv2.resize(frame, (FRAME_ANCHO, FRAME_ALTO))
    _, buffer = cv2.imencode('.jpg', frame_reducido, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
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

            # [SALUD] LLaVA respondió y entendimos el JSON → online
            reportar_salud(
                "llava", "online",
                latencia_ms=int(tiempo * 1000),
                metrica={"modelo": MODELO, "nivel": nivel, "personas": int(resultado.get("personas", 0) or 0)},
            )
            return {
                "sospechoso": bool(resultado.get("sospechoso", resultado.get("suspicious", False))),
                "nivel": nivel,
                "descripcion": descripcion,
                "personas": int(resultado.get("personas", resultado.get("people", 0))),
                "acciones": acciones,
                "zona": contexto,
                "tiempo_analisis": round(tiempo, 1)
            }

        # [SALUD] Respondió pero no encontramos JSON → degradado
        reportar_salud("llava", "degradado", error_msg="json no encontrado en respuesta")
        return _resultado_vacio(contexto, "json no encontrado")

    except requests.exceptions.Timeout:
        print(f"  Timeout después de {TIMEOUT}s")
        reportar_salud("llava", "degradado", error_msg=f"timeout {TIMEOUT}s")
        return _resultado_vacio(contexto, "timeout")

    except json.JSONDecodeError as e:
        print(f"  Error JSON: {e}")
        reportar_salud("llava", "degradado", error_msg=f"json decode: {e}")
        return _resultado_vacio(contexto, "error json")

    except Exception as e:
        print(f"  Error: {e}")
        # Connection refused / ollama caído → offline
        reportar_salud("llava", "offline", error_msg=str(e)[:200])
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