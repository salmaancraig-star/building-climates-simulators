/* Passive Building Simulator v2 — model core. Line-for-line port of building_model.py (v2 physics only). Needs CanyonModel for sun and weather. */
(function (root) {
  'use strict';
  var CM = (typeof module !== 'undefined' && module.exports) ? require('./canyon_model.built.js') : root.CanyonModel;
  var HOURS = 168, RHO_CP_AIR = 1.2 * 1005.0, VOLUME = 3000.0, ENV_AREA = 1000.0, GLAZING_TOTAL = 120.0;
  var FLOORS = 3, FLOOR_H = 10.0 / FLOORS, RIBBON_H = 1.5;
  var ZONE_VOLUME = VOLUME / FLOORS, ROOF_AREA = 300.0, WALL_AREA_FLOOR = 700.0 / FLOORS, H_OUT = 17.0, DELTA_R = 63.0;
  var ROOF_ABSORPTANCE = { dark: 0.90, grey: 0.65, cool: 0.20 };
  var SHADING_PRESETS = { none: ['none', 0.0], partial: ['overhang', 0.6], max: ['both', 1.2] };
  var FACADES = { W: [270.0, 200.0], N: [0.0, 150.0], E: [90.0, 200.0], S: [180.0, 150.0] };
  var FACADE_LEN = { W: 20.0, N: 15.0, E: 20.0, S: 15.0 };
  var W_PER_PERSON = 150.0, LPS_PER_PERSON = 10.0, GROUND_ALBEDO = 0.20, FIN_SPACING = 1.5, INFILTRATION_ACH = 0.3;
  var GLAZING_TYPES = { single: [5.7, 0.70], double: [2.7, 0.50], triple: [1.8, 0.35] };
  var BAND_HALFWIDTH = { 90: 2.5, 80: 3.5, fans: 3.5 }, FAN_UPLIFT = { 90: 0.0, 80: 0.0, fans: 2.2 };
  var DEFAULTS = { occupants: 15, u_opaque: 1.0, glazing: 'single', mass_mjk: 15.0, night_ach: 0.0, roof: 'dark', vent_lps: 10.0,
    shares: { W: 0.60, N: 0.10, E: 0.20, S: 0.10 }, shading: { W: 'none', N: 'none', E: 'none', S: 'none' }, band: 80, glazing_total: GLAZING_TOTAL };
  var TEXT = CM.TEXT;
  function achToWK(ach) { return ach / 3600.0 * ZONE_VOLUME * RHO_CP_AIR; }

  function irradianceOnFacade(beta, gamma, dni, dhi, azDeg) {
    if (beta <= 0.0) return [0, 0, 0];
    var cosInc = Math.cos(beta) * Math.cos(gamma - azDeg * Math.PI / 180), direct = dni * Math.max(0.0, cosInc);
    var ghi = dni * Math.sin(beta) + dhi;
    return [direct, 0.5 * dhi, 0.5 * GROUND_ALBEDO * ghi];
  }
  function shadingFactors(kind, depth, beta, gamma, azDeg, windowH) {
    var fDir = 1.0, fDif = 1.0;
    if (kind === 'none' || depth <= 0.0) return [fDir, fDif];
    var rel = gamma - azDeg * Math.PI / 180, cosRel = Math.cos(rel);
    if (kind === 'overhang' || kind === 'both') {
      if (beta > 0.0 && cosRel > 1e-6) fDir *= 1.0 - Math.min(1.0, depth * (Math.tan(beta) / cosRel) / Math.max(0.3, windowH));
      fDif *= 1.0 - 0.4 * Math.min(1.0, depth / Math.max(0.3, windowH));
    }
    if (kind === 'fins' || kind === 'both') {
      if (beta > 0.0 && cosRel > 1e-6) fDir *= 1.0 - Math.min(1.0, depth * Math.abs(Math.tan(rel)) / FIN_SPACING);
      fDif *= 1.0 - 0.4 * Math.min(1.0, depth / FIN_SPACING);
    }
    return [fDir, fDif];
  }
  function glazingLayout(shares, total) {
    var out = {}, fits = true, f;
    for (f in FACADES) {
      var a = (shares[f] || 0) * total, cap = FLOORS * RIBBON_H * FACADE_LEN[f];
      if (a > cap + 1e-9) fits = false;
      out[f] = { area: a, wwr: a / FACADES[f][1], ribbon_len: Math.min(a / (FLOORS * RIBBON_H), FACADE_LEN[f]), cap: cap, over: Math.max(0.0, a - cap) };
    }
    return { layout: out, fits: fits };
  }

  function run(params) {
    var p = {}, k;
    for (k in DEFAULTS) p[k] = DEFAULTS[k];
    for (k in (params || {})) p[k] = params[k];
    var gt = GLAZING_TYPES[p.glazing], uG = gt[0], shgc = gt[1];
    var qIntGain = p.occupants * W_PER_PERSON, ventOcc = p.occupants * p.vent_lps / 1000.0 * RHO_CP_AIR, cInt = p.mass_mjk * 1e6;
    var total = p.glazing_total, gl = glazingLayout(p.shares, total), layout = gl.layout;
    var glassFloor = total / FLOORS, uaWalls = glassFloor * uG + (WALL_AREA_FLOOR - glassFloor) * p.u_opaque, uaRoof = ROOF_AREA * p.u_opaque;
    var roofAbs = ROOF_ABSORPTANCE[p.roof], nightWK = achToWK(p.night_ach), infilWK = achToWK(INFILTRATION_ACH);
    var dt = 600.0, sub = 6, half = BAND_HALFWIDTH[p.band], uplift = FAN_UPLIFT[p.band], roofKWh = 0.0;
    var tInt = 0, i; for (i = 0; i < HOURS; i++) tInt += TEXT[i]; tInt /= HOURS;
    var hist = [tInt], upper = [], lower = [], hoursOver = 0, degHours = 0.0, gains = { W: 0, N: 0, E: 0, S: 0 }, removed = 0.0, qsolH = [], perFacadeH = [];
    var dailyMean = 0; for (i = 0; i < 24; i++) dailyMean += TEXT[i]; dailyMean /= 24.0;
    for (i = 1; i < HOURS; i++) {
      var hod = i % 24, dow = Math.floor(i / 24) % 7;
      if (hod === 0) { var start = Math.max(0, i - 24), s = 0; for (var j = start; j < i; j++) s += TEXT[j]; dailyMean = s / (i - start); }
      var tBase = 0.31 * dailyMean + 17.8, tUp = tBase + half + uplift, tLo = tBase - half;
      upper.push(tUp); lower.push(tLo);
      var occupied = dow < 5 && hod >= 8 && hod < 18, qInt = occupied ? qIntGain : 0.0;
      var sp = CM.sunPosition(hod), beta = sp[0], gamma = sp[1], cs = CM.clearSky(beta), dni = cs[0], dhi = cs[1];
      var qSol = 0.0, pf = { W: 0, N: 0, E: 0, S: 0 }, f;
      for (f in FACADES) {
        var a = layout[f].area / FLOORS; if (a <= 0.0) continue;
        var irr = irradianceOnFacade(beta, gamma, dni, dhi, FACADES[f][0]), pre = SHADING_PRESETS[p.shading[f]];
        var sf = shadingFactors(pre[0], pre[1], beta, gamma, FACADES[f][0], RIBBON_H);
        var unshaded = (irr[0] + irr[1] + irr[2]) * a * shgc, shaded = (irr[0] * sf[0] + (irr[1] + irr[2]) * sf[1]) * a * shgc;
        qSol += shaded; gains[f] += shaded; removed += unshaded - shaded; pf[f] = shaded;
      }
      var ghi = beta > 0 ? dni * Math.sin(beta) + dhi : 0.0, tSolair = TEXT[i] + (roofAbs * ghi - 0.9 * DELTA_R) / H_OUT;
      qsolH.push(qSol); perFacadeH.push(pf); roofKWh += uaRoof * (tSolair - TEXT[i]) / 1000.0;
      var vent, isNight = hod >= 18 || hod < 8;
      if (occupied) vent = ventOcc; else vent = (nightWK > 0 && isNight && TEXT[i] < tInt) ? nightWK : infilWK;
      for (var n = 0; n < sub; n++) {
        if (occupied) {   // arrivals spread over the first occupied hour, departures over the last
          var fr = hod === 8 ? (n + 1) / sub : (hod === 17 ? (sub - 1 - n) / sub : 1.0);
          qInt = fr * qIntGain; vent = fr * ventOcc + (1.0 - fr) * infilWK;
        }
        var qEnv = uaWalls * (tInt - TEXT[i]) + uaRoof * (tInt - tSolair), qVent = vent * (tInt - TEXT[i]);
        tInt += (qInt + qSol - qEnv - qVent) * dt / cInt;
        if (nightWK > 0 && !occupied && isNight) vent = TEXT[i] < tInt ? nightWK : infilWK;
      }
      hist.push(tInt);
      if (occupied && tInt > tUp) { hoursOver++; degHours += tInt - tUp; }
    }
    upper.push(upper[upper.length - 1]); lower.push(lower[lower.length - 1]);
    var peak = -1e9; for (i = 0; i < hist.length; i++) peak = Math.max(peak, hist[i]);
    var gk = {}; for (f in gains) gk[f] = gains[f] / 1000.0;
    return { t_int: hist, t_ext: TEXT.slice(), upper: upper, lower: lower, hours_over: hoursOver, degree_hours: degHours, peak_int: peak,
             gains_kwh: gk, removed_kwh: removed / 1000.0, roof_kwh: roofKWh, qsol: qsolH, per_facade: perFacadeH, layout: layout, fits: gl.fits, params: p };
  }

  var api = { run: run, glazingLayout: glazingLayout, shadingFactors: shadingFactors, irradianceOnFacade: irradianceOnFacade,
              FACADES: FACADES, FACADE_LEN: FACADE_LEN, FLOORS: FLOORS, FLOOR_H: FLOOR_H, RIBBON_H: RIBBON_H, GLAZING_TOTAL: GLAZING_TOTAL, DEFAULTS: DEFAULTS, GLAZING_TYPES: GLAZING_TYPES, SHADING_PRESETS: SHADING_PRESETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuildingModel = api;
})(typeof window !== 'undefined' ? window : this);
