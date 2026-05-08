import os
from pathlib import Path
from django.contrib.messages import constants as message_constants

BASE_DIR = Path(__file__).resolve().parent.parent

# ─── Entorno / seguridad ────────────────────────────────────────────────
DEBUG = os.environ.get('DEBUG', 'True').lower() in ('1', 'true', 'yes')

SECRET_KEY = os.environ.get('SECRET_KEY',
                             'django-insecure-tuberia-cambiar-en-produccion-2025')

# En producción Render inyecta el host (ej. tuberia-app.onrender.com)
# ALLOWED_HOSTS puede venir como CSV o como sufijo único (.onrender.com)
_allowed_env = os.environ.get('ALLOWED_HOSTS', '*')
if _allowed_env == '*':
    ALLOWED_HOSTS = ['*']
else:
    ALLOWED_HOSTS = [h.strip() for h in _allowed_env.split(',') if h.strip()]
# Render expone RENDER_EXTERNAL_HOSTNAME automáticamente
_render_host = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if _render_host and _render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_render_host)

# ─── Apps ────────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'production',
    'quality',
]

# ─── Middleware (WhiteNoise va justo después de SecurityMiddleware) ──────
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

# El index.html del build de React vive en frontend_build/
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [
        BASE_DIR / 'templates',
        BASE_DIR / 'frontend_build',  # ← React index.html como template
    ],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

WSGI_APPLICATION = 'config.wsgi.application'

# ─── Base de datos ───────────────────────────────────────────────────────
# En producción: DATABASE_URL (Render lo inyecta desde el servicio postgres)
# En desarrollo: SQLite local
_db_url = os.environ.get('DATABASE_URL')
if _db_url:
    import dj_database_url
    DATABASES = {
        'default': dj_database_url.parse(_db_url, conn_max_age=600, ssl_require=True),
    }
else:
    DATABASES = {'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }}

AUTH_PASSWORD_VALIDATORS = []
LANGUAGE_CODE = 'es-co'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True

# ─── Estáticos (WhiteNoise + collectstatic) ──────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# El build de React queda en frontend_build/ y collectstatic lo mueve a staticfiles/
STATICFILES_DIRS = []
if (BASE_DIR / 'frontend_build').exists():
    STATICFILES_DIRS.append(BASE_DIR / 'frontend_build')

# WhiteNoise: comprimir y cachear con hashes
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── DRF ─────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': None,
}

# ─── CORS / CSRF ─────────────────────────────────────────────────────────
# En desarrollo permite Vite dev server. En producción (mismo origen) no se necesita.
_cors_env = os.environ.get('CORS_ALLOWED_ORIGINS', '')
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(',') if o.strip()] or [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^http://192\.168\.\d+\.\d+:5173$',
    r'^http://10\.\d+\.\d+\.\d+:5173$',
]

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
if _render_host:
    CSRF_TRUSTED_ORIGINS.append(f'https://{_render_host}')

# ─── HTTPS / proxy en producción ─────────────────────────────────────────
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 0  # subir cuando se valide bien
    SECURE_REDIRECT_EXEMPT = []
    SECURE_SSL_REDIRECT = False  # Render maneja TLS upstream

MESSAGE_TAGS = {
    message_constants.ERROR: 'error',
    message_constants.SUCCESS: 'success',
    message_constants.INFO: 'info',
    message_constants.WARNING: 'info',
}
