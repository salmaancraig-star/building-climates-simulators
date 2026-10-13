"""Passive Building Simulator v2 — Python reference model.

Plain, loop-based, ports line-for-line to JavaScript. Shares the sun and the 168-hour
temperature series with the Street Canyon Simulator (canyon_model.py).

legacy=True reproduces the original 2026-01 app exactly (cosine west sun, hourly explicit
step, its ventilation constants) for validation; legacy=False is the v2 physics.
"""
import math, json, os
import canyon_model as cm   # sun_position, clear_sky, load_text, DAY_OF_YEAR, LAT

HOURS = 168
RHO_CP_AIR = 1.2 * 1005.0           # J/m3K
VOLUME = 3000.0
ENV_AREA = 1000.0
GLAZING_TOTAL = 120.0               # m2 for the whole building, fixed (tuned by experiment; W/E ribbons hold at most 90)
FLOORS = 3
FLOOR_H = 10.0 / FLOORS
# façades: azimuth of outward normal (deg from north, clockwise), wall area m2
FACADES = {"W": (270.0, 200.0), "N": (0.0, 150.0), "E": (90.0, 200.0), "S": (180.0, 150.0)}
RIBBON_H = 1.5                      # m, fixed window height per floor; glass area sets the ribbon length
FACADE_LEN = {"W": 20.0, "N": 15.0, "E": 20.0, "S": 15.0}
W_PER_PERSON, LPS_PER_PERSON = 150.0, 10.0   # LPS_PER_PERSON is the legacy default; v2 takes vent_lps from params
GROUND_ALBEDO = 0.20
FIN_SPACING = 1.5                   # m between vertical fins along a ribbon window
INFILTRATION_ACH = 0.3              # v2 background infiltration
# ---- v3: the simulated zone is the TOP FLOOR (roof exposed); glass, walls, people and mass are per floor
ZONE_VOLUME = VOLUME / FLOORS       # 1000 m3
ROOF_AREA = 300.0
WALL_AREA_FLOOR = 700.0 / FLOORS    # 233.3 m2
ROOF_ABSORPTANCE = {"dark": 0.90, "grey": 0.65, "cool": 0.20}
H_OUT = 17.0                        # W/m2K outside film coefficient (ASHRAE sol-air)
DELTA_R = 63.0                      # W/m2 longwave loss of a horizontal surface to a clear sky (ASHRAE sol-air)
SHADING_PRESETS = {"none": ("none", 0.0), "partial": ("overhang", 0.6), "max": ("both", 1.2)}

def ach_to_wk(ach):
    return ach / 3600.0 * VOLUME * RHO_CP_AIR

DEFAULTS = dict(
    occupants=15, u_opaque=1.0, glazing="single", mass_mjk=15.0, night_ach=0.0, roof="dark", vent_lps=10.0,
    shares={"W": 0.60, "N": 0.10, "E": 0.20, "S": 0.10},
    shading={"W": "none", "N": "none", "E": "none", "S": "none"},   # none | partial | max
    band=80,            # 90, 80, or "fans" = 80 % with ceiling fans (upper limit +2.2 K at 1.2 m/s, ASHRAE 55 §5.4.2.4)
)
GLAZING_TYPES = {"single": (5.7, 0.70), "double": (2.7, 0.50), "triple": (1.8, 0.35)}
BAND_HALFWIDTH = {90: 2.5, 80: 3.5, "fans": 3.5}
FAN_UPLIFT = {90: 0.0, 80: 0.0, "fans": 2.2}

def legacy_west_solar(hour_index):
    hod = hour_index % 24
    if hod < 12 or hod > 20:
        return 0.0
    return max(0.0, 650.0 * math.sin((hod - 12) / 8.0 * math.pi))

def irradiance_on_facade(beta, gamma, dni, dhi, az_deg):
    """Direct, sky-diffuse and ground-reflected irradiance on a vertical façade, W/m2."""
    if beta <= 0.0:
        return 0.0, 0.0, 0.0
    cos_inc = math.cos(beta) * math.cos(gamma - math.radians(az_deg))
    direct = dni * max(0.0, cos_inc)
    ghi = dni * math.sin(beta) + dhi
    return direct, 0.5 * dhi, 0.5 * GROUND_ALBEDO * ghi

