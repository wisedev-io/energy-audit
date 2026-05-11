"""
PostgreSQL-backed storage for cases, generated files, and uploaded photos.
"""

from __future__ import annotations

import mimetypes
import os
from dataclasses import dataclass
from datetime import datetime

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError as exc:  # pragma: no cover - depends on local environment
    psycopg = None
    dict_row = None
    _PSYCOPG_IMPORT_ERROR = exc
else:
    _PSYCOPG_IMPORT_ERROR = None


class StorageError(RuntimeError):
    """Raised when PostgreSQL storage cannot be used."""


@dataclass(frozen=True)
class BinaryUpload:
    """Normalized uploaded file kept in the database."""

    filename: str
    content: bytes
    mimetype: str | None = None


def guess_mimetype(filename: str) -> str:
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/octet-stream"


class PostgresStorage:
    def __init__(self, dsn: str | None = None):
        self.dsn = dsn or os.environ.get("DATABASE_URL", "").strip()
        self._schema_ready = False

    def _connect(self):
        if psycopg is None:
            raise StorageError(
                "PostgreSQL support requires the 'psycopg' package. "
                "Install dependencies from requirements.txt first."
            ) from _PSYCOPG_IMPORT_ERROR
        if not self.dsn:
            raise StorageError("DATABASE_URL is not set.")
        try:
            return psycopg.connect(self.dsn, row_factory=dict_row)
        except Exception as exc:
            raise StorageError(f"PostgreSQL connection failed: {exc}") from exc

    def ensure_schema(self):
        if self._schema_ready:
            return

        statements = [
            """
            CREATE TABLE IF NOT EXISTS app_counters (
                name TEXT PRIMARY KEY,
                last_value BIGINT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS cases (
                id BIGSERIAL PRIMARY KEY,
                case_name TEXT NOT NULL UNIQUE,
                case_no TEXT NOT NULL UNIQUE,
                owner TEXT,
                form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS case_files (
                id BIGSERIAL PRIMARY KEY,
                case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
                filename TEXT NOT NULL,
                file_kind TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                content BYTEA NOT NULL,
                size_bytes BIGINT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (case_id, filename)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS case_photos (
                id BIGSERIAL PRIMARY KEY,
                case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
                sec_id INTEGER NOT NULL,
                slot_no INTEGER NOT NULL,
                filename TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                content BYTEA NOT NULL,
                size_bytes BIGINT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (case_id, sec_id, slot_no)
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_case_files_case_id ON case_files(case_id)",
            "CREATE INDEX IF NOT EXISTS idx_case_photos_case_id ON case_photos(case_id)",
        ]

        with self._connect() as conn:
            with conn.cursor() as cur:
                for statement in statements:
                    cur.execute(statement)
            conn.commit()

        self._schema_ready = True

    def healthcheck(self):
        self.ensure_schema()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 AS ok")
                row = cur.fetchone()
        return bool(row and row["ok"] == 1)

    def next_case_number(self) -> str:
        self.ensure_schema()
        year = datetime.now().strftime("%y")
        prefix = year
        with self._connect() as conn:
            with conn.cursor() as cur:
                # Floor: max existing case_no for this year (guards against counter desync)
                cur.execute(
                    """
                    SELECT COALESCE(MAX(CAST(SUBSTRING(case_no FROM 3) AS BIGINT)), 0) AS max_seq
                    FROM cases
                    WHERE case_no ~ %s
                    """,
                    (f"^{prefix}\\d{{5}}$",),
                )
                max_seq = cur.fetchone()["max_seq"]

                cur.execute(
                    """
                    INSERT INTO app_counters (name, last_value)
                    VALUES ('case_number', %s)
                    ON CONFLICT (name)
                    DO UPDATE SET last_value = GREATEST(app_counters.last_value + 1, %s)
                    RETURNING last_value
                    """,
                    (max_seq + 1, max_seq + 1),
                )
                row = cur.fetchone()
            conn.commit()
        return f"{year}{int(row['last_value']):05d}"

    def peek_next_case_number(self) -> str:
        self.ensure_schema()
        year = datetime.now().strftime("%y")
        prefix = year
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT last_value FROM app_counters WHERE name = 'case_number'"
                )
                row = cur.fetchone()
                counter_val = int(row['last_value']) if row else 0
                cur.execute(
                    """
                    SELECT COALESCE(MAX(CAST(SUBSTRING(case_no FROM 3) AS BIGINT)), 0) AS max_seq
                    FROM cases WHERE case_no ~ %s
                    """,
                    (f"^{prefix}\\d{{5}}$",),
                )
                max_seq = cur.fetchone()["max_seq"]
        next_val = max(counter_val + 1, max_seq + 1)
        return f"{year}{next_val:05d}"

    def case_no_exists(self, case_no: str) -> bool:
        self.ensure_schema()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM cases WHERE case_no = %s", (case_no,))
                return cur.fetchone() is not None

    def get_case(self, case_name: str):
        self.ensure_schema()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, case_name, case_no, owner, created_at, updated_at
                    FROM cases
                    WHERE case_name = %s
                    """,
                    (case_name,),
                )
                return cur.fetchone()

    def save_case(
        self,
        case_name: str,
        case_no: str,
        owner: str,
        form_data: dict,
        files: list[dict],
        photos: dict[tuple[int, int], BinaryUpload],
        created_by: int | None = None,
        *,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ):
        self.ensure_schema()
        form_data_json = psycopg.types.json.Jsonb(form_data)

        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM cases WHERE case_name = %s",
                    (case_name,),
                )
                existing = cur.fetchone()

                if existing:
                    case_id = existing["id"]
                    if updated_at is None:
                        cur.execute(
                            """
                            UPDATE cases
                            SET case_no = %s,
                                owner = %s,
                                form_data = %s,
                                updated_at = NOW()
                            WHERE id = %s
                            """,
                            (case_no, owner, form_data_json, case_id),
                        )
                    else:
                        cur.execute(
                            """
                            UPDATE cases
                            SET case_no = %s,
                                owner = %s,
                                form_data = %s,
                                updated_at = %s
                            WHERE id = %s
                            """,
                            (case_no, owner, form_data_json, updated_at, case_id),
                        )
                else:
                    if created_at is None and updated_at is None:
                        cur.execute(
                            """
                            INSERT INTO cases (case_name, case_no, owner, form_data, created_by)
                            VALUES (%s, %s, %s, %s, %s)
                            RETURNING id
                            """,
                            (case_name, case_no, owner, form_data_json, created_by),
                        )
                    else:
                        cur.execute(
                            """
                            INSERT INTO cases (
                                case_name, case_no, owner, form_data, created_at, updated_at
                            )
                            VALUES (
                                %s, %s, %s, %s, %s, %s
                            )
                            RETURNING id
                            """,
                            (
                                case_name,
                                case_no,
                                owner,
                                form_data_json,
                                created_at or updated_at or datetime.now(),
                                updated_at or created_at or datetime.now(),
                            ),
                        )
                    case_id = cur.fetchone()["id"]

                cur.execute("DELETE FROM case_files WHERE case_id = %s", (case_id,))
                for record in files:
                    content = record["content"]
                    cur.execute(
                        """
                        INSERT INTO case_files (
                            case_id, filename, file_kind, mime_type, content, size_bytes
                        )
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            case_id,
                            record["filename"],
                            record["file_kind"],
                            record["mime_type"],
                            content,
                            len(content),
                        ),
                    )

                cur.execute("DELETE FROM case_photos WHERE case_id = %s", (case_id,))
                for (sec_id, slot_no), upload in sorted(photos.items()):
                    mime_type = upload.mimetype or guess_mimetype(upload.filename)
                    cur.execute(
                        """
                        INSERT INTO case_photos (
                            case_id, sec_id, slot_no, filename, mime_type, content, size_bytes
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            case_id,
                            sec_id,
                            slot_no,
                            upload.filename,
                            mime_type,
                            upload.content,
                            len(upload.content),
                        ),
                    )
            conn.commit()

    def list_cases(self) -> list[dict]:
        self.ensure_schema()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        c.case_name AS name,
                        c.owner,
                        c.created_at,
                        c.updated_at,
                        c.created_by,
                        u.username AS created_by_username,
                        COALESCE(
                            ARRAY_AGG(f.filename ORDER BY f.filename)
                            FILTER (WHERE f.filename IS NOT NULL),
                            ARRAY[]::TEXT[]
                        ) AS files
                    FROM cases c
                    LEFT JOIN case_files f ON f.case_id = c.id
                    LEFT JOIN users u ON u.id = c.created_by
                    GROUP BY c.id, u.username
                    ORDER BY c.updated_at DESC, c.created_at DESC
                    """
                )
                rows = cur.fetchall()

        cases = []
        for row in rows:
            cases.append(
                {
                    "name": row["name"],
                    "files": row["files"] or [],
                    "created_at": self._format_dt(row["created_at"]),
                    "updated_at": self._format_dt(row["updated_at"]),
                    "owner": row["owner"] or "",
                    "created_by": row["created_by"],
                    "created_by_username": row["created_by_username"] or "unknown",
                }
            )
        return cases

    def get_case_form(self, case_name: str):
        self.ensure_schema()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT form_data
                    FROM cases
                    WHERE case_name = %s
                    """,
                    (case_name,),
                )
                row = cur.fetchone()
        if not row:
            return None
        return row["form_data"]

    def get_case_file(self, case_name: str, filename: str):
        self.ensure_schema()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT f.filename, f.mime_type, f.content
                    FROM case_files f
                    JOIN cases c ON c.id = f.case_id
                    WHERE c.case_name = %s AND f.filename = %s
                    """,
                    (case_name, filename),
                )
                return cur.fetchone()

    def get_case_photos(self, case_name: str) -> dict[tuple[int, int], BinaryUpload]:
        self.ensure_schema()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT p.sec_id, p.slot_no, p.filename, p.mime_type, p.content
                    FROM case_photos p
                    JOIN cases c ON c.id = p.case_id
                    WHERE c.case_name = %s
                    ORDER BY p.sec_id, p.slot_no
                    """,
                    (case_name,),
                )
                rows = cur.fetchall()

        return {
            (row["sec_id"], row["slot_no"]): BinaryUpload(
                filename=row["filename"],
                content=row["content"],
                mimetype=row["mime_type"],
            )
            for row in rows
        }


    def rename_case(self, old_name: str, new_name: str) -> None:
        self.ensure_schema()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE cases SET case_name = %s WHERE case_name = %s",
                    (new_name, old_name),
                )
            conn.commit()

    def delete_case(self, case_name: str) -> bool:
        self.ensure_schema()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM cases WHERE case_name = %s RETURNING id",
                    (case_name,),
                )
                deleted = cur.fetchone()
            conn.commit()
        return deleted is not None

    @staticmethod
    def _format_dt(value) -> str:
        if not value:
            return ""
        if hasattr(value, "astimezone"):
            value = value.astimezone()
        return value.strftime("%Y-%m-%d %H:%M")


_STORAGE: PostgresStorage | None = None


def get_storage() -> PostgresStorage:
    global _STORAGE
    if _STORAGE is None:
        _STORAGE = PostgresStorage()
    return _STORAGE
