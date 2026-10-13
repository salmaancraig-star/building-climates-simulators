# Street Canyon Simulator — model note

*Companion to `StreetCanyonSimulator.html`. For the head TA and anyone asked what the numbers mean. One file, no installation, works offline.*

---

## What it is

A two-dimensional model of a street in Los Angeles — two rows of buildings, a road, two 3 m sidewalks — run hour by hour over the same hot summer week as the Passive Building Simulator. It reports two things that do not move together: how much the street heats the air (the city), and how hot it feels to a person walking along each sidewalk (the body). The two apps share the week's weather and nothing else; no data passes between them.

## Controls

| Control | Range | What it changes in the model |
|---|---|---|
| Canyon width, building height | 10–40 m, 5–40 m | View factors between every surface and the sky; shadow lengths; how much the canyon air exchanges with the air above |
| Orientation | N–S, E–W, NE–SW, NW–SE | Which sidewalk is in shadow at each hour. Sidewalks are named by the compass side of the street they lie on |
| Road albedo, sidewalk albedo, façade reflectivity | 0.10–0.80, 0.20–0.80, 0.10–0.60 | Sunlight absorbed by each surface, and reflected onto the others and onto the pedestrian |
| Sidewalk shade (awnings, arcades) | 0–100 %, 75 % marked | Fraction of sidewalk shielded from direct sun and sky; the shield sits at air temperature, so it also blocks night-sky cooling |
| Tree canopy, irrigated or not | 0–60 %, 9 % and 19 % marked | Canopy transmits 20 % of sunlight. Irrigated: 70 % of what it intercepts leaves as evaporation. Unirrigated: all of it warms the canyon air. Canopy blocks 80 % of the night sky beneath it |
| Air-conditioning frontage | 0–100 % | Sensible heat into the canyon air, up to 60 W per m² of façade at the hottest hour, scaling with outdoor temperature; rooftop units are not counted |
| Hour of day 3 | 0–23 | Which hour the section drawing shows; does not affect the week's results |

The marked detents are the Phoenix Walkable Urban Code (75 % shaded sidewalks) and the Hunting Park / Philadelphia canopy figures from Aviv et al. The 0.80 albedo end exceeds what weathered paving achieves in service and is there to make the trade-off unmistakable.

## Outputs

**The body.** The app calls UTCI "Felt Temperature" throughout and defines it in its preamble. Hours per week above a felt temperature of 32 °C (strong heat stress) on each sidewalk — the headline, parallel to the building app's hours above the comfort limit — with the peak UTCI and when it occurs. UTCI is the air temperature of a reference outdoor setting that would feel the same; it combines air temperature, mean radiant temperature, wind and humidity for a walking person. The chart shows both sidewalks over the official UTCI heat-stress bands drawn as translucent colour, with a vertical marker at the hour chosen on the section slider; the two charts sit behind tabs named "Pedestrian heat stress" and "Urban heat island", and the heat-stress categories are named on the chart's right-hand axis.

**The city.** Peak road surface temperature; heat released from the surfaces into the canyon air after dark, in MJ per metre of street; the canyon heat island (canyon air minus the air above the roofline) as a weekly peak and a night-time mean; the coolest the canyon air gets at night. The chart shows the road surface, the canyon air and the roofline air that is the week's weather; the heat island is the gap between the last two.

**The section.** The lead graphic: a live cross-section at a chosen hour of the hottest day, with the orientation named ("section looking east"), the two weekly headline panels, the sky drawn as a half-disc in orthographic projection with the sun's path traced across it, the building's shadow, trees and awnings with the shade they cast, and the two pedestrians labelled with UTCI and whether they stand in sun or shade. A sun lying along the street projects near the centre of the disc, low down; the line from the street centre to the sun is always parallel to the shadow's edge. Trees and awnings are drawn at a fixed size, and the sliders set their density, shown as opacity and as the darkness of the shadow volumes they cast along the sun direction, clipped to the canyon so that shade lands on the opposite wall rather than passing through it. Pedestrians are drawn as outlined figures. One toggle switches the page between metric and imperial units.

## The physics, briefly

