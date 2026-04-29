"""
Energy calculation module — replicates Excel tariff logic exactly.
All costs in Uzbek som, energy in kWh, gas in m³, other fuel in kg.
"""

MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
          'Iyul', 'Avgust', 'Sentabr', 'Oktyabr', 'Noyabr', 'Dekabr']

GAS_KWH = 9.5      # 1 m³ natural gas = 9.5 kWh
OTHER_KWH = 6.98   # 1 kg other fuel = 6.98 kWh
CO2_PER_KWH = 0.5  # kg CO₂ per kWh electricity (Uzbekistan grid)

# FES (Solar PV) lookup: kW → (annual_kWh, investment_mln, payback_str)
FES_TABLE = {
    5:  {'kWh': 7500,  'mln': 25.0,  'payb': '3.3 yil'},
    10: {'kWh': 15000, 'mln': 37.5,  'payb': '2.5 yil'},
    15: {'kWh': 22500, 'mln': 52.0,  'payb': '2.3 yil'},
    20: {'kWh': 30000, 'mln': 66.0,  'payb': '2.2 yil'},
    25: {'kWh': 37500, 'mln': 80.0,  'payb': '2.1 yil'},
    30: {'kWh': 45000, 'mln': 90.0,  'payb': '2.0 yil'},
    35: {'kWh': 52500, 'mln': 101.0, 'payb': '1.9 yil'},
}

# Heliocollector lookup: litres → (investment_mln, saved_kWh, saved_som)
GELIO_TABLE = {
    100: {'inv': 2.5, 'kwh': 820,  'som': 820000},
    150: {'inv': 3.5, 'kwh': 1200, 'som': 1200000},
    200: {'inv': 4.5, 'kwh': 1640, 'som': 1640000},
    300: {'inv': 6.5, 'kwh': 2400, 'som': 2400000},
}


def _tiered(amount, bands):
    """Tiered cost. bands = [(cap, rate), ...] cap is cumulative limit."""
    cost = 0.0
    prev = 0
    for cap, rate in bands:
        chunk = min(amount, cap) - prev
        if chunk <= 0:
            break
        cost += chunk * rate
        prev = min(amount, cap)
        if amount <= cap:
            break
    return cost


# ── 2023 (flat tariffs) ────────────────────────────────────────────────────

def elektr_cost_2023(kwh):
    return kwh * 295

def gas_cost_2023(m3):
    return m3 * 380

def other_cost_2023(kg):
    return kg * 1000


# ── 2024 ──────────────────────────────────────────────────────────────────

def elektr_cost_2024(kwh, month_idx):
    """month_idx 0=Jan … 11=Dec. Jan-Jun flat 295; Jul-Dec tiered from 450."""
    if month_idx < 6:  # Jan–Jun
        bands = [(200, 295), (800, 900), (4000, 1350), (5000, 1575), (float('inf'), 1800)]
    else:              # Jul–Dec
        bands = [(200, 450), (800, 900), (4000, 1350), (5000, 1575), (float('inf'), 1800)]
    return _tiered(kwh, bands)

def _gas_cost_tiered(m3, quota, rate_in, rate2, rate3, rate4, rate5):
    """Gas tiered cost matching Excel absolute breakpoints at 2500 / 5000 / 10000 m³."""
    cost = min(m3, quota) * rate_in
    if m3 > quota:
        cost += (min(m3, 2500) - quota) * rate2
    if m3 > 2500:
        cost += (min(m3, 5000) - 2500) * rate3
    if m3 > 5000:
        cost += (min(m3, 10000) - 5000) * rate4
    if m3 > 10000:
        cost += (m3 - 10000) * rate5
    return cost


def gas_cost_2024(m3, month_idx):
    """Jan–Apr flat 380. May–Oct quota=100 @ 650. Nov–Dec quota=500 @ 650."""
    if month_idx <= 3:   # Jan–Apr flat
        return m3 * 380
    quota = 500 if month_idx >= 10 else 100
    return _gas_cost_tiered(m3, quota, 650, 1500, 1950, 2275, 2600)

def other_cost_2024(kg):
    return kg * 1300


# ── 2025 ──────────────────────────────────────────────────────────────────

