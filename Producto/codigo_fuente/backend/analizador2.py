"""
analizador2.py · Analizador LLaVA orientado a seguridad
=======================================================
Variante especializada en DETECCIÓN DE AMENAZAS.
A diferencia de analizador.py (que es genérico y rápido), este pide a
LLaVA que clasifique la escena buscando triggers concretos:
  - Armas visibles (cuchillo, arma de fuego, machete, palo, bate).
  - Cara cubierta (capucha puesta, pasamontañas, barbijo/bufanda tapando).
  - Trepar, forzar puertas, correr con objetos, peleas.

Costos respecto al original:
  - ~40-60% más tiempo de inferencia por el prompt más largo
    y la imagen más grande (320x240 vs 256x192).
  - Más falsos positivos (el trade-off por mayor sensibilidad).

Uso:
  from analizador2 import analizar_frame
  resultado = analizar_frame(frame, contexto="Camara_Sonoff")

Retorna el mismo shape que analizador.py para que sea drop-in compatible:
  {sospechoso, nivel, descripcion, personas, acciones, zona, tiempo_analisis}
"""

import requests
import base64
import cv2
import json
import time

# [SALUD] Reportes de heartbeat para el servicio LLaVA
try:
    from salud import reportar as reportar_salud
except Exception:
    def reportar_salud(*args, **kwargs):  # fallback no-op
        pass

OLLAMA_URL = "http://localhost:11434/api/generate"
MODELO = "llava"

# [TUNING v2 · CPU-friendly]
#   Timeout subido a 360s. En CPU, LLaVA 7B con la imagen 320x240
#   y el prompt largo puede pasarse de 200s puntualmente (carga del
#   sistema, primera inferencia post-arranque, etc.). 360s deja
#   margen sin colgar el detector.
#   Si tu maquina tiene GPU NVIDIA con CUDA, podes bajarlo a 60s.
TIMEOUT = 360

# [TUNING v2] Imagen más grande que la del analizador original
#   para poder ver armas chicas (cuchillos, pistolas) y rasgos finos
#   como capucha/cara tapada. Costo: ~95-135s por análisis.
#   Si ves que LLaVA empieza a lentear demasiado, bajá a (256, 192).
FRAME_ANCHO  = 320
FRAME_ALTO   = 240
JPEG_QUALITY = 80


def frame_a_base64(frame):
    frame_reducido = cv2.resize(frame, (FRAME_ANCHO, FRAME_ALTO))
    _, buffer = cv2.imencode('.jpg', frame_reducido, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    return base64.b64encode(buffer).decode('utf-8')


def analizar_frame(frame, contexto="camara de seguridad"):
    imagen_b64 = frame_a_base64(frame)
    inicio = time.time()

    prompt = """You are a security camera analyst.
ALL your text output MUST be written in SPANISH. No English words.

Respond with ONE JSON object that contains EXACTLY these 5 keys (no more, no less):
"sospechoso", "nivel", "descripcion", "personas", "acciones".
Omitting any key is a failure. Extra keys are forbidden.

Expected shape:
{"sospechoso": false, "nivel": "bajo", "descripcion": "texto en español", "personas": 0, "acciones": "texto en español"}

Set "sospechoso": true AND "nivel": "alto" if you see ANY of:
- A weapon visible: knife, gun, pistol, machete, bat, stick used as weapon.
- A person with face COVERED: hood pulled up over head, ski mask, balaclava, scarf covering face.
- A person CLIMBING a fence, wall, window, or gate.
- A person RUNNING while carrying an object.
- Someone FORCING a door, window, or lock (pushing, prying, breaking).
- Aggressive physical contact between people (fighting, grabbing, pushing).

Set "nivel": "medio" if:
- Unknown person lingering, loitering, or looking around nervously.
- Person peeking into windows or doors.
- Group of 3 or more unknown people gathered closely.
- Person carrying a large bag or package in an unusual way.

Otherwise set "sospechoso": false and "nivel": "bajo".

RULES (strict):
1. "descripcion" written in SPANISH, MAX 15 words. MUST explicitly mention any weapon, hood, or mask if visible.
2. "acciones" written in SPANISH, MAX 8 words. Describe what the person(s) are doing. Never leave empty.
3. "personas" = integer count of humans visible in the frame.
4. "nivel" MUST be one of: "alto", "medio", "bajo" (Spanish, lowercase).
5. Return ONLY the JSON object. No prose, no markdown, no code fences."""

    try:
        print(f"  [v2-seguridad] Analizando escena ({contexto})...")

        response = requests.post(OLLAMA_URL, json={
            "model": MODELO,
            "prompt": prompt,
            "images": [imagen_b64],
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.0,
                "num_predict": 180,      # respuesta de hasta ~180 tokens, suficiente para el JSON
                "num_ctx": 1024,         # baja de 2048 -> 1024: ahorra ~30% de tiempo en CPU
                "seed": 42
            }
        }, timeout=TIMEOUT)

        tiempo = time.time() - inicio
        texto = response.json().get('response', '{}').strip()

        print(f"  [v2] Respuesta en {tiempo:.1f}s")
        print(f"  [v2] Raw: {texto[:120]}")

        inicio_json = texto.find('{')
        fin_json = texto.rfind('}') + 1

        if inicio_json >= 0:
            resultado = json.loads(texto[inicio_json:fin_json])

            descripcion = resultado.get("descripcion", resultado.get("description", "sin descripción"))
            acciones = resultado.get("acciones", resultado.get("actions", "sin datos"))
            nivel = resultado.get("nivel", resultado.get("level", "bajo")).lower()

            if nivel not in ["alto", "medio", "bajo"]:
                nivel = "bajo"

            # [SALUD] LLaVA respondió OK → online
            reportar_salud(
                "llava", "online",
                latencia_ms=int(tiempo * 1000),
                metrica={"modelo": MODELO, "analizador": "v2", "nivel": nivel,
                         "personas": int(resultado.get("personas", 0) or 0)},
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

        reportar_salud("llava", "degradado", error_msg="json no encontrado en respuesta")
        return _resultado_vacio(contexto, "json no encontrado")

    except requests.exceptions.Timeout:
        print(f"  [v2] Timeout después de {TIMEOUT}s")
        reportar_salud("llava", "degradado", error_msg=f"timeout {TIMEOUT}s")
        return _resultado_vacio(contexto, "timeout")

    except json.JSONDecodeError as e:
        print(f"  [v2] Error JSON: {e}")
        reportar_salud("llava", "degradado", error_msg=f"json decode: {e}")
        return _resultado_vacio(contexto, "error json")

    except Exception as e:
        print(f"  [v2] Error: {e}")
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
