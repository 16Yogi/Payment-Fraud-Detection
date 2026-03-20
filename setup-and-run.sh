#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Project root: ${ROOT_DIR}"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm not found. Install Node.js first." >&2
  exit 1
fi

if command -v python >/dev/null 2>&1; then
  PYTHON="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="python3"
else
  echo "Error: python not found. Install Python first." >&2
  exit 1
fi

echo "---- Backend setup ----"
cd "${ROOT_DIR}/backend"

if [ ! -d "venv" ]; then
  echo "Creating backend venv..."
  "${PYTHON}" -m venv venv
fi

# Activate venv in Git Bash/WSL on Windows.
if [ -f "venv/Scripts/activate" ]; then
  # shellcheck disable=SC1091
  source "venv/Scripts/activate"
elif [ -f "venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  source "venv/bin/activate"
fi

venv/bin/pip install --upgrade pip >/dev/null 2>&1 || true
pip install -r requirements.txt

cd "${ROOT_DIR}"

echo "---- Frontend setup ----"
cd "${ROOT_DIR}/frontend"
npm install
cd "${ROOT_DIR}"

echo "---- Starting services ----"

# Backend (FastAPI): http://localhost:8000
(
  cd "${ROOT_DIR}/backend"
  python -m uvicorn "app.main:app" --host "0.0.0.0" --port 8000 --reload
) &
BACKEND_PID=$!

# Frontend (Vite): http://localhost:3000
(
  cd "${ROOT_DIR}/frontend"
  npm run dev
) &
FRONTEND_PID=$!

echo "Backend PID: ${BACKEND_PID}"
echo "Frontend PID: ${FRONTEND_PID}"

cleanup() {
  kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
}
trap cleanup INT TERM

wait