def elektr_cost_2025(kwh, month_idx):
    """Jan–Apr same as 2024 Jul-Dec. May–Dec new higher tariff."""
    if month_idx <= 3:   # Jan–Apr (2024 tariff)
        bands = [(200, 450), (800, 900), (4000, 1350), (5000, 1575), (float('inf'), 1800)]
    else:                # May–Dec (new 2025)
        bands = [(200, 600), (300, 800), (500, 1000), (4000, 1500), (5000, 1750), (float('inf'), 2000)]
    return _tiered(kwh, bands)

def gas_cost_2025(m3, month_idx):
    """Jan–Feb quota=500 old tariff; Mar–Apr quota=100 old; May–Oct quota=100 new; Nov–Dec quota=500 new."""
    if month_idx <= 1:   # Jan–Feb: old tariff, quota=500
        return _gas_cost_tiered(m3, 500, 650, 1500, 1950, 2275, 2600)
    elif month_idx <= 3: # Mar–Apr: old tariff, quota=100
        return _gas_cost_tiered(m3, 100, 650, 1500, 1950, 2275, 2600)
    elif month_idx <= 9: # May–Oct: new tariff, quota=100
        return _gas_cost_tiered(m3, 100, 1000, 1800, 2100, 2500, 3000)
    else:                # Nov–Dec: new tariff, quota=500
        return _gas_cost_tiered(m3, 500, 1000, 1800, 2100, 2500, 3000)

def other_cost_2025(kg):
    return kg * 1500


# ── Main calculation entry point ──────────────────────────────────────────

def calc_year(gas_vals, elec_vals, other_vals, year):
    """
    Compute monthly + annual energy table for one year.
    Returns list of 12 dicts + annual summary dict.
    """
    rows = []
    for i in range(12):
        g  = float(gas_vals[i]   or 0)
        e  = float(elec_vals[i]  or 0)
        o  = float(other_vals[i] or 0)

        gas_kwh   = round(g * GAS_KWH,  2)
        other_kwh = round(o * OTHER_KWH, 2)
        total_kwh = round(e + gas_kwh + other_kwh, 2)

        if year == 2023:
            e_cost = elektr_cost_2023(e)
            g_cost = gas_cost_2023(g)
            o_cost = other_cost_2023(o)
        elif year == 2024:
            e_cost = elektr_cost_2024(e, i)
            g_cost = gas_cost_2024(g, i)
            o_cost = other_cost_2024(o)
        else:  # 2025
            e_cost = elektr_cost_2025(e, i)
            g_cost = gas_cost_2025(g, i)
            o_cost = other_cost_2025(o)

        rows.append({
            'month':     MONTHS[i],
            'elec_kwh':  e,
            'gas_m3':    g,
            'gas_kwh':   gas_kwh,
            'other_kg':  o,
            'other_kwh': other_kwh,
            'total_kwh': total_kwh,
            'elec_cost': round(e_cost),
            'gas_cost':  round(g_cost),
            'other_cost':round(o_cost),
            'total_cost':round(e_cost + g_cost + o_cost),
        })

    total_elec      = sum(r['elec_kwh']   for r in rows)
    total_gas       = sum(r['gas_m3']     for r in rows)
    total_gkwh      = sum(r['gas_kwh']    for r in rows)
    total_okg       = sum(r['other_kg']   for r in rows)
    total_okwh      = sum(r['other_kwh']  for r in rows)
    total_kwh       = sum(r['total_kwh']  for r in rows)
    total_cost      = sum(r['total_cost'] for r in rows)
    total_elec_cost = sum(r['elec_cost']  for r in rows)
    total_gas_cost  = sum(r['gas_cost']   for r in rows)
    total_other_cost= sum(r['other_cost'] for r in rows)

    pct_gas   = round(total_gkwh / total_kwh * 100, 1) if total_kwh else 0
    pct_elec  = round(total_elec / total_kwh * 100, 1) if total_kwh else 0
    pct_other = round(100 - pct_gas - pct_elec, 1)

    summary = {
        'total_elec':  round(total_elec),
        'total_gas':   round(total_gas),
        'total_gkwh':  round(total_gkwh, 1),
        'total_okg':   round(total_okg),
        'total_okwh':  round(total_okwh, 1),
        'total_kwh':   round(total_kwh, 2),
        'total_cost':       total_cost,
        'total_mln':        round(total_cost / 1_000_000, 4),
        'total_elec_cost':  total_elec_cost,
        'total_gas_cost':   total_gas_cost,
        'total_other_cost': total_other_cost,
        'pct_gas':          pct_gas,
        'pct_elec':    pct_elec,
        'pct_other':   pct_other,
    }
    return rows, summary


