# ScriptHive Publication House

Production-grade monorepo rebuild:

- `frontend/` React 18 + Vite + TypeScript + Tailwind + React Router v6 + Context API
- `backend/` Node.js + Express (ES modules) + Prisma + PostgreSQL + JWT auth + security middleware

## Quick Start

### Backend

1. Copy `backend/.env.example` to `backend/.env` and fill values.
2. Run:
   - `cd backend`
   - `npm install`
   - `npx prisma generate`
   - `npx prisma migrate dev --name init`
   - `npm run seed`
   - `npm run dev`

### Frontend

1. Copy `frontend/.env.local.example` to `frontend/.env.local`.
2. Run:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

## Build

- Backend: `cd backend && npm run build`
- Frontend: `cd frontend && npm run build`
