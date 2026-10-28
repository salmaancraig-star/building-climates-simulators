# Model sources

The apps embed the JavaScript files here; the Python files are the reference implementations against which they were validated.

| File | Role |
|---|---|
| `canyon_model.py` | Street-canyon model, Python reference. `run(params)` returns hourly surface temperatures, canyon air temperature, mean radiant temperature and UTCI on each sidewalk for the synthetic heatwave week. |
| `canyon_model.js` | Port used in `StreetCanyonSimulator.html`. Matches the Python to 1e-13 °C over 16 scenarios. |
| `text168.json` | The synthetic heatwave week: 168 hourly air temperatures above the roofline, shared by both models. |
| `utci_poly.py` | The Bröde et al. (2012) sixth-order UTCI polynomial, checked against `pythermalcomfort` to 0.04 K. |
| `building_model.py` | Passive-building model, Python reference. Depends on `canyon_model.py` for sun position, clear-sky irradiance and the weather week. Has a `legacy=True` mode reproducing the January 2026 app, used to confirm nothing regressed before the physics was changed. |
| `building_model.js` | Port used in `PassiveBuildingSimulator.html`. Matches the Python to 1e-14 °C over 30 random designs. |
| `ratchet_model.js` | Used in `ComfortRatchetSimulator.html`: the building physics of `building_model.js` driven by real TMYx weather (air-conditioned or naturally ventilated mode, with hourly heating and cooling), plus the occupant model (expectation, sensitivity, discomfort weight, comfort band) and the scenario runner. |
| `ratchet_occupant_reference.py` | Independent Python implementation of the occupant rules, run on the indoor-temperature series exported from the JavaScript (`series_downtown.json`). The app's self-test checks seven numbers against it (uncomfortable hours, band widths, operational share) and prints PASS in the fold-out. |
| `series_downtown.json` | The exported series: downtown office air-conditioned and naturally ventilated, the Medellín office, the occupancy mask and the ASHRAE adaptive comfort temperature, calendar frame. |

To run the Python references: Python 3.10+, standard library only (`pythermalcomfort` was used once for the UTCI check and is not required).

```
cd src
python3 -c "import sys; sys.path.insert(0, '.'); import building_model as b; o = b.run(dict(b.DEFAULTS)); print(o['hours_over'], round(o['peak_int'], 1))"
```

which prints `49 57.1` — the app's opening design.


To run the comfort-ratchet reference (NumPy required):

```
cd src
python3 ratchet_occupant_reference.py series_downtown.json
```

which prints the calibration and six scenarios; the first line of results is `native -> NV office, jumper ... 214 h ... w 2.0669 share 0.9045`, the numbers the app's self-test checks.
