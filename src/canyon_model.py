"""Street Canyon Simulator — Python reference model.

Written in a deliberately plain, loop-based style so that it ports line-for-line
to JavaScript. No numpy inside the model; numpy only in analysis scripts.

Units: SI throughout; temperatures in °C in inputs/outputs, Kelvin inside
radiation terms. Time: hourly weather, 300 s model step, 168 h week.
"""
import math, json, os

SIGMA = 5.670374e-8
RHO_CP = 1200.0            # J/m3K, air
LAT = 34.05                # Los Angeles
DAY_OF_YEAR = 244          # 1 September
DEW_POINT = 15.0           # °C, fixed (vapour pressure fixed; RH follows T)
WIND_PED = 0.5              # m/s at pedestrian level, fixed
WIND_10 = 0.75             # m/s at 10 m (log-law from 0.5 m/s at 1.1 m), for UTCI and canyon exchange
DT = 300.0                 # s
HOURS = 168
SIDEWALK = 3.0             # m, each

# ---------------------------------------------------------------- weather ---
def load_text():
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "text168.json")) as f:
        return json.load(f)

def sat_vp_hpa(t):              # Magnus, over water
    return 6.112 * math.exp(17.62 * t / (243.12 + t))

VP_HPA = sat_vp_hpa(DEW_POINT)  # ≈17.0 hPa

def rh_pct(t):
    return min(100.0, 100.0 * VP_HPA / sat_vp_hpa(t))

def sun_position(hour_local):
    """Solar elevation (rad) and azimuth from north, clockwise (rad). Local solar time."""
    decl = math.radians(23.45 * math.sin(math.radians(360.0 * (284 + DAY_OF_YEAR) / 365.0)))
    phi = math.radians(LAT)
    omega = math.radians(15.0 * (hour_local - 12.0))
    sinb = math.sin(phi) * math.sin(decl) + math.cos(phi) * math.cos(decl) * math.cos(omega)
    beta = math.asin(max(-1.0, min(1.0, sinb)))
    # azimuth measured from south, positive toward west, then converted to from-north clockwise
    az_s = math.atan2(math.sin(omega), math.cos(omega) * math.sin(phi) - math.tan(decl) * math.cos(phi))
    gamma = (az_s + math.pi) % (2 * math.pi)
    return beta, gamma

# ASHRAE clear-sky coefficients interpolated to 1 September
ASH_A, ASH_B, ASH_C = 1117.0, 0.193, 0.112

def clear_sky(beta):
    """Direct normal and diffuse horizontal irradiance, W/m2."""
    if beta <= 0.0:
        return 0.0, 0.0
    dni = ASH_A * math.exp(-ASH_B / math.sin(beta))
    return dni, ASH_C * dni

def sky_emissivity():
    return 0.741 + 0.0062 * DEW_POINT     # Berdahl & Martin, clear sky

def weather_at(text, t_s):
    """Interpolated roof-level air temperature, sun, irradiance, longwave down at time t_s (s)."""
    h = t_s / 3600.0
    i = int(h) % HOURS
    f = h - int(h)
    ta = text[i] * (1 - f) + text[(i + 1) % HOURS] * f
    hour_local = h % 24.0
    beta, gamma = sun_position(hour_local)
    dni, dhi = clear_sky(beta)
    ldown = sky_emissivity() * SIGMA * (ta + 273.15) ** 4
    return ta, beta, gamma, dni, dhi, ldown

# --------------------------------------------------------------- geometry ---
ORIENTATIONS = {           # axis azimuth (deg from north) and compass labels of sides A (-n) and B (+n)
    "N-S":   (0.0,   "West",      "East"),
    "E-W":   (90.0,  "North",     "South"),
    "NE-SW": (45.0,  "Northwest", "Southeast"),
    "NW-SE": (135.0, "Northeast", "Southwest"),
}

def vf_point_to_segment(px, pz, nx, nz, q1x, q1z, q2x, q2z):
    """2D view factor from a differential element (p, normal n) to segment q1-q2."""
    tx, tz = -nz, nx
    def ang(qx, qz):
        dx, dz = qx - px, qz - pz
        return math.atan2(dx * tx + dz * tz, dx * nx + dz * nz)
    a1, a2 = ang(q1x, q1z), ang(q2x, q2z)
    lo, hi = min(a1, a2), max(a1, a2)
    half = math.pi / 2
    if hi - lo <= math.pi:                       # short arc does not pass behind the element
        lo, hi = max(lo, -half), min(hi, half)
        return 0.5 * (math.sin(hi) - math.sin(lo)) if hi > lo else 0.0
    # short arc wraps through ±π (behind): visible pieces are [hi, π/2]∪[-π/2, lo] where they exist
    f = 0.0
    if hi < half:
        f += 0.5 * (1.0 - math.sin(hi))
    if lo > -half:
        f += 0.5 * (math.sin(lo) + 1.0)
    return f

