# Building Climates — three browser simulators

Teaching tools for **CLUSTER 2A "Building Climates"**, UCLA Architecture and Urban Design (Module 2, *Interior Climates*, Fall 2026).

Each simulator is a single HTML file. It needs no installation, no server and no internet connection once opened: open it in any modern browser (Chrome, Edge, Firefox, Safari) and it runs.

| File | What it does |
|---|---|
| [`StreetCanyonSimulator.html`](StreetCanyonSimulator.html) | Design a street canyon — width, height, orientation, surface colours, trees, awnings, air-conditioning rejection — and see pedestrian heat stress (UTCI, shown as "felt temperature") and the night-time heat island over a week-long Los Angeles heatwave. |
| [`ComfortRatchetSimulator.html`](ComfortRatchetSimulator.html) | Follow two people — an LA local from a lifetime of air-conditioning at 22 ± 0.5 °C and a newcomer from Medellín's free-running buildings — through seven years in the same Los Angeles office, air-conditioned or naturally ventilated. Their thermal expectation and comfort band learn from exposure at three speeds (days, a season, years); the app shows the hours too warm or too cool, the "ratchet" of narrowing and broadening tolerance, and the air-conditioning energy and emissions used or avoided. |
| [`PassiveBuildingSimulator.html`](PassiveBuildingSimulator.html) | Design the top floor of a naturally ventilated office — where the glass goes, shading, roof colour, insulation, glazing, thermal mass, night ventilation, occupancy, fresh air, comfort band — and see whether it stays within the adaptive comfort band during the same heatwave, without air-conditioning. |

The first two open on a poor design; the task for the student is to make it work. The third opens on the broadening scenario; the task is to read the two directions of the ratchet off the time slider.

**Try them online** (GitHub Pages):
- Landing page: https://salmaancraig-star.github.io/building-climates-simulators/
- Street Canyon Simulator: https://salmaancraig-star.github.io/building-climates-simulators/StreetCanyonSimulator.html
- Passive Building Simulator: https://salmaancraig-star.github.io/building-climates-simulators/PassiveBuildingSimulator.html
- Comfort Ratchet Simulator: https://salmaancraig-star.github.io/building-climates-simulators/ComfortRatchetSimulator.html

Hosting and embedding notes for Canvas/BruinLearn are in `docs/BruinLearn_embedding.md`.

## Folder contents

```
index.html                       landing page linking both apps (used by GitHub Pages)
StreetCanyonSimulator.html       app 1, self-contained
PassiveBuildingSimulator.html    app 2, self-contained
ComfortRatchetSimulator.html     app 3, self-contained (embeds two TMYx weather files, see docs/ComfortRatchet_model_note.md)
docs/
  StreetCanyon_model_note.md     what the canyon model computes, assumptions, validation, limits
  StreetCanyon_validation.png    validation figure referred to in the note
  PassiveBuilding_model_note.md  the same for the building model
  ComfortRatchet_model_note.md   the occupant model of app 3: equations, constants and their sources, checks, limits
  BruinLearn_embedding.md        for the Digital Curriculum team: hosting and embedding in Canvas
src/
  canyon_model.py / .js          the canyon model: Python reference and the JavaScript port used in the app
  building_model.py / .js        the building model, likewise
  ratchet_model.js               app 3: building physics (after building_model.js, with real weather) plus the occupant model
  ratchet_occupant_reference.py  app 3: independent Python reference for the occupant rules
  series_downtown.json           app 3: the indoor-temperature series the Python reference runs on
  utci_poly.py                   UTCI polynomial (Bröde et al. 2012) used for validation
  README.md                      how the models were validated
LICENSE                          MIT licence for this work
THIRD_PARTY_LICENSES.md          licence of the bundled charting library (Chart.js, MIT)
```

## How the apps were built

Each model was first written in Python, checked against published references (UTCI against the `pythermalcomfort` implementation; the building model against the January 2026 version of the tool, line for line), then ported to JavaScript and verified to reproduce the Python output to 10⁻¹³ °C across randomised designs. The JavaScript and the Chart.js library are inlined into the HTML so that each app is one file. Details are in the two model notes.

## Physics in one paragraph each

**Street canyon.** A two-dimensional canyon (two walls, road, two sidewalks, sky) with radiative exchange by view factors, one bounce of reflected sunlight, heat storage in each surface, a quasi-steady canyon air volume exchanged with the air above the roofline, optional tree canopy, awnings and air-conditioning heat rejection. Pedestrian heat stress is the Universal Thermal Climate Index computed from air temperature, mean radiant temperature, wind and humidity on each sidewalk.

**Passive building.** A single air-and-mass node for the top floor of a 20 m × 15 m, three-storey office; solar gains by façade from a clear-sky model and the sun's position for 34° N on 1 September, cut by overhangs and fins; conduction through walls and a sol-air roof; occupant gains and fresh air that ramp as people arrive and leave; night purging when the outside is cooler; the ASHRAE 55 adaptive comfort band with an optional ceiling-fan allowance.

**Comfort ratchet.** Each person carries an expectation P of the room temperature and a comfort band P ± w. P learns from the room's daily mean at α = 0.20 (the ASHRAE running-mean constant read indoors); sensitivity re-tunes to the lived spread of T − P over about six weeks; the weight given to discomfort relaxes over years towards what the regime trains (faster rising than falling — the ratchet). The band is anchored so that a lifetime at 22 ± 0.5 °C gives ±1.75 K (PMV ±0.5) and a settled naturally ventilated life ±2.50 K (ASHRAE 55 adaptive, 90 %). The building is the Passive Building Simulator's top floor driven by a typical-year weather file for downtown Los Angeles (and Medellín for the newcomer's origin); hours are uncomfortable when the room lies outside that day's own band. Model after Craig, Halepaska & Collins (2026), *Thermal Comfort, Alliesthesia, and the Predictive Brain* (pre-submission manuscript).

## Licence

Code, apps and documentation: MIT licence (see `LICENSE`) — reuse and adapt with attribution. The charting library is Chart.js, also MIT; the weather files embedded in the Comfort Ratchet Simulator are TMYx typical years from climate.onebuilding.org (see `THIRD_PARTY_LICENSES.md`).

## Author

Salmaan Craig, UCLA Architecture and Urban Design, 2026.
