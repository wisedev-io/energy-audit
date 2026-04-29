"""
Flask server — receives form data + photos, saves reports in PostgreSQL.
Run: python3 server.py
"""

import io
import json as _json
import os
import time as _time
import uuid as _uuid
from pathlib import Path

# Load .env from the project directory before anything else reads env vars
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_file, override=False)
    except ImportError:
        pass

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

from storage import StorageError, get_storage

BASE_DIR = Path(__file__).parent
app = Flask(__name__)

# ── CORS — allow all origins explicitly (fixes preflight 404/405) ──────────
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    supports_credentials=False,
)

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response

@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        r = app.make_default_options_response()
        r.headers["Access-Control-Allow-Origin"] = "*"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        r.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return r

# ── Constants ──────────────────────────────────────────────────────────────

DELETE_PASSCODE = "abulika8"

_TEMP_PHOTO_TTL = 7200  # 2 hours

# Filesystem-based temp photo store — shared across all Gunicorn worker processes.
# Each upload writes two files: <dir>/<key> (raw bytes) and <dir>/<key>.meta (JSON).
_TEMP_PHOTOS_DIR = Path('/tmp/ea-temp-photos')
_TEMP_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)


def _temp_photo_save(key: str, data: bytes, mime: str, filename: str) -> None:
    _TEMP_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    (_TEMP_PHOTOS_DIR / key).write_bytes(data)
    meta = {'mime': mime, 'filename': filename, 'ts': _time.time()}
    (_TEMP_PHOTOS_DIR / f'{key}.meta').write_text(_json.dumps(meta))


def _temp_photo_get(key: str):
    """Return (data, mime, ts, filename) or None if not found / expired."""
    data_path = _TEMP_PHOTOS_DIR / key
    meta_path = _TEMP_PHOTOS_DIR / f'{key}.meta'
    if not data_path.exists() or not meta_path.exists():
        return None
    try:
        meta = _json.loads(meta_path.read_text())
    except Exception:
        return None
    if _time.time() - meta['ts'] > _TEMP_PHOTO_TTL:
        data_path.unlink(missing_ok=True)
        meta_path.unlink(missing_ok=True)
        return None
    return data_path.read_bytes(), meta['mime'], meta['ts'], meta['filename']


def _error_response(message, status=500):
    return jsonify({"success": False, "error": message}), status


# ── Basic routes ───────────────────────────────────────────────────────────

@app.route("/")
def index():
    return jsonify({"status": "ok", "service": "Energy Audit API"})


@app.route("/healthz", methods=["GET"])
def healthz():
    try:
        return jsonify({"ok": get_storage().healthcheck()})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


# ── HEIC conversion ────────────────────────────────────────────────────────

def _convert_heic_to_jpg(data: bytes, filename: str):
    """Convert HEIC/HEIF bytes to JPEG in memory. Raises RuntimeError on failure."""
    jpg_filename = Path(filename).stem + '.jpg'
    try:
        import pillow_heif
        from PIL import Image as _PILImage
        pillow_heif.register_heif_opener()
        img = _PILImage.open(io.BytesIO(data))
        buf = io.BytesIO()
        img.convert('RGB').save(buf, 'JPEG', quality=90)
        return buf.getvalue(), jpg_filename, 'image/jpeg'
    except Exception as exc:
        raise RuntimeError(f"HEIC conversion failed: {exc}") from exc


# ── Photo upload ───────────────────────────────────────────────────────────

