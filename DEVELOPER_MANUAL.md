# Manual del Desarrollador — Sistema de Producción Tubería

## Índice
1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arranque del proyecto](#3-arranque-del-proyecto)
4. [Estructura de archivos](#4-estructura-de-archivos)
5. [Backend — Django](#5-backend--django)
   - [Modelos](#51-modelos)
   - [Serializers](#52-serializers)
   - [Vistas y endpoints](#53-vistas-y-endpoints)
   - [Admin](#54-admin)
   - [Configuración](#55-configuración)
6. [Frontend — React](#6-frontend--react)
   - [Routing y autenticación](#61-routing-y-autenticación)
   - [API client](#62-api-client-libapijs)
   - [Componentes compartidos](#63-componentes-compartidos)
   - [Páginas](#64-páginas)
7. [Flujo de datos completo](#7-flujo-de-datos-completo)
8. [Roles y permisos](#8-roles-y-permisos)
9. [Módulo de calidad](#9-módulo-de-calidad)
10. [Programa de corte](#10-programa-de-corte)
11. [Turnos parciales — modelo central](#11-turnos-parciales--modelo-central)
12. [Seed de datos](#12-seed-de-datos)
13. [Referencia rápida de endpoints](#13-referencia-rápida-de-endpoints)

---

## 1. Visión general

Sistema web para gestionar la producción de tubería metálica. Permite crear **lotes de producción** y hacerles seguimiento proceso a proceso (corte → chaflanado → moleteado → curvado). Cada operario registra turnos individuales con firma; un proceso puede pasar por varios turnos hasta completarse. Los supervisores monitorean el avance en tiempo real, gestionan el programa mensual de corte y el despacho. El módulo de calidad registra la puesta a punto y las mediciones dimensionales por lote.

**Roles del sistema:**
- **Supervisor** — crea programa de corte (que genera los lotes), visualiza el tablero general, ve el estado de cada máquina, despacha lotes terminados, accede al reporte de calidad.
- **Operario** — ve sus tareas asignadas según la máquina que opera, **abre y cierra turnos**, registra calidad y mediciones. Si trabaja en cortadora, ve además el programa mensual.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend API | Django 4.2 + Django REST Framework 3.17 |
| Gestor de dependencias | **Poetry** (`pyproject.toml` + `poetry.lock`) |
| Autenticación | DRF Token Authentication |
| Base de datos | SQLite (desarrollo) |
| CORS | django-corsheaders |
| Frontend | React 18 + React Router 6 |
| Estilos | Tailwind CSS |
| Build / Dev server | Vite |
| HTTP client | Fetch nativo (sin axios) |

---

## 3. Arranque del proyecto

### Backend
```bash
cd backend
poetry install                              # Crea el virtualenv e instala dependencias
poetry run python manage.py migrate         # Crea todas las tablas
poetry run python setup_initial_data.py     # Carga catálogos, usuarios y datos demo
poetry run python manage.py runserver       # http://localhost:8000
```

> Alternativa: `poetry shell` activa el entorno y luego puedes correr `python ...` sin el prefijo.

### Frontend
```bash
cd frontend
npm install
npm run dev                                  # http://localhost:5173
```

> El frontend en dev hace proxy de `/api` → `http://localhost:8000` via Vite. No tocar el prefijo en los fetch.

### Credenciales de ejemplo (tras el seed)
| Usuario | Contraseña | Rol | Máquinas asignadas |
|---|---|---|---|
| supervisor | admin1234 | Supervisor + admin Django | — |
| juan | op1234 | Operario | Bewo 1, Bewo 2, Socco 1 |
| maria | op1234 | Operario | Chaflaneadora, Moleteadora |
| pedro | op1234 | Operario | Bewo 1, Bewo 2, Socco 2 |
| camila | op1234 | Operario | Socco 1, Socco 2 |

---

## 4. Estructura de archivos

```
tuberia_react/
├── backend/
│   ├── pyproject.toml           # Dependencias Poetry
│   ├── poetry.lock
│   ├── config/
│   │   ├── settings.py          # Configuración Django
│   │   └── urls.py              # URLs raíz
│   ├── production/
│   │   ├── models.py            # TubeSpec, ProductType, Machine,
│   │   │                        # ProductionBatch, ProcessRecord, ProcessShiftEntry,
│   │   │                        # CuttingProgram, CuttingProgramLine
│   │   ├── serializers.py
│   │   ├── views.py             # Viewsets + auth + dashboards + machines_status
│   │   ├── urls.py
│   │   └── admin.py
│   ├── quality/
│   │   ├── models.py            # QualityCheck, DimensionalLog
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── admin.py
│   ├── setup_initial_data.py    # Script seed completo
│   └── manage.py
└── frontend/
    └── src/
        ├── main.jsx
        ├── App.jsx              # Router con rutas protegidas
        ├── styles.css
        ├── lib/
        │   ├── api.js           # Cliente HTTP + endpoints
        │   ├── auth.jsx         # Context de autenticación
        │   └── utils.js         # Constantes y helpers
        ├── components/
        │   ├── Common.jsx       # Componentes UI reutilizables
        │   ├── Layout.jsx       # Shell con header y nav
        │   ├── ProductPicker.jsx# Buscador + creación inline de productos
        │   └── SignaturePad.jsx
        └── pages/
            ├── Login.jsx
            ├── SupervisorDashboard.jsx
            ├── MachinesStatus.jsx        # Tablero de máquinas en vivo
            ├── BatchList.jsx
            ├── BatchDetail.jsx
            ├── CreateBatch.jsx           # (legacy — accesible por ruta pero sin tab)
            ├── OperatorDashboard.jsx
            ├── ProcessStart.jsx
            ├── ProcessFinish.jsx
            ├── QualityForm.jsx
            ├── QualityDetail.jsx
            ├── QualityReport.jsx
            ├── DimensionalLog.jsx
            ├── DimensionalAdd.jsx
            ├── CuttingProgramList.jsx     # Lista de programas (supervisor)
            ├── CuttingProgramDetail.jsx   # Edición de programa + líneas
            └── CuttingProgramOperator.jsx # Vista solo lectura para operarios Bewo
```

---

## 5. Backend — Django

### 5.1 Modelos

Todos en `backend/production/models.py` y `backend/quality/models.py`.

#### Diagrama de relaciones

```
TubeSpec ─── 1:N ──→ ProductType ─── 1:N ──→ ProductionBatch ─── 1:N ──→ ProcessRecord ─── 1:N ──→ ProcessShiftEntry
                          ▲                          ▲                         │  │                       │
                          │                          │                         │  └─ 1:1 ─→ QualityCheck   │
                          │                          │                         └────── 1:N ─→ DimensionalLog
                          │                          │                         
CuttingProgram ── 1:N ──→ CuttingProgramLine ────────┘  (cada línea genera un batch)
                          │
                          └─ FK ─→ ProductType   (qué se va a fabricar)

Machine ── M:N ──→ User (operadores autorizados)
Machine ── 1:N ──→ ProcessRecord  (legacy, último turno)
Machine ── 1:N ──→ ProcessShiftEntry  (cada turno usa una máquina específica)
```

---

#### `TubeSpec` — Especificación de tubo (catálogo)

| Campo | Tipo | Descripción |
|---|---|---|
| `shape` | CharField | `round` · `square` |
| `outer_diameter` | FloatField | Diámetro exterior o lado (mm) |
| `thickness` | FloatField | Espesor (mm) |
| `material` | CharField | `cr` · `hr` · `cr_est` · `hr_est` |
| `original_length` | FloatField | Longitud del tubo largo (default 6000 mm) |

**Restricción única:** `(outer_diameter, thickness, material, original_length)`.

---

#### `ProductType` — Tipo de producto (catálogo)

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | CharField | "Manubrio 838", etc. |
| `tube_spec` | FK → TubeSpec | PROTECT |
| `cut_length` | FloatField | Longitud de corte (mm) |
| `client` | CharField | Cliente destino |
| `default_priority` | CharField | `alta` · `media` · `baja` |
| `requires_chaflan` / `_moleteo` / `_curvado` | BooleanField | Procesos requeridos |
| `saw_type` | CharField | `hss` · `tct` · `none` |
| `rpm` | IntegerField | Velocidad de sierra |

`product.get_process_route()` → lista ordenada de procesos (`['corte', 'chaflan', ...]`)

---

#### `Machine` — Máquina (catálogo)

| Campo | Descripción |
|---|---|
| `name` | "Bewo 1", "Socco 2", etc. |
| `process_type` | `corte` · `chaflan` · `moleteo` · `curvado` |
| `operators` | M2M → User (autorizados a operar) |
| `is_active` | Boolean |

---

#### `ProductionBatch` — Lote de producción

| Campo | Tipo | Descripción |
|---|---|---|
| `batch_code` | CharField | Auto: `LOTE-XXXX` |
| `product_type` | FK | PROTECT |
| `total_quantity` | IntegerField | |
| `priority` | CharField | `alta` · `media` · `baja` |
| `scheduled_date` | DateField | |
| `status` | CharField | Ver tabla abajo |
| `notes` | TextField | |
| `dispatched_at` | DateTimeField | Cuando se despachó |

**Estados:**

| Estado | Cuándo |
|---|---|
| `in_basket` | Recién creado, sin procesos iniciados |
| `in_process` | Al menos un proceso iniciado o pausado |
| `finished` | Todos los `ProcessRecord` están `finished` |
| `dispatched` | El supervisor ya despachó |

**Métodos:**
```python
batch.create_process_records()
# Crea un ProcessRecord por cada paso de get_process_route() del producto.

batch.is_available_for_process('chaflan')
# True si el proceso anterior está finished (o si es el primero).

batch.progress_pct
# Avance ponderado: sum(qty_done) / sum(qty_assigned) × 100
# Refleja también las cantidades parciales de procesos pausados / activos.
```

---

#### `ProcessRecord` — Un paso del lote

Cada lote tiene N records (uno por cada proceso de su ruta). Mantiene el control acumulado del avance, pero el detalle real va en `ProcessShiftEntry`.

| Campo | Tipo | Descripción |
|---|---|---|
| `batch` | FK | CASCADE |
| `process_type` | CharField | `corte`/`chaflan`/`moleteo`/`curvado` |
| `sequence` | IntegerField | Posición en la ruta |
| `machine` | FK | (legacy: última máquina usada) |
| `operator` | FK → User | (legacy: último operario) |
| `shift` | CharField | A/B/C — del último turno |
| `status` | CharField | `pending` · `in_process` · **`paused`** · `finished` |
| `qty_assigned` | IntegerField | = batch.total_quantity |
| `qty_done` | IntegerField | Acumulado de todos los turnos |
| `started_at` / `finished_at` | DateTimeField | Primer arranque / fin total |
| `signature` | TextField | Firma del último turno |

**Restricción única:** `(batch, process_type)`.

**Propiedades:**
```python
record.qty_remaining     # qty_assigned - qty_done
record.progress_pct      # 0..100
record.active_shift      # ProcessShiftEntry actualmente abierto, o None
```

**Métodos clave:**
```python
record.start_shift(user, machine, shift)
# Crea un nuevo ProcessShiftEntry con started_at=now y finished_at=None.
# Falla si ya hay un turno activo o el record ya está 'finished'.
# Sincroniza campos legacy y pone status='in_process'.

record.end_shift(qty_done_this_shift, user, signature, notes)
# Cierra el turno activo. Recalcula record.qty_done = sum(shifts).
#   Si total >= qty_assigned → status='finished' + actualiza el batch
#   Si total < qty_assigned → status='paused' (queda libre para otro operario)

# Aliases legacy (siguen funcionando):
record.start(user, machine, shift)   == start_shift(...)
record.finish(qty, user, ...)        == end_shift(...)
```

---

#### `ProcessShiftEntry` — Un turno individual

**Cada vez que un operario abre un turno**, se crea uno de estos. Cuando lo cierra, se le pone `finished_at`. Múltiples entries por record cuando hay handoff entre turnos.

| Campo | Tipo | Descripción |
|---|---|---|
| `process_record` | FK | CASCADE |
| `operator` | FK → User | Quién está/estuvo trabajando |
| `machine` | FK → Machine | Cuál máquina usó |
| `shift` | CharField | A/B/C |
| `qty_done` | IntegerField | Lo que hizo este operario en este turno |
| `started_at` | DateTimeField | |
| `finished_at` | DateTimeField | NULL si el turno sigue activo |
| `signature` | TextField | Firma de cierre |

> **Reglas duras:**
> - Solo puede haber UN entry abierto (`finished_at IS NULL`) por `process_record` a la vez.
> - La suma de `qty_done` de los entries cerrados nunca debe exceder `record.qty_assigned`.

---

#### `CuttingProgram` — Programa mensual de corte

Único activo a la vez (compartido entre Bewo 1 y Bewo 2). Estados: `draft → active → closed`.

| Campo | Descripción |
|---|---|
| `month` | DateField (primer día del mes) |
| `version` | IntegerField |
| `status` | `draft` · `active` · `closed` |
| `notes` | |

`program.activate()` cierra cualquier otro programa activo y deja este como el vigente.

---

#### `CuttingProgramLine` — Línea del programa

| Campo | Descripción |
|---|---|
| `program` | FK CASCADE |
| `batch` | OneToOne ProductionBatch (auto-creado) |
| `product_type` | FK PROTECT |
| `start_day` / `end_day` | Día del mes (1-31) |
| `pieces_per_hour` | Float |
| `item_code` | CharField |
| `tube_description` | CharField — tal como aparece en el documento físico ("TUB CR REDONDO 1 1/2 x 0.80 x 140mm") |
| `total_quantity` | Cantidad pedida (única cantidad del renglón) |
| `demo_pieces` | Cantidad de muestras |
| `tube_count` | Cantidad de tubos largos necesarios |
| `tube_length_mm` | Longitud del tubo largo |
| `saw_type` | `hss` · `tct` |
| `saw_teeth` | Número de dientes |
| `rpm` | Velocidad de sierra |
| `advance_high` / `advance_low` | Velocidades disponibles en cada modo |
| `client` | CharField |
| `packaging` | CharField |

`line.create_batch(user)` genera el `ProductionBatch` correspondiente (con sus `ProcessRecords`) y lo enlaza.

---

#### `QualityCheck` — Control de calidad (puesta a punto)

Relación **OneToOne** con `ProcessRecord`. Una puesta a punto por proceso. Los campos son los mismos del documento físico: cliente, ítem/tramo, moto, dimensiones OK (sí/no/otras), tipo de lámina, apariencia, sierra, RPM, presión de mordaza, apariencia de corte, distancia de moleteo, doble moleteo, 3 muestras, observaciones.

Propiedad: `qc.has_nonconformity` — true si cualquiera de los campos críticos es no-conforme.

---

#### `DimensionalLog` — Medición dimensional

Relación **ForeignKey** con `ProcessRecord` (varias por proceso). Se registra ~cada 20 piezas. 1–3 medidas con label personalizado (ej. "Longitud (mm)", "Ángulo", "Distancia moleteo"). Resultado conforme / no conforme.

---

### 5.2 Serializers

Todos en `backend/production/serializers.py` y `backend/quality/serializers.py`.

| Serializer | Lo importante |
|---|---|
| `UserMiniSerializer` | Embebido — `full_name` |
| `TubeSpecSerializer` | `label` (string legible) |
| `ProductTypeSerializer` | `tube_spec_data` (nested), `process_route` |
| `MachineSerializer` | `process_label`, `operators_data` |
| `ProcessShiftEntrySerializer` | `operator_data`, `machine_data`, `shift_display` |
| `ProcessRecordSerializer` | `qty_remaining`, `progress_pct`, `shift_entries[]`, `active_shift_operator`, **`batch_priority`**, **`batch_priority_display`**, **`batch_code`**, **`product_name`** |
| `ProductionBatchSerializer` | Detalle completo, `records` anidados |
| `BatchListSerializer` | Versión liviana. `current_process` ahora incluye `qty_done`, `qty_assigned`, `qty_remaining`, `progress_pct` y operario activo / del último turno |
| `CuttingProgramSerializer` / `CuttingProgramLineSerializer` | Con `month_display`, status displays, etc. |
| `QualityCheckSerializer` | `has_nonconformity` |
| `DimensionalLogSerializer` | |

---

### 5.3 Vistas y endpoints

#### Autenticación

| Método | URL | Auth | Notas |
|---|---|---|---|
| POST | `/api/auth/login/` | `AllowAny` + `@authentication_classes([])` | El decorador es **crítico** para evitar el CSRF de SessionAuthentication. Devuelve token y `is_supervisor`. |
| POST | `/api/auth/logout/` | Token | |
| GET | `/api/auth/me/` | Token | `{ user, is_supervisor, machines, process_types }` |

#### Catálogos
- `GET/POST  /api/tube-specs/`
- `GET/POST  /api/product-types/`
- `GET       /api/machines/` (read-only)

#### Lotes (`/api/batches/`)
- `GET  ?status=&q=&exclude_dispatched=1`
- `POST` (crea + auto-genera ProcessRecords)
- `GET  /{id}/`
- `POST /{id}/dispatch/`

#### Procesos y turnos (`/api/records/`)
- `GET  /{id}/` — detalle con `shift_entries[]` y avance
- `POST /{id}/start/` — abre un turno (`{ machine_id, shift }`)
- `POST /{id}/finish/` — cierra el turno activo (`{ qty_done, signature, notes }`)
  - Si la suma alcanza `qty_assigned` → record `finished`; si no → `paused`

#### Programa de corte (`/api/cutting-programs/`)
- `GET/POST  /` — lista y creación
- `GET       /active/` — programa activo (sin pasar ID)
- `GET/PATCH /{id}/`
- `POST      /{id}/activate/`
- `POST      /{id}/close/`

Líneas (`/api/cutting-lines/`):
- `POST   /` — crea línea + lote automático
- `PATCH  /{id}/`
- `DELETE /{id}/` (solo si batch sigue en `in_basket`)

#### Dashboards
- `GET /api/supervisor/dashboard/` — contadores por proceso (incluye `paused`)
- `GET /api/supervisor/machines/` — **estado en vivo de cada máquina** (turno actual, operario, avance, cola)
- `GET /api/operator/tasks/` — tareas del operario (incluye `pending` y `paused` con prerequisitos OK)

#### Calidad (`/api/quality/`)
- `GET/POST/PUT  /checks/` — soporta `?record=` y `?only_nc=1`
- `GET/POST      /logs/` — soporta `?record=`
- `GET           /report/` — últimos 200 + lista NC

---

### 5.4 Admin

`http://localhost:8000/admin/` con `supervisor`. Modelos registrados: TubeSpec, ProductType, Machine, ProductionBatch (con ProcessRecord inline), ProcessRecord (con **ProcessShiftEntry inline**), ProcessShiftEntry, CuttingProgram (con CuttingProgramLine inline), CuttingProgramLine, QualityCheck, DimensionalLog.

---

### 5.5 Configuración

`backend/config/settings.py`

```python
DATABASES = {'default': {'ENGINE': 'sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
TIME_ZONE = 'America/Bogota'
LANGUAGE_CODE = 'es-co'
USE_TZ = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',  # solo para el admin
    ],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
}

CORS_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
CORS_ALLOWED_ORIGIN_REGEXES = [r'^http://192\.168\.\d+\.\d+:5173$', r'^http://10\.\d+\.\d+\.\d+:5173$']
```

`backend/pyproject.toml`:
```toml
[tool.poetry]
name = "tuberia-backend"
package-mode = false

[tool.poetry.dependencies]
python = ">=3.11"
django = ">=4.2,<5.0"
djangorestframework = ">=3.14"
django-cors-headers = ">=4.3"
```

---

## 6. Frontend — React

### 6.1 Routing y autenticación

`App.jsx` define las rutas. `Protected` chequea `useAuth().user` antes de renderizar.

| Ruta | Componente | Acceso |
|---|---|---|
| `/login` | Login | Público |
| `/` | Redirect | → `/supervisor` o `/operario` según rol |
| `/supervisor` | SupervisorDashboard | Autenticado |
| `/maquinas` | **MachinesStatus** | Autenticado (mostrado en nav supervisor) |
| `/lotes` | BatchList | Autenticado |
| `/nuevo-lote` | CreateBatch | Legacy — accesible por URL pero **sin tab en el nav** |
| `/lote/:id` | BatchDetail | Autenticado |
| `/operario` | OperatorDashboard | Autenticado |
| `/proceso/iniciar/:id` | ProcessStart | Autenticado |
| `/proceso/terminar/:id` | ProcessFinish | Autenticado |
| `/calidad/reporte` | QualityReport | Autenticado |
| `/calidad/nuevo/:rid` | QualityForm | Autenticado |
| `/calidad/editar/:rid` | QualityForm (modo edit) | Autenticado |
| `/calidad/ver/:rid` | QualityDetail | Autenticado |
| `/dimensional/:rid` | DimensionalLog | Autenticado |
| `/dimensional/:rid/nueva` | DimensionalAdd | Autenticado |
| `/programa` | CuttingProgramList | Supervisor |
| `/programa/:id` | CuttingProgramDetail | Supervisor (lectura) / supervisor (edición) |
| `/corte/programa` | CuttingProgramOperator | Operarios Bewo (vista solo lectura) |

#### `lib/auth.jsx`

Provee `{ user, loading, login, logout }` vía context.

- Token guardado en `localStorage` con clave `tuberia_token`.
- Al montar: si hay token, llama a `/auth/me/` para validarlo.
- `user` incluye `is_supervisor`, `machines`, `process_types` (sirven para el filtro automático del nav y de las tareas).

---

### 6.2 API client (`lib/api.js`)

Todos los requests pasan por `request(path, options)` con manejo automático de:
- `Content-Type: application/json`
- `Authorization: Token <token>` si existe
- 401 → limpia token + redirect a `/login`
- non-OK → extrae `detail` del JSON y lanza Error

**Grupos exportados:**

```js
Auth.{ login, logout, me }
Batches.{ list, get, create, dispatch }
Records.{ get, start, finish }
Catalog.{ products, createProduct, machines, tubes, createTube }
Dashboard.{ supervisor, machinesStatus, operatorTasks }
Quality.{ list, byRecord, get, create, update, report }
DimLogs.{ byRecord, create }
CuttingPrograms.{ list, get, active, create, update, activate, close }
CuttingLines.{ create, update, delete }
```

---

### 6.3 Componentes compartidos

#### `components/Common.jsx`

| Componente | Notas |
|---|---|
| `BackLink`, `Loading`, `Alert` | Genéricos |
| `ProcIcon` | Badge coloreado de proceso |
| `StatusBadge` | Soporta `paused` (azul) además de in_basket / in_process / finished / dispatched |
| `PriorityTag` | Pill alta/media/baja |
| `MiniPipeline` | Pipeline visual del lote, distingue paused (azul) de in_process (ámbar) |
| `BatchCard` | Tarjeta para listas, incluye línea de avance parcial cuando aplica |

#### `components/Layout.jsx`

Header con logo + nombre de usuario + logout. Tabs según rol:

- **Supervisor:** `Resumen · Máquinas · Lotes · Programa · Calidad`
- **Operario Bewo (corte):** `Mis tareas · Programa`
- **Otro operario:** `Mis tareas`

#### `components/SignaturePad.jsx`

Canvas para firma. Soporta touch + mouse. Exporta PNG en base64.

#### `components/ProductPicker.jsx` ⭐ (nuevo)

Buscador de productos con autocomplete y creación inline.

**Props:** `value`, `onChange(id, productData)`

**Comportamiento:**
- Si hay producto seleccionado: muestra tarjeta resumen + botón ✕ para limpiar.
- Si está vacío: input con búsqueda en tiempo real (filtra por nombre, tubo, diámetro, cliente).
- Dropdown con resultados; al pie un botón "**➕ Crear producto nuevo**".
- Al crear: abre un modal (renderizado con **`createPortal(..., document.body)`** para evitar problemas de forms anidados):
  - **Sección 1 — Tubo:** toggle `Elegir del catálogo` / `Crear nuevo`. Si se crea: forma, diámetro, espesor, material, longitud original.
  - **Sección 2 — Producto:** nombre, longitud de corte, cliente, prioridad, sierra, RPM, checkboxes de procesos requeridos.
- Al guardar: POST a `/tube-specs/` (si es nuevo) → POST a `/product-types/` → autoselecciona el producto recién creado.

> **Bug evitado:** los componentes auxiliares (`Field`, `Section`) están definidos a nivel de módulo, no dentro del componente. Si se definen dentro, cada render crea referencias nuevas y los inputs pierden el foco al teclear.

---

### 6.4 Páginas

#### `Login.jsx`
Formulario simple. Llama `auth.login()` y redirige según `is_supervisor`.

#### `SupervisorDashboard.jsx`
- Stats grid: 4 procesos con conteo de turnos activos / pausados / terminados
- Tabla de lotes con columna **"Proceso actual"** que muestra estado (Activo/Pausado), `XXX/YYY · faltan ZZZ`, mini barra y operario actual o último turno
- Avance total ponderado por lote

#### `MachinesStatus.jsx` ⭐ (nuevo, supervisor)
Tablero de planta con auto-refresh manual (botón). Una tarjeta por máquina:
- **Activa:** lote, operario, turno, avance, cronómetro en vivo
- **Sin actividad:** última actividad, último operario
- Pie: cola pendiente y operarios autorizados
- Resumen superior: 4 chips con "X de Y máquinas activas" por proceso
- **Orden:** corte → curvado → chaflan → moleteo (definido en constante `PROCESS_ORDER`)

#### `BatchList.jsx`
Buscador + filtros por estado. Renderiza `BatchCard` por lote.

#### `BatchDetail.jsx`
Cabecera del lote + lista de procesos. Cada tarjeta de proceso:
- Estado con color (pendiente/activo/pausado/terminado)
- Avance (qty_done/qty_assigned + barra)
- Operario activo o último turno
- Botones: Calidad · Mediciones · **Iniciar / Continuar / Cerrar turno**
- **Desplegable "Ver turnos (N)"** con historial completo de cada `ProcessShiftEntry` (operario, turno, máquina, qty hecha, fechas)

#### `CreateBatch.jsx`
Form legacy de creación directa de lote. Sigue accesible por URL para edge cases pero ya no aparece en el nav — los lotes nuevos deberían crearse desde el programa.

#### `OperatorDashboard.jsx`
- Chips de máquinas asignadas
- **"Mis turnos activos":** los procesos `in_process` cuyo último turno es del usuario actual
- **"Disponibles · ordenadas por prioridad":** procesos `pending` o `paused` cuyo prerequisito está cumplido
  - **Orden:** alta → media → baja (`sortByPriority`)
  - Borde izquierdo coloreado según prioridad (rojo / ámbar / verde)
  - Badge `↻ Continuar` para los pausados, mostrando quién hizo el último turno
- Cada tarjeta incluye `batch_code`, `PriorityTag`, `product_name`, barra de progreso

#### `ProcessStart.jsx`
Form para abrir un turno. Selecciona máquina (filtrada por las del usuario) + turno. POST `/records/{id}/start/`.

#### `ProcessFinish.jsx`
**"Cerrar turno"** — no necesariamente termina el proceso entero.
- Avance global del proceso (asignado / hecho / restante)
- "¿Cuánto hiciste en este turno?" con max = `qty_remaining`
- Indicador en vivo: "Con esta cantidad se completa el proceso" / "Quedarán X uds para otro operario"
- Cronómetro del turno actual
- Firma + notas
- Botón cambia entre "TERMINAR PROCESO" y "CERRAR TURNO" según corresponda

#### `QualityForm.jsx`, `QualityDetail.jsx`, `QualityReport.jsx`
Sin cambios estructurales. Soporta crear y editar puesta a punto.

#### `DimensionalLog.jsx`, `DimensionalAdd.jsx`
Sin cambios estructurales. Mediciones por pieza.

#### `CuttingProgramList.jsx` (supervisor)
Grid de tarjetas de programas con su estado. Modal para crear nuevo (mes + versión + notas).

#### `CuttingProgramDetail.jsx` (supervisor)
- Cabecera con mes, versión, estado, botones de Activar/Cerrar
- Tabla de líneas con todas las columnas (días, producto/tubo, cantidades pedido/total, tubo largo, sierra/dientes/RPM, avance High/Low, lote generado)
- Form inline para agregar/editar línea, secciones organizadas:
  - **Producto y cliente** (usa **`ProductPicker`**)
  - **Programación y cantidades**
  - **Tubo largo (materia prima)**
  - **Sierra y velocidades**
- Solo se permite borrar líneas cuyo lote sigue en `in_basket`

#### `CuttingProgramOperator.jsx` (operarios Bewo)
Vista de solo lectura del programa activo. Resalta filas cuyos días incluyen "hoy". Cada línea muestra todos los parámetros + estado del lote linkeado.

---

## 7. Flujo de datos completo

```
[Supervisor] Crear programa de corte (o agregar línea a uno existente)
    │  POST /api/cutting-programs/
    │  POST /api/cutting-lines/  → automáticamente:
    │       - Crea/encuentra TubeSpec + ProductType (vía ProductPicker)
    │       - Crea ProductionBatch
    │       - Crea ProcessRecords (uno por paso de la ruta)
    ▼
[Lote]  status='in_basket'  ──→  ProcessRecords todos en 'pending'

[Supervisor] Activa el programa  →  POST /cutting-programs/{id}/activate/
    │  El programa anterior queda 'closed'.

[Operario] Ve sus tareas (ordenadas por prioridad)
    │  GET /api/operator/tasks/

[Operario] Abre un turno
    │  POST /api/records/{id}/start/  { machine_id, shift }
    │  Backend: crea ProcessShiftEntry abierto
    │  ProcessRecord → status='in_process'
    │  ProductionBatch → 'in_process' (si era 'in_basket')
    ▼
[Operario] Trabaja, registra calidad y mediciones
    │  POST /api/quality/checks/
    │  POST /api/quality/logs/

[Operario] Termina su turno con qty_done parcial
    │  POST /api/records/{id}/finish/  { qty_done, signature, notes }
    │  Backend: cierra el ShiftEntry. Recalcula record.qty_done.
    │       Si total ≥ qty_assigned → record='finished'
    │       Si total < qty_assigned → record='paused'  ← ¡saldo libre!

[Otro operario] Ve la tarea como "↻ Continuar"
    │  POST /api/records/{id}/start/   crea un NUEVO ShiftEntry
    │  POST /api/records/{id}/finish/  cierra ese, sigue acumulando
    │  ... (puede haber N handoffs hasta completar) ...

[Lote] Cuando todos los records están finished → status='finished'
[Supervisor] Despachar
    │  POST /api/batches/{id}/dispatch/
    ▼
[Lote]  status='dispatched'  (estado final)
```

---

## 8. Roles y permisos

Igual que antes — toda la lógica de visibilidad UI vive en frontend. El backend solo distingue autenticado vs anónimo (excepto `/auth/login/`).

| Acción | Supervisor | Operario |
|---|---|---|
| Ver lotes / detalles | ✅ | ✅ |
| Crear/editar programa de corte | ✅ | ❌ (UI sin nav, ruta protegida lógicamente) |
| Crear líneas (que generan lotes) | ✅ | ❌ |
| Abrir/cerrar turnos | ✅ | ✅ (solo procesos de sus máquinas) |
| QC y mediciones | ✅ | ✅ |
| Despachar lote | ✅ | ❌ |
| Ver tablero de máquinas | ✅ | ❌ |
| Ver reporte de calidad | ✅ | ❌ |

---

## 9. Módulo de calidad

Sin cambios estructurales respecto a versiones anteriores.

- `QualityCheck` 1:1 con `ProcessRecord` (puesta a punto, una vez)
- `DimensionalLog` 1:N con `ProcessRecord` (mediciones, varias)
- Reporte global en `/api/quality/report/`
- No-conformidad si: `dimensions_ok='no'`, `appearance_ok='no'`, `cut_appearance='no_conforme'`, `double_knurling_free='no_conforme'`

---

## 10. Programa de corte

Sistema de planificación mensual para las cortadoras Bewo. **Único programa activo** compartido entre Bewo 1 y Bewo 2.

**Flujo:**
1. Supervisor crea un `CuttingProgram` (mes + versión).
2. Agrega `CuttingProgramLine`s con todos los parámetros (días, tubo, cantidades, sierra, avances, etc.). Cada línea **auto-crea un ProductionBatch**.
3. Activa el programa → cualquier programa activo previo queda `closed`.
4. Los cortadores ven el programa en `/corte/programa` con resaltado de lo vigente hoy.
5. Pueden tocar el código del lote para ir al detalle y arrancar un turno.

**Creación inline (`ProductPicker`):**
- Si el producto/tubo ya existe → autocomplete lo encuentra y se selecciona.
- Si no → modal completo para crear TubeSpec + ProductType de un golpe sin salir del flujo.

**Campos de la línea (mapean al documento físico):**

| Columna del Excel | Campo del modelo |
|---|---|
| Día Inicio / Final | `start_day` / `end_day` |
| Piezas/hora | `pieces_per_hour` |
| Item | `item_code` |
| Descripción tramo cortado | `tube_description` (la longitud final va al final como "...x 140mm") |
| Cantidad pedida | `total_quantity` |
| Tramos tubo | `tube_count` |
| Tubo largo (mm) | `tube_length_mm` |
| Tipo sierra | `saw_type` |
| Número de dientes | `saw_teeth` |
| RPM | `rpm` |
| Avance High / Low | `advance_high` / `advance_low` |
| Cliente | `client` |
| Embalaje | `packaging` |

---

## 11. Turnos parciales — modelo central

Es el cambio más importante respecto a versiones anteriores. **Un proceso ya no se completa en un solo paso**.

### Concepto

Un `ProcessRecord` representa un paso lógico de la ruta del lote (ej. "corte para LOTE-0042"). Tiene un `qty_assigned` total que normalmente es igual a `batch.total_quantity`.

Dentro de ese paso, **N operarios pueden trabajar en distintos momentos**. Cada vez que uno abre un turno se crea un `ProcessShiftEntry`. Cuando lo cierra, se le pone `finished_at` y `qty_done` (lo que hizo en su turno).

El acumulado del proceso (`record.qty_done`) es la suma de todos los `ProcessShiftEntry.qty_done`.

### Estados del ProcessRecord

| Estado | Cuándo |
|---|---|
| `pending` | qty_done=0, sin shift entries — nadie ha tocado el proceso |
| `in_process` | hay un shift entry abierto (alguien está trabajando ahora) |
| `paused` | todos los shift entries están cerrados, pero qty_done < qty_assigned (saldo pendiente) |
| `finished` | qty_done ≥ qty_assigned |

### Reglas de UI

- En el dashboard del operario, los `pending` y `paused` aparecen en "Disponibles" (con prerequisitos OK). Los `paused` muestran el badge "↻ Continuar".
- El form de cierre de turno valida que `qty_done` no exceda `record.qty_remaining`.
- El supervisor ve el avance parcial en cada vista (lista de lotes, tablero de máquinas, detalle del lote).

### Histórico

El detalle del lote (`BatchDetail.jsx`) tiene un desplegable **"Ver turnos (N)"** por cada `ProcessRecord` que muestra cada `ProcessShiftEntry` con su operario, máquina, turno, qty hecha y timestamps.

### Compatibilidad

`record.start()` y `record.finish()` siguen funcionando como aliases de `start_shift()` / `end_shift()`. Los campos legacy (`record.operator`, `record.machine`, `record.shift`, `record.signature`) se sincronizan al **último turno** automáticamente — útil para serializar info rápida sin atravesar la lista completa.

---

## 12. Seed de datos

`backend/setup_initial_data.py`

**Política:** **borra los datos transaccionales** (lotes, procesos, turnos, calidad, programas) en cada corrida y los recrea limpios. Catálogos y usuarios se preservan vía `get_or_create`.

**Lo que crea:**
- 5 usuarios + 2 grupos
- 6 TubeSpec, 9 ProductType, 6 Machine
- **18 lotes con estados consistentes:**
  - 4 finished (uno con corte hecho en 2 turnos handoff)
  - 2 dispatched
  - 2 paused (ej: corte 80/150 esperando relevo)
  - 4 in_process (con shift entry abierto)
  - 6 in_basket
- `QualityCheck` para cada proceso terminado/activo
- `DimensionalLog` con mediciones por lote terminado de corte

> **Importante:** todos los procesos `in_process` tienen un `ProcessShiftEntry` abierto, y los `paused` tienen entries cerrados sumando menos del total. Esto evita el bug "150/150 pero no deja terminar" que aparecía cuando se ponía `qty_done=qty_assigned` directamente sin shift activo.

**UTF-8 forzado** en stdout para que la consola de Windows (cp1252) no falle con los iconos.

```python
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
```

---

## 13. Referencia rápida de endpoints

```
# Auth
POST   /api/auth/login/              (AllowAny + sin auth class para evitar CSRF)
POST   /api/auth/logout/
GET    /api/auth/me/

# Catálogos
GET/POST  /api/tube-specs/
GET/POST  /api/product-types/
GET       /api/machines/

# Lotes
GET    /api/batches/                 ?status= &q= &exclude_dispatched=
POST   /api/batches/
GET    /api/batches/{id}/
POST   /api/batches/{id}/dispatch/

# Procesos y turnos
GET    /api/records/{id}/
POST   /api/records/{id}/start/      { machine_id, shift }    → abre ProcessShiftEntry
POST   /api/records/{id}/finish/     { qty_done, signature }  → cierra el ShiftEntry

# Programa de corte
GET/POST  /api/cutting-programs/
GET       /api/cutting-programs/active/
GET/PATCH /api/cutting-programs/{id}/
POST      /api/cutting-programs/{id}/activate/
POST      /api/cutting-programs/{id}/close/
POST/PATCH/DELETE /api/cutting-lines/{id}/

# Dashboards
GET    /api/supervisor/dashboard/    (incluye conteo de paused)
GET    /api/supervisor/machines/     (estado en vivo de cada máquina)
GET    /api/operator/tasks/          (incluye paused, ordenable por prioridad)

# Calidad
GET/POST/PUT  /api/quality/checks/    ?record= &only_nc=
GET/POST      /api/quality/logs/      ?record=
GET           /api/quality/report/
```
