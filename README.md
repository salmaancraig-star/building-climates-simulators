# Building Climates — two browser simulators

Teaching tools for **CLUSTER 2A "Building Climates"**, UCLA Architecture and Urban Design (Module 2, *Interior Climates*, Fall 2026).

Each simulator is a single HTML file. It needs no installation, no server and no internet connection once opened: open it in any modern browser (Chrome, Edge, Firefox, Safari) and it runs.

| File | What it does |
|---|---|
| [`StreetCanyonSimulator.html`](StreetCanyonSimulator.html) | Design a street canyon — width, height, orientation, surface colours, trees, awnings, air-conditioning rejection — and see pedestrian heat stress (UTCI, shown as "felt temperature") and the night-time heat island over a week-long Los Angeles heatwave. |
| [`PassiveBuildingSimulator.html`](PassiveBuildingSimulator.html) | Design the top floor of a naturally ventilated office — where the glass goes, shading, roof colour, insulation, glazing, thermal mass, night ventilation, occupancy, fresh air, comfort band — and see whether it stays within the adaptive comfort band during the same heatwave, without air-conditioning. |

Both open on a poor design. The task for the student is to make it work.

**Try them online:** once GitHub Pages is switched on for this repository (see `docs/BruinLearn_embedding.md`), the apps are served at
`https://<username>.github.io/<repository>/StreetCanyonSimulator.html` and
`https://<username>.github.io/<repository>/PassiveBuildingSimulator.html`, with a landing page at `https://<username>.github.io/<repository>/`.

## Folder contents

```
index.html                       landing page linking both apps (used by GitHub Pages)
StreetCanyonSimulator.html       app 1, self-contained
PassiveBuildingSimulator.html    app 2, self-contained
docs/
  StreetCanyon_model_note.md     what the canyon model computes, assumptions, validation, limits
  StreetCanyon_validation.png    validation figure referred to in the note
  PassiveBuilding_model_note.md  the same for the building model
  BruinLearn_embedding.md        for the Digital Curriculum team: hosting and embedding in Canvas
src/
  canyon_model.py / .js          the canyon model: Python reference and the JavaScript port used in the app
  building_model.py / .js        the building model, likewise
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

## Licence

Code, apps and documentation: MIT licence (see `LICENSE`) — reuse and adapt with attribution. The charting library is Chart.js, also MIT (see `THIRD_PARTY_LICENSES.md`).

## Author

Salmaan Craig, UCLA Architecture and Urban Design, 2026.
