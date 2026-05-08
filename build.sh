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
echo "   4/4 — Migrate, collectstatic y seed"
echo "═══════════════════════════════════════════════"
python manage.py collectstatic --no-input
python manage.py migrate --no-input
python setup_initial_data.py

echo ""
echo "✅ Build completo — listo para arrancar"
