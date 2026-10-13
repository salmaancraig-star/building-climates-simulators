# Passive Building Simulator v2 — model note

*Companion to `PassiveBuildingSimulator.html`. For the head TA and anyone asked what the numbers mean. One file, no installation, works offline.*

---

## What it is

The January 2026 building app with its heat balance kept, its sun replaced, and its glazing turned into a design decision. The building is a mid-rise office in Los Angeles — 20 m × 15 m, three floors, 10 m tall — but the simulated zone is its **top floor**: 1,000 m³ under 300 m² of roof, so that the roof finish can matter. It runs through the same hot week as the Street Canyon Simulator, under the same clear-sky sun. The student has 120 m² of glass to place across the four façades, chooses how much to shade them, the roof finish, the insulation, the glazing type, the thermal mass per floor, the occupant density, the fresh-air rate, the night ventilation and the comfort band.

## What changed from the January app, and why

| | January app | v2 |
|---|---|---|
| Zone | Whole building, 3,000 m³, 1,000 m² envelope | Top floor only: 1,000 m³, 233 m² of wall, 300 m² of roof, floor below assumed at the same temperature |
| Sun | A cosine peaking at 650 W/m² at 16:00 on the west only | Clear-sky direct and diffuse sun for 34°N on 1 September, resolved on each façade by incidence angle, with sky-diffuse and ground-reflected terms |
| Glazing | One control: west glazing ratio 5–90 % of a 300 m² façade | 120 m² fixed for the building, distributed by four shares with a divided bar; one 1.5 m ribbon per floor per façade whose length follows the share; the dividers stop where a ribbon would exceed its wall |
| Shading | None | One setting for every façade: none / partial (0.6 m overhang) / practical maximum (1.2 m overhang and 1.2 m fins at 1.5 m) |
| Roof | Not represented | Dark (absorbs 90 %), grey (65 %) or cool (20 %); heat enters by conduction from the roof's sol-air temperature |
| Night purging | "5 ACH" wired as 1,759 W/K (1.75 ACH); 10 ACH | Off / 2 ACH (windows ajar) / 6 ACH (purpose-made vents), correctly scaled to the zone |
| Background infiltration | 1.2 W/K, labelled "~1 ACH", in fact about 0.001 | 0.3 air changes per hour |
| Comfort band | ±3.5 °C labelled 90 % acceptability (it is the 80 % band) | 90 % (±2.5), 80 % (±3.5), or 80 % with ceiling fans: upper limit raised 2.2 °C, the standard's allowance for 1.2 m/s of air movement (ASHRAE 55 §5.4.2.4) |
| Occupants, mass | Whole-building: 5–50 people, 10–150 MJ/K | Per floor: low / medium / high density (10, 15, 25 people — 30, 20 and 12 m² per person), 5–50 MJ/K |
| Insulation | U-value slider 0.2–1.5 | Three options for walls and roof together: 1.0 / 0.5 / 0.2 W/m²K |
| Fresh air when occupied | 10 L/s per person, fixed | 5 / 10 / 15 L/s per person |
| Time step | 1 hour, explicit — can oscillate for light mass with high purging | 10 minutes |

Everything else — occupancy weekdays 08:00–18:00 (now with arrivals spread over the first hour and departures over the last, so internal gains and occupied ventilation ramp rather than switch), 150 W and 10 L/s per person, U-values, SHGC by glazing type, the adaptive comfort temperature 0.31 × previous day's mean + 17.8 °C, counting only occupied hours — is unchanged. Before any change was made, the new code was run in a "legacy" mode reproducing the January app line for line; across 31 parameter combinations it matched the original JavaScript to 10⁻¹⁴ °C, including the hours count. The v2 JavaScript in the app matches the Python reference to 10⁻¹⁴ °C across 30 random designs.

## Why 120 m², and why ribbons

The brief fixed the glass at 300 m², the January app's west façade fully glazed. At that quantity the building overheats whatever is done with it — the occupied-hours count sits near 50 of 50 for every distribution — and the design decision disappears. At 120 m² (17 % of wall area) distribution, shading, roof and the other controls all register, and a well-designed top floor can reach zero hours over the limit.

