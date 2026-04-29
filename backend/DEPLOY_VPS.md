# Deploy to a friend’s VPS (isolated)

This app is a Flask server that needs **PostgreSQL** (`DATABASE_URL`). It can run publicly on a VPS without touching other projects by using:

- its own folder: `/opt/energy-audit`
- its own systemd service: `energy-audit`
- its own nginx site config

## On the server (one-time)

### 0) Upload the project into `/opt/energy-audit`

**Option A: git clone**

```bash
mkdir -p /opt/energy-audit
cd /opt/energy-audit
git clone <YOUR_REPO_URL> .
```

**Option B: rsync from your Mac**

```bash
rsync -av --delete \
  --exclude ".venv" --exclude "__pycache__" --exclude ".env" \
  /path/to/EnergyAudit/ \
  root@157.180.28.98:/opt/energy-audit/
```

### 1) Create `/opt/energy-audit/.env` (DO NOT commit)

```bash
nano /opt/energy-audit/.env
```

Example:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
```

### 2) Run the setup script

```bash
bash /opt/energy-audit/deploy/setup.sh
```

### 3) Verify

```bash
systemctl status energy-audit --no-pager
curl -s http://127.0.0.1:5050/healthz
```

Open:

- `http://157.180.28.98/`

## HTTPS (recommended)

Once you have a domain pointing to the server, you can add Let’s Encrypt via Certbot and change nginx to serve HTTPS.

