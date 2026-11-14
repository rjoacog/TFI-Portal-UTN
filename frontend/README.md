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
└─ src/    main.tsx, App.tsx, features/, routes/ y shared/
```