Windows are a ribbon per floor of fixed height, 1.5 m, whose length follows the share; the height has to be fixed because an overhang's effect depends on window height and fins' on window width. The ceiling on each façade is then geometric: a west or east ribbon can be at most 20 m long, so those façades take at most 90 m² of the building's glass; north and south, 68 m². The largest façade cannot take the 120 m², and the divided bar's handles stop at the caps, so an unbuildable design cannot be set. Presets that would exceed a cap spill the excess onto the north façade first.

## Two measures, and heat admitted

The occupied-hours count saturates in a heatwave; peak indoor temperature is shown beside it because that is what west glass most affects. A third figure, heat admitted through glass and roof over the week, and the stacked bar beneath the chart (glass by façade, roof, and what shading kept out) show where the heat came from.

The app opens on a deliberately bad design (15 people, poorly insulated at U 1.0, single glazing, 15 MJ/K, windows closed at night, dark roof, 10 L/s per person, 60 % of the glass on the west, no shading): 49 of 50 h over, peak 57 °C, 679 kWh through the glass and 600 kWh through the roof. No single move rescues it — a cool roof gives 45 h and 49 °C, heavy mass 49 h and 50 °C, maximum shading 47 h and 50 °C, north-heavy glass 47 h and 53 °C, 6 ACH purging 47 h, ceiling fans 46 h — which is the point: the measures have to be combined. For reference, the earlier moderate starting point (double glazing, 35 MJ/K, 2 ACH, grey roof, glass spread evenly) gives 44 h and 44 °C; from there a dark roof gives 46 h, a cool roof 39 h, 6 ACH 39 h and purging off 48 h.

## What the glazing and shading show

With a moderate envelope (cool roof, U 0.5, double glazing, 35 MJ/K, 6 ACH): a north–south distribution gives 31 h; partial shading 25 h; the practical maximum 18 h; adding ceiling fans 5 h. The same envelope west-heavy gives 30 h unshaded, 27 h with partial shading and 22 h with the maximum. Per façade, the partial overhang removes 64 % of the south glass's weekly gain but 30 % of the west's; the maximum removes 85 % and 62 %. The west is hard to shade because its sun is low and nearly square to the façade when the gain is largest; the better move is to take the glass away.

The game can be won: at medium density, north-heavy glass with maximum shading, triple glazing, U 0.2, 50 MJ/K, 6 ACH purging, a cool roof and ceiling fans gives 0 h and a 33 °C peak (8 h without the fans; at low density 3–4 h without fans, 0 h with them; at high density 5 h even with fans). More fresh air during the day does not help in a heatwave — the outdoor air is hotter than the comfort limit — which is a useful thing for students to discover from the dilution-rate control. A dark roof, light mass or closed windows at night undoes the design.

## Fixed, and why

- Weather and sun shared with the canyon app, so the two exercises are commensurable; the June and December sun paths are drawn for context only.
- Internal gains, ventilation and comfort as in the January app.
- The building does not rotate: a rotated building is the same exercise as a redistribution of glass.
- Roof: sol-air temperature with a 17 W/m²K outside film and a 63 W/m² longwave loss to the clear sky (ASHRAE), same U-value as the walls, no thermal mass of its own.
- Ground albedo 0.2; fins at 1.5 m spacing; overhang at the window head; diffuse reduced by 40 % of the fraction of sky each device hides — approximations stated, not calibrated.

## Known limits

One air-and-mass node for the top floor, so no stratification; the floor below is assumed to track it. Shading geometry is the standard projection on a ribbon window; real windows with reveals and frames will differ. The roof has no thermal mass, which makes its daytime load arrive a little early. The absolute hours depend strongly on the comfort band chosen; differences between designs are the robust quantity.

## Sources

ASHRAE Standard 55 adaptive model (including §5.4.2.4 elevated air speed); ASHRAE Handbook sol-air temperature; ASHRAE clear-sky model (coefficients interpolated to 1 September); shading geometry after Olgyay and Olgyay, *Solar Control and Shading Devices*. Chart.js v4.4.7 (MIT) is embedded in the file.