@app.route("/upload_photo", methods=["POST", "OPTIONS"])
def upload_photo():
    """Accept a single photo, convert HEIC→JPG if needed, return a temp key."""
    if "photo" not in request.files:
        return _error_response("No 'photo' field", 400)
    file_obj = request.files["photo"]
    data = file_obj.read()
    if not data:
        return _error_response("Empty file", 400)

    mime = file_obj.content_type or "image/jpeg"
    filename = file_obj.filename or "photo.jpg"

    # Normalize empty/generic content-type from web blob uploads
    if mime in ("application/octet-stream", ""):
        ext = Path(filename).suffix.lower()
        mime = {
            ".heic": "image/heic",
            ".heif": "image/heif",
            ".png":  "image/png",
            ".jpg":  "image/jpeg",
            ".jpeg": "image/jpeg",
        }.get(ext, "image/jpeg")

    is_heic = (
        mime.lower() in ("image/heic", "image/heif") or
        Path(filename).suffix.lower() in (".heic", ".heif")
    )

    if is_heic:
        try:
            data, filename, mime = _convert_heic_to_jpg(data, filename)
        except RuntimeError:
            filename = Path(filename).stem + '.jpg'
            mime = 'image/jpeg'  

    key = str(_uuid.uuid4())
    _temp_photo_save(key, data, mime, filename)
    return jsonify({"key": key, "size": len(data)})


# ── Generate report ────────────────────────────────────────────────────────

@app.route("/generate", methods=["POST"])
def generate():
    from generate import generate_all

    form_data = {}
    for key, val in request.form.items():
        form_data[key] = val

    owner_full = form_data.get("owner", "")
    if not form_data.get("owner_surname") and owner_full:
        form_data["owner_surname"] = owner_full.split()[0].upper()

    for prefix, fields in [
        ("floor", ["l", "w"]),
        ("door",  ["w", "h", "n"]),
        ("win",   ["w", "h", "n"]),
        ("wall",  ["p", "h"]),
        ("apl",   ["name", "w", "n", "hrs"]),
    ]:
        i = 1
        while True:
            key = f"{prefix}_{fields[0]}{i}"
            if key not in request.form:
                break
            for fld in fields:
                form_data[f"{prefix}_{fld}{i}"] = request.form.get(f"{prefix}_{fld}{i}", "")
            i += 1

    for year in [2023, 2024, 2025]:
        for energy_type in ["gas", "elec", "other"]:
            vals = []
            for month in range(12):
                raw = request.form.get(f"{energy_type}_{year}_{month}", "0")
                try:
                    vals.append(float(raw))
                except ValueError:
                    vals.append(0.0)
            form_data[f"{energy_type}_{year}"] = vals

    uploaded_photos = {}
    for sec in range(1, 11):
        for n in range(1, 16):
            key = f"photo_s{sec}_{n}"
            if key in request.files:
                file_obj = request.files[key]
                if file_obj and file_obj.filename:
                    uploaded_photos[(sec, n)] = file_obj

    # Resolve pre-uploaded photo keys from mobile real-time uploads
    from storage import BinaryUpload
    for sec in range(1, 11):
        for n in range(1, 16):
            photo_key = request.form.get(f"photo_key_s{sec}_{n}")
            if photo_key and (sec, n) not in uploaded_photos:
                entry = _temp_photo_get(photo_key)
                if entry:
                    data, mime, _, filename = entry
                    uploaded_photos[(sec, n)] = BinaryUpload(
                        filename=filename, content=data, mimetype=mime
                    )

    edit_case = form_data.pop("edit_case", None) or None
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    current_user = None
    try:
        ensure_auth_schema()
        current_user = get_user_from_token(token)
    except Exception:
        pass
    created_by = current_user['id'] if current_user else None

    if current_user:
        try:
            storage = get_storage()
            with storage._connect() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT aud_name, aud_jshshr FROM users WHERE id = %s",
                        (current_user['id'],)
                    )
                    profile = cur.fetchone()
            if profile:
                if profile['aud_name']:
                    form_data['aud_name'] = profile['aud_name']
                if profile['aud_jshshr']:
                    form_data['aud_jshshr'] = profile['aud_jshshr']
        except Exception:
            pass

    try:
        result = generate_all(
            form_data, uploaded_photos,
            edit_case_name=edit_case,
            created_by=created_by,
        )
        return jsonify(result)
    except StorageError as exc:
        return _error_response(str(exc), 500)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return _error_response(str(exc), 500)


# ── Cases ──────────────────────────────────────────────────────────────────

