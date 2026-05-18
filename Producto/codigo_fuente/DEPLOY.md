# Deployment en Oracle Cloud (Always Free ARM)

Arquitectura **híbrida**: Oracle corre la "fachada" pública (frontend +
backend + DB + storage). Tu PC en casa corre la "IA" (detector YOLO +
Ollama + LLaVA + MediaMTX + cámaras).

```
ORACLE (Ubuntu ARM, IP pública)              TU CASA (PC + cámaras)
┌─────────────────────────────┐              ┌──────────────────────────┐
│ docker compose up:          │              │ - detector.py            │
│  - frontend (nginx :80)     │ ◄── HTTPS ── │ - ollama + llava         │
│  - backend (FastAPI)        │  (alertas,   │ - mediamtx               │
│  - postgres                 │   snapshots, │ - cámaras IP             │
│  - redis                    │   uploads)   │                          │
│  - minio                    │              │ - .env apunta a Oracle   │
└─────────────────────────────┘              └──────────────────────────┘
```

## Paso 1 — Preparar la VM Oracle (Ubuntu)

```bash
# SSH a la VM
ssh -i ~/.ssh/oracle.pem ubuntu@<IP_PUBLICA>

# Docker ya está instalado (lo dijiste). Verificar:
docker --version
docker compose version

# Firewall de Ubuntu (iptables): abrir 80 y 443
sudo iptables -I INPUT 5 -p tcp -m state --state NEW --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp -m state --state NEW --dport 443 -j ACCEPT
sudo netfilter-persistent save  # o `sudo iptables-save > /etc/iptables/rules.v4`

# En la consola web de Oracle: VCN → Security Lists → agregar Ingress Rules:
#   - 0.0.0.0/0  TCP 80    (HTTP)
#   - 0.0.0.0/0  TCP 443   (HTTPS)
```

## Paso 2 — Subir el código

Desde tu PC local:

```bash
# Comprimís el proyecto sin node_modules ni .vite
cd C:\Users\ignfu\OneDrive\Desktop\camaras-ia\Producto
tar --exclude='codigo_fuente/frontend/node_modules' \
    --exclude='codigo_fuente/frontend/dist' \
    --exclude='codigo_fuente/backend/__pycache__' \
    --exclude='codigo_fuente/.env' \
    -czf camaras-ia.tar.gz .

# Lo subís
scp -i ~/.ssh/oracle.pem camaras-ia.tar.gz ubuntu@<IP_PUBLICA>:~/
```

En la VM Oracle:

```bash
mkdir -p ~/camaras-ia
tar -xzf camaras-ia.tar.gz -C ~/camaras-ia
cd ~/camaras-ia/codigo_fuente
```

## Paso 3 — Crear `.env` con secretos reales

```bash
cp .env.production.example .env
nano .env

# Generar JWT secret:
openssl rand -base64 48
# Copiar el output a JWT_SECRET= en .env
# Hacer lo mismo para POSTGRES_PASSWORD y MINIO_ROOT_PASSWORD (passwords largas).
```

## Paso 4 — Levantar el stack

```bash
cd ~/camaras-ia/codigo_fuente
docker compose up -d --build

# Ver logs en vivo
docker compose logs -f

# Verificar que todo está arriba
docker compose ps
# Tienen que decir: Up (healthy)
```

Esperar ~2 minutos la primera vez (compila imágenes ARM).

## Paso 5 — Crear el admin inicial

```bash
docker compose exec backend python /app/bats/seed_admin.py
```

Te pide email + password + nombre. Guardalos.

## Paso 6 — Probar desde tu navegador

```
http://<IP_PUBLICA_ORACLE>/
```

Te pide login. Entrás con el admin que creaste. **A esta altura las
cámaras NO se ven todavía** — falta conectar el detector local.

## Paso 7 — Conectar tu PC al stack de Oracle

Tu detector local tiene que apuntar a Postgres + Redis + MinIO **de
Oracle**. Cambiá el `.env` LOCAL de tu PC (NO el del servidor):

```
# .env de tu PC local
CAMARAS_DB_HOST=<IP_PUBLICA_ORACLE>
CAMARAS_DB_PORT=5432
CAMARAS_DB_PASSWORD=<la misma del Oracle .env>

CAMARAS_REDIS_HOST=<IP_PUBLICA_ORACLE>
CAMARAS_REDIS_PORT=6379

CAMARAS_MINIO_ENDPOINT=http://<IP_PUBLICA_ORACLE>:9000
CAMARAS_MINIO_ACCESS_KEY=admin
CAMARAS_MINIO_SECRET_KEY=<la misma del Oracle .env>
```

Para exponer Postgres/Redis/MinIO al exterior, agregá en
`docker-compose.yml` puertos publicados:

```yaml
postgres:
  ports: ["5432:5432"]
redis:
  ports: ["6379:6379"]
minio:
  ports: ["9000:9000"]
```

Y abrí esos puertos en Oracle Security List. **Ojo**: esto los expone a
internet pública. Mejor es usar **Tailscale**:

### Alternativa con Tailscale (recomendada, gratis)

```bash
# En la VM Oracle
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# En tu PC local
# Bajar Tailscale para Windows + instalar
# Login con la misma cuenta
```

Tailscale te asigna IPs `100.x.x.x` a ambos. Tu PC ve Oracle como
`100.x.x.x` y los puertos están "abiertos" en esa red privada. En el
`.env` de tu PC ponés esa IP en lugar de la pública.

## Paso 8 — Arrancar detector local

En tu PC (con cámaras + hotspot + Ollama):

```cmd
bats\start-seguridad.bat
```

Ahora las alertas y snapshots van a la DB de Oracle. El frontend público
las muestra en tiempo real.

## Logs útiles

```bash
docker compose logs -f backend     # Backend FastAPI
docker compose logs -f frontend    # Nginx access log
docker compose logs -f postgres    # SQL queries lentas, etc.
docker compose exec postgres psql -U postgres -d camaras_ia  # Acceso a DB

# Restart de un solo servicio
docker compose restart backend
```

## HTTPS con Let's Encrypt (después)

Cuando tengas un dominio apuntando a la IP pública:

```bash
# Container Certbot que hace renovación automática
docker run -it --rm -v $(pwd)/certbot:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d tu-dominio.com --email tu@email.com --agree-tos
```

Después montás `/etc/letsencrypt/live/tu-dominio.com/` en el container
`frontend` y actualizás `nginx.conf` para escuchar 443.

## Troubleshooting

| Síntoma | Solución |
|---|---|
| `docker compose up` tarda mucho | Primera vez compila imágenes ARM, ~5-10 min |
| `pg_isready` falla | Esperar 30s más, postgres tarda en inicializar |
| Frontend muestra "Network Error" | Revisar `docker compose logs backend` — ¿postgres conectó? |
| Login falla con "Credenciales inválidas" | ¿Corriste seed_admin? `docker compose exec backend python /app/bats/seed_admin.py` |
| Detector local no conecta a Oracle | Verificar IP en .env del PC + que Tailscale o puertos estén abiertos |
| Memoria llena en Oracle ARM | Ver `docker stats` y `free -h`. 24 GB alcanza para todo SIN ollama |
