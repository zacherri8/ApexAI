# F1 AI Analytics & Strategy Platform

Full-stack F1 analytics platform with telemetry visualization, strategy guidance, automated reporting, race prediction, and a retrieval-based chatbot.

## Stack

- Frontend: Next.js, React, Tailwind CSS, Recharts
- Backend: FastAPI, Pydantic, SQLAlchemy
- AI/ML: OpenAI-ready service adapters, scikit-learn-compatible predictor scaffolding
- Data: SQLite-backed seeded domain data with optional FastF1 integration hooks

## Structure

- `frontend/` Next.js application
- `backend/` FastAPI application

## Quick Start

### One Command Startup

From the project root:

```bash
npm run dev
```

This starts both services from one root command:

- backend: `http://127.0.0.1:8000`
- frontend: `http://127.0.0.1:3000`

On Windows, this root command launches the backend and frontend as child PowerShell processes and waits for them to come up. Use:

```bash
npm run stop
```

to stop both.

If you need different ports, run:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\run-dev.ps1 -BackendPort 8001 -FrontendPort 3001
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1` in `frontend/.env.local`.

## Notes

- OpenAI-enhanced responses activate when `OPENAI_API_KEY` is available to the backend.
- The backend now seeds a local SQLite database automatically on startup.
- Demo auth credentials:
  - Username: `demo`
  - Password: `demo123`
- Auth endpoints:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`
- Set `DATABASE_URL` if you want to point the backend at PostgreSQL instead of the default local SQLite file.
