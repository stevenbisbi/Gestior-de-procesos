# Control de Planta — Tubería

App de control de procesos para planta de tubos: **Django REST Framework** (backend, gestionado con **Poetry**) + **React + Vite + Tailwind** (frontend).

## Estructura

```
tuberia_react/
├── backend/                    Django + DRF
│   ├── config/                 Settings, urls, wsgi
│   ├── production/             Lotes, máquinas, procesos, turnos, programa de corte
│   ├── quality/                Control de calidad + dimensional
│   ├── manage.py
│   ├── pyproject.toml          Dependencias (Poetry)
│   ├── poetry.lock
│   └── setup_initial_data.py   Carga datos demo
└── frontend/                   React + Vite
    ├── src/
    │   ├── components/         Layout, BatchCard, SignaturePad, ProductPicker…
    │   ├── pages/              Login, Dashboards, Batch, Quality, Programa, Máquinas…
    │   ├── lib/                api.js, auth.jsx, utils.js
    │   ├── App.jsx             Routes
    │   ├── main.jsx
    │   └── styles.css          Tailwind + componentes custom
    ├── package.json
    └── vite.config.js
```

---

## 🚀 Primera vez (setup)

### 1. Backend — con Poetry

```bash
cd backend
poetry install                              # crea virtualenv + instala deps
poetry run python manage.py migrate         # crea todas las tablas
poetry run python setup_initial_data.py     # usuarios, máquinas, productos, lotes demo
```

> Si prefieres entrar al shell del virtualenv una sola vez:
> ```bash
> poetry shell
> python manage.py migrate
> python setup_initial_data.py
> ```

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
poetry run python manage.py runserver 0.0.0.0:8000
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
poetry run python manage.py collectstatic --noinput
poetry run python manage.py runserver 0.0.0.0:8000
```

Ahora todo (frontend + API + admin) sale por **http://192.168.X.X:8000**.

---

## 👥 Usuarios demo (tras correr el seed)

| Usuario | Contraseña | Rol | Máquinas |
|---|---|---|---|
| `supervisor` | `admin1234` | Supervisor (+ admin Django) | — |
| `juan` | `op1234` | Operario | Bewo 1, Bewo 2, Socco 1 |
| `pedro` | `op1234` | Operario | Bewo 1, Bewo 2, Socco 2 |
| `maria` | `op1234` | Operario | Chaflaneadora, Moleteadora |
| `camila` | `op1234` | Operario | Socco 1, Socco 2 |

---

## 🧩 Funcionalidades principales

**Producción**
- Login por rol (supervisor / operario)
- **Dashboard supervisor** con conteos por proceso (activos, pausados, terminados)
- **Tablero de máquinas** (`/maquinas`) — estado en vivo de cada máquina: turno activo, operario, avance, cola pendiente
- **Mis tareas** para operarios (filtrado por máquina asignada, ordenado por prioridad)
- Pipeline visual del lote (corte → chaflanado → moleteado → curvado)
- Bloqueo automático de procesos hasta que termine el anterior
- Despacho a almacén → sale del seguimiento

**Turnos parciales** (clave del modelo)
- Un proceso puede ejecutarse en **múltiples turnos** por distintos operarios
- Si un operario cierra turno sin completar el total, el proceso queda **`paused`** con el saldo restante visible
- Otro operario puede **continuar** desde donde se quedó — historial completo de turnos preservado
- El supervisor ve el avance parcial en tiempo real

**Programa de corte** (Bewo)
- Programa mensual único compartido entre las cortadoras Bewo 1 y Bewo 2
- El supervisor crea líneas con todos los parámetros (tubo, descripción, cantidad pedida vs total a cortar, sierra, RPM, avance High/Low, dientes, cliente, embalaje)
- **Cada línea genera automáticamente un lote** con sus ProcessRecords
- Los cortadores ven el programa completo con resaltado de las líneas vigentes hoy
- Búsqueda con autocomplete + creación inline de productos y especificaciones de tubo nuevos

**Calidad** (reemplaza Microsoft Forms)
- Puesta a punto: datos generales, parámetros, verificaciones, 3 muestras
- Detección automática de no conformidades
- Campos NA según el tipo de proceso
- Registro dimensional periódico (~cada 20 piezas) con resultado conforme/NC
- Reporte supervisor que destaca todas las NC

**Otros**
- Firma digital por canvas (sin biometría — solo trazo del dedo/mouse)
- Cronómetro en vivo durante el turno activo
- Diseño industrial navy/blanco
- Responsive: PC + tablet + celular

---

## 🔑 Endpoints principales

### Auth
- `POST /api/auth/login/` → `{ token, user, is_supervisor }`
- `POST /api/auth/logout/`
- `GET  /api/auth/me/` → `{ user, is_supervisor, machines, process_types }`

### Catálogos
- `GET/POST /api/tube-specs/` — TubeSpec
- `GET/POST /api/product-types/` — ProductType
- `GET /api/machines/`

### Lotes
- `GET  /api/batches/?status=&q=&exclude_dispatched=1`
- `POST /api/batches/` (auto-crea ProcessRecords)
- `GET  /api/batches/{id}/`
- `POST /api/batches/{id}/dispatch/`

### Procesos y turnos
- `POST /api/records/{id}/start/`  → abre un turno (crea `ProcessShiftEntry`)
- `POST /api/records/{id}/finish/` → cierra el turno con `qty_done`. Si total < qty_assigned → estado `paused`

### Programa de corte
- `GET/POST  /api/cutting-programs/`
- `GET       /api/cutting-programs/active/`
- `POST      /api/cutting-programs/{id}/activate/`
- `POST      /api/cutting-programs/{id}/close/`
- `POST/PATCH /api/cutting-lines/`

### Dashboards
- `GET /api/supervisor/dashboard/` → contadores por proceso (activo/pausado/terminado)
- `GET /api/supervisor/machines/`  → estado en vivo de cada máquina
- `GET /api/operator/tasks/`       → tareas del operario (incluye pausados)

### Calidad
- `GET/POST  /api/quality/checks/?record={record_id}`
- `GET/POST  /api/quality/logs/?record={record_id}`
- `GET       /api/quality/report/`  → últimos 200 + lista de no-conformidades

---

## 🛠 Stack

- **Backend**: Django 4.2, DRF 3.17, Token Auth, SQLite, CORS, Poetry
- **Frontend**: React 18, React Router 6, Vite 5, Tailwind CSS 3
- **Sin servicios externos** — todo corre en red local

---

## 🐛 Tips

- Si tras crear modelos no aparece algo, corre `poetry run python manage.py makemigrations && poetry run python manage.py migrate`
- El admin Django sigue en `/admin/` para CRUD avanzado
- Para resetear datos demo: el seed (`setup_initial_data.py`) ya borra y recrea las tablas transaccionales (lotes, procesos, turnos, calidad, programas) en cada corrida — los catálogos y usuarios se preservan
- Si el login devuelve 403 Forbidden, verifica que el `login_view` tenga `@authentication_classes([])` (necesario para saltarse el CSRF de SessionAuthentication)
