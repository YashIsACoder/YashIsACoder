---
title: Where did the battery charge go?
date: 2026-11-22
tags: [solar-cars, simulation, ecm]
summary: A six-leg audit of one simulated day in the Sunswift 7 preset.
card_math: $E_{\text{end}} = E_{\text{start}} - (E_{\text{demand}} - E_{\text{solar}})$
---

The public SR7 example starts its first morning with 15.28 kWh. At the end of the first simulated leg it holds 13.89 kWh. The difference is smaller than the energy the drivetrain and auxiliaries drew.

## Balance generation against demand

In the reference run, the first leg consumes 1,816 Wh and collects 431 Wh of solar energy. Net draw is about 1,385 Wh:

$$
E_{\text{end}} = E_{\text{start}} - \left(E_{\text{demand}} - E_{\text{solar}}\right) = 15.28 - (1.816 - 0.431) \approx 13.89\ \text{kWh}
$$

Looking at demand alone would miss the solar contribution.

## Read the timestamps

The first day ends at 6.26 kWh after six legs. Within that day, one arrival at 3.39 elapsed hours and the next departure at 3.89 hours share the same charge. The half-hour control hold advances the race clock but not the battery. Overnight, the next departure begins with a full pack under this Cruiser charging scenario.

These are modelled leg endpoints from seed 2025, draw 7. Connecting the endpoints is helpful for a replay, but it can't recover instantaneous power or the exact charging curve while parked.

- [Download the endpoint data](../../assets/sr7.csv) (CSV)
- [Inspect the race atlas](../../labs/ecm/index.html) in SolarRoute Studio
- [Read the recorded run](https://github.com/YashIsACoder/ecm/blob/da068a8/apps/route-lab/web/atlas-demo.json) on GitHub
