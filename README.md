<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7299e884-e5f2-4a9a-8fd6-3417b7a3b950

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Online Payment Fraud Detection

This repository contains a simple full-stack starter for online payment fraud detection.

- Frontend: React + Vite
- Backend: FastAPI REST API

The backend currently uses a heuristic placeholder for fraud scoring (you can replace it later with a real ML model).

### Run the project

Backend runs on `http://localhost:8000`, frontend runs on `http://localhost:3000`.

#### Windows (PowerShell) - Recommended

From the project root (`PymentFraud`):

```powershell
.\setup-and-run.ps1
```

#### Bash / Git Bash

From the project root (`PymentFraud`):

```bash
bash setup-and-run.sh
```

### API endpoints (Backend)

- `GET /api/health`
- `POST /api/fraud/score`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/dataset/run` (runs fraud detection on `backend/dataset/*.csv`)

Example request body for `POST /api/fraud/score`:

```json
{
  "amount": 1200,
  "currency": "USD",
  "country": "IN",
  "merchant_category": "crypto",
  "payment_method": "wallet",
  "transaction_time_utc": "2026-03-20T10:30:00Z",
  "ip_country": "IN",
  "device_id": "device-123"
}
```

Tip: backend CORS is enabled by default. You can control allowed origins with `CORS_ALLOW_ORIGINS` environment variable.

Auth note: `POST /api/fraud/score` and `POST /api/dataset/run` require a JWT token. Use `POST /api/auth/login` first, then send `Authorization: Bearer <token>`.

Example request body for `POST /api/dataset/run`:

```json
{
  "dataset_path": "sample_fraud_payment_data.csv",
  "fraud_threshold": 60,
  "suspicious_threshold": 30
}
```

You can also send `dataset_filename` instead of `dataset_path` (filename under `backend/dataset/`).

## Frontend (API) configuration

The React frontend calls the FastAPI backend, so you can set:

- `frontend/.env.local` → `VITE_API_BASE_URL` (defaults to `http://localhost:8000`)
