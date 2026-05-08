# Despliegue en Render (free tier)

Guía rápida para subir el proyecto a [Render](https://render.com) usando el plan gratuito.

## Lo que se despliega

- **1 Web Service** (Django) que sirve API + admin + el SPA de React compilado.
- **1 PostgreSQL free** (90 días de duración antes de expirar).

Todo desde un único dominio (`https://<nombre>.onrender.com`).

## Limitaciones del plan free

- El servicio se duerme tras **15 min de inactividad** (primer request lo despierta, demora ~30 s).
- 750 horas/mes gratis (alcanzan para un servicio 24/7).
- 512 MB RAM, 0.1 CPU.
- La base de datos free **expira en 90 días** y queda solo lectura tras eso.
- En cada deploy se ejecuta el seed que **borra y recrea los datos transaccionales** (lotes, procesos, calidad). Catálogos y usuarios se preservan.

## Pasos

### 1. Push a GitHub
Asegúrate que la rama esté en GitHub:
```bash
git push origin feat/cutting-program-and-shifts   # o la rama que estés usando
```

### 2. Conectar el repo en Render

1. Entra a https://dashboard.render.com
2. Click en **"New +" → "Blueprint"**
3. Conecta tu cuenta de GitHub y selecciona el repo
4. Render detecta el `render.yaml` automáticamente y muestra:
   - Web Service `tuberia-app`
   - Database `tuberia-db`
5. Click **"Apply"**

Render hará:
- Crear la base de datos PostgreSQL
- Inyectar `DATABASE_URL` automáticamente al web service
- Generar un `SECRET_KEY` aleatorio
- Correr el `build.sh` (compila frontend, instala backend, migra, siembra)
- Arrancar `gunicorn`

El primer deploy tarda **~5–8 minutos**.

### 3. Verificar

Cuando termine, Render te da una URL del tipo `https://tuberia-app.onrender.com`.

Probar:
- `https://tuberia-app.onrender.com/` → carga la app
- `https://tuberia-app.onrender.com/admin/` → admin Django
- Login con `supervisor / admin1234`

## Variables de entorno gestionadas

Ver `render.yaml`. El blueprint las configura automáticamente.

| Variable | Valor | Descripción |
|---|---|---|
| `PYTHON_VERSION` | 3.11.9 | Runtime |
| `DEBUG` | `False` | Modo producción |
| `SECRET_KEY` | autogenerado | Django secret key |
| `DATABASE_URL` | desde Postgres | Conexión PostgreSQL |
| `ALLOWED_HOSTS` | `.onrender.com` | Hosts permitidos |
| `RENDER_EXTERNAL_HOSTNAME` | inyectado por Render | El subdominio asignado |

## Cambios manuales en el dashboard

Si necesitas ajustar algo después:

- **Reset de datos:** Manual Deploy → "Clear build cache & deploy" → vuelve a correr el seed
- **Logs en vivo:** pestaña "Logs" del web service
- **Shell remota:** pestaña "Shell" del web service (útil para `python manage.py shell`)
- **Reiniciar servicio:** "Manual Deploy → Deploy latest commit"

## Cómo despertar el servicio si se durmió

El primer request tarda ~30 s. Para "calentarlo" antes de una demo:
```bash
curl https://tuberia-app.onrender.com/api/auth/me/
```
(retornará 401 pero el servicio ya estará vivo)

Algunas alternativas para evitar que se duerma:
- Usar un cron externo (UptimeRobot, cron-job.org) que pegue cada 14 min
- Subir al plan starter ($7/mes — siempre activo)

## Si no quieres usar `render.yaml`

Crea el servicio manualmente:

1. **New + → Web Service**
2. Conectar repo, branch
3. Configuración:
   - **Runtime:** Python
   - **Build Command:** `./build.sh`
   - **Start Command:** `cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 60`
   - **Plan:** Free
4. Crear Postgres por separado: **New + → PostgreSQL → Free**
5. En el Web Service → Environment, agregar manualmente:
   - `PYTHON_VERSION` = `3.11.9`
   - `DEBUG` = `False`
   - `SECRET_KEY` = (click "Generate")
   - `ALLOWED_HOSTS` = `.onrender.com`
   - `DATABASE_URL` = (Internal Connection String del Postgres)

## Troubleshooting

### El build falla con "fcntl module not found"
No se puede probar gunicorn en Windows local — solo funciona en Linux (Render). Es esperado.

### CSRF Forbidden en producción
Verifica que `RENDER_EXTERNAL_HOSTNAME` se esté inyectando — está en `os.environ` automáticamente. El settings ya lo agrega a `CSRF_TRUSTED_ORIGINS`.

### La app carga pero los assets dan 404
Significa que `collectstatic` no corrió. Revisa el log del build — debe haber una línea "X static files copied".

### Login devuelve 403
El `login_view` debe tener `@authentication_classes([])` (saltarse el CSRF de SessionAuthentication). Ya está aplicado en `production/views.py`.

### Migraciones fallan tras cambios al modelo
Después de modificar modelos, hacer commit + push. Render correrá `migrate` en el próximo build. Si hay conflictos, puedes correr migraciones manualmente desde la **Shell** del dashboard:
```bash
cd backend
python manage.py migrate
```
