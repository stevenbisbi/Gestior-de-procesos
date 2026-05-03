# Control de Planta — Tubería

App de control de procesos para planta de tubos: **Django REST Framework** (backend) + **React + Vite + Tailwind** (frontend).

## Estructura

```
tuberia_react/
├── backend/                    Django + DRF
│   ├── config/                 Settings, urls, wsgi
│   ├── production/             Lotes, máquinas, procesos
│   ├── quality/                Control de calidad + dimensional
│   ├── manage.py
│   ├── requirements.txt
│   └── setup_initial_data.py   Carga datos demo
└── frontend/                   React + Vite
    ├── src/
    │   ├── components/         Layout, BatchCard, SignaturePad, etc.
    │   ├── pages/              Login, Dashboards, Batch, Quality...
    │   ├── lib/                api.js, auth.jsx, utils.js
    │   ├── App.jsx             Routes
    │   ├── main.jsx
    │   └── styles.css          Tailwind + componentes custom
    ├── package.json
    └── vite.config.js
```

---

## 🚀 Primera vez (setup)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python setup_initial_data.py     # Crea usuarios, máquinas, productos demo
```

### 2. Frontend

```bash
cd frontend
npm install
```

---

## 🏃 Modo desarrollo (dos terminales)

**Terminal 1 — Backend:**
```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Abre **http://localhost:5173** en el navegador. Vite hace proxy automático de `/api/*` al backend.

Para acceder desde la red local (otros PCs/tablets), usa la IP del PC:
- `http://192.168.X.X:5173` para la app
- `http://192.168.X.X:8000/admin/` para el admin Django

---

## 📦 Modo producción (un solo servidor)

Si quieres servir todo desde Django (más simple para deploy en planta):

```bash
# 1. Compilar React
cd frontend
npm run build

# 2. Mover build a backend
cd ..
rm -rf backend/frontend_build
cp -r frontend/dist backend/frontend_build

# 3. Recolectar estáticos y correr Django
cd backend
python manage.py collectstatic --noinput
python manage.py runserver 0.0.0.0:8000
```

Ahora todo (frontend + API + admin) sale por **http://192.168.X.X:8000**.

---

## 👥 Usuarios demo

| Usuario | Contraseña | Rol | Máquinas |
|---|---|---|---|
| `supervisor` | `admin1234` | Supervisor (+ admin Django) | Todas |
| `juan` | `op1234` | Operario | Cortadora 1 |
| `pedro` | `op1234` | Operario | Cortadora 2, Curvadora 2 |
| `maria` | `op1234` | Operario | Chaflaneadora, Moleteadora |
| `camila` | `op1234` | Operario | Curvadora 1 |

---

## 🔑 Endpoints principales

### Auth
- `POST /api/auth/login/` → `{ token, user, is_supervisor }`
- `POST /api/auth/logout/`
- `GET  /api/auth/me/`

### Lotes
- `GET    /api/batches/?status=in_basket&q=manubrio&exclude_dispatched=1`
- `POST   /api/batches/` (crea con records automáticos)
- `GET    /api/batches/{id}/`
- `POST   /api/batches/{id}/dispatch/`

### Procesos
- `POST /api/records/{id}/start/`  `{ machine_id, shift }`
- `POST /api/records/{id}/finish/` `{ qty_done, signature, notes }`

### Dashboards
- `GET /api/supervisor/dashboard/` → contadores por proceso
- `GET /api/operator/tasks/`        → tareas para el operario logueado

### Calidad
- `GET    /api/quality/checks/?record={record_id}`
- `POST   /api/quality/checks/`    Crea control (reemplaza Microsoft Forms)
- `GET    /api/quality/report/`    Reporte supervisor con NC

### Registro dimensional
- `GET  /api/quality/logs/?record={record_id}`
- `POST /api/quality/logs/`        Medición ~cada 20 piezas

---

## 🧩 Funcionalidades

**Producción**
- Login por rol (supervisor/operario)
- Dashboard supervisor con conteos por proceso
- Mis tareas para operarios (filtrado por máquina asignada)
- Pipeline visual del lote (corte → chaflanado → moleteado → curvado)
- Bloqueo automático de procesos hasta que termine el anterior
- Despacho a almacén → sale del seguimiento

**Calidad** (reemplaza Microsoft Forms)
- Puesta a punto: datos generales, parámetros, verificaciones, 3 muestras
- Detección automática de no conformidades
- Campos NA según el tipo de proceso
- Registro dimensional periódico (~cada 20 piezas) con resultado conforme/NC
- Reporte supervisor que destaca todas las NC

**Otros**
- Firma digital por canvas (sin biometría — solo trazo del dedo/mouse)
- Cronómetro en vivo durante el proceso activo
- Diseño industrial navy/blanco
- Responsive: PC + tablet + celular

---

## 🛠 Stack

- **Backend**: Django 4.2, DRF 3.14, Token Auth, SQLite, CORS
- **Frontend**: React 18, React Router 6, Vite 5, Tailwind CSS 3
- **Sin servicios externos** — todo corre en red local

---

## 🐛 Tips

- Si tras crear modelos no aparece algo, corre `python manage.py makemigrations` y `migrate`
- El admin Django sigue en `/admin/` para CRUD avanzado
- Para resetear datos: borra `db.sqlite3` y vuelve a correr migraciones + setup
