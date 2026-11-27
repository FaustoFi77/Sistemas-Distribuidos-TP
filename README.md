# Sistema IoT de Seguimiento de Mascotas — TP Final Sistemas Distribuidos

Repositorio del **Grupo 3 (Pérdida de enlace y zonas — `link-loss-zones`)**, compatible con la **Especificación de Interoperabilidad v1** sobre **Ovenbird IoT Cloud**.

## Estructura del repositorio

```text
.
├── .github/workflows/ci.yml   # CI unificado (Backend + Frontend)
├── backend/                   # API REST + SSE en NestJS 10 + TypeORM + SQLite
└── frontend/                  # Portal web en Next.js 16 + React 19 + @ovenbird/react
```

## Cómo levantar el proyecto en local

### 1. Backend (`http://localhost:3001/api/v1`)

```bash
cd backend
cp .env.example .env           # completar JWT_SECRET, OVENBIRD_CLIENT_ID y OVENBIRD_CLIENT_SECRET
npm install
npm run start:dev
```

Swagger queda disponible en `http://localhost:3001/api/docs` y el JSON en `http://localhost:3001/api/docs-json`.

### 2. Frontend (`http://localhost:3000`)

```bash
cd frontend
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
npm install
npm run dev
```

> Recordá agregar `http://localhost:3000` en **Orígenes** (`allowedOrigins`) de tu proyecto en Ovenbird IoT Cloud para que el mapa en vivo (`@ovenbird/react`) funcione sin errores CORS.

## Documentación detallada

- Backend: [backend/README.md](./backend/README.md)
- Frontend: [frontend/README.md](./frontend/README.md)