def build_geometry(W, H, n_samp=7):
    """Surfaces: 0 wallA (x=0), 1 wallB (x=W), 2 sidewalkA, 3 road, 4 sidewalkB. Index 5 = sky.
    Returns dict with segments, areas per m street, and view-factor matrix F[i][j] (i,j in 0..5),
    plus pedestrian view factors for sidewalk A and B."""
    sw = min(SIDEWALK, W / 3.0)
    segs = [  # (q1x,q1z,q2x,q2z, nx,nz)
        (0.0, 0.0, 0.0, H, 1.0, 0.0),
        (W, 0.0, W, H, -1.0, 0.0),
        (0.0, 0.0, sw, 0.0, 0.0, 1.0),
        (sw, 0.0, W - sw, 0.0, 0.0, 1.0),
        (W - sw, 0.0, W, 0.0, 0.0, 1.0),
    ]
    areas = [H, H, sw, W - 2 * sw, sw]
    F = [[0.0] * 6 for _ in range(5)]
    for i, (ax, az, bx, bz, nx, nz) in enumerate(segs):
        for k in range(n_samp):
            f = (k + 0.5) / n_samp
            px, pz = ax + (bx - ax) * f, az + (bz - az) * f
            tot = 0.0
            for j, (cx, cz, dx, dz, _, _) in enumerate(segs):
                if j == i:
                    continue
                v = vf_point_to_segment(px, pz, nx, nz, cx, cz, dx, dz)
                F[i][j] += v / n_samp
                tot += v
            F[i][5] += max(0.0, 1.0 - tot) / n_samp
    # pedestrian: vertical cylinder approximated by two opposed vertical elements at 1.1 m
    ped = {}
    for side, xp in (("A", sw / 2.0), ("B", W - sw / 2.0)):
        vf = [0.0] * 6
        for nx in (1.0, -1.0):
            tot = 0.0
            for j, (cx, cz, dx, dz, _, _) in enumerate(segs):
                v = vf_point_to_segment(xp, 1.1, nx, 0.0, cx, cz, dx, dz)
                vf[j] += 0.5 * v
                tot += v
            vf[5] += 0.5 * max(0.0, 1.0 - tot)
        ped[side] = vf
    return {"W": W, "H": H, "sw": sw, "segs": segs, "areas": areas, "F": F, "ped": ped}

def shading(geom, beta, gamma, axis_deg):
    """Sunlit fractions of the five surfaces and the shadow geometry.
    Returns (sunlit[5], sun_side, cos_wall, ground shadow length L, proj)."""
    W, H, sw = geom["W"], geom["H"], geom["sw"]
    if beta <= 0.0:
        return [0.0] * 5, None, 0.0, W, 0.0
    psi = math.radians(axis_deg)
    # n points to side B; s·n with s = (sin g, cos g), n = (cos psi, -sin psi)
    proj = math.sin(gamma) * math.cos(psi) - math.cos(gamma) * math.sin(psi)
    ap = abs(proj)
    if ap < 1e-6:
        # sun along the axis: ground fully lit, walls grazing
        return [0.0, 0.0, 1.0, 1.0, 1.0], None, 0.0, 0.0, proj
    L = H * ap / math.tan(beta)             # ground shadow length from the sun-side wall
    cos_wall = math.cos(beta) * ap          # incidence cosine on the sunlit wall
    sunlit = [0.0] * 5
    if proj > 0:                            # sun over side B: wall A sunlit, shadow from x=W inward
        sunlit[0] = min(1.0, W / L)
        lit_from, lit_to = 0.0, max(0.0, W - L)
    else:                                   # sun over side A: wall B sunlit, shadow from x=0 outward
        sunlit[1] = min(1.0, W / L)
        lit_from, lit_to = min(W, L), W
    def frac(x1, x2):
        return max(0.0, min(x2, lit_to) - max(x1, lit_from)) / (x2 - x1)
    sunlit[2] = frac(0.0, sw)
    sunlit[3] = frac(sw, W - sw)
    sunlit[4] = frac(W - sw, W)
    return sunlit, ("B" if proj > 0 else "A"), cos_wall, L, proj

# ------------------------------------------------------------------- UTCI ---
def utci(ta, tmrt, va, rh):
    """UTCI (°C), Bröde et al. 2012 polynomial. va = wind at 10 m (m/s), rh in %."""
    from utci_poly import utci_approx
    return utci_approx(ta, tmrt, va, rh)