def shading_factors(kind, depth, beta, gamma, az_deg, window_h):
    """(direct factor, diffuse factor) for a ribbon window with an overhang at its head and/or vertical fins."""
    f_dir, f_dif = 1.0, 1.0
    if kind == "none" or depth <= 0.0:
        return f_dir, f_dif
    rel = gamma - math.radians(az_deg)                 # sun azimuth relative to façade normal
    cos_rel = math.cos(rel)
    if kind in ("overhang", "both"):
        if beta > 0.0 and cos_rel > 1e-6:
            tan_profile = math.tan(beta) / cos_rel
            f_dir *= 1.0 - min(1.0, depth * tan_profile / max(0.3, window_h))
        f_dif *= 1.0 - 0.4 * min(1.0, depth / max(0.3, window_h))
    if kind in ("fins", "both"):
        if beta > 0.0 and cos_rel > 1e-6:
            f_dir *= 1.0 - min(1.0, depth * abs(math.tan(rel)) / FIN_SPACING)
        f_dif *= 1.0 - 0.4 * min(1.0, depth / FIN_SPACING)
    return f_dir, f_dif

def glazing_layout(shares, total=None):
    """Per-façade glass area, ribbon length per floor and WWR; a façade is over capacity when the ribbon would be longer than the wall."""
    total = GLAZING_TOTAL if total is None else total
    out, fits = {}, True
    for f, (az, area) in FACADES.items():
        a = shares.get(f, 0.0) * total
        length = a / (FLOORS * RIBBON_H)
        cap = FLOORS * RIBBON_H * FACADE_LEN[f]
        if a > cap + 1e-9:
            fits = False
        out[f] = {"area": a, "wwr": a / area, "ribbon_len": min(length, FACADE_LEN[f]), "cap": cap, "over": max(0.0, a - cap)}
    return out, fits

