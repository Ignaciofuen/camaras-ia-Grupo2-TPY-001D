# Cámaras-IA

> **Sistema de videovigilancia con análisis IA en tiempo real**
> Detecta personas, vehículos y amenazas con YOLOv8 + LLaVA, envía alertas push y permite acceso remoto desde cualquier dispositivo.

[![Status](https://img.shields.io/badge/status-v1.0%20pilot-success)]()
[![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React%20%2B%20Docker-blue)]()
[![AI](https://img.shields.io/badge/AI-YOLOv8%20%2B%20LLaVA%207B-orange)]()
[![Cloud](https://img.shields.io/badge/cloud-Oracle%20Free%20Tier-red)]()
[![License](https://img.shields.io/badge/license-Educational-lightgrey)]()

---

## 🚀 Demo en vivo

**👉 [https://caviar-zit-jelly.ngrok-free.dev/](https://caviar-zit-jelly.ngrok-free.dev/)**

> ⚠️ **Nota:** la URL es un túnel ngrok del piloto académico. Si está caída, significa que la VM de Oracle no está disponible en ese momento. Para activarla nuevamente, contactar al autor.

**Credenciales de demo (rol visualizador):**
- Usuario: `demo@camaras-ia.local`
- Password: solicitar al autor
**Credenciales de demo (rol Administrador):**
- Usuario: `admin@alumnoduocuc.cl`
- Password: admincamarasllava01
  
---


---

## 🎯 Qué es Cámaras-IA

Cámaras-IA es un **sistema completo de videovigilancia inteligente** que toma cámaras IP existentes (cualquier modelo con RTSP) y les agrega:

- **Detección automática** de personas, vehículos y objetos con YOLOv8 en tiempo real
- **Análisis semántico** de la escena con LLaVA (modelo visión-lenguaje) que describe en lenguaje natural lo que está pasando
- **Alertas push** vía Telegram con foto + descripción
- **Dashboard web responsive** con video en vivo, bounding boxes, historial, playback y gestión de usuarios por rol
- **Túnel HTTPS seguro** para acceso remoto sin exponer la red del cliente

Diseñado para operadores de seguridad privada que quieren complementar su CCTV existente con IA sin comprar hardware nuevo.

---

## Características

### Para el operador
- 🎥 **Mosaico de cámaras** en vivo (1×1, 2×2, 3×3)
- 🤖 **Bounding boxes IA superpuestos** al video en tiempo real (SSE)
- 🚨 **Panel de alertas** con descripción semántica + snapshot
- 📸 **Snapshot manual + grabación con un clic**
- 📺 **Playback** de grabaciones desde MinIO
- 💬 **Notificaciones Telegram** push automáticas
- 📱 **Responsive** — funciona en celular y desktop

### Para el administrador
- 👥 **Gestión de usuarios** con 3 roles (admin / operador / visualizador)
- 📹 **CRUD de cámaras** con edición de credenciales RTSP sin reinicio
- 🩺 **Panel de Sistema** con heartbeats de cada servicio
- ⚙️ **Configuración dinámica** (umbrales IA, cooldown, modo de análisis)

### Bajo el capó
- 🔐 **JWT + RBAC** con bcrypt, expiración 24h
- 🐳 **Docker Compose** con 6 contenedores en una sola línea
- 🌐 **Arquitectura híbrida** Cloud + Edge — corre en Oracle Free Tier
- 🔄 **Túnel dinámico Cloudflare** auto-reportado a la DB
- ⚡ **LL-HLS** (Low-Latency HLS) — video con 1–2 s de retraso
- 📊 **PostgreSQL 16** con UUID + JSONB
- 🚀 **Redis pub/sub** para SSE de detecciones y alertas
- 💾 **MinIO** S3-compatible para snapshots y grabaciones

---

## 🏗️ Arquitectura

**Arquitectura híbrida en dos zonas:**

| Zona | Componentes | Responsabilidad |
|---|---|---|
| **PC Local del Cliente** | MediaMTX · Detector (YOLO + LLaVA) · Ollama · Cloudflared | Captura y procesa video |
| **Oracle Cloud (VM ARM Free)** | Postgres · Redis · MinIO · Backend FastAPI · Frontend Nginx · Telegram Worker | API, datos, dashboard, notificaciones |
| **Internet / Túneles** | TryCloudflare (video HLS) · ngrok (frontend HTTPS) | Acceso remoto seguro |



---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Backend** | FastAPI 0.115 · Python 3.11 · uvicorn · Pydantic 2 |
| **Frontend** | React 18 · Vite · Tailwind CSS · hls.js · axios |
| **Base de datos** | PostgreSQL 16 · UUID · JSONB · psycopg 3 |
| **Cache + PubSub** | Redis 7 |
| **Object storage** | MinIO (S3-compatible) |
| **Video server** | MediaMTX (RTSP / HLS / WebRTC) |
| **IA — Detección** | YOLOv8 (Ultralytics) |
| **IA — Visión-Lenguaje** | LLaVA 7B vía Ollama |
| **Túneles** | Cloudflared TryCloudflare · ngrok |
| **Contenedores** | Docker · Docker Compose |
| **Auth** | JWT (python-jose) · bcrypt |
| **Notificaciones** | Telegram Bot API |
| **Cloud** | Oracle Cloud Always Free (ARM A1.Flex 4 vCPU / 24 GB) |

---

## ⚡ Quick Start

### Pre-requisitos

- Docker + Docker Compose (en el servidor)
- Python 3.10+ (en la PC local del operador)
- MediaMTX, Cloudflared, Ollama+LLaVA (en la PC local)
- Cámaras IP con stream RTSP en la misma LAN que la PC local

### 1. Clonar el repositorio

```bash
git clone https://github.com/<tu-usuario>/camaras-ia.git
cd camaras-ia/Producto/codigo_fuente
```

### 2. Configurar variables de entorno

```bash
cp .env.production.example .env
nano .env   # editar passwords, JWT_SECRET, etc.
```

### 3. Levantar el stack en el servidor (Oracle)

```bash
docker compose up -d --build
docker compose ps   # verificar que los 6 contenedores estén healthy
```

### 4. Inicializar la base de datos

```bash
docker exec -i camaras-postgres psql -U postgres -d camaras_ia \
  < tablas_base_de_datos/migrations/01_schema.sql
docker exec -i camaras-postgres psql -U postgres -d camaras_ia \
  < tablas_base_de_datos/migrations/seed_camaras.sql
docker exec -it camaras-backend python bats/seed_admin.py
```

### 5. Exponer el frontend con ngrok

```bash
screen -S ngrok
ngrok http http://localhost:80
# Copiar la URL HTTPS que asigna ngrok
```

### 6. En la PC local del operador

```bash
cd codigo_fuente/bats
start-mediamtx.bat   # túnel + cámaras + MediaMTX
start-seguridad.bat  # detector con análisis v2 (armas/capucha/etc)
# o bien:
start.bat            # detector con análisis v1 (genérico, más rápido)
```

---

## 👥 Roles y Permisos

| Rol | Color | Puede |
|---|---|---|
| **Visualizador** | Gris | Login · Ver cámaras en vivo · Recibir alertas · Ver historial · Reproducir grabaciones |
| **Operador** | Azul | Todo lo anterior **+** Tomar snapshot · Grabar manual · Validar alerta |
| **Admin** | Violeta | Todo lo anterior **+** Gestionar cámaras · Cambiar credenciales RTSP · Gestionar usuarios · Eliminar alertas/grabaciones · Recargar cámaras |

Las acciones de admin están protegidas en el backend con el decorador `require_admin`. Si un Operador/Visualizador intenta una acción restringida, recibe 403 y el frontend muestra un toast rojo.



---

## 🗺️ Roadmap

### ✅ v1.0 — Piloto académico (actual)
- Arquitectura híbrida Cloud + Edge funcionando
- 3 roles con UI diferenciada
- Detección YOLO + LLaVA en tiempo real
- Túnel dinámico Cloudflare + ngrok
- Telegram worker dockerizado
- Documentación profesional completa

### 🚧 v1.1 — Producción Estándar
- Dominio fijo del cliente (Cloudflare Tunnel pago)
- HTTPS con certificado válido
- Backup automatizado de Postgres
- CI/CD con GitHub Actions
- Tests unitarios sobre el detector

### 🔮 v2.0 — Producción Premium
- Detector + LLaVA en **GPU NVIDIA A10** en Oracle Cloud
- Latencia LLaVA de ~2 min → **1–3 segundos**
- Capacidad: de 4 cámaras → **20+ simultáneas**
- Multi-tenant (múltiples sitios)
- Analytics: mapas de calor, conteo por horario
- Exportación a Excel / PDF



---

## 📊 Estado del Backlog

- **Total de items:** 151
- **Hechos:** 82 (54%)
- **En progreso:** 2
- **Pendientes:** 67

**Top 5 épicas más completas:**
1. Frontend — 84%
2. Documentación — 79%
3. Cache y Realtime — 70%
4. DevOps — 70%
5. Ingesta y Detección — 67%



---

## ⚠️ Limitaciones conocidas

- **LLaVA corre en CPU** durante el piloto → análisis tarda 120–150 s. Solución: migrar a GPU (escenario Premium del Plan de Costos).
- **PC del cliente debe estar encendida** para que haya video remoto y detecciones. Solución: escenario Premium internaliza el detector en Oracle.
- **URL de ngrok cambia al reiniciar** (cuenta free). Solución: ngrok plan personal con dominio fijo (USD 8/mes) o Cloudflare Tunnel con dominio propio.


---

## 📄 Licencia

Este proyecto es un trabajo académico de fin de carrera. Distribución y uso comercial sujetos a acuerdo previo con el autor.

---

<p align="center">
  <i>Construido en 4 meses · 151 items · 100% open source en su stack</i><br/>
  <b>Cámaras-IA · v1.0 · 2026</b>
</p>
