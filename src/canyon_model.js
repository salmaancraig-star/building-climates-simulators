/* Street Canyon Simulator — model core. Line-for-line port of canyon_model.py. */
(function (root) {
  'use strict';
  var SIGMA = 5.670374e-8, RHO_CP = 1200.0, LAT = 34.05, DAY_OF_YEAR = 244, DEW_POINT = 15.0;
  var WIND_PED = 0.5, WIND_10 = 0.75, DT = 300.0, HOURS = 168, SIDEWALK = 3.0;
  var TEXT = [22.0, 22.1, 22.3, 22.5, 22.9, 23.4, 24.0, 25.0, 26.5, 28.0, 29.5, 31.0, 32.5, 33.5, 34.0, 33.8, 33.0, 32.0, 30.5, 29.0, 27.5, 26.0, 24.5, 23.0, 23.0, 23.1, 23.3, 23.5, 23.9, 24.4, 25.0, 26.0, 27.5, 29.5, 31.5, 33.0, 34.5, 35.5, 36.0, 35.8, 35.0, 34.0, 32.5, 31.0, 29.5, 28.0, 26.5, 25.0, 25.0, 25.1, 25.3, 25.5, 25.9, 26.4, 27.0, 28.0, 29.8, 31.8, 33.8, 35.5, 37.0, 37.8, 38.0, 37.8, 37.0, 36.0, 34.5, 33.0, 31.5, 30.0, 28.5, 27.0, 27.0, 27.1, 27.3, 27.5, 27.9, 28.4, 29.0, 30.0, 31.5, 33.5, 35.0, 36.0, 36.8, 37.0, 37.0, 36.8, 36.0, 35.0, 33.5, 32.0, 30.5, 29.0, 28.0, 27.0, 27.0, 26.9, 26.7, 26.5, 26.1, 25.6, 25.0, 24.5, 26.0, 28.0, 30.0, 32.0, 33.5, 34.5, 35.0, 34.8, 34.0, 33.0, 31.5, 30.0, 29.0, 28.0, 27.5, 27.0, 27.0, 26.6, 26.1, 25.7, 25.0, 24.4, 24.0, 24.1, 25.0, 26.5, 28.0, 29.5, 31.0, 32.0, 33.0, 32.8, 32.0, 31.0, 29.5, 28.0, 27.0, 26.0, 25.0, 24.0, 24.0, 23.6, 23.1, 22.7, 22.0, 21.4, 21.0, 21.1, 22.0, 23.5, 25.0, 26.5, 28.0, 29.5, 30.0, 29.8, 29.0, 28.0, 26.5, 25.0, 24.0, 23.0, 22.5, 22.0];

  function satVpHpa(t) { return 6.112 * Math.exp(17.62 * t / (243.12 + t)); }
  var VP_HPA = satVpHpa(DEW_POINT);
  function rhPct(t) { return Math.min(100.0, 100.0 * VP_HPA / satVpHpa(t)); }
  function rad(d) { return d * Math.PI / 180.0; }

  function sunPosition(hourLocal) {
    var decl = rad(23.45 * Math.sin(rad(360.0 * (284 + DAY_OF_YEAR) / 365.0)));
    var phi = rad(LAT), omega = rad(15.0 * (hourLocal - 12.0));
    var sinb = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(omega);
    var beta = Math.asin(Math.max(-1.0, Math.min(1.0, sinb)));
    var azS = Math.atan2(Math.sin(omega), Math.cos(omega) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi));
    var gamma = (azS + Math.PI) % (2 * Math.PI);
    if (gamma < 0) gamma += 2 * Math.PI;
    return [beta, gamma];
  }
  var ASH_A = 1117.0, ASH_B = 0.193, ASH_C = 0.112;
  function clearSky(beta) {
    if (beta <= 0.0) return [0.0, 0.0];
    var dni = ASH_A * Math.exp(-ASH_B / Math.sin(beta));
    return [dni, ASH_C * dni];
  }
  function skyEmissivity() { return 0.741 + 0.0062 * DEW_POINT; }
  function weatherAt(tS) {
    var h = tS / 3600.0, i = Math.floor(h) % HOURS, f = h - Math.floor(h);
    var ta = TEXT[i] * (1 - f) + TEXT[(i + 1) % HOURS] * f;
    var sp = sunPosition(h % 24.0), cs = clearSky(sp[0]);
    var ldown = skyEmissivity() * SIGMA * Math.pow(ta + 273.15, 4);
    return { ta: ta, beta: sp[0], gamma: sp[1], dni: cs[0], dhi: cs[1], ldown: ldown };
  }

  var ORIENTATIONS = { 'N-S': [0.0, 'West', 'East'], 'E-W': [90.0, 'North', 'South'],
                       'NE-SW': [45.0, 'Northwest', 'Southeast'], 'NW-SE': [135.0, 'Northeast', 'Southwest'] };

  function vfPointToSegment(px, pz, nx, nz, q1x, q1z, q2x, q2z) {
    var tx = -nz, tz = nx;
    function ang(qx, qz) { var dx = qx - px, dz = qz - pz; return Math.atan2(dx * tx + dz * tz, dx * nx + dz * nz); }
    var a1 = ang(q1x, q1z), a2 = ang(q2x, q2z);
    var lo = Math.min(a1, a2), hi = Math.max(a1, a2), half = Math.PI / 2;
    if (hi - lo <= Math.PI) {
      lo = Math.max(lo, -half); hi = Math.min(hi, half);
      return hi > lo ? 0.5 * (Math.sin(hi) - Math.sin(lo)) : 0.0;
    }
    var f = 0.0;
    if (hi < half) f += 0.5 * (1.0 - Math.sin(hi));
    if (lo > -half) f += 0.5 * (Math.sin(lo) + 1.0);
    return f;
  }

  function buildGeometry(W, H) {
    var nSamp = 7, sw = Math.min(SIDEWALK, W / 3.0);
    var segs = [[0, 0, 0, H, 1, 0], [W, 0, W, H, -1, 0], [0, 0, sw, 0, 0, 1], [sw, 0, W - sw, 0, 0, 1], [W - sw, 0, W, 0, 0, 1]];
    var areas = [H, H, sw, W - 2 * sw, sw];
    var F = [], i, j, k;
    for (i = 0; i < 5; i++) {
      F.push([0, 0, 0, 0, 0, 0]);
      var s = segs[i];
      for (k = 0; k < nSamp; k++) {
        var f = (k + 0.5) / nSamp, px = s[0] + (s[2] - s[0]) * f, pz = s[1] + (s[3] - s[1]) * f, tot = 0.0;
        for (j = 0; j < 5; j++) {
          if (j === i) continue;
          var q = segs[j], v = vfPointToSegment(px, pz, s[4], s[5], q[0], q[1], q[2], q[3]);
          F[i][j] += v / nSamp; tot += v;
        }
        F[i][5] += Math.max(0.0, 1.0 - tot) / nSamp;
      }
    }
    var ped = {}, sides = [['A', sw / 2.0], ['B', W - sw / 2.0]];
    for (i = 0; i < 2; i++) {
      var vf = [0, 0, 0, 0, 0, 0], xp = sides[i][1], dirs = [1.0, -1.0];
      for (k = 0; k < 2; k++) {
        var tot2 = 0.0;
        for (j = 0; j < 5; j++) {
          var q2 = segs[j], v2 = vfPointToSegment(xp, 1.1, dirs[k], 0.0, q2[0], q2[1], q2[2], q2[3]);
          vf[j] += 0.5 * v2; tot2 += v2;
        }
        vf[5] += 0.5 * Math.max(0.0, 1.0 - tot2);
      }
      ped[sides[i][0]] = vf;
    }
    return { W: W, H: H, sw: sw, segs: segs, areas: areas, F: F, ped: ped };
  }

  function shading(geom, beta, gamma, axisDeg) {
    var W = geom.W, H = geom.H, sw = geom.sw;
    if (beta <= 0.0) return { sunlit: [0, 0, 0, 0, 0], sunSide: null, cosWall: 0.0, L: W, proj: 0.0 };
    var psi = rad(axisDeg);
    var proj = Math.sin(gamma) * Math.cos(psi) - Math.cos(gamma) * Math.sin(psi), ap = Math.abs(proj);
    if (ap < 1e-6) return { sunlit: [0, 0, 1, 1, 1], sunSide: null, cosWall: 0.0, L: 0.0, proj: proj };
    var L = H * ap / Math.tan(beta), cosWall = Math.cos(beta) * ap, sunlit = [0, 0, 0, 0, 0], litFrom, litTo;
    if (proj > 0) { sunlit[0] = Math.min(1.0, W / L); litFrom = 0.0; litTo = Math.max(0.0, W - L); }
    else { sunlit[1] = Math.min(1.0, W / L); litFrom = Math.min(W, L); litTo = W; }
    function frac(x1, x2) { return Math.max(0.0, Math.min(x2, litTo) - Math.max(x1, litFrom)) / (x2 - x1); }
    sunlit[2] = frac(0.0, sw); sunlit[3] = frac(sw, W - sw); sunlit[4] = frac(W - sw, W);
    return { sunlit: sunlit, sunSide: proj > 0 ? 'B' : 'A', cosWall: cosWall, L: L, proj: proj };
  }

  // UTCI — Bröde et al. (2012) polynomial
  function satVpKpa(tdb) {
    var t = tdb + 273.15;
    var c = [-2.8365744e3, -6.028076559e3, 1.954263612e1, -2.737830188e-2, 1.6261698e-5, 7.0229056e-10, -1.8680009e-13, 2.7150305];
    return Math.exp(c[0] / (t * t) + c[1] / t + c[2] + c[3] * t + c[4] * t * t + c[5] * t * t * t + c[6] * t * t * t * t + c[7] * Math.log(t)) / 1000.0;
  }
  function utciPoly(tdb, v, delta_t_tr, pa) {
    return (tdb
        + 0.607562052
        + (-0.0227712343) * tdb
        + 8.06470249e-4 * tdb * tdb
        + -1.54271372e-4 * tdb * tdb * tdb
        + -3.24651735e-6 * tdb * tdb * tdb * tdb
        + 7.32602852e-8 * tdb * tdb * tdb * tdb * tdb
        + 1.35959073e-9 * tdb * tdb * tdb * tdb * tdb * tdb
        + (-2.25836520) * v
        + 0.0880326035 * tdb * v
        + 0.00216844454 * tdb * tdb * v
        + -1.53347087e-5 * tdb * tdb * tdb * v
        + -5.72983704e-7 * tdb * tdb * tdb * tdb * v
        + -2.55090145e-9 * tdb * tdb * tdb * tdb * tdb * v
        + (-0.751269505) * v * v
        + (-0.00408350271) * tdb * v * v
        + -5.21670675e-5 * tdb * tdb * v * v
        + 1.94544667e-6 * tdb * tdb * tdb * v * v
        + 1.14099531e-8 * tdb * tdb * tdb * tdb * v * v
        + 0.158137256 * v * v * v
        + -6.57263143e-5 * tdb * v * v * v
        + 2.22697524e-7 * tdb * tdb * v * v * v
        + -4.16117031e-8 * tdb * tdb * tdb * v * v * v
        + (-0.0127762753) * v * v * v * v
        + 9.66891875e-6 * tdb * v * v * v * v
        + 2.52785852e-9 * tdb * tdb * v * v * v * v
        + 4.56306672e-4 * v * v * v * v * v
        + -1.74202546e-7 * tdb * v * v * v * v * v
        + -5.91491269e-6 * v * v * v * v * v * v
        + 0.398374029 * delta_t_tr
        + 1.83945314e-4 * tdb * delta_t_tr
        + -1.73754510e-4 * tdb * tdb * delta_t_tr
        + -7.60781159e-7 * tdb * tdb * tdb * delta_t_tr
        + 3.77830287e-8 * tdb * tdb * tdb * tdb * delta_t_tr
        + 5.43079673e-10 * tdb * tdb * tdb * tdb * tdb * delta_t_tr
        + (-0.0200518269) * v * delta_t_tr
        + 8.92859837e-4 * tdb * v * delta_t_tr
        + 3.45433048e-6 * tdb * tdb * v * delta_t_tr
        + -3.77925774e-7 * tdb * tdb * tdb * v * delta_t_tr
        + -1.69699377e-9 * tdb * tdb * tdb * tdb * v * delta_t_tr
        + 1.69992415e-4 * v * v * delta_t_tr
        + -4.99204314e-5 * tdb * v * v * delta_t_tr
        + 2.47417178e-7 * tdb * tdb * v * v * delta_t_tr
        + 1.07596466e-8 * tdb * tdb * tdb * v * v * delta_t_tr
        + 8.49242932e-5 * v * v * v * delta_t_tr
        + 1.35191328e-6 * tdb * v * v * v * delta_t_tr
        + -6.21531254e-9 * tdb * tdb * v * v * v * delta_t_tr
        + -4.99410301e-6 * v * v * v * v * delta_t_tr
        + -1.89489258e-8 * tdb * v * v * v * v * delta_t_tr
        + 8.15300114e-8 * v * v * v * v * v * delta_t_tr
        + 7.55043090e-4 * delta_t_tr * delta_t_tr
        + -5.65095215e-5 * tdb * delta_t_tr * delta_t_tr
        + -4.52166564e-7 * tdb * tdb * delta_t_tr * delta_t_tr
        + 2.46688878e-8 * tdb * tdb * tdb * delta_t_tr * delta_t_tr
        + 2.42674348e-10 * tdb * tdb * tdb * tdb * delta_t_tr * delta_t_tr
        + 1.54547250e-4 * v * delta_t_tr * delta_t_tr
        + 5.24110970e-6 * tdb * v * delta_t_tr * delta_t_tr
        + -8.75874982e-8 * tdb * tdb * v * delta_t_tr * delta_t_tr
        + -1.50743064e-9 * tdb * tdb * tdb * v * delta_t_tr * delta_t_tr
        + -1.56236307e-5 * v * v * delta_t_tr * delta_t_tr
        + -1.33895614e-7 * tdb * v * v * delta_t_tr * delta_t_tr
        + 2.49709824e-9 * tdb * tdb * v * v * delta_t_tr * delta_t_tr
        + 6.51711721e-7 * v * v * v * delta_t_tr * delta_t_tr
        + 1.94960053e-9 * tdb * v * v * v * delta_t_tr * delta_t_tr
        + -1.00361113e-8 * v * v * v * v * delta_t_tr * delta_t_tr
        + -1.21206673e-5 * delta_t_tr * delta_t_tr * delta_t_tr
        + -2.18203660e-7 * tdb * delta_t_tr * delta_t_tr * delta_t_tr
        + 7.51269482e-9 * tdb * tdb * delta_t_tr * delta_t_tr * delta_t_tr
        + 9.79063848e-11
        * tdb
        * tdb
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + 1.25006734e-6 * v * delta_t_tr * delta_t_tr * delta_t_tr
        + -1.81584736e-9 * tdb * v * delta_t_tr * delta_t_tr * delta_t_tr
        + -3.52197671e-10
        * tdb
        * tdb
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + -3.36514630e-8 * v * v * delta_t_tr * delta_t_tr * delta_t_tr
        + 1.35908359e-10
        * tdb
        * v
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + 4.17032620e-10
        * v
        * v
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + -1.30369025e-9
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + 4.13908461e-10
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + 9.22652254e-12
        * tdb
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + -5.08220384e-9
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + -2.24730961e-11
        * tdb
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + 1.17139133e-10
        * v
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + 6.62154879e-10
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + 4.03863260e-13
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + 1.95087203e-12
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + -4.73602469e-12
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + 5.12733497 * pa
        + (-0.312788561) * tdb * pa
        + (-0.0196701861) * tdb * tdb * pa
        + 9.99690870e-4 * tdb * tdb * tdb * pa
        + 9.51738512e-6 * tdb * tdb * tdb * tdb * pa
        + -4.66426341e-7 * tdb * tdb * tdb * tdb * tdb * pa
        + 0.548050612 * v * pa
        + (-0.00330552823) * tdb * v * pa
        + (-0.00164119440) * tdb * tdb * v * pa
        + -5.16670694e-6 * tdb * tdb * tdb * v * pa
        + 9.52692432e-7 * tdb * tdb * tdb * tdb * v * pa
        + (-0.0429223622) * v * v * pa
        + 0.00500845667 * tdb * v * v * pa
        + 1.00601257e-6 * tdb * tdb * v * v * pa
        + -1.81748644e-6 * tdb * tdb * tdb * v * v * pa
        + -1.25813502e-3 * v * v * v * pa
        + -1.79330391e-4 * tdb * v * v * v * pa
        + 2.34994441e-6 * tdb * tdb * v * v * v * pa
        + 1.29735808e-4 * v * v * v * v * pa
        + 1.29064870e-6 * tdb * v * v * v * v * pa
        + -2.28558686e-6 * v * v * v * v * v * pa
        + (-0.0369476348) * delta_t_tr * pa
        + 0.00162325322 * tdb * delta_t_tr * pa
        + -3.14279680e-5 * tdb * tdb * delta_t_tr * pa
        + 2.59835559e-6 * tdb * tdb * tdb * delta_t_tr * pa
        + -4.77136523e-8 * tdb * tdb * tdb * tdb * delta_t_tr * pa
        + 8.64203390e-3 * v * delta_t_tr * pa
        + -6.87405181e-4 * tdb * v * delta_t_tr * pa
        + -9.13863872e-6 * tdb * tdb * v * delta_t_tr * pa
        + 5.15916806e-7 * tdb * tdb * tdb * v * delta_t_tr * pa
        + -3.59217476e-5 * v * v * delta_t_tr * pa
        + 3.28696511e-5 * tdb * v * v * delta_t_tr * pa
        + -7.10542454e-7 * tdb * tdb * v * v * delta_t_tr * pa
        + -1.24382300e-5 * v * v * v * delta_t_tr * pa
        + -7.38584400e-9 * tdb * v * v * v * delta_t_tr * pa
        + 2.20609296e-7 * v * v * v * v * delta_t_tr * pa
        + -7.32469180e-4 * delta_t_tr * delta_t_tr * pa
        + -1.87381964e-5 * tdb * delta_t_tr * delta_t_tr * pa
        + 4.80925239e-6 * tdb * tdb * delta_t_tr * delta_t_tr * pa
        + -8.75492040e-8 * tdb * tdb * tdb * delta_t_tr * delta_t_tr * pa
        + 2.77862930e-5 * v * delta_t_tr * delta_t_tr * pa
        + -5.06004592e-6 * tdb * v * delta_t_tr * delta_t_tr * pa
        + 1.14325367e-7 * tdb * tdb * v * delta_t_tr * delta_t_tr * pa
        + 2.53016723e-6 * v * v * delta_t_tr * delta_t_tr * pa
        + -1.72857035e-8 * tdb * v * v * delta_t_tr * delta_t_tr * pa
        + -3.95079398e-8 * v * v * v * delta_t_tr * delta_t_tr * pa
        + -3.59413173e-7 * delta_t_tr * delta_t_tr * delta_t_tr * pa
        + 7.04388046e-7 * tdb * delta_t_tr * delta_t_tr * delta_t_tr * pa
        + -1.89309167e-8
        * tdb
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + -4.79768731e-7 * v * delta_t_tr * delta_t_tr * delta_t_tr * pa
        + 7.96079978e-9
        * tdb
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + 1.62897058e-9
        * v
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + 3.94367674e-8
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + -1.18566247e-9
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + 3.34678041e-10
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + -1.15606447e-10
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + (-2.80626406) * pa * pa
        + 0.548712484 * tdb * pa * pa
        + (-0.00399428410) * tdb * tdb * pa * pa
        + -9.54009191e-4 * tdb * tdb * tdb * pa * pa
        + 1.93090978e-5 * tdb * tdb * tdb * tdb * pa * pa
        + (-0.308806365) * v * pa * pa
        + 0.0116952364 * tdb * v * pa * pa
        + 4.95271903e-4 * tdb * tdb * v * pa * pa
        + -1.90710882e-5 * tdb * tdb * tdb * v * pa * pa
        + 0.00210787756 * v * v * pa * pa
        + -6.98445738e-4 * tdb * v * v * pa * pa
        + 2.30109073e-5 * tdb * tdb * v * v * pa * pa
        + 4.17856590e-4 * v * v * v * pa * pa
        + -1.27043871e-5 * tdb * v * v * v * pa * pa
        + -3.04620472e-6 * v * v * v * v * pa * pa
        + 0.0514507424 * delta_t_tr * pa * pa
        + (-0.00432510997) * tdb * delta_t_tr * pa * pa
        + 8.99281156e-5 * tdb * tdb * delta_t_tr * pa * pa
        + -7.14663943e-7 * tdb * tdb * tdb * delta_t_tr * pa * pa
        + -2.66016305e-4 * v * delta_t_tr * pa * pa
        + 2.63789586e-4 * tdb * v * delta_t_tr * pa * pa
        + -7.01199003e-6 * tdb * tdb * v * delta_t_tr * pa * pa
        + -1.06823306e-4 * v * v * delta_t_tr * pa * pa
        + 3.61341136e-6 * tdb * v * v * delta_t_tr * pa * pa
        + 2.29748967e-7 * v * v * v * delta_t_tr * pa * pa
        + 3.04788893e-4 * delta_t_tr * delta_t_tr * pa * pa
        + -6.42070836e-5 * tdb * delta_t_tr * delta_t_tr * pa * pa
        + 1.16257971e-6 * tdb * tdb * delta_t_tr * delta_t_tr * pa * pa
        + 7.68023384e-6 * v * delta_t_tr * delta_t_tr * pa * pa
        + -5.47446896e-7 * tdb * v * delta_t_tr * delta_t_tr * pa * pa
        + -3.59937910e-8 * v * v * delta_t_tr * delta_t_tr * pa * pa
        + -4.36497725e-6 * delta_t_tr * delta_t_tr * delta_t_tr * pa * pa
        + 1.68737969e-7
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        * pa
        + 2.67489271e-8
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        * pa
        + 3.23926897e-9
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        * pa
        + (-0.0353874123) * pa * pa * pa
        + (-0.221201190) * tdb * pa * pa * pa
        + 0.0155126038 * tdb * tdb * pa * pa * pa
        + -2.63917279e-4 * tdb * tdb * tdb * pa * pa * pa
        + 0.0453433455 * v * pa * pa * pa
        + (-0.00432943862) * tdb * v * pa * pa * pa
        + 1.45389826e-4 * tdb * tdb * v * pa * pa * pa
        + 2.17508610e-4 * v * v * pa * pa * pa
        + -6.66724702e-5 * tdb * v * v * pa * pa * pa
        + 3.33217140e-5 * v * v * v * pa * pa * pa
        + (-0.00226921615) * delta_t_tr * pa * pa * pa
        + 3.80261982e-4 * tdb * delta_t_tr * pa * pa * pa
        + -5.45314314e-9 * tdb * tdb * delta_t_tr * pa * pa * pa
        + -7.96355448e-4 * v * delta_t_tr * pa * pa * pa
        + 2.53458034e-5 * tdb * v * delta_t_tr * pa * pa * pa
        + -6.31223658e-6 * v * v * delta_t_tr * pa * pa * pa
        + 3.02122035e-4 * delta_t_tr * delta_t_tr * pa * pa * pa
        + -4.77403547e-6 * tdb * delta_t_tr * delta_t_tr * pa * pa * pa
        + 1.73825715e-6 * v * delta_t_tr * delta_t_tr * pa * pa * pa
        + -4.09087898e-7
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        * pa
        * pa
        + 0.614155345 * pa * pa * pa * pa
        + (-0.0616755931) * tdb * pa * pa * pa * pa
        + 0.00133374846 * tdb * tdb * pa * pa * pa * pa
        + 0.00355375387 * v * pa * pa * pa * pa
        + -5.13027851e-4 * tdb * v * pa * pa * pa * pa
        + 1.02449757e-4 * v * v * pa * pa * pa * pa
        + (-0.00148526421) * delta_t_tr * pa * pa * pa * pa
        + -4.11469183e-5 * tdb * delta_t_tr * pa * pa * pa * pa
        + -6.80434415e-6 * v * delta_t_tr * pa * pa * pa * pa
        + -9.77675906e-6 * delta_t_tr * delta_t_tr * pa * pa * pa * pa
        + 0.0882773108 * pa * pa * pa * pa * pa
        + (-0.00301859306) * tdb * pa * pa * pa * pa * pa
        + 0.00104452989 * v * pa * pa * pa * pa * pa
        + 2.47090539e-4 * delta_t_tr * pa * pa * pa * pa * pa
        + 0.00148348065 * pa * pa * pa * pa * pa * pa);
  }
  function utci(ta, tmrt, va, rh) { return utciPoly(ta, va, tmrt - ta, satVpKpa(ta) * rh / 100.0); }

  var DEFAULTS = { W: 20.0, H: 15.0, orient: 'N-S', alb_wall: 0.25, alb_road: 0.10, alb_walk: 0.30,
                   canopy: 0.0, irrigated: true, awning: 0.0, ac: 0.0 };
  var MAT = { wall: [250000.0, 1.2, 26.0], road: [220000.0, 1.5, null], walk: [160000.0, 1.5, null] };
  var EMIS = 0.92, TAU_SW = 0.20, TAU_LW = 0.20, LATENT_FRAC = 0.70, AC_PEAK = 60.0, AC_T0 = 22.0, AC_T1 = 38.0;
  var H_CONV = 5.6 + 4.0 * WIND_PED, AB_PERSON = 0.70, EM_PERSON = 0.97, UTCI_STRONG = 32.0;
  function exchangeVelocity(H, W) { return WIND_10 * (0.03 + 0.07 / (1.0 + H / W)); }
  function personFp(beta) { return 0.42 * Math.cos(beta) + 0.043 * Math.sin(beta); }

  function run(params) {
    var p = {}, k;
    for (k in DEFAULTS) p[k] = DEFAULTS[k];
    for (k in (params || {})) p[k] = params[k];
    var spinupHours = 24, tmean = 0, i, j;
    for (i = 0; i < HOURS; i++) tmean += TEXT[i];
    tmean /= HOURS;
    var W = p.W, H = p.H, ori = ORIENTATIONS[p.orient], axisDeg = ori[0];
    var g = buildGeometry(W, H), F = g.F, areas = g.areas, sw = g.sw;
    var alb = [p.alb_wall, p.alb_wall, p.alb_walk, p.alb_road, p.alb_walk];
    var mats = [MAT.wall, MAT.wall, MAT.walk, MAT.road, MAT.walk];
    var c = p.canopy, a = p.awning;
    var canopyBlock = c * (1.0 - TAU_SW), canopyLw = c * (1.0 - TAU_LW);
    var skyBlock = [0, 0, 1 - (1 - canopyLw) * (1 - a), canopyLw, 1 - (1 - canopyLw) * (1 - a)];
    var swBlock = [0, 0, 1 - (1 - canopyBlock) * (1 - a), canopyBlock, 1 - (1 - canopyBlock) * (1 - a)];
    var gEx = RHO_CP * exchangeVelocity(H, W) * W;
    var hA = areas.map(function (A) { return H_CONV * A; });
    var sumHA = hA.reduce(function (x, y) { return x + y; }, 0);
    var T = [tmean + 2, tmean + 2, tmean + 2, tmean + 2, tmean + 2];
    var out = { ta: [], tc: [], ts: [], utciA: [], utciB: [], mrtA: [], mrtB: [], qconv: [], rh: [], beta: [], sunlit: [], shadowL: [], sunSide: [] };
    var nsteps = Math.floor((HOURS + spinupHours) * 3600 / DT), t0 = -spinupHours * 3600.0, perHour = Math.round(3600 / DT);
    for (var step = 0; step < nsteps; step++) {
      var tS = t0 + step * DT, tw = ((tS % (HOURS * 3600)) + HOURS * 3600) % (HOURS * 3600);
      var w = weatherAt(tw), ta = w.ta, beta = w.beta, dni = w.dni, dhi = w.dhi, ldown = w.ldown;
      var sh = shading(g, beta, w.gamma, axisDeg), sunlit = sh.sunlit;
      var tsky4 = ldown / SIGMA;
      var inc = [0, 0, 0, 0, 0];
      for (i = 0; i < 5; i++) {
        var direct = beta > 0 ? dni * sunlit[i] * (i < 2 ? sh.cosWall : Math.sin(beta)) : 0.0;
        inc[i] = (direct + dhi * F[i][5]) * (1.0 - swBlock[i]);
      }
      var intercepted = 0.0;
      for (i = 2; i < 5; i++) intercepted += (inc[i] / Math.max(1e-9, 1.0 - swBlock[i]) - inc[i]) * areas[i];
      var refl = [], swAbs = [];
      for (i = 0; i < 5; i++) refl.push(alb[i] * inc[i]);
      for (i = 0; i < 5; i++) {
        var bounce = 0.0;
        for (j = 0; j < 5; j++) if (j !== i) bounce += F[i][j] * refl[j];
        swAbs.push((1.0 - alb[i]) * (inc[i] + bounce));
      }
      var acLoad = Math.max(0.0, Math.min(1.0, (ta - AC_T0) / (AC_T1 - AC_T0)));
      var qAc = p.ac * AC_PEAK * acLoad * 2.0 * H;
      var qCanopy = intercepted * (1.0 - (p.irrigated ? LATENT_FRAC : 0.0));
      var num = gEx * ta + qAc + qCanopy;
      for (i = 0; i < 5; i++) num += hA[i] * T[i];
      var tc = num / (sumHA + gEx);
      var T4 = T.map(function (Ti) { return Math.pow(Ti + 273.15, 4); }), tair4 = Math.pow(tc + 273.15, 4);
      var newT = [0, 0, 0, 0, 0], qconv = 0.0;
      for (i = 0; i < 5; i++) {
        var lwIn = 0.0;
        for (j = 0; j < 5; j++) if (j !== i) lwIn += F[i][j] * EMIS * SIGMA * T4[j];
        var skyPart = F[i][5] * ((1.0 - skyBlock[i]) * ldown + skyBlock[i] * SIGMA * tair4);
        var lwNet = EMIS * (lwIn + skyPart - SIGMA * T4[i]);
        var conv = H_CONV * (tc - T[i]);
        var m = mats[i], Tdeep = m[2] === null ? tmean : m[2];
        newT[i] = T[i] + DT * (swAbs[i] + lwNet + conv + m[1] * (Tdeep - T[i])) / m[0];
        qconv += -conv * areas[i];
      }
      T = newT;
      var res = {};
      ['A', 'B'].forEach(function (side) {
        var vf = g.ped[side], idx = side === 'A' ? 2 : 4, lw4 = 0.0;
        for (j = 0; j < 5; j++) lw4 += vf[j] * T4[j];
        lw4 += vf[5] * ((1.0 - skyBlock[idx]) * tsky4 + skyBlock[idx] * tair4);
        var direct2 = 0.0;
        if (beta > 0) {
          var xp = side === 'A' ? sw / 2.0 : W - sw / 2.0, Lp = H > 1.1 ? sh.L * (H - 1.1) / H : 0.0;
          var inShadow = sh.sunSide === 'B' ? (xp > W - Lp) : (xp < Lp);
          if (sh.sunSide === null) inShadow = false;
          if (!inShadow) direct2 = dni * personFp(beta) * (1.0 - swBlock[idx]);
        }
        var diffuse = 0.5 * dhi * vf[5] * (1.0 - swBlock[idx]), reflected = 0.0;
        for (j = 0; j < 5; j++) reflected += vf[j] * refl[j];
        var sAbs = AB_PERSON * (direct2 + diffuse + reflected);
        res[side] = Math.pow(lw4 + sAbs / (EM_PERSON * SIGMA), 0.25) - 273.15;
      });
      if (tS >= 0 && step % perHour === 0) {
        var rh = rhPct(tc);
        out.ta.push(ta); out.tc.push(tc); out.ts.push(T.slice());
        out.mrtA.push(res.A); out.mrtB.push(res.B);
        out.utciA.push(utci(tc, res.A, WIND_10, rh)); out.utciB.push(utci(tc, res.B, WIND_10, rh));
        out.qconv.push(qconv); out.rh.push(rh); out.beta.push(beta);
        out.sunlit.push(sunlit); out.shadowL.push(sh.L); out.sunSide.push(sh.sunSide);
      }
    }
    out.labels = { A: ori[1], B: ori[2] };
    out.params = p; out.geom = g;
    out.summary = summarise(out);
    return out;
  }

  function summarise(o) {
    var n = o.ta.length, i, day = [], dT = [];
    for (i = 0; i < n; i++) { day.push(o.beta[i] > 0); dT.push(o.tc[i] - o.ta[i]); }
    function hrsAbove(x, lim) { var c = 0; for (var k = 0; k < x.length; k++) if (x[k] > lim) c++; return c; }
    function peak(x) { var bi = 0; for (var k = 1; k < x.length; k++) if (x[k] > x[bi]) bi = k; return [x[bi], bi]; }
    function maxCol(c) { var m = -1e9; for (var k = 0; k < n; k++) m = Math.max(m, o.ts[k][c]); return m; }
    var nightN = 0, nightSum = 0, minNight = 1e9, qDay = 0, qNight = 0, sumDT = 0;
    for (i = 0; i < n; i++) {
      sumDT += dT[i];
      if (day[i]) qDay += o.qconv[i]; else { nightN++; nightSum += dT[i]; minNight = Math.min(minNight, o.tc[i]); qNight += o.qconv[i]; }
    }
    return {
      hoursStrongA: hrsAbove(o.utciA, UTCI_STRONG), hoursStrongB: hrsAbove(o.utciB, UTCI_STRONG),
      hoursVeryStrongA: hrsAbove(o.utciA, 38.0), hoursVeryStrongB: hrsAbove(o.utciB, 38.0),
      peakUtciA: peak(o.utciA), peakUtciB: peak(o.utciB),
      peakRoadT: maxCol(3), peakWalkA: maxCol(2), peakWalkB: maxCol(4),
      peakDT: Math.max.apply(null, dT), meanDT: sumDT / n, nightMeanDT: nightSum / Math.max(1, nightN),
      minNightTc: minNight, qDay: qDay * 3600 / 1e6, qNight: qNight * 3600 / 1e6
    };
  }

  var api = { run: run, utci: utci, sunPosition: sunPosition, clearSky: clearSky, buildGeometry: buildGeometry,
              shading: shading, ORIENTATIONS: ORIENTATIONS, DEFAULTS: DEFAULTS, TEXT: TEXT, HOURS: HOURS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CanyonModel = api;
})(typeof window !== 'undefined' ? window : this);
