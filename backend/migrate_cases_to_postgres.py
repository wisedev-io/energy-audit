"""
Import legacy case folders from ./cases into PostgreSQL storage.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from storage import BinaryUpload, get_storage, guess_mimetype

BASE_DIR = Path(__file__).parent
CASES_DIR = BASE_DIR / "cases"


def _parse_timestamp(raw):
    if not raw:
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _load_json(path):
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def main():
    storage = get_storage()
    storage.ensure_schema()

    if not CASES_DIR.exists():
        print("No legacy cases directory found.")
        return

    migrated = 0
    for case_dir in sorted(CASES_DIR.iterdir()):
        if not case_dir.is_dir():
            continue

        meta = _load_json(case_dir / "meta.json")
        form_data = _load_json(case_dir / "form_data.json")
        case_name = case_dir.name
        case_no = meta.get("case_no") or case_name.split("_")[0].replace("EA-", "")
        owner = meta.get("owner") or form_data.get("owner", "")

        files = []
        for file_path in sorted(case_dir.iterdir()):
            if not file_path.is_file():
                continue
            if file_path.name in {"form_data.json", "meta.json"} or file_path.name.startswith("~$"):
                continue
            if file_path.suffix.lower() == ".xlsx":
                file_kind = "excel"
            elif "passport" in file_path.name.lower():
                file_kind = "passport"
            else:
                file_kind = "report"
            files.append(
                {
                    "filename": file_path.name,
                    "file_kind": file_kind,
                    "mime_type": guess_mimetype(file_path.name),
                    "content": file_path.read_bytes(),
                }
            )

        photos = {}
        photos_dir = case_dir / "photos"
        if photos_dir.exists():
            for photo_path in sorted(photos_dir.iterdir()):
                if not photo_path.is_file():
                    continue
                try:
                    sec_str, slot_str = photo_path.stem[1:].split("_", 1)
                    sec_id = int(sec_str)
                    slot_no = int(slot_str)
                except Exception:
                    continue
                photos[(sec_id, slot_no)] = BinaryUpload(
                    filename=photo_path.name,
                    content=photo_path.read_bytes(),
                    mimetype=guess_mimetype(photo_path.name),
                )

        storage.save_case(
            case_name=case_name,
            case_no=case_no,
            owner=owner,
            form_data=form_data,
            files=files,
            photos=photos,
            created_at=_parse_timestamp(meta.get("created_at")),
            updated_at=_parse_timestamp(meta.get("updated_at") or meta.get("created_at")),
        )
        migrated += 1
        print(f"Migrated {case_name}")

    print(f"Done. Migrated {migrated} cases.")


if __name__ == "__main__":
    main()

