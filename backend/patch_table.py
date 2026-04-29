import re

new_func = '''def _fill_energy_table(table, rows, summary, year):
    """Fill a monthly energy Word table from calculated rows."""
    month_start = 1

    for i, r in enumerate(rows):
        row_idx = month_start + i
        if row_idx >= len(table.rows):
            break
        trow = table.rows[row_idx]

        seen, unique = set(), []
        for cell in trow.cells:
            if id(cell._tc) not in seen:
                seen.add(id(cell._tc))
                unique.append(cell)

        def set_c(idx, val):
            if idx < len(unique):
                _set_cell_text(unique[idx], val, font_size=11, font_name='Cambria')

        set_c(0, r['month'])
        set_c(1, int(r['elec_kwh']))
        set_c(2, int(r['gas_m3']))
        set_c(3, int(r['gas_kwh']))
        set_c(4, int(r['other_kg']))
        set_c(5, int(r['other_kwh']))
        set_c(6, int(r['total_kwh']))

    jami_idx = 13
    if jami_idx < len(table.rows):
        seen, unique = set(), []
        for cell in table.rows[jami_idx].cells:
            if id(cell._tc) not in seen:
                seen.add(id(cell._tc))
                unique.append(cell)

        def set_j(idx, val):
            if idx < len(unique):
                _set_cell_text(unique[idx], val, bold=True, font_size=11, font_name='Cambria')

        set_j(0, 'JAMI')
        set_j(1, int(summary['total_elec']))
        set_j(2, int(summary['total_gas']))
        set_j(3, int(summary['total_gkwh']))
        set_j(4, int(summary['total_okg']))
        set_j(5, int(summary['total_okwh']))
        set_j(6, int(summary['total_kwh']))

    def _fill_between(row_idx, before_label, after_label, value, bold=False):
        if row_idx >= len(table.rows):
            return
        row = table.rows[row_idx]
        seen, past_before = set(), False
        for cell in row.cells:
            if id(cell._tc) in seen:
                continue
            seen.add(id(cell._tc))
            txt = cell.text.strip()
            if before_label and before_label in txt:
                past_before = True
                continue
            if past_before or not before_label:
                if after_label and after_label in txt:
                    break
                if not txt or txt == '\xa0':
                    _set_cell_text(cell, str(value), bold=bold, font_size=11, font_name='Cambria')
                    return

    _fill_between(14, 'JAMI yillik', 'kW',     int(summary['total_kwh']), bold=True)
    _fill_between(15, 'Ulushi',      'gaz',    f"{summary['pct_gas']}%",   bold=True)
    _fill_between(15, 'gaz',         'elektr', f"{summary['pct_elec']}%",  bold=True)
    _fill_between(15, 'elektr',      'boshqa', f"{summary['pct_other']}%", bold=True)
    _fill_between(16, 'Yillik',      'mln',    f"{summary['total_mln']:.4f}", bold=True)

'''

with open('/opt/energy-audit/generate.py', 'r') as f:
    src = f.read()

pattern = r'def _fill_energy_table\(table, rows, summary, year\):.*?(?=\ndef _fill_comparison_table)'
result = re.sub(pattern, new_func.lstrip(), src, flags=re.DOTALL)

if result == src:
    print('ERROR: pattern not matched — nothing replaced!')
else:
    with open('/opt/energy-audit/generate.py', 'w') as f:
        f.write(result)
    print('OK: _fill_energy_table replaced successfully')