# Frontend de UTN Connect

Web hecha con React, Vite y React Router. Es un proyecto independiente: se instala y se ejecuta desde esta carpeta.

## Requisitos

Node.js LTS y npm.

## Puesta en marcha

```bash
cd frontend
npm install
npm run dev
```

**Hay que tener la API levantada en el puerto 3000** (`npm run dev` en `backend/`). Vite redirige los pedidos a `/api` a `http://localhost:3000` (ver `vite.config.ts`), así la web y la API quedan en el mismo origen y la cookie de sesión viaja. Si cambiás el `PORT` en `backend/.env`, ajustá también el proxy en `vite.config.ts`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Levanta la web en modo desarrollo (Vite). |
| `npm run lint` | Revisa el estilo del código (ESLint). |
| `npm run typecheck` | Verifica los tipos (`tsc --noEmit`). |
| `npm run test` | Ejecuta las pruebas (Vitest). |

## Estructura

```text
frontend/
├─ index.html            carga las tipografías (Google Fonts)
└─ src/
   ├─ main.tsx, App.tsx  punto de entrada, router y proveedor de sesión
   ├─ styles/global.css  variables de diseño y estilos base (único CSS global)
   ├─ routes/            definición de rutas
   ├─ features/<area>/   pantallas y componentes de cada área (home, login)
   └─ shared/
      ├─ api/            cliente HTTP: único lugar donde se llama a fetch
      ├─ session/        contexto de sesión (SessionProvider y useSession)
      └─ layout/         layout base (encabezado y contenido)
```

## Cliente HTTP

`shared/api` expone `api.get/post/put/patch/delete`. Usa rutas relativas (`/api/...`), envía `credentials: 'include'` y lee JSON. Si la respuesta es un error lanza `ApiError` con `status`, `code`, `message` y `details`; las pantallas deciden según `code`. Si la respuesta no tiene el formato común (por ejemplo, la API apagada y el proxy responde 502) el `code` es `INVALID_RESPONSE`; si no hay conexión, `NETWORK_ERROR`.

Ante un 401, el cliente llama a un manejador que registra `SessionProvider`: limpia la sesión (usuario en `null`) y redirige a `/login`.

## Estilos

- `src/styles/global.css` define las variables (colores, tipografías, espacios y radios) y se importa una sola vez, en `main.tsx`.
- Cada componente tiene su propio `.css` junto a su `.tsx`, importado desde él.
- Los componentes usan solo `var(--...)`: no escriben colores ni tipografías a mano. Para cambiar el diseño se editan las variables.
- Las clases siguen BEM con el prefijo del componente: `.app-layout`, `.app-layout__header`, `.app-layout__content--wide`. Como son globales, el prefijo evita choques.
- El diseño es mobile-first: 16 px de margen lateral en el celular y sin desplazamiento horizontal.