@app.route("/next-case-number", methods=["GET"])
def next_case_number():
    try:
        return jsonify({"case_number": get_storage().peek_next_case_number()})
    except StorageError as exc:
        return _error_response(str(exc), 500)


@app.route("/cases", methods=["GET"])
def list_cases():
    try:
        return jsonify(get_storage().list_cases())
    except StorageError as exc:
        return _error_response(str(exc), 500)


@app.route("/cases/<case_name>/form", methods=["GET"])
def get_case_form(case_name):
    try:
        form_data = get_storage().get_case_form(case_name)
    except StorageError as exc:
        return _error_response(str(exc), 500)
    if form_data is None:
        return jsonify({"error": "form data not found"}), 404
    return jsonify(form_data)


@app.route("/cases/<case_name>/<filename>", methods=["GET"])
def download_file(case_name, filename):
    try:
        record = get_storage().get_case_file(case_name, filename)
    except StorageError as exc:
        return _error_response(str(exc), 500)
    if not record:
        return jsonify({"error": "file not found"}), 404
    return send_file(
        io.BytesIO(record["content"]),
        mimetype=record["mime_type"],
        as_attachment=True,
        download_name=record["filename"],
    )


@app.route("/cases/<case_name>", methods=["DELETE"])
def delete_case(case_name):
    data = request.get_json(silent=True) or {}
    if data.get("passcode", "") != DELETE_PASSCODE:
        return _error_response("Noto'g'ri parol", 403)
    try:
        deleted = get_storage().delete_case(case_name)
    except StorageError as exc:
        return _error_response(str(exc), 500)
    except AttributeError:
        return _error_response("Bu storage turi o'chirishni qo'llab-quvvatlamaydi", 501)
    if not deleted:
        return _error_response("Ish topilmadi", 404)
    return jsonify({"success": True, "deleted": case_name})


# ── Authentication ─────────────────────────────────────────────────────────

import hashlib
import secrets
from datetime import datetime, timedelta


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def generate_token() -> str:
    return secrets.token_hex(32)


def ensure_auth_schema():
    storage = get_storage()
    with storage._connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id BIGSERIAL PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    full_name TEXT,
                    role TEXT NOT NULL DEFAULT 'auditor',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS auth_tokens (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMPTZ NOT NULL
                )
            """)
            cur.execute("SELECT COUNT(*) as cnt FROM users")
            row = cur.fetchone()
            if row['cnt'] == 0:
                cur.execute("""
                    INSERT INTO users (username, password_hash, full_name, role)
                    VALUES (%s, %s, %s, %s)
                """, ('admin', hash_password('admin123'), 'Administrator', 'admin'))
            cur.execute("SELECT id FROM users WHERE username = %s", ('Kamoliddin',))
            kamoliddin = cur.fetchone()
            if not kamoliddin:
                cur.execute("""
                    INSERT INTO users (username, password_hash, full_name, role)
                    VALUES (%s, %s, %s, %s) RETURNING id
                """, ('Kamoliddin', hash_password('abulika8'), 'Kamoliddin', 'admin'))
                kamoliddin = cur.fetchone()
            else:
                cur.execute("UPDATE users SET role = 'admin' WHERE username = 'Kamoliddin'")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS aud_name TEXT")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS aud_jshshr TEXT")
            cur.execute("ALTER TABLE cases ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id)")
            if kamoliddin:
                cur.execute(
                    "UPDATE cases SET created_by = %s WHERE created_by IS NULL",
                    (kamoliddin['id'],)
                )
                cur.execute("""
                    UPDATE cases SET created_by = %s
                    WHERE created_by IN (SELECT id FROM users WHERE username = 'admin')
                """, (kamoliddin['id'],))
        conn.commit()


def get_user_from_token(token: str):
    storage = get_storage()
    with storage._connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.username, u.full_name, u.role
                FROM auth_tokens t
                JOIN users u ON u.id = t.user_id
                WHERE t.token = %s AND t.expires_at > NOW()
            """, (token,))
            return cur.fetchone()