# ------------------------------------------------------------------ model ---
DEFAULTS = dict(
    W=20.0, H=15.0, orient="N-S",
    alb_wall=0.25, alb_road=0.10, alb_walk=0.30,
    canopy=0.0, irrigated=True, awning=0.0, ac=0.0,
)

MAT = dict(
    # heat capacity per area of the active slab (J/m2K), conductance to the deep/inside node (W/m2K), deep node T (°C)
    wall=(250000.0, 1.2, 26.0),
    road=(220000.0, 1.5, None),    # deep T = weekly mean air
    walk=(160000.0, 1.5, None),
)
EMIS = 0.92
TAU_SW = 0.20       # canopy shortwave transmittance
TAU_LW = 0.20       # canopy longwave transmittance
LATENT_FRAC = 0.70  # share of intercepted shortwave removed as latent heat when irrigated
AC_PEAK = 60.0      # W per m2 of façade, both walls, at the hottest hour, when fully conditioned
AC_T0, AC_T1 = 22.0, 38.0
H_CONV = 5.6 + 4.0 * WIND_PED
AB_PERSON, EM_PERSON = 0.70, 0.97
UTCI_STRONG = 32.0

def exchange_velocity(H, W):
    return WIND_10 * (0.03 + 0.07 / (1.0 + H / W))

def person_fp(beta):
    """Projected area factor of a standing person (approximation to Fanger's curve)."""
    return 0.42 * math.cos(beta) + 0.043 * math.sin(beta)

def run(params=None, text=None, spinup_hours=24):
    p = dict(DEFAULTS); p.update(params or {})
    text = text or load_text()
    tmean = sum(text) / len(text)
    W, H = p["W"], p["H"]
    axis_deg, labA, labB = ORIENTATIONS[p["orient"]]
    g = build_geometry(W, H)
    F, areas, sw = g["F"], g["areas"], g["sw"]
    alb = [p["alb_wall"], p["alb_wall"], p["alb_walk"], p["alb_road"], p["alb_walk"]]
    mats = [MAT["wall"], MAT["wall"], MAT["walk"], MAT["road"], MAT["walk"]]
    c = p["canopy"]; a = p["awning"]
    canopy_block = c * (1.0 - TAU_SW)          # fraction of shortwave removed before reaching ground
    canopy_lw = c * (1.0 - TAU_LW)             # fraction of sky view replaced by canopy (at air T) for ground
    # ground strips see sky through canopy; sidewalks additionally under awnings
    sky_block = [0.0, 0.0, 1 - (1 - canopy_lw) * (1 - a), canopy_lw, 1 - (1 - canopy_lw) * (1 - a)]
    sw_block = [0.0, 0.0, 1 - (1 - canopy_block) * (1 - a), canopy_block, 1 - (1 - canopy_block) * (1 - a)]
    w_ex = exchange_velocity(H, W)
    g_ex = RHO_CP * w_ex * W                   # W/K per m street
    hA = [H_CONV * A for A in areas]

    T = [tmean + 2.0] * 5                      # surface temperatures °C
    out = {k: [] for k in ("ta", "tc", "ts", "utciA", "utciB", "mrtA", "mrtB", "qconv", "rh", "beta")}
    nsteps = int((HOURS + spinup_hours) * 3600 / DT)
    t0 = -spinup_hours * 3600.0
    for step in range(nsteps):
        t_s = t0 + step * DT
        ta, beta, gamma, dni, dhi, ldown = weather_at(text, t_s % (HOURS * 3600))
        sunlit, sun_side, cos_wall, L, proj = shading(g, beta, gamma, axis_deg)
        tsky4 = ldown / SIGMA
        # --- shortwave incident (before reflection)
        inc = [0.0] * 5
        for i in range(5):
            direct = dni * sunlit[i] * (cos_wall if i < 2 else math.sin(beta)) if beta > 0 else 0.0
            diffuse = dhi * F[i][5]
            inc[i] = (direct + diffuse) * (1.0 - sw_block[i])
        # canopy interception (per m street, over the ground strips)
        intercepted = sum((inc_i / max(1e-9, 1.0 - sw_block[i]) - inc_i) * areas[i] for i, inc_i in enumerate(inc) if i >= 2)
        # one bounce
        refl = [alb[i] * inc[i] for i in range(5)]
        sw_abs = [0.0] * 5
        for i in range(5):
            bounce = sum(F[i][j] * refl[j] for j in range(5) if j != i)
            sw_abs[i] = (1.0 - alb[i]) * (inc[i] + bounce)
        # --- canyon air (quasi-steady)
        ac_load = max(0.0, min(1.0, (ta - AC_T0) / (AC_T1 - AC_T0)))
        q_ac = p["ac"] * AC_PEAK * ac_load * 2.0 * H
        q_canopy = intercepted * (1.0 - (LATENT_FRAC if p["irrigated"] else 0.0))
        tc = (sum(hA[i] * T[i] for i in range(5)) + g_ex * ta + q_ac + q_canopy) / (sum(hA) + g_ex)
        # --- longwave and surface update
        T4 = [(Ti + 273.15) ** 4 for Ti in T]
        tair4 = (tc + 273.15) ** 4
        newT = [0.0] * 5
        qconv = 0.0
        for i in range(5):
            lw_in = sum(F[i][j] * EMIS * SIGMA * T4[j] for j in range(5) if j != i)
            sky_part = F[i][5] * ((1.0 - sky_block[i]) * ldown + sky_block[i] * SIGMA * tair4)
            lw_net = EMIS * (lw_in + sky_part - SIGMA * T4[i])
            conv = H_CONV * (tc - T[i])
            C, U, Tdeep = mats[i]
            Tdeep = tmean if Tdeep is None else Tdeep
            cond = U * (Tdeep - T[i])
            newT[i] = T[i] + DT * (sw_abs[i] + lw_net + conv + cond) / C
            qconv += -conv * areas[i]
        T = newT
        # --- pedestrian
        res = {}
        for side in ("A", "B"):
            vf = g["ped"][side]
            idx = 2 if side == "A" else 4
            lw4 = sum(vf[j] * T4[j] for j in range(5)) + vf[5] * ((1.0 - sky_block[idx]) * tsky4 + sky_block[idx] * tair4)
            # direct beam on the body: in shadow of the sun-side wall if within L' of it (at 1.1 m)
            direct = 0.0
            if beta > 0:
                xp = sw / 2.0 if side == "A" else W - sw / 2.0
                Lp = L * (H - 1.1) / H if H > 1.1 else 0.0
                in_shadow = (xp > W - Lp) if sun_side == "B" else (xp < Lp)
                if sun_side is None: in_shadow = False
                if not in_shadow:
                    direct = dni * person_fp(beta) * (1.0 - sw_block[idx])
            diffuse = 0.5 * dhi * vf[5] * (1.0 - sw_block[idx])
            reflected = sum(vf[j] * refl[j] for j in range(5))
            s_abs = AB_PERSON * (direct + diffuse + reflected)
            mrt = (lw4 + s_abs / (EM_PERSON * SIGMA)) ** 0.25 - 273.15
            res[side] = mrt
        if t_s >= 0 and step % int(3600 / DT) == 0:
            rh = rh_pct(tc)
            out["ta"].append(ta); out["tc"].append(tc); out["ts"].append(list(T))
            out["mrtA"].append(res["A"]); out["mrtB"].append(res["B"])
            out["utciA"].append(utci(tc, res["A"], WIND_10, rh))
            out["utciB"].append(utci(tc, res["B"], WIND_10, rh))
            out["qconv"].append(qconv); out["rh"].append(rh); out["beta"].append(beta)
    out["labels"] = {"A": labA, "B": labB}
    out["params"] = p
    out["summary"] = summarise(out)
    return out