Clear-sky direct and diffuse sun from a standard clear-sky model for 34°N in early September. Each surface receives direct sun on the part the walls do not shadow, diffuse sun in proportion to the sky it sees, and one bounce of what the other surfaces reflect. Each surface radiates to the sky it sees and exchanges longwave radiation with the surfaces it faces, convects to the canyon air, and conducts to a deep layer (pavements) or a conditioned interior (walls). Surfaces have the heat capacity of their daily active layer, so asphalt is still warm at midnight. Canyon air is a single well-mixed volume exchanging with the air above at a rate that falls as the canyon deepens; it receives convection from the surfaces, air-conditioning heat and whatever the trees do not evaporate. The pedestrian is a vertical body at 1.1 m above the sidewalk centre, seeing ground, walls and sky in the proportions geometry dictates, plus direct sun on a standing person's projected area. UTCI is the published sixth-order polynomial (Bröde et al. 2012).

The JavaScript in the app was checked against a Python reference implementation (`src/canyon_model.py`): across sixteen test scenarios the two agree to 2 × 10⁻¹³ °C in every hourly output, and the validation figure (`StreetCanyon_validation.png` (in this folder), panel d) plots four of those scenarios. The UTCI polynomial matches the pythermalcomfort library's implementation to 0.04 °C across the week's range of conditions.

## Fixed, and why

- **Weather.** The building app's 168-hour temperature series, unchanged, so the two exercises are commensurable. The building app has no sun geometry, humidity or wind; these were added here as fixed values (clear skies; dew point 15 °C, so relative humidity runs from about 25 % at the hottest hour to 70 % at night; 0.5 m/s at street level, about 0.75 m/s at 10 m).
- **Wind** is not a control. It enters UTCI strongly and geometry genuinely alters it, but modelling that honestly is a different class of model.
- **Two-dimensional.** No intersections, no corners, no flow along the street.
- **The reference for urban heating is the air above the roofline**, not a rural station, which keeps the comparison inside the model.

## What the model shows, and how far to trust it

Sanity checks against published magnitudes, with the week's hottest day peaking at 38 °C:

- Black asphalt in full sun peaks at 60–68 °C depending on canyon depth; measured asphalt in comparable climates reaches 60–65 °C.
- A sunlit sidewalk feels 5–10 °C hotter on the UTCI scale than the shaded one opposite; field studies report 5–10 °C.
- Whitening road and sidewalk to albedo 0.8 drops the road's peak by about 22 °C and the night-time heat release by about a quarter, while raising the west sidewalk's peak UTCI by about 1.6 °C — the "albedo trap" is in the model and of the size reported in cool-pavement field studies.
- Deepening the canyon from 15 m to 40 m cuts peak UTCI by about 6–7 °C and raises the night-time heat island from 1.2 to 1.3 °C; the day and night registers disagree about which design won.
- Irrigated trees improve both registers; the same trees unirrigated cool the pedestrian almost as much but push the canyon's peak heat island from 2.5 to 4.7 °C (the bare canyon's is 3.0 °C).
- Full air-conditioning adds about 0.35 °C to the night-time mean heat island of a moderate canyon and 1.3 °C to a deep one (0.8 and 2.0 °C at the peak), the same order as the roughly 1 °C reported for Phoenix.

**Known limits.** With the street-level wind fixed at 0.5 m/s the canyon heat island sits within the observed range (night-time means of 0.6–2.6 °C here against 1–2 °C in measured canyons); a windier week would ventilate the canyon more and shrink it. Surface materials are textbook values, not calibrated. Trees are a transmittance and an evaporation fraction, not a species. The pedestrian's view of the world is taken across the street section only. None of these affect the direction of any comparison a student will make, but the app should be quoted for differences between designs, not for absolute values.

## Sources

ASHRAE clear-sky model (coefficients interpolated to 1 September); Berdahl and Martin clear-sky emissivity; Bröde, P. et al., "Deriving the operational procedure for the Universal Thermal Climate Index (UTCI)", *International Journal of Biometeorology* 56 (2012); view-factor and canyon energy-balance structure after Oke, *Boundary Layer Climates*, and Masson's Town Energy Balance scheme, reduced to a single canyon air node. Chart.js v4.4.7 (MIT) is embedded in the file.
