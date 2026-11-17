# Mediconnect

Sistema de una farmacia conectada a una IPS: el paciente consulta su fórmula, toma un turno
virtual o pide el domicilio; la farmacia atiende la fila, entrega los medicamentos, cobra la
cuota moderadora y lleva el inventario.

## Partes del proyecto

| Carpeta | Qué es |
|---|---|
| `backend/` | API (Node 22, Express, PostgreSQL) y avisos en vivo (Socket.IO) |
| `frontend/` | Sitio y panel (React, Vite, Tailwind). Incluye el simulador de la IPS en `/ips/` |
| `render.yaml` | Publicación de prueba en Render: un solo servicio entrega la API y el sitio |

Direcciones del sitio:

| Dirección | Para quién |
|---|---|
| `/` | Página pública |
| `/paciente` | Consulta de la fórmula y turno del paciente |
| `/mi-cuenta`, `/registro` | Cuenta del paciente y domicilios |
| `/farmacia` | Panel del personal (fila, entregas, inventario, reportes, contenido) |
| `/pantalla` | Pantalla de la sala de espera |
| `/kiosco` | Pantalla de turnos de la entrada |
| `/ips/` | Simulador de la IPS para el médico (solo con `MODO_DEMO=true`) |

## Puesta en marcha en el equipo

Requisitos: Node 22 o superior y PostgreSQL.

```bash
# 1. Base de datos (una vez)
createdb mediconect

# 2. Backend
cd backend
cp .env.example .env        # complete DATABASE_URL, JWT_SECRET y ADMIN_CLAVE
npm install
npm run db:migrate          # crea o actualiza las tablas (se puede repetir)
npm run db:seed             # crea el administrador y los datos iniciales
npm run dev                 # API en http://localhost:3000

# 3. Frontend (en otra terminal)
cd frontend
npm install
npm run dev                 # sitio en http://localhost:5173
```

El frontend reenvía `/api` y `/socket.io` al backend, así que basta abrir la dirección de Vite.

## Pruebas

Las pruebas de integración usan PostgreSQL, en un esquema aparte que se borra al terminar
(no tocan los datos del proyecto):

```bash
cd backend
TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/mediconect npm run test:integration
```

## Publicación

`render.yaml` describe el servicio y la base de datos. En Render: New → Blueprint → elegir este
repositorio. `npm run build` construye el sitio y `npm start` actualiza las tablas y arranca el servidor.

Antes de usarlo con datos reales: `MODO_DEMO=false`, contraseñas propias para el personal y un
plan con base de datos permanente (el plan gratis es solo para pruebas).

## Otros comandos

| Comando | Dónde | Qué hace |
|---|---|---|
| `npm run correo:prueba` | `backend/` | Envía un correo de prueba con los datos SMTP |
| `npm run imagenes` | `frontend/` | Optimiza las imágenes de `imagenes-originales/` |
| `npm run build` | `frontend/` | Construye el sitio en `frontend/dist/` |
