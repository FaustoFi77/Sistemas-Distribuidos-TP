# Frontend — Portal del cliente (TP Final IoT · variante 3: pérdida de enlace y zonas)

Next.js 16 · React 19 · TanStack Query v5 · Formik + Zod v4 · Tailwind 4 · Leaflet · `@ovenbird/react`.

## Cómo ejecutarlo

```bash
cp .env.example .env.local     # completar NEXT_PUBLIC_API_URL
npm install                    # .npmrc incluye legacy-peer-deps=true por @ovenbird/react
npm run dev                    # http://localhost:3000
```

Registrar `http://localhost:3000` en los `allowedOrigins` del proyecto de Ovenbird.

## Scripts de verificación

```bash
npm run lint                   # ESLint (core-web-vitals + typescript)
npm run typecheck              # TypeScript strict (tsc --noEmit)
npm run build                  # Build de producción
```

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend REST (`.../api/v1`). Cambiarla es lo único necesario para usar el backend de otro grupo. |
| `NEXT_PUBLIC_OVENBIRD_URL` | URL pública de Ovenbird IoT Cloud. Nunca va el `clientSecret`. |

## Pantallas

| Ruta | Contenido |
| --- | --- |
| `/login`, `/registro` | Autenticación (JWT del backend vía `useLogin` / `useRegister`). |
| `/` | Mapa en vivo (`OvenbirdProvider` + `DeviceMap` + zonas activas + estado en vivo), lista por mascota. |
| `/mascotas` | Listado paginado, alta, edición y baja con confirmación modal. |
| `/mascotas/[id]` | Ficha, código de emparejamiento con vencimiento, vincular y desvincular collar, acceso a zonas y estado del enlace. |
| `/mascotas/[id]/zonas` | **Variante 3.** Zonas circulares sobre el mapa (clic o coordenadas), activar/desactivar, estado dentro/fuera. |
| `/alertas` | **Variante 3.** Alertas en vivo e historial con filtros; reconocer. |

Las pantallas de la variante solo aparecen si `GET /capabilities` anuncia `link-loss-zones`
(si devuelve 404 se asume modo base). Así el front funciona con el backend de cualquier grupo.

## Decisiones de diseño

- **Arquitectura estricta de 3 capas:** `services/` (HTTP + SSE) → `hooks/` (TanStack Query + claves centralizadas en `lib/queryKeys.ts`) → `components/` y `app/` (UI pura, sin importar `services/`).
- **Sesión e interoperabilidad (trade-off `localStorage` vs cookie `httpOnly` + middleware):** El contrato de interoperabilidad establece que el frontend consume un backend REST externo intercambiable (`NEXT_PUBLIC_API_URL`) que retorna `{ accessToken, tokenType: "Bearer", expiresIn }` en JSON y espera `Authorization: Bearer <token>` tanto en REST como en SSE. Por eso el JWT se gestiona en cliente con expiración proactiva, limpieza automática en 401 y headers de seguridad anti-XSS/clickjacking en `next.config.ts` (y nunca se expone el `clientSecret` de Ovenbird).
- **Errores:** `lib/errors.ts` traduce RFC 9457 (`application/problem+json`) a mensajes claros sin filtrar detalles internos y propaga `fieldErrors` directo a Formik.
- **Tiempo real:** Una sola conexión SSE (`/alerts/stream`) encapsulada en `services/alertsStream.ts` con `@microsoft/fetch-event-source`, resincronización automática al reconectar y notificaciones opt-in del navegador (`Notification` API) en segundo plano.
- **App Router completo:** Incluye límites de error (`error.tsx`, `(app)/error.tsx`), `not-found.tsx` y `loading.tsx`.
- **SDK aislado:** Todo uso de `@ovenbird/react` está en `components/map/OvenbirdLive.tsx`, usando los tipos reales del paquete (`DeviceMap`, `OnlineBadge`, `BatteryIndicator`, `useDeviceStatus`).
