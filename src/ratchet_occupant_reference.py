"""Python reference for the Comfort Ratchet Simulator occupant rules (lecture build v17).
Runs the occupant on indoor-temperature series produced by the JS engine (ratchet_model.js; building physics validated earlier against
the Passive Building Simulator v2 reference), so that the occupant rules can be checked independently of the JavaScript.
Series (series_downtown.json, calendar frame, day 0 = Monday 1 January): acT / nvT = the downtown office air-conditioned / naturally
ventilated; medT = the same office in Medellin, naturally ventilated (the newcomer's origin); occ = weekdays 08-18; Tc = ASHRAE 55 adaptive
comfort temperature from the downtown weather (for the operational-share column only).
Constants as in ratchet_model.js: alpha 0.20; W_AC 1.75, W_NV 2.50 (90 % envelopes); gamma_S ratio 1.5 (Rupp 2019, attenuated); level
ratio 1.41 (Luo 2018); beta_1 0.05/day symmetric; level relaxation 0.9 up / 0.30 down (x1.5 with a window); window switch 0.7;
fan +2.2 K warm edge; jumper +2.0 K cool edge; caps 18 / 32 C. Arrival: first Monday of September (calendar day 245), the series rotated
so that index 0 is the day of arrival.
"""
import json, sys, numpy as np
ALPHA, BETA1, W_AC, W_NV, G1R, LR, GDW, FAN, JUMPER, CAP, COOLCAP = 0.20, 0.05, 1.75, 2.50, 1.5, 1.41, 0.7, 2.2, 2.0, 32.0, 18.0
R_UP, R_DOWN, WINDOW_X = 0.9, 0.30, 1.5
L_AC, L_NV = 1.0, 1 / LR
C = (W_NV - W_AC) / (1 / L_NV - 1 / (G1R * L_AC)); W0 = W_AC - C / (G1R * L_AC)       # eq. (tolerance): w = W0 + C / (g1 * level * switch)
ARRIVE = 245

def band(g1, lev, gD): return W0 + C / (g1 * lev * gD)
def rot(a, doy=ARRIVE): return np.roll(np.asarray(a), -24 * doy)

def live(T, occ, st, ctl, s0sq, vNV):
    """One year. st = (P, v, level); v is the running estimate of the squared error; g1 = (s0sq + vNV) / (s0sq + v)."""
    P, v, lev = st; gD = GDW if ctl.get("window") else 1.0; Ps = np.zeros(8760); Ws = np.zeros(8760); sumd2 = n = 0
    for i in range(8760):
        if i % 24 == 0 and i > 0:
            idx = slice(i - 24, i); mk = occ[idx]
            if mk.any():
                d = T[idx][mk] - Ps[idx][mk]; P = P + ALPHA * (T[idx][mk].mean() - P); v = v + BETA1 * (float((d * d).mean()) - v)
        Ps[i] = P; Ws[i] = band((s0sq + vNV) / (s0sq + v), lev, gD)
        if occ[i]: dd = T[i] - P; sumd2 += dd * dd; n += 1
    return Ps, Ws, (P, v, lev), sumd2 / n

def calibrate(acT, nvT, occ):
    def settle_v(T):
        st = (22.0, 1.0, 1.0)
        for _ in range(3): _, _, st, vl = live(T, occ, st, {}, 1.0, 1.0)
        return vl
    vAC, vNV = settle_v(acT), settle_v(nvT); return vAC, vNV, (vNV - G1R * vAC) / (G1R - 1)

def next_level(lev, tgt, ctl): r = R_UP if tgt > lev else R_DOWN * (WINDOW_X if ctl.get("window") else 1.0); return lev + r * (tgt - lev)
def target(vl, vcal): vAC, vNV, _ = vcal; return L_AC + (L_NV - L_AC) * (vl - vAC) / (vNV - vAC)

def settled(T, occ, regime, vcal, ctl):
    vAC, vNV, s0sq = vcal; st = (22.0, vAC if regime == "ac" else vNV, L_AC if regime == "ac" else L_NV)
    for _ in range(2): _, _, st, _ = live(T, occ, st, ctl, s0sq, vNV)
    return st

def newcomer(medT, occ, vcal):
    """Six years in the Medellin office under the destination's constants (as in ratchet_model.js newcomer())."""
    vAC, vNV, s0sq = vcal; st = (22.0, vNV, 0.9)
    for _ in range(6): _, _, end, vl = live(medT, occ, st, {}, s0sq, vNV); st = (end[0], end[1], next_level(st[2], target(vl, vcal), {}))
    return st

def classes(T, occ, Tc, Ps, Ws, ctl):
    up = FAN if ctl.get("fan") else 0.0; dn = JUMPER if ctl.get("jumper") else 0.0
    hi = np.minimum(Ps + Ws + up, CAP); lo = np.maximum(Ps - Ws - dn, COOLCAP); ok = (T <= hi) & (T >= lo); std = np.abs(T - Tc) <= W_NV
    return dict(bad=int((~ok & occ).sum()), warm=int(((T > hi) & occ).sum()), cool=int(((T < lo) & occ).sum()), share=float((ok & std & occ).sum() / (std & occ).sum()))

def scenario(st, T_to, occ, Tc, vcal, ctl, years=3):
    vAC, vNV, s0sq = vcal; out = []
    for y in range(years):
        Ps, Ws, end, vl = live(T_to, occ, st, ctl, s0sq, vNV); cl = classes(T_to, occ, Tc, Ps, Ws, ctl)
        out.append(dict(year=y + 1, w_mean=float(Ws[occ].mean()), w_start=float(Ws[0]), level=st[2], **cl))
        st = (end[0], end[1], next_level(st[2], target(vl, vcal), ctl))
    return out

if __name__ == "__main__":
    S = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "series_downtown.json"))
    occ = rot(np.array(S["occ"], bool)); acT, nvT, medT, Tc = (rot(np.array(S[k], float)) for k in ("acT", "nvT", "medT", "Tc"))
    vcal = calibrate(acT, nvT, occ); J = {"jumper": True}; JW = {"jumper": True, "window": True}
    nat = settled(acT, occ, "ac", vcal, {}); new = newcomer(medT, occ, vcal)
    print("calibration vAC %.4f vNV %.4f s0sq %.3f; W0 %.4f C %.4f" % (vcal[0], vcal[1], vcal[2], W0, C))
    for name, st, T_to, ctl in (("native -> NV office, jumper", nat, nvT, J), ("newcomer -> NV office, jumper", new, nvT, J), ("native -> NV, jumper+window", nat, nvT, JW), ("newcomer -> NV, jumper+window", new, nvT, JW), ("newcomer -> AC office, jumper", new, acT, J), ("native -> AC office (own regime)", nat, acT, J)):
        out = scenario(st, T_to, occ, Tc, vcal, ctl)
        print("%-34s band start %.3f | years: %s" % (name, out[0]["w_start"], " ; ".join("%d h (%dw/%dc) w %.4f share %.4f" % (o["bad"], o["warm"], o["cool"], o["w_mean"], o["share"]) for o in out)))
