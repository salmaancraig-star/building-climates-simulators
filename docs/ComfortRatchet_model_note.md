# Comfort Ratchet Simulator — model note

*App 3 of the Building Climates simulators. Salmaan Craig, UCLA Architecture and Urban Design, October 2026. Model after Craig, Halepaska & Collins (2026), *Thermal Comfort, Alliesthesia, and the Predictive Brain* (pre-submission manuscript).*

## What the app computes

Two people start work in the same Los Angeles office on the first Monday of September and stay seven years. The **LA local** has lived at 22 ± 0.5 °C (comfort band ±1.75 K); the **LA newcomer** arrives from six years in a free-running Medellín office (±2.31 K, expectation 23.0 °C). Two scenarios: the office is air-conditioned at 22 ± 0.5 °C (*narrowing*) or naturally ventilated (*broadening*), with three levels of personal control (nothing; operable windows and clothing; plus ceiling fans). For the period at the slider's stop the app draws the outdoor temperature, the room during occupancy, each person's expectation as a bell filled within their own comfort band, and the hours too warm or too cool; a strip shows each person's band half-width at nine clock-spaced stops (day 1 · week 1 · month 1 · Oct–Nov · Dec–Aug · years 2, 3, 4 · years 5–7). Scorecards give the updated prior, the tolerance, the share of occupied hours uncomfortable, and the air-conditioning electricity and emissions used (AC) or avoided (NV) per person since arrival.

## The building

The Passive Building Simulator's top floor (1,000 m³; 120 m² of north-heavy triple glazing, U 0.2 W/m²K; 50 MJ/K of mass; 15 people × 250 W; 10 L/s per person; weekdays 08–18), driven hour by hour by a TMYx typical year for Los Angeles Downtown (USC campus, 722874, 2009–2023) — the nearest file to Westwood — and by Medellín Olaya Herrera (801100) for the newcomer's origin. Naturally ventilated: windows open above 24 °C when it is cooler outside, night purge 6 ACH above 22 °C, heating holds 18 °C in occupied hours. Air-conditioned: 22 ± 0.5 °C. Hourly heating and cooling are accumulated; electricity = thermal / COP 3; emissions at 0.22 kg CO₂e/kWh (LADWP 2025 Power Content Label, 487 lb/MWh). The building series is rotated so that the occupant's day 1 is the first Monday of September and the working week stays aligned with the weather.

## The occupant (from the fold-out of the app)

**Fold-out summary line:** Year by year, the building, and how the model is built

*(note)* Brackets: the same year with every learning rate at the slow end of its range (α 0.10, β₁ 0.02, discomfort-weight relaxation 0.10 a year) or the fast end (0.40, 0.10, 0.44). “Accepts of what the standard accepts”: of the hours ASHRAE 55's adaptive 90 % envelope calls acceptable in this room, the share inside the newcomer's own comfort band. The standard's curve is not drawn: it is a pooled regression on outdoor air, and the gap between it and what either person expects is the building's doing.

**The people.** Each has an expectation P (where they expect the room to be) and a comfort band P ± w they accept. Sensation S = γ_S(T − P); discomfort D = γ_D|S|; the comfort band w = w₀ + c/(γ_Sγ_D), with w₀ = 1.08 K and c = 1.01 fixed so that a lifetime at 22 ± 0.5 °C gives ±1.75 K (PMV ±0.5 at 3.5 K a vote — the 90 % envelope) and a settled naturally ventilated life gives ±2.50 K (ASHRAE 55's adaptive 90 % envelope). An hour is uncomfortable when the room is outside that day's comfort band — their own band, never the standard's. The newcomer arrives with the comfort band six years in the Medellín office under these constants give them (±2.31 K, P 23.0 °C); the local as a lifetime at the setpoint (±1.75 K, P 22 °C). The Medellín figure in the heading (19–26 °C) is the simulated office's own range over working hours (mean 22.7 °C, 90 % of hours 20.9–24.7 °C) with no heating or cooling at all; it is not the adaptive standard's band, which for Medellín's running mean of 19.7 °C would be 21.4–26.4 °C.

**Three clocks.** (1) P ← P + α(T̄ − P), α = γ_S/(γ_S + γ_P) = 0.20 a day — McCartney & Nicol's fitted optimum (c = 0.80; 90 % of a change in ten days), read with the room in place of the outdoor air; their fit is flat for c 0.33–0.90 and the constant was never fitted indoors, so α 0.10–0.40 is carried as a range. (2) Sensitivity γ_S is tuned to the lived spread of T − P: 1/γ_S ∝ s₀² + σ², σ² tracked at β₁ = 0.05 a day (90 % in about six weeks; habituation studies fix only the downward direction, for strong stimuli; 0.02–0.10 carried as a range). The floor s₀² is set so that a settled air-conditioned life is 1.5× as sensitive as a naturally ventilated one (Rupp et al. 2019 give ≈ 2, pooled-slope attenuation argues for less; 1.3–2 is the honest range). (3) The discomfort weight's level moves toward the regime's settled value — the two differ by 1.41 (Luo et al. 2018, demand factors 1.13/0.80) — by 0.9 of the gap a year when rising (Luo: confidence built “rapidly in the first year”) and 0.30 when falling (Luo's bound is 0.44; 0.10–0.44 carried as a range), × 1.5 with a window.

