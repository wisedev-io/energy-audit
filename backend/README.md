# Energy Audit

This version stores cases, uploaded photos, and generated reports in PostgreSQL instead of the local `cases/` folder.

## Setup

1. Create a virtual environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If your deployment needs HEIC conversion on Linux, also install `libheif` on the server and then add `pillow-heif`.

2. Create a PostgreSQL database and set `DATABASE_URL`:

```bash
cp .env.example .env
set -a
source .env
set +a
```

3. Start the app:

```bash
python3 server.py
```

4. Optional: import legacy folder-based cases into PostgreSQL:

```bash
python3 migrate_cases_to_postgres.py
```

## Deployment

Run the Flask app behind Gunicorn:

```bash
gunicorn -b 0.0.0.0:5050 wsgi:app
```

Make sure the server environment has `DATABASE_URL` set before starting the service.

## Private Repo Prep

From inside the `EnergyAudit/` directory, once you share the new private repository URL, you can initialize/push with:

```bash
git init
git add .
git commit -m "Initial PostgreSQL-backed Energy Audit app"
git remote add origin <your-private-repo-url>
git push -u origin main
```
