
/* Comfort Ratchet Simulator v10 (lecture build) — building physics after the Passive Building Simulator v2; weather TMYx 2009-2023 (climate.onebuilding.org).
   Occupant, in the manuscript's terms (Thermal Comfort and the Predictive Brain, Draft V): eq. (sensation) S = gamma_1 (T - P); eq. (discomfort) D = gamma_2 |S|;
   eq. (tolerance) comfort band w = w0 + c / (gamma_1 gamma_2); eq. (recursion-as-learning) P <- P + alpha (T_day - P), alpha = 0.20 pinned (gamma_P / gamma_1 = 4);
   gamma_1: Delta(1/gamma_1) = beta_1 (delta^2 - 1/gamma_1) daily with a floor s0^2, relative to the settled NV value; gamma_2 = switch (0.7 with a window) x level,
   the level relaxing yearly toward the value the lived variance trains (0.5 of the gap up, 0.30 down, x1.5 with a window). Anchors: the two 90 % envelopes
   (PMV +-1.75 K, adaptive +-2.50 K) with Rupp's gamma_1 ratio 2 and Luo's level ratio 1.41 fix w0 = 1.34 K and c. Caps 18 / 32 C. */
(function (root) {
  'use strict';
  var WXALL = root.__WXALL__;
  var N = 8760, RHO = 1.2 * 1005.0, ZV = 1000.0, ROOF = 300.0, WALL = 700.0 / 3, GLASS = 120.0, RIBBON_H = 1.5, FIN_SPACING = 1.5, GROUND_ALBEDO = 0.2;
  var FAC = { W: [270.0, 200.0, 20.0], N: [0.0, 150.0, 15.0], E: [90.0, 200.0, 20.0], S: [180.0, 150.0, 15.0] };
  var ENV = { u: 0.2, u_g: 1.8, shgc: 0.35, mass: 50.0, n_occ: 15, gain_pp: 250.0, vent_lps: 10.0, shares: { W: 0.10, N: 0.50, E: 0.10, S: 0.30 },
              shading: ['both', 1.2], roof_abs: 0.20, purge_ach: 6.0, open_ach: 4.0, t_open: 24.0, t_purge: 22.0, heat_floor: 18.0 };   // supplementary heating holds the room at 18 C in occupied hours
  // ---- occupant constants (lecture build; see the parameter table in the app) ----
  var ALPHA = 0.20;                   // eq. (recursion-as-learning): daily learning of P; McCartney & Nicol 2002, c = 0.80 (their fit is flat for c 0.33-0.90)  [measured, rough]
  var W_AC = 1.75, W_NV = 2.50;       // 90 % envelopes: PMV +-0.5 at 3.5 K per vote; ASHRAE 55 adaptive 90 %  [standard]
  var G1_RATIO = 1.5;                 // settled sensory weight, AC / NV (Rupp et al. 2019 report about 2, part of it the scale factor; 1.5 per the manuscript session)  [measured, bound]
  var L_RATIO = 1.41;                 // settled discomfort level, steady-heated / variable interiors (Luo et al. 2018 demand factor 1.13 / 0.80)  [measured]
  var BETA1 = 0.05;                   // per day, symmetric: 90 % of a change in ~45 days; habituation studies fix only the downward direction, for strong stimuli (range 0.02-0.10)  [bound]: Delta(1/gamma_1) = beta_1 (delta^2 - 1/gamma_1) (habituation studies, downward only)  [bound / assumption upward]
  var R_LEVEL_UP = 0.9, R_LEVEL_DOWN = 0.30, WINDOW_LEVEL_X = 1.5;   // yearly relaxation of the discomfort level: 0.44 is Luo's bound itself (not fully adapted after four years); x1.5 with a window  [bound; assumption]
  var GD_WINDOW = 0.7;                // the switch on gamma_2 with a window he may open (Schweiker et al. 2018)  [measured effect, value assumed]
  var FAN = 2.2, CAP = 32.0, COOL_CAP = 18.0;   // ASHRAE 55 5.4.2.4; limits of adaptation  [standard; reminder]
  var JUMPER = 2.0;  // cool-edge extension from putting on a sweater (0.25-0.36 clo; ASHRAE 55 graphical zone shifts about 3 K per 0.5 clo)  [derived, rough]
  var SETPOINT = 22.0, DEADBAND = 0.5;
  var L_AC = 1.0, L_NV = 1.0 / L_RATIO;         // discomfort level by convention: 1 in the steady regime
  // eq. (tolerance): w = w0 + c / (g1 * level), g1 = gamma_1 relative to the settled NV value; the two 90 % envelopes fix w0 and c
  var C_BAND = (W_NV - W_AC) / (1.0 / L_NV - 1.0 / (G1_RATIO * L_AC)), W0 = W_AC - C_BAND / (G1_RATIO * L_AC);
  var ENCINO = { g1: 0.4, level: 0.4, P: 24.0 };  // kept for reference only (an untrained start); the lecture uses the newcomer from Medellin instead
  var MONTH = new Array(N), OCC = new Array(N), OCC_CAL = new Array(N), ARRIVE = 0;  // ARRIVE: day of the calendar year on which the occupant's year 1 begins (0 = 1 Jan, 181 = 1 Jul); the weather is rotated so that index 0 is the day of arrival
  function buildMonth() { var dim = [31,28,31,30,31,30,31,31,30,31,30,31], i = 0, cal = new Array(N), occ = new Array(N);
    for (var m = 0; m < 12; m++) for (var d = 0; d < dim[m]; d++) for (var h = 0; h < 24; h++) { cal[i] = m + 1; var dow = Math.floor(i / 24) % 7; occ[i] = dow < 5 && h >= 8 && h < 18; OCC_CAL[i] = occ[i]; i++; }
    for (i = 0; i < N; i++) { MONTH[i] = cal[(i + ARRIVE * 24) % N]; OCC[i] = occ[(i + ARRIVE * 24) % N]; } }  // the building is simulated on the calendar grid (occupancy drives gains and windows); the occupant's frame is the same grid rotated, so his working days are the building's
  buildMonth();
  function rot(a) { if (!ARRIVE) return a; var o = new Array(N); for (var i = 0; i < N; i++) o[i] = a[(i + ARRIVE * 24) % N]; return o; }
  function setArrival(doy) { ARRIVE = doy || 0; buildMonth(); calCache = {}; }
  function firstMonday(doy) { return doy + ((7 - doy % 7) % 7); }  // calendar day 0 is a Monday
  function getArrival() { return ARRIVE; }
  function sun(wx, doy, hr) {
    var decl = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + doy) / 365), B = 2 * Math.PI * (doy - 81) / 364;
    var eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B), solar = hr + (wx.lon - 15 * wx.tz) / 15 + eot / 60;
    var H = 15 * (solar - 12) * Math.PI / 180, lat = wx.lat * Math.PI / 180;
    var sinb = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H), beta = Math.asin(Math.max(-1, Math.min(1, sinb)));
    var cosaz = (Math.sin(decl) - Math.sin(beta) * Math.sin(lat)) / Math.max(1e-9, Math.cos(beta) * Math.cos(lat)), az = Math.acos(Math.max(-1, Math.min(1, cosaz)));
    if (H > 0) az = 2 * Math.PI - az; return [beta, az];
  }
  function irradiance(beta, gamma, dni, dhi, azDeg) { if (beta <= 0.0) return [0, 0, 0];
    var cosInc = Math.cos(beta) * Math.cos(gamma - azDeg * Math.PI / 180), direct = dni * Math.max(0.0, cosInc), ghi = dni * Math.sin(beta) + dhi; return [direct, 0.5 * dhi, 0.5 * GROUND_ALBEDO * ghi]; }
  function shadingFactors(kind, depth, beta, gamma, azDeg, windowH) { var fDir = 1.0, fDif = 1.0; if (kind === 'none' || depth <= 0.0) return [fDir, fDif];
    var rel = gamma - azDeg * Math.PI / 180, cosRel = Math.cos(rel);
    if (kind === 'overhang' || kind === 'both') { if (beta > 0.0 && cosRel > 1e-6) fDir *= 1.0 - Math.min(1.0, depth * (Math.tan(beta) / cosRel) / Math.max(0.3, windowH)); fDif *= 1.0 - 0.4 * Math.min(1.0, depth / Math.max(0.3, windowH)); }
    if (kind === 'fins' || kind === 'both') { if (beta > 0.0 && cosRel > 1e-6) fDir *= 1.0 - Math.min(1.0, depth * Math.abs(Math.tan(rel)) / FIN_SPACING); fDif *= 1.0 - 0.4 * Math.min(1.0, depth / FIN_SPACING); }
    return [fDir, fDif]; }
  function glassArea(f) { return Math.min(GLASS * ENV.shares[f], FAC[f][2] * RIBBON_H * 3); }
  function runYear(wx, mode, over) {
    var e = over ? Object.assign({}, ENV, over) : ENV, gf = GLASS / 3, ua = gf * e.u_g + (WALL - gf) * e.u + ROOF * e.u;
    var infil = 0.3 / 3600 * ZV * RHO, ventOcc = e.n_occ * e.vent_lps / 1000 * RHO, purge = e.purge_ach / 3600 * ZV * RHO, openv = e.open_ach / 3600 * ZV * RHO;
    var C = e.mass * 1e6, dt = 600.0, sub = 6, T = 0; for (var i = 0; i < N; i++) T += wx.T[i]; T /= N;
    var Tin = new Array(N), heat = 0, cool = 0, heatHours = 0, heatH = new Array(N), coolH = new Array(N), hAcc = 0, cAcc = 0;
    for (i = 0; i < N; i++) {
      var doy = Math.floor(i / 24) + 1, hod = i % 24, occupied = OCC_CAL[i], tout = wx.T[i];
      var s = sun(wx, doy, hod + 0.5), beta = s[0], az = s[1], qSol = 0.0;
      if (beta > 0) for (var f in FAC) { var a = glassArea(f) / 3; var ir = irradiance(beta, az, wx.dni[i], wx.dhi[i], FAC[f][0]), sf = shadingFactors(e.shading[0], e.shading[1], beta, az, FAC[f][0], RIBBON_H);
        qSol += (ir[0] * sf[0] + (ir[1] + ir[2]) * sf[1]) * a * e.shgc; }
      var tSolair = beta > 0 ? tout + (e.roof_abs * wx.ghi[i] - 0.9 * 63.0) / 17.0 : tout - 0.9 * 63.0 / 17.0, qRoof = ROOF * e.u * (tSolair - tout);
      var qInt = occupied ? e.n_occ * e.gain_pp : 0.0;
      for (var n = 0; n < sub; n++) {
        var vent;
        if (mode === 'ac') vent = occupied ? ventOcc : infil;
        else if (occupied) { vent = ventOcc; if (T > e.t_open && tout < T) vent += openv * Math.min(1.0, (T - e.t_open) / 2.0); }
        else vent = (T > e.t_purge && tout < T) ? purge : infil;
        var q = qInt + qSol + qRoof - ua * (T - tout) - vent * (T - tout); T += q * dt / C;
        if (occupied) {
          if (mode === 'ac') { if (T > SETPOINT + DEADBAND) { var q = (T - SETPOINT - DEADBAND) * C / 3.6e6; cool += q; cAcc += q; T = SETPOINT + DEADBAND; } else if (T < SETPOINT - DEADBAND) { var q2 = (SETPOINT - DEADBAND - T) * C / 3.6e6; heat += q2; hAcc += q2; T = SETPOINT - DEADBAND; } }
          else if (T < e.heat_floor) { var q3 = (e.heat_floor - T) * C / 3.6e6; heat += q3; hAcc += q3; T = e.heat_floor; heatHours++; }
        }
      }
      Tin[i] = T; heatH[i] = hAcc; coolH[i] = cAcc; hAcc = 0; cAcc = 0;
    }
    return { T: rot(Tin), heat_kwh: heat, cool_kwh: cool, heat_hours: heatHours / sub, heatH: rot(heatH), coolH: rot(coolH) }  // the series leaves runYear in the occupant's frame (rotated to the arrival day); everything downstream shares that frame;
  }

  var MONTHS_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
  function inSel(i, m) { return m === 0 || (m <= 12 ? MONTH[i] === m : (m === 13 ? MONTH[i] <= 6 : MONTH[i] >= 7)); }
  function hoursCurve(pts, lo, hi, step, bw) { var xs = [], ys = []; for (var x = lo; x <= hi + 1e-9; x += step) { var s = 0; for (var k = 0; k < pts.length; k++) { var z = (x - pts[k]) / bw; if (z > -4 && z < 4) s += Math.exp(-0.5 * z * z); } xs.push(Math.round(x * 100) / 100); ys.push(s / (bw * 2.5066)); } return { x: xs, y: ys, n: pts.length }; }
  function hours(T, m, lo, hi, step, bw) { var pts = []; for (var i = 0; i < N; i++) if (OCC[i] && inSel(i, m)) pts.push(T[i]); return hoursCurve(pts, lo, hi, step, bw); }
  function hoursAll(T, m, lo, hi, step, bw) { var pts = []; for (var i = 0; i < N; i++) if (inSel(i, m)) pts.push(T[i]); return hoursCurve(pts, lo, hi, step, bw); }
  function adaptiveTc(wx) { if (wx._Tc) return wx._Tc; var T = wx.T, trm = null, Tc = new Array(N);
    for (var d = 0; d < N / 24; d++) { var ds = 0; for (var h = 0; h < 24; h++) ds += T[d * 24 + h]; ds /= 24; trm = trm === null ? ds : 0.8 * trm + 0.2 * ds; for (var h2 = 0; h2 < 24; h2++) Tc[d * 24 + h2] = 17.8 + 0.31 * trm; }
    wx._Tc = Tc; return Tc; }
  function adaptive(wx, m) { var Tc = adaptiveTc(wx), s = 0, n = 0; for (var i = 0; i < N; i++) if (OCC[i] && inSel(i, m)) { s += Tc[i]; n++; } return { Tc: s / n, lo: s / n - W_NV, hi: s / n + W_NV }; }
  // ---- the occupant for one year: P daily (alpha), gamma_1 daily (beta_1), level fixed within the year; returns per-hour P and band, daily traces, lived statistics ----
  function bandOf(g1, level, gD) { return W0 + C_BAND / (g1 * level * gD); }
  function liveYear(T, st, ctl, s0sq, vNV) {
    // st: { P, v, level } (v = running estimate of delta^2); ctl: { window, fan }; s0sq: floor; vNV: settled NV variance (g1 = (s0sq + vNV) / (s0sq + v))
    var P = st.P, v = st.v, level = st.level, gD = ctl.window ? GD_WINDOW : 1.0, up = ctl.fan ? FAN : 0.0, dn = ctl.jumper ? JUMPER : 0.0;
    var Ps = new Array(N), Ws = new Array(N), dayP = [], dayG1 = [], dayW = [], dayV = [], daySens = [], dayTmin = [], dayTmax = [], sumd2 = 0, nOcc = 0;
    for (var i = 0; i < N; i++) {
      if (i % 24 === 0 && i > 0) { var s = 0, s2 = 0, k = 0; for (var j = i - 24; j < i; j++) if (OCC[j]) { var d = T[j] - Ps[j]; s += d; s2 += d * d; k++; }
        if (k) { var dm = s / k, d2 = s2 / k; P = P + ALPHA * (T_mean(T, i - 24, i) - P); v = v + BETA1 * (d2 - v); } }
      var g1 = (s0sq + vNV) / (s0sq + v); Ps[i] = P; Ws[i] = bandOf(g1, level, gD);
      if (i % 24 === 0) { dayP.push(P); dayG1.push(g1); dayW.push(Ws[i]); dayV.push(v); }
      if (OCC[i]) { var dd = T[i] - P; sumd2 += dd * dd; nOcc++; } }
    // sensation index by day: mean |T - P| * g1 over the day's occupied hours
    for (var dday = 0; dday < 365; dday++) { var ss = 0, kk = 0, tmin = 99, tmax = -99; for (var h = 0; h < 24; h++) { var ii = dday * 24 + h; if (OCC[ii]) { ss += Math.abs(T[ii] - Ps[ii]) * dayG1[dday]; kk++; if (T[ii] < tmin) tmin = T[ii]; if (T[ii] > tmax) tmax = T[ii]; } } daySens.push(kk ? ss / kk : null); dayTmin.push(kk ? tmin : null); dayTmax.push(kk ? tmax : null); }
    return { P: Ps, W: Ws, up: up, dn: dn, gD: gD, dayP: dayP, dayV: dayV, dayG1: dayG1, dayW: dayW, daySens: daySens, dayTmin: dayTmin, dayTmax: dayTmax, end: { P: P, v: v, level: level }, v_lived: sumd2 / nOcc, g1_end: (s0sq + vNV) / (s0sq + v), level: level };
  }
  function T_mean(T, a, b) { var s = 0, k = 0; for (var j = a; j < b; j++) if (OCC[j]) { s += T[j]; k++; } return k ? s / k : null; }
  // level target from the lived variance: linear between the two settled regimes (extrapolated beyond them; the caps bound the band)
  function levelTarget(vLived, vAC, vNV) { return L_AC + (L_NV - L_AC) * (vLived - vAC) / (vNV - vAC); }
  function nextLevel(level, target, ctl) { var r = target > level ? R_LEVEL_UP : R_LEVEL_DOWN * (ctl.window ? WINDOW_LEVEL_X : 1.0); return level + r * (target - level); }
  // ---- calibration per climate: settled variances of the two regimes, the floor s0^2 that gives Rupp's ratio ----
  var calCache = {};
  function calibrate(climate) { if (calCache[climate]) return calCache[climate]; var wx = WXALL[climate], ac = runYear(wx, 'ac'), nv = runYear(wx, 'nv');
    var settle = function (T) { var st = { P: SETPOINT, v: 1.0, level: 1.0 }, L; for (var y = 0; y < 3; y++) { L = liveYear(T, st, {}, 1.0, 1.0); st = L.end; } return L.v_lived; };
    var vAC = settle(ac.T), vNV = settle(nv.T), s0sq = (vNV - G1_RATIO * vAC) / (G1_RATIO - 1.0);
    calCache[climate] = { wx: wx, ac: ac, nv: nv, vAC: vAC, vNV: vNV, s0sq: s0sq }; return calCache[climate]; }
  // ---- counting ----
  function classes(T, Ps, Ws, up, m, Tc, dn) { dn = dn || 0; var warm = [], cool = [], beyond = [], beyondWarm = 0, over = 0, n = 0, inStd = 0, accStd = 0;
    for (var i = 0; i < N; i++) { if (!OCC[i] || !inSel(i, m)) continue; n++; var hi = Math.min(Ps[i] + Ws[i] + up, CAP), lo = Math.max(Ps[i] - Ws[i] - dn, COOL_CAP), ok = T[i] <= hi && T[i] >= lo, std = Tc ? Math.abs(T[i] - Tc[i]) <= W_NV : false;
      if (std) { inStd++; if (ok) accStd++; }
      if (T[i] > hi) { warm.push(T[i]); if (T[i] > CAP) over++; } else if (T[i] < lo) cool.push(T[i]); else if (Tc && !std) { beyond.push(T[i]); if (T[i] > Tc[i]) beyondWarm++; } }
    return { n: n, warm: warm, cool: cool, beyond: beyond, beyondWarm: beyondWarm, beyondCool: beyond.length - beyondWarm, over: over, bad: warm.length + cool.length, inStd: inStd, accStd: accStd, share: inStd ? accStd / inStd : null }; }
  function monthlyBad(T, Ps, Ws, up, dn) { var out = []; for (var mo = 1; mo <= 12; mo++) out.push(classes(T, Ps, Ws, up, mo, null, dn).bad); return out; }
  function meanW(Ws, m) { var s = 0, k = 0; for (var i = 0; i < N; i++) if (OCC[i] && inSel(i, m)) { s += Ws[i]; k++; } return s / k; }
  function meanP(Ps, m) { var s = 0, k = 0; for (var i = 0; i < N; i++) if (OCC[i] && inSel(i, m)) { s += Ps[i]; k++; } return s / k; }
  // ---- buildings for scenario 3 ----
  var LOOSEN = [ { label: 'as designed: heating to 18 °C, windows open above 24 °C, night purge above 22 °C', env: {} },
    { label: 'a little looser: windows above 26 °C, purge above 24 °C', env: { t_open: 26, t_purge: 24 } },
    { label: 'looser: windows above 28 °C, purge above 26 °C at half strength', env: { t_open: 28, t_purge: 26, purge_ach: 3 } },
    { label: 'loosest: windows above 30 °C, hardly any purge', env: { t_open: 30, t_purge: 28, purge_ach: 1 } } ];
  // ---- the three scenarios ----
  // start states: 'encino' (untrained), 'ac' (a settled lifetime in the AC office), 'nv' (a settled lifetime in the NV office as designed, with a window)
  function settled(cal, regime, ctl) { var T = regime === 'ac' ? cal.ac.T : cal.nv.T, st = { P: SETPOINT, v: regime === 'ac' ? cal.vAC : cal.vNV, level: regime === 'ac' ? L_AC : L_NV }, L;
    for (var y = 0; y < 2; y++) { L = liveYear(T, st, ctl, cal.s0sq, cal.vNV); st = L.end; } return st; }
  function newcomer(cal) { var o = WXALL.medellin ? runYear(WXALL.medellin, 'nv') : null; if (!o) return null; var st = { P: SETPOINT, v: cal.vNV, level: 0.9 }, L;
    for (var k = 0; k < 6; k++) { L = liveYear(o.T, st, {}, cal.s0sq, cal.vNV); var tgt = levelTarget(L.v_lived, cal.vAC, cal.vNV); st = { P: L.end.P, v: L.end.v, level: nextLevel(st.level, tgt, {}) }; }
    return { st: st, origin: o, band: bandOf((cal.s0sq + cal.vNV) / (cal.s0sq + st.v), st.level, 1.0) }; }
  function run(climate, start, building, ctl, nYears) {
    var cal = calibrate(climate), wx = cal.wx, Tc = rot(adaptiveTc(wx));
    var bld0 = building === 'ac' ? cal.ac : (typeof building === 'number' && building > 0 ? runYear(wx, 'nv', LOOSEN[building].env) : cal.nv), bld = bld0;
    var st = (start && typeof start === 'object') ? { P: start.P, v: start.v, level: start.level } : start === 'newcomer' ? newcomer(cal).st : (start === 'encino' ? { P: ENCINO.P, v: (cal.s0sq + cal.vNV) / ENCINO.g1 - cal.s0sq, level: ENCINO.level } : settled(cal, start, start === 'nv' ? { window: true } : {}));
    var years = [], w0 = bandOf((cal.s0sq + cal.vNV) / (cal.s0sq + st.v), st.level, ctl.window ? GD_WINDOW : 1.0), P0 = st.P;
    for (var y = 1; y <= nYears; y++) { var L = liveYear(bld.T, st, ctl, cal.s0sq, cal.vNV), cl = classes(bld.T, L.P, L.W, L.up, 0, Tc, L.dn), dayBad = new Array(365);
      for (var d = 0; d < 365; d++) { var b = 0, anyOcc = false; for (var h = 0; h < 24; h++) { var i = d * 24 + h; if (!OCC[i]) continue; anyOcc = true; var hi = Math.min(L.P[i] + L.W[i] + L.up, CAP), lo = Math.max(L.P[i] - L.W[i] - L.dn, COOL_CAP); if (bld.T[i] > hi || bld.T[i] < lo) b++; } dayBad[d] = anyOcc ? b : null; }
      years.push({ year: y, T: bld.T, P: L.P, W: L.W, up: L.up, dn: L.dn, gD: L.gD, level: st.level, dayV: L.dayV, heat_kwh: bld.heat_kwh, cool_kwh: bld.cool_kwh, heatH: bld.heatH, coolH: bld.coolH, g1_end: L.g1_end, w_end: L.dayW[L.dayW.length - 1], w_mean: meanW(L.W, 0), dayP: L.dayP, dayG1: L.dayG1, dayW: L.dayW, daySens: L.daySens, dayTmin: L.dayTmin, dayTmax: L.dayTmax, dayBad: dayBad, monthlyBad: monthlyBad(bld.T, L.P, L.W, L.up, L.dn), bad: cl.bad, warm: cl.warm.length, cool: cl.cool.length, beyond: cl.beyond.length, beyondWarm: cl.beyondWarm, beyondCool: cl.beyondCool, over: cl.over, share: cl.share, inStd: cl.inStd, v_lived: L.v_lived });
      var tgt = levelTarget(L.v_lived, cal.vAC, cal.vNV); st = { P: L.end.P, v: L.end.v, level: nextLevel(st.level, tgt, ctl) }; years[years.length - 1].state_end = st; }
    return { climate: climate, start: start, building: building, ctl: ctl, cal: cal, wx: wx, Tc: Tc, bld: bld, years: years, w_start: w0, P_start: P0, label: typeof building === 'number' ? LOOSEN[building].label : null };
  }
  function setRates(o) { if (o.alpha !== undefined) ALPHA = o.alpha; if (o.beta1 !== undefined) BETA1 = o.beta1; if (o.down !== undefined) R_LEVEL_DOWN = o.down; if (o.up !== undefined) R_LEVEL_UP = o.up; calCache = {}; }
  function getRates() { return { alpha: ALPHA, beta1: BETA1, down: R_LEVEL_DOWN, up: R_LEVEL_UP }; }
  root.RatchetModel = { runYear: runYear, liveYear: liveYear, calibrate: calibrate, run: run, newcomer: newcomer, setRates: setRates, getRates: getRates, setArrival: setArrival, getArrival: getArrival, firstMonday: firstMonday, classes: classes, hours: hours, hoursAll: hoursAll, hoursCurve: hoursCurve, meanP: meanP, meanW: meanW, adaptive: adaptive, adaptiveTc: adaptiveTc, inSel: inSel, bandOf: bandOf, OCC: OCC, MONTH: MONTH, WXALL: WXALL, ENV: ENV, LOOSEN: LOOSEN,
    PARAMS: { ALPHA: ALPHA, W_AC: W_AC, W_NV: W_NV, G1_RATIO: G1_RATIO, L_RATIO: L_RATIO, BETA1: BETA1, R_LEVEL_UP: R_LEVEL_UP, R_LEVEL_DOWN: R_LEVEL_DOWN, WINDOW_LEVEL_X: WINDOW_LEVEL_X, GD_WINDOW: GD_WINDOW, FAN: FAN, JUMPER: JUMPER, CAP: CAP, COOL_CAP: COOL_CAP, SETPOINT: SETPOINT, DEADBAND: DEADBAND, W0: W0, C_BAND: C_BAND, L_AC: L_AC, L_NV: L_NV, ENCINO: ENCINO } };
})(typeof window !== 'undefined' ? window : this);