**Three levels of control.** A window lowers γ_D to 0.7 from the first day (Schweiker 2018: perceived control is worth about 2 K; the value is assumed) and speeds the slow clock × 1.5 (allostatic self-efficacy, Stephan et al. 2016; assumption). Clothing adds 2 K on the cool edge (a 0.25–0.36 clo sweater against ASHRAE 55's ≈ 3 K comfort-zone shift per 0.5 clo; rough) and comes with the windows as the second level of control. Ceiling fans add 2.2 K on the warm edge (ASHRAE 55 §5.4.2.4) as the third. None changes what they feel; all change what they accept. The comfort band is capped at 18 and 32 °C.

**Energy and emissions.** The running totals are per person (15 occupants) from the day of arrival to the end of the period shown: thermal cooling and heating from the building model divided by a seasonal COP of 3 (cooling, and heat-pump heating in both offices), times 0.22 kg CO₂e per kWh — LADWP's 2025 Power Content Label, 487 lb per MWh. In the naturally ventilated office the figure is what the air-conditioned office would have used, less this office's own supplementary heating. Both constants are rough and stated here so they can be changed.

**The building and the weather.** Top floor of a 1,000 m³ office (120 m² of north-heavy triple glazing, U 0.2 W/m²K, 50 MJ/K of mass), 15 people × 250 W, 10 L/s per person, weekdays 08–18. Naturally ventilated: windows open above 24 °C when it is cooler outside, night purge at 6 ACH above 22 °C, heating holds 18 °C in occupied hours. Air-conditioned: 22 ± 0.5 °C. Weather: Los Angeles Downtown (USC campus) TMYx 2009–2023 — the nearest typical-year file to Westwood (15 km; Westwood lies between it and Santa Monica). Medellín (Olaya Herrera, 1,506 m) for the newcomer's origin.

**What is drawn.** Two views of the same period. *Overlaid*: one chart with both people's bells, to watch the ratchet; *separated*: one chart per person on a shared scale, with the distributions of the hours too warm and too cool for that person. The axis is clipped to 12–32 °C (55–90 °F) so the indoor curves have room, which cuts the outdoor tails; the key sits to the right. Light blue: the outdoor temperature over all hours of the period, scaled to their working hours so that the areas compare. Grey: the room's temperature during the hours they are at work. Their bell is the sum of that period's daily bells (90 % of each day's area inside P ± w); the fill is the part inside each day's own comfort band, so it is exactly what they accept, and the thin curve beyond is the bell's shape, not their tolerance. Red and blue: the distribution of the hours that were too warm or too cool for them — counted hour by hour against that day's own edges, so they begin where the fill ends. The strip below is the ratchet itself: each person's comfort band half-width at every stop, on an axis spaced by the clocks.

| constant | value | source | status |

| wAC, wNV | ±1.75 K, ±2.50 K | PMV ±0.5 at 3.5 K a vote; ASHRAE 55 adaptive 90 % | standard |

| α | 0.20 (range 0.10–0.40) | McCartney & Nicol 2002: c = 0.80 optimum, fit flat for c 0.33–0.90 | measured (rough; never fitted indoors) |

| β₁ | 0.05 a day, symmetric (range 0.02–0.10) | habituation studies (downward only, strong stimuli) | bound |

| γS ratio AC/NV | 1.5 (range 1.3–2) | Rupp et al. 2019 (≈ 2), attenuated for pooled-slope dilution | measured (adjusted) |

| γD-level ratio | 1.41 | Luo et al. 2018, demand factors 1.13 / 0.80 | measured |

| level relaxation | 0.9 a year up, 0.30 down (range 0.10–0.44), × 1.5 with a window | Luo et al. 2018 (“rapidly in the first year”; not settled after four: bound < 0.45) | bound |

| window switch | γD × 0.7 | Schweiker 2018 (≈ 2 K) | assumption |

| jumper | +2.0 K cool edge | 0.25–0.36 clo; ASHRAE 55 zone shift ≈ 3 K per 0.5 clo | derived (rough) |

| s₀² | set by the γS ratio (3.7 K² here) | — | derived |

| w₀, c | 1.08 K, 1.01 | fixed by the two envelopes and the two ratios | derived |

| caps | 18 °C, 32 °C | limits of adaptation | reminder |

## Checks

The JavaScript occupant rules are checked against an independent Python implementation (`src/ratchet_occupant_reference.py`) run on the exported indoor series (`src/series_downtown.json`): local in the NV office year 1 = 214 h uncomfortable, mean band ±2.0669 K, operational share 0.9045; newcomer 136 h; newcomer in the AC office ±1.9627 K after a year; arrival band ±2.312 K; w₀ = 1.0774 K — identical in both. The app runs this self-test on load and prints PASS at the foot of the fold-out. The building physics was validated earlier against the January 2026 Passive Building Simulator (see `PassiveBuilding_model_note.md`).

## Headline numbers (default control: windows and clothing)

Broadening, local / newcomer uncomfortable hours: week 1 16 / 2; September 38 / 13; year 1 128 / 63; year 3 62 / 50; year 7 47 / 46. Narrowing: the newcomer's band ±2.31 → 2.16 K (September) → 1.94 K (end of year 1) → 1.75 K (year 3); nobody uncomfortable; leaving for the NV office would cost 63 h on arrival, 123 h after a year, 128 h (the local's figure) from year 2. Air-conditioning: 291 kWh and 64 kg CO₂e per person per year.

## Limits

One person per role, not a population; the field envelopes (±1.75 K, ±2.50 K) are population statistics used to anchor one person's band. Humidity, air speed beyond the fan allowance, physiological acclimatisation and clothing beyond a fixed jumper are not modelled. The learning rates are central values with stated ranges (α 0.10–0.40; β₁ 0.02–0.10; discomfort-weight relaxation 0.10–0.44 a year); the fold-out table gives every year's hours at the slow and fast ends. The "cost of leaving" is a model counterfactual. The adaptive standard's curve is not drawn: it is a pooled regression on outdoor air, and the gap between it and what either person expects is the building's doing; the standard enters only as the operational-share column. Refrigerant leaks are not included (an R-410A plant would add roughly 100 kg CO₂e per person per year; R-32 about 33).
