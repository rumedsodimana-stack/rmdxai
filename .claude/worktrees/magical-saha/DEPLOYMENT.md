# Singularity PMS — Deployment Guide

## Option A: Railway (Recommended)

### Prerequisites
- Railway account at [railway.app](https://railway.app)
- Railway CLI: `npm install -g @railway/cli`

### Steps

1. **Login**
   ```bash
   railway login
   ```

2. **Create a new project**
   ```bash
   railway init
   ```

3. **Add a PostgreSQL database**
   - In the Railway dashboard, click **New** → **Database** → **PostgreSQL**
   - Copy the `DATABASE_URL` from the database's **Connect** tab

4. **Add a Redis instance** (optional — needed for Bull queues)
   - Click **New** → **Database** → **Redis**
   - Copy the `REDIS_URL`

5. **Set environment variables**
   ```bash
   railway variables set \
     DATABASE_URL="postgresql://..." \
     JWT_SECRET="$(openssl rand -hex 32)" \
     JWT_REFRESH_SECRET="$(openssl rand -hex 32)" \
     NODE_ENV="production" \
     PORT="3001" \
     FRONTEND_URL="https://your-frontend.vercel.app"
   ```

6. **Deploy**
   ```bash
   railway up
   ```

7. **Run database migrations**
   ```bash
   railway run npx prisma migrate deploy
   ```

8. **(Optional) Seed demo data**
   ```bash
   railway run npm run prisma:seed
   ```

Railway will provide a public URL like `https://singularity-pms-production.up.railway.app`.

Swagger docs will be available at `<URL>/api/docs`.

---

## Option B: Render.com

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect your GitHub repo — Render auto-detects `render.yaml`.
4. Fill in the `sync: false` env vars (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_URL`).
5. Click **Apply** — Render builds and deploys automatically.

---

## Option C: Docker (self-hosted / any VPS)

```bash
# Build
docker build -t singularity-pms .

# Run (supply your own DATABASE_URL)
docker run -d \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e JWT_REFRESH_SECRET="$(openssl rand -hex 32)" \
  -e NODE_ENV="production" \
  singularity-pms
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token secret (min 32 chars) |
| `REDIS_HOST` | No | Redis host (default: localhost) |
| `REDIS_PORT` | No | Redis port (default: 6379) |
| `REDIS_PASSWORD` | No | Redis password |
| `PORT` | No | HTTP port (default: 3001) |
| `NODE_ENV` | No | `development` or `production` |
| `FRONTEND_URL` | No | Frontend origin for CORS |
| `THROTTLE_TTL` | No | Rate limit window in seconds |
| `THROTTLE_LIMIT` | No | Max requests per window |

---

## Post-deployment checklist

- [ ] `GET /api/v1/health` returns `200 OK`
- [ ] `GET /api/docs` loads Swagger UI
- [ ] Database migrations applied (`prisma migrate deploy`)
- [ ] CORS allows your frontend origin