def require_auth():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return None
    return get_user_from_token(token)


@app.route("/auth/register", methods=["POST"])
def register():
    ensure_auth_schema()
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    full_name = data.get('full_name', '').strip()
    if not username or not password:
        return jsonify({"success": False, "error": "Username and password required"}), 400
    if len(password) < 6:
        return jsonify({"success": False, "error": "Password must be at least 6 characters"}), 400
    storage = get_storage()
    try:
        with storage._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE username = %s", (username,))
                if cur.fetchone():
                    return jsonify({"success": False, "error": "Username already exists"}), 409
                cur.execute("""
                    INSERT INTO users (username, password_hash, full_name)
                    VALUES (%s, %s, %s) RETURNING id
                """, (username, hash_password(password), full_name))
            conn.commit()
        return jsonify({"success": True, "message": "Account created successfully"})
    except Exception as e:
        return _error_response(str(e))


@app.route("/auth/login", methods=["POST"])
def login():
    ensure_auth_schema()
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    if not username or not password:
        return jsonify({"success": False, "error": "Username and password required"}), 400
    storage = get_storage()
    with storage._connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, username, full_name, role FROM users
                WHERE username = %s AND password_hash = %s
            """, (username, hash_password(password)))
            user = cur.fetchone()
            if not user:
                return jsonify({"success": False, "error": "Invalid username or password"}), 401
            token = generate_token()
            expires_at = datetime.now() + timedelta(days=30)
            cur.execute("""
                INSERT INTO auth_tokens (user_id, token, expires_at)
                VALUES (%s, %s, %s)
            """, (user['id'], token, expires_at))
        conn.commit()
    return jsonify({
        "success": True,
        "token": token,
        "user": {
            "id": user['id'],
            "username": user['username'],
            "full_name": user['full_name'],
            "role": user['role'],
        }
    })


@app.route("/auth/me", methods=["GET"])
def me():
    ensure_auth_schema()
    user = require_auth()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    return jsonify({"success": True, "user": dict(user)})


@app.route("/auth/logout", methods=["POST"])
def logout():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if token:
        storage = get_storage()
        with storage._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM auth_tokens WHERE token = %s", (token,))
            conn.commit()
    return jsonify({"success": True})


@app.route("/auth/profile", methods=["GET"])
def get_profile():
    ensure_auth_schema()
    user = require_auth()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    storage = get_storage()
    with storage._connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT aud_name, aud_jshshr FROM users WHERE id = %s",
                (user['id'],)
            )
            row = cur.fetchone()
    return jsonify({
        "success": True,
        "aud_name":   row['aud_name']   or '',
        "aud_jshshr": row['aud_jshshr'] or '',
    })


@app.route("/auth/profile", methods=["PUT"])
def update_profile():
    ensure_auth_schema()
    user = require_auth()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    aud_name    = data.get('aud_name',    '').strip()
    aud_jshshr  = data.get('aud_jshshr',  '').strip()
    storage = get_storage()
    with storage._connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET aud_name = %s, aud_jshshr = %s WHERE id = %s",
                (aud_name, aud_jshshr, user['id'])
            )
        conn.commit()
    return jsonify({"success": True})


# ── Drafts ─────────────────────────────────────────────────────────────────

def ensure_drafts_schema():
    storage = get_storage()
    with storage._connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS drafts (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    form_data JSONB NOT NULL DEFAULT '{}',
                    step INTEGER NOT NULL DEFAULT 1,
                    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(user_id)
                )
            """)
        conn.commit()


@app.route("/drafts", methods=["GET"])
def get_draft():
    ensure_auth_schema()
    user = require_auth()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    try:
        ensure_drafts_schema()
        storage = get_storage()
        with storage._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT form_data, step, saved_at FROM drafts WHERE user_id = %s",
                    (user['id'],)
                )
                row = cur.fetchone()
        if not row:
            return jsonify({"success": True, "draft": None})
        return jsonify({
            "success": True,
            "draft": {
                "formData": row['form_data'],
                "step": row['step'],
                "savedAt": row['saved_at'].isoformat() if row['saved_at'] else None,
            }
        })
    except Exception as exc:
        return _error_response(str(exc))