def summarise(o):
    n = len(o["ta"])
    day = [o["beta"][i] > 0 for i in range(n)]
    dT = [o["tc"][i] - o["ta"][i] for i in range(n)]
    def hrs_above(x, lim): return sum(1 for v in x if v > lim)
    def peak(x):
        i = max(range(n), key=lambda k: x[k]); return x[i], i
    s = {
        "hoursStrongA": hrs_above(o["utciA"], UTCI_STRONG),
        "hoursStrongB": hrs_above(o["utciB"], UTCI_STRONG),
        "hoursVeryStrongA": hrs_above(o["utciA"], 38.0),
        "hoursVeryStrongB": hrs_above(o["utciB"], 38.0),
        "peakUtciA": peak(o["utciA"]), "peakUtciB": peak(o["utciB"]),
        "peakRoadT": max(o["ts"][i][3] for i in range(n)),
        "peakWalkA": max(o["ts"][i][2] for i in range(n)),
        "peakWalkB": max(o["ts"][i][4] for i in range(n)),
        "peakDT": max(dT), "meanDT": sum(dT) / n,
        "nightMeanDT": sum(dT[i] for i in range(n) if not day[i]) / max(1, sum(1 for d in day if not d)),
        "minNightTc": min(o["tc"][i] for i in range(n) if not day[i]),
        "qDay": sum(o["qconv"][i] for i in range(n) if day[i]) * 3600 / 1e6,       # MJ per m street
        "qNight": sum(o["qconv"][i] for i in range(n) if not day[i]) * 3600 / 1e6,
    }
    return s

if __name__ == "__main__":
    o = run()
    print(json.dumps(o["summary"], indent=1, default=lambda x: round(x, 2) if isinstance(x, float) else x))