def run(params=None, legacy=False, text=None):
    p = dict(DEFAULTS); p.update(params or {})
    text = text or cm.load_text()
    u_g, shgc = GLAZING_TYPES[p["glazing"]]
    n_occ = p["occupants"]
    q_int_gain = n_occ * W_PER_PERSON
    vent_occ = n_occ * (LPS_PER_PERSON if legacy else p.get("vent_lps", 10.0)) / 1000.0 * RHO_CP_AIR
    c_int = p["mass_mjk"] * 1e6
    if legacy:
        glass = {"W": GLAZING_TOTAL * p.get("legacy_gr", 1.0)}
        a_glass = glass["W"]
        ua = a_glass * u_g + (ENV_AREA - a_glass) * p["u_opaque"]
        night_wk = {0.0: 0.0, 5.0: 1759.0, 10.0: 10050.0}[p["night_ach"]]
        infil_wk = 1.0 / 1000.0 * RHO_CP_AIR
        dt, sub = 3600.0, 1
    else:
        total = p.get("glazing_total", GLAZING_TOTAL)
        layout, fits = glazing_layout(p["shares"], total)
        glass_floor = total / FLOORS
        ua_walls = glass_floor * u_g + (WALL_AREA_FLOOR - glass_floor) * p["u_opaque"]
        ua_roof = ROOF_AREA * p["u_opaque"]
        ua = ua_walls + ua_roof
        roof_abs = ROOF_ABSORPTANCE[p["roof"]]
        night_wk = p["night_ach"] / 3600.0 * ZONE_VOLUME * RHO_CP_AIR
        infil_wk = INFILTRATION_ACH / 3600.0 * ZONE_VOLUME * RHO_CP_AIR
        dt, sub = 600.0, 6
    half = BAND_HALFWIDTH[p["band"]]; uplift = FAN_UPLIFT[p["band"]]
    t_int = sum(text) / HOURS
    hist = [t_int]; upper = []; lower = []; hours_over = 0; degree_hours = 0.0
    gains = {f: 0.0 for f in FACADES}; removed = 0.0; qsol_h = []; roof_h = []; t_solair = 0.0
    daily_mean = sum(text[:24]) / 24.0
    for i in range(1, HOURS):
        hod, dow = i % 24, (i // 24) % 7
        if hod == 0:
            start = max(0, i - 24)
            daily_mean = sum(text[start:i]) / (i - start)
        t_base = 0.31 * daily_mean + 17.8
        t_up, t_lo = t_base + half + uplift, t_base - half
        upper.append(t_up); lower.append(t_lo)
        occupied = dow < 5 and 8 <= hod < 18
        q_int = q_int_gain if occupied else 0.0
        # arrivals spread over the first occupied hour, departures over the last (fraction present per sub-step)
        def present(n):
            if not occupied or legacy:
                return 1.0 if occupied else 0.0
            if hod == 8:
                return (n + 1) / sub
            if hod == 17:
                return (sub - 1 - n) / sub
            return 1.0
        # ---- solar
        if legacy:
            q_sol = legacy_west_solar(i) * a_glass * shgc
        else:
            beta, gamma = cm.sun_position(hod)
            dni, dhi = cm.clear_sky(beta)
            q_sol = 0.0
            for f, (az, area) in FACADES.items():
                a = layout[f]["area"] / FLOORS            # glass on this façade of the top floor
                if a <= 0.0:
                    continue
                d, sdif, g = irradiance_on_facade(beta, gamma, dni, dhi, az)
                kind, depth = SHADING_PRESETS[p["shading"][f]]
                fd, fs = shading_factors(kind, depth, beta, gamma, az, RIBBON_H)
                unshaded = (d + sdif + g) * a * shgc
                shaded = (d * fd + (sdif + g) * fs) * a * shgc
                q_sol += shaded; gains[f] += shaded; removed += unshaded - shaded
            # roof: sol-air temperature drives conduction through the roof (steady-state, no roof mass)
            ghi = (dni * math.sin(beta) + dhi) if beta > 0 else 0.0
            t_solair = text[i] + (roof_abs * ghi - 0.9 * DELTA_R) / H_OUT
        qsol_h.append(q_sol); roof_h.append(0.0 if legacy else ua_roof * (t_solair - text[i]))
        # ---- ventilation
        if occupied:
            vent = vent_occ
        else:
            is_night = hod >= 18 or hod < 8
            vent = night_wk if (night_wk > 0 and is_night and text[i] < t_int) else infil_wk
        for n in range(sub):
            if occupied and not legacy:
                fr = present(n)
                q_int = fr * q_int_gain
                vent = fr * vent_occ + (1.0 - fr) * infil_wk
            q_env = ua * (t_int - text[i]) if legacy else (ua_walls * (t_int - text[i]) + ua_roof * (t_int - t_solair))
            q_vent = vent * (t_int - text[i])
            t_int += (q_int + q_sol - q_env - q_vent) * dt / c_int
            if not legacy and night_wk > 0 and not occupied and (hod >= 18 or hod < 8):
                vent = night_wk if text[i] < t_int else infil_wk
        hist.append(t_int)
        if occupied and t_int > t_up:
            hours_over += 1; degree_hours += t_int - t_up
    upper.append(upper[-1]); lower.append(lower[-1])
    out = {"t_int": hist, "t_ext": list(text), "upper": upper, "lower": lower, "hours_over": hours_over, "degree_hours": degree_hours, "peak_int": max(hist),
           "gains_kwh": {f: v / 1000.0 for f, v in gains.items()}, "removed_kwh": removed / 1000.0, "qsol": qsol_h, "roof_kwh": sum(roof_h) / 1000.0,
           "params": p}
    if not legacy:
        out["layout"], out["fits"] = layout, fits
    return out

if __name__ == "__main__":
    o = run()
    print(o["hours_over"], {k: round(v) for k, v in o["gains_kwh"].items()})
