#!/usr/bin/env bash
# Build script para Render — corre en cada deploy.
# Compila el frontend, instala backend con Poetry, migra y siembra datos demo.

set -o errexit
set -o pipefail

echo ""
echo "═══════════════════════════════════════════════"
echo "   1/4 — Compilando frontend (Vite + React)"
echo "═══════════════════════════════════════════════"
cd frontend
npm ci
npm run build
cd ..

echo ""
echo "═══════════════════════════════════════════════"
echo "   2/4 — Copiando build al backend"
echo "═══════════════════════════════════════════════"
rm -rf backend/frontend_build
cp -r frontend/dist backend/frontend_build
ls backend/frontend_build/

echo ""
echo "═══════════════════════════════════════════════"
echo "   3/4 — Instalando deps Python (Poetry)"
echo "═══════════════════════════════════════════════"
cd backend
pip install --upgrade pip
pip install poetry
poetry config virtualenvs.create false
poetry install --only main --no-interaction --no-ansi

echo ""
echo "═══════════════════════════════════════════════"
echo "   4/4 — Migrate y collectstatic"
echo "═══════════════════════════════════════════════"
python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Seed solo si se pide explícitamente (env var RUN_SEED=1).
# El seed BORRA y RECREA datos transaccionales, no querés que corra en
# cada deploy si ya hay info real cargada.
#
# Cómo correrlo cuando lo necesites:
#   - Render dashboard → Environment → agregá RUN_SEED=1 → Save & Deploy
#   - Después de que se siembre, BORRÁ la variable para los próximos deploys
#   - O entrá al Shell del servicio y corré: python setup_initial_data.py
if [ "${RUN_SEED:-0}" = "1" ]; then
    echo ""
    echo "⚠️  RUN_SEED=1 detectado — corriendo seed (borra datos transaccionales)"
    python setup_initial_data.py
else
    echo ""
    echo "ℹ️  Seed omitida (RUN_SEED no está en 1). Datos preservados."
fi

echo ""
echo "✅ Build completo — listo para arrancar"