def calc_all(data):
    """Run calculations for all 3 years and return combined result."""
    result = {}
    for year in [2023, 2024, 2025]:
        y = str(year)
        rows, summary = calc_year(
            data.get(f'gas_{y}',   [0]*12),
            data.get(f'elec_{y}',  [0]*12),
            data.get(f'other_{y}', [0]*12),
            year,
        )
        result[year] = {'rows': rows, 'summary': summary}
    return result


def calc_areas(data):
    """Calculate building areas from raw dimensions."""
    def _sum_rows(prefix, f1, f2, f3=None):
        total = 0.0
        i = 1
        while True:
            v1 = data.get(f'{prefix}_{f1}{i}')
            if v1 is None:
                break
            a = float(v1 or 0) * float(data.get(f'{prefix}_{f2}{i}') or 0)
            if f3:
                a *= float(data.get(f'{prefix}_{f3}{i}') or 0)
            total += a
            i += 1
        return total

    floor_area = _sum_rows('floor', 'l', 'w')
    win_area   = _sum_rows('win',   'w', 'h', 'n')
    door_area  = _sum_rows('door',  'w', 'h', 'n')
    wall_gross = _sum_rows('wall',  'p', 'h')
    wall_net = max(0.0, wall_gross - win_area - door_area)

    # Roof
    roof_area = float(data.get('roof_area') or 0)
    if roof_area == 0:
        roof_area = round(floor_area * 1.15, 1)

    return {
        'floor_area': round(floor_area, 1),
        'win_area':   round(win_area, 1),
        'door_area':  round(door_area, 1),
        'wall_gross': round(wall_gross, 1),
        'wall_net':   round(wall_net, 1),
        'roof_area':  round(roof_area, 1),
    }


def calc_ariston(count, kw):
    """Calculate electric water heater consumption."""
    count = float(count or 1)
    kw    = float(kw    or 2)
    day   = round(kw * 3, 2)          # 3 hours/day
    month = round(day * 30, 1)
    year  = round(month * 12, 1)
    return {'day': day, 'month': month, 'year': year}


def calc_efficiency(gas_2025_total, heat_area):
    """Energy efficiency rating vs SHNQ norm 149 kWh/m²."""
    gas_95   = round(gas_2025_total * 0.95, 1)
    gas_heat = round(gas_95 * GAS_KWH, 1)
    area     = float(heat_area or 1)
    qov_fakt = round(gas_heat / area, 2)
    ec_diff  = round(qov_fakt - 149, 2)
    ec_pct   = round(ec_diff / 149 * 100, 1)
    return {
        'gas_95':      gas_95,
        'gas_heat':    gas_heat,
        'qov_fakt':    qov_fakt,
        'ec_diff':     abs(ec_diff),   # absolute kWh/m² difference (for display)
        'ec_pct':      abs(ec_pct),    # absolute % difference (for display)
        'ec_pct_signed': ec_pct,       # signed % difference (for BEE class logic)
        'better':      ec_diff < 0,   # True = better than norm
    }


def fes_values(kw):
    kw = int(kw)
    f  = FES_TABLE.get(kw, FES_TABLE[10])
    som = f['kWh'] * 1000
    co2_calc = round(f['kWh'] * CO2_PER_KWH)
    return {
        'fes':      kw,
        'fes_kw':   kw,
        'fes_kWh':  f['kWh'],
        'fes_mln':  f['mln'],
        'fes_som':  som,
        'fes_payb': f['payb'],
        'co2_kg':   CO2_PER_KWH,
        'co2_calc': co2_calc,
        'co2_tonn': round(co2_calc / 1000, 2),
    }


def gelio_values(litres):
    litres = int(litres)
    g = GELIO_TABLE.get(litres, GELIO_TABLE[200])
    return {
        'gelio':     litres,
        'gelio_inv': g['inv'],
        'gelio_kwh': g['kwh'],
        'gelio_som': g['som'],
    }