@app.route("/drafts", methods=["PUT"])
def save_draft():
    ensure_auth_schema()
    user = require_auth()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    try:
        ensure_drafts_schema()
        import json as _json
        data = request.get_json(silent=True) or {}
        form_data = data.get('formData', {})
        step = data.get('step', 1)
        storage = get_storage()
        with storage._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO drafts (user_id, form_data, step, saved_at)
                    VALUES (%s, %s::jsonb, %s, NOW())
                    ON CONFLICT (user_id) DO UPDATE
                    SET form_data = EXCLUDED.form_data,
                        step      = EXCLUDED.step,
                        saved_at  = NOW()
                """, (user['id'], _json.dumps(form_data), step))
            conn.commit()
        return jsonify({"success": True})
    except Exception as exc:
        return _error_response(str(exc))


@app.route("/drafts", methods=["DELETE"])
def clear_draft():
    ensure_auth_schema()
    user = require_auth()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    try:
        ensure_drafts_schema()
        storage = get_storage()
        with storage._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM drafts WHERE user_id = %s", (user['id'],))
            conn.commit()
        return jsonify({"success": True})
    except Exception as exc:
        return _error_response(str(exc))


# ── Case ownership ─────────────────────────────────────────────────────────

@app.route("/auth/migrate-cases", methods=["POST"])
def migrate_cases():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user = get_user_from_token(token)
    if not user or user['role'] != 'admin':
        return jsonify({"success": False, "error": "Admin only"}), 403
    storage = get_storage()
    with storage._connect() as conn:
        with conn.cursor() as cur:
            cur.execute("ALTER TABLE cases ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id)")
            cur.execute("UPDATE cases SET created_by = 1 WHERE created_by IS NULL")
            cur.execute("SELECT COUNT(*) as cnt FROM cases WHERE created_by = 1")
            row = cur.fetchone()
        conn.commit()
    return jsonify({"success": True, "migrated": row['cnt']})


@app.route("/cases/<case_name>/delete", methods=["POST"])
def delete_case_with_auth(case_name):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        ensure_auth_schema()
    except Exception:
        pass
    user = get_user_from_token(token)
    if not user:
        return _error_response("Unauthorized", 401)
    storage = get_storage()
    with storage._connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT created_by FROM cases WHERE case_name = %s", (case_name,))
            case = cur.fetchone()
            if not case:
                return _error_response("Case not found", 404)
            if user['role'] != 'admin' and case['created_by'] != user['id']:
                return _error_response("You can only delete your own cases", 403)
    try:
        deleted = storage.delete_case(case_name)
        if not deleted:
            return _error_response("Case not found", 404)
        return jsonify({"success": True, "deleted": case_name})
    except Exception as exc:
        return _error_response(str(exc))


# ── Bill OCR ───────────────────────────────────────────────────────────────

@app.route("/ocr-bill", methods=["POST"])
def ocr_bill():
    try:
        import pytesseract
        from pytesseract import Output as TessOutput
    except ImportError:
        return jsonify({
            "success": False,
            "error": "Tesseract not available. Run: sudo apt install tesseract-ocr && pip install pytesseract"
        }), 503

    from PIL import Image, ImageEnhance
    import re

    if "image" not in request.files:
        return _error_response("No 'image' field", 400)
    raw = request.files["image"].read()
    if not raw:
        return _error_response("Empty file", 400)

    img = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = img.size
    chart = img.crop((0, int(h * 0.15), w, int(h * 0.75)))
    cw, ch = chart.size
    gray = chart.convert("L")
    gray = ImageEnhance.Contrast(gray).enhance(2.5)
    gray = gray.resize((cw * 2, ch * 2), Image.LANCZOS)
    fw, fh = gray.size

    ocr = pytesseract.image_to_data(
        gray,
        output_type=TessOutput.DICT,
        config="--psm 11 --oem 3",
    )

    month_abbr = ['yan', 'feb', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek']
    values = []
    months_found = []

    for i in range(len(ocr["text"])):
        text = ocr["text"][i].strip()
        conf = int(ocr["conf"][i])
        if conf < 30 or not text or len(text) > 6:
            continue
        cx = ocr["left"][i] + ocr["width"][i] / 2
        cy = ocr["top"][i] + ocr["height"][i] / 2
        if cx < fw * 0.10:
            continue
        cleaned = re.sub(r"[^\d.,]", "", text).replace(",", ".").strip(".")
        if cleaned:
            try:
                val = float(cleaned)
                if 10 < val < 10000:
                    values.append({"val": val, "x": cx, "y": cy, "conf": conf})
                    continue
            except ValueError:
                pass
        text_lower = text.lower().strip()
        for month_idx, month in enumerate(month_abbr):
            if month in text_lower or text_lower.startswith(month[:2]):
                if cy > fh * 0.60:
                    months_found.append({"month": month_idx, "x": cx, "conf": conf})
                break

    values.sort(key=lambda r: r["x"])
    deduped_vals = []
    for item in values:
        if deduped_vals and abs(item["x"] - deduped_vals[-1]["x"]) < fw * 0.05:
            if item["conf"] > deduped_vals[-1]["conf"]:
                deduped_vals[-1] = item
        else:
            deduped_vals.append(item)

    extracted_values = [round(r["val"], 1) for r in deduped_vals[:12]]
    start_month_idx = 0
    if months_found:
        months_found.sort(key=lambda r: r["x"])
        start_month_idx = months_found[0]["month"]

    return jsonify({
        "success": True,
        "values": extracted_values,
        "start_month": start_month_idx,
        "count": len(extracted_values),
    })


# ── Scan bill screenshots (Google Vision + crop-based OCR) ────────────────

# Fixed crop regions calibrated for 1080×1920 normalised images
_GAS_BAR_REGIONS = {
    0: (80,  420, 220, 520),   # Jan
    1: (220, 420, 360, 520),   # Feb
    2: (360, 420, 500, 520),   # Mar
    3: (500, 420, 640, 520),   # Apr
    4: (640, 420, 780, 520),   # May
    5: (780, 420, 920, 520),   # Jun
}
_GAS_TABLE_REGIONS = {
    11: (100, 1050, 900, 1150),  # Dec
    10: (100, 1150, 900, 1250),  # Nov
    9:  (100, 1250, 900, 1350),  # Oct
    8:  (100, 1350, 900, 1450),  # Sep
    7:  (100, 1450, 900, 1550),  # Aug
    6:  (100, 1550, 900, 1650),  # Jul
}
_ELEC_REGIONS = {
    0: (80,  500, 220, 600),   # Jan
    1: (220, 500, 360, 600),   # Feb
    2: (360, 500, 500, 600),   # Mar
    3: (500, 500, 640, 600),   # Apr
    4: (640, 500, 780, 600),   # May
    5: (780, 500, 920, 600),   # Jun
    6: (920, 500, 1060, 600),  # Jul
}


def _gv_crop_ocr(client, gv, img_cv, box):
    """Crop one region from img_cv, run Google Vision text detection, return int or None."""
    import re as _re
    import cv2 as _cv2
    x1, y1, x2, y2 = box
    crop = img_cv[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    _, enc = _cv2.imencode('.jpg', crop)
    resp = client.text_detection(image=gv.Image(content=enc.tobytes()))
    if not resp.text_annotations:
        return None
    nums = _re.findall(r'\d+', resp.text_annotations[0].description)
    return int(''.join(nums)) if nums else None


def _process_bill_bytes(img_bytes):
    """Deterministic crop-based Google Vision pipeline.
    Returns (bill_type, year, data_list) where data_list = [{'month': 0-11, 'value': int}].
    Raises RuntimeError if required packages are missing.
    """
    import re as _re
    try:
        import numpy as _np
        import cv2 as _cv2
        from google.cloud import vision as _gv
    except ImportError as exc:
        raise RuntimeError(f"OCR dependency missing: {exc}") from exc

    arr = _np.frombuffer(img_bytes, _np.uint8)
    img = _cv2.imdecode(arr, _cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError('Cannot decode image')
    img = _cv2.resize(img, (1080, 1920))

    client = _gv.ImageAnnotatorClient()

    # Full-image OCR — only to detect type and year, not values
    _, enc = _cv2.imencode('.jpg', img)
    resp = client.text_detection(image=_gv.Image(content=enc.tobytes()))
    if not resp.text_annotations:
        return None, None, []

    full = resp.text_annotations[0].description.lower()

    bill_type = None
    if "iste'mol" in full or 'iste mol' in full or 'mygaz' in full:
        bill_type = 'gas'
    elif 'statistika' in full or 'myelektro' in full or 'my elektro' in full:
        bill_type = 'elec'

    year = None
    ym = _re.search(r'\b(202\d)\b', full)
    if ym:
        year = int(ym.group(1))

    if bill_type == 'gas':
        regions = {**_GAS_BAR_REGIONS, **_GAS_TABLE_REGIONS}
    elif bill_type == 'elec':
        regions = dict(_ELEC_REGIONS)
    else:
        regions = {}

    data = []
    for month_idx, box in sorted(regions.items()):
        val = _gv_crop_ocr(client, _gv, img, box)
        if val is not None:
            data.append({'month': month_idx, 'value': val})

    return bill_type, year, data


@app.route("/scan-bills", methods=["POST", "OPTIONS"])
def scan_bills():
    """Accept stored photo keys, run Google Vision crop-OCR on each.

    Request body: {"keys": ["uuid1", "uuid2", ...]}
    Response: {"success": true, "results": [
        {"type": "gas"|"elec"|null, "year": int|null,
         "data": [{"month": 0-11, "value": int}, ...]}
    ]}
    """
    body = request.get_json(silent=True) or {}
    keys = body.get("keys", [])
    if not keys:
        return _error_response("No keys provided", 400)

    results = []
    for key in keys:
        photo = _temp_photo_get(key)
        if not photo:
            continue
        img_bytes, _mime, _, _ = photo
        try:
            bill_type, year, data = _process_bill_bytes(img_bytes)
            results.append({"type": bill_type, "year": year, "data": data})
        except Exception as exc:
            results.append({"type": None, "year": None, "data": [], "error": str(exc)})

    return jsonify({"success": True, "results": results})


@app.route("/scan-bill", methods=["POST", "OPTIONS"])
def scan_bill():
    """Accept an image upload, store it, run crop-based Google Vision OCR.

    Response: {success, key, type: 'gas'|'elec'|null, year: int|null,
               data: [{month: 0-11, value: int}]}
    """
    if "image" not in request.files:
        return _error_response("No 'image' field", 400)
    raw = request.files["image"].read()
    if not raw:
        return _error_response("Empty file", 400)

    from PIL import Image as _PILImg
    try:
        pil = _PILImg.open(io.BytesIO(raw)).convert("RGB")
        buf = io.BytesIO()
        pil.save(buf, "JPEG", quality=90)
        stored = buf.getvalue()
    except Exception:
        stored = raw
    key = str(_uuid.uuid4())
    _temp_photo_save(key, stored, "image/jpeg", f"bill_{key}.jpg")

    try:
        bill_type, year, data = _process_bill_bytes(stored)
        return jsonify({"success": True, "key": key, "type": bill_type, "year": year, "data": data})
    except Exception as exc:
        return jsonify({"success": True, "key": key, "type": None, "year": None,
                        "data": [], "ocr_error": str(exc)})


# ── Entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5050"))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"\n{'=' * 50}")
    print("  Energy Audit server running.")
    print(f"  Open: http://{host}:{port}")
    print(f"{'=' * 50}\n")
    app.run(host=host, port=port, debug=False)