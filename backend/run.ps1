$ErrorActionPreference = "Stop"

$env:PYTHONUNBUFFERED = "1"

# Assumes you are in the `backend` directory.
uvicorn "app.main:app" --host "0.0.0.0" --port 8000 --reload
