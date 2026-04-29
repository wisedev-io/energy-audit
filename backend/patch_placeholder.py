import re

new_func = """def _insert_photos_by_placeholder(doc, photo_paths_by_sec, photo_widths=None):
    \"\"\"Replace {{photo_secN_M}} or {{photo_N}} placeholders with uploaded photos.\"\"\"
    import re as _re
    if photo_widths is None:
        photo_widths = {}

    flat_photos = []
    for sec_id in sorted(photo_paths_by_sec.keys()):
        for path in photo_paths_by_sec[sec_id]:
            flat_photos.append((path, sec_id))

    pat_global = _re.compile(r'^\\{\\{photo_(\\d+)\\}\\}$')
    pat_sec    = _re.compile(r'^\\{\\{photo_sec(\\d+)_(\\d+)\\}\\}$')

    for table in doc.tables:
        for row in table.rows:
            seen = set()
            for cell in row.cells:
                if id(cell._tc) in seen:
                    continue
                seen.add(id(cell._tc))
                txt = cell.text.strip()

                m = pat_sec.match(txt)
                if m:
                    sec_id = int(m.group(1))
                    n      = int(m.group(2)) - 1
                    sec_photos = photo_paths_by_sec.get(sec_id, [])
                    if n < len(sec_photos):
                        path = _convert_image_if_needed(Path(sec_photos[n]))
                        if path.exists():
                            width_in = photo_widths.get(sec_id, DEFAULT_PHOTO_WIDTHS.get(sec_id, 3.0))
                            _insert_image_in_cell(cell, str(path), table=table, width_in=width_in)
                    continue

                m = pat_global.match(txt)
                if m:
                    n = int(m.group(1)) - 1
                    if n < len(flat_photos):
                        path, sec_id = flat_photos[n]
                        path = _convert_image_if_needed(Path(path))
                        if path.exists():
                            width_in = photo_widths.get(sec_id, DEFAULT_PHOTO_WIDTHS.get(sec_id, 3.0))
                            _insert_image_in_cell(cell, str(path), table=table, width_in=width_in)

"""

with open('/opt/energy-audit/generate.py', 'r') as f:
    src = f.read()

start = src.find('def _insert_photos_by_placeholder(')
end   = src.find('\n# ── Fill U-value', start)

if start == -1 or end == -1:
    print('ERROR: could not find function boundaries')
else:
    result = src[:start] + new_func + src[end:]
    with open('/opt/energy-audit/generate.py', 'w') as f:
        f.write(result)
    print('OK: _insert_photos_by_placeholder replaced')
