# Student Manager

Teachers create an account, then add, edit, delete, search and rank their own students.
Each teacher only sees their own students.

- `backend/` is the Flask API with Neon PostgreSQL
- `frontend/` is React + TypeScript (Vite)

## Run locally

```powershell
py -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env   # fill in DATABASE_URL and SESSION_SECRET_KEY
py -m backend.init_db                          # creates tables (safe to re-run)
py -m backend.app                              # API on http://127.0.0.1:5000

cd frontend; npm install; npm run dev          # app on http://localhost:5173
```

To generate a secret, run `py -c "import secrets; print(secrets.token_urlsafe(48))"`.
To run the tests, run `py -m unittest backend.test_app` (no database needed).

## Deploy for free

The free setup is Neon (database), Render (API) and Vercel (frontend).
Vercel proxies `/api` to Render, so the login cookie stays on one site.

1. **Neon:** use your existing project. Copy the connection string, then run
   `py -m backend.init_db` once against it.
2. **Render:** create a Web Service from this repo (Free plan).
   - Root directory: *(empty)*
   - Build: `pip install -r backend/requirements.txt`
   - Start: `gunicorn backend.app:app`
   - Env vars: `DATABASE_URL`, `SESSION_SECRET_KEY` (new random value),
     `APP_ENV=production`, `FRONTEND_ORIGINS=https://<your-app>.vercel.app`,
     `PYTHON_VERSION=3.12.7`
   - Check that `https://<your-api>.onrender.com/api/health` returns OK.
3. **Vercel:** edit `frontend/vercel.json` and put in your Render URL. Then import
   the repo with root directory `frontend` (Vite is auto-detected). Leave
   `VITE_API_BASE_URL` unset.

Free-tier notes: the Render free plan sleeps after about 15 minutes idle, so the
first request after that takes around 30–60 seconds. Neon free also pauses when
idle and wakes on demand.

## Backup (optional)

```powershell
pg_dump --dbname="<DATABASE_URL>" --format=custom --file "$env:USERPROFILE\students.dump"
```
