---
title: Give both cars the same weather
date: 2026-11-22
tags: [statistics, simulation, ecm]
summary: A fast pacing rule can look brilliant on a calm day. For a fair comparison, weather is an input we can share.
card_math: $\operatorname{Var}(A-B) = \operatorname{Var}A + \operatorname{Var}B - 2\operatorname{Cov}(A,B)$
---

A faster pacing rule can look excellent if it happens to get a calm day. A slower rule can look poor if it spends its afternoon in a headwind. For a comparison, weather is an input we can share.

## One draw, two decisions

In ECM, the route lab draws a vector of conditions $\omega$ for a trial and passes it to every entry in the fleet. The cars can choose different speeds and use different amounts of energy, but the wind and cloud on each leg are matched. Changing the seed changes the experiment for everyone.

If $A$ and $B$ are the outcomes of two policies on the same draw, then

$$
\operatorname{Var}(A - B) = \operatorname{Var} A + \operatorname{Var} B - 2\operatorname{Cov}(A, B)
$$

Shared weather makes the covariance large and positive, so the difference between the policies is far less noisy than either outcome on its own.[^crn]

## Count the disagreements

Suppose two policies are tested on eight draws. Both finish four, only $A$ finishes two, only $B$ finishes one, and both fail one.

|              | $B$ finishes | $B$ fails |
| ------------ | :----------: | :-------: |
| $A$ finishes | $n_{11} = 4$ | $n_{10} = 2$ |
| $A$ fails    | $n_{01} = 1$ | $n_{00} = 1$ |

$A$ finishes six of eight and $B$ finishes five of eight. Their estimated difference is one finish in eight:

$$
\hat d = \frac{n_{10} - n_{01}}{n} = \frac{2 - 1}{8} = \frac{1}{8}
$$

The four joint successes and the shared failure contribute nothing to that difference. Try it yourself: each re-roll draws a fresh set of shared weather.

::: widget paired-draws seed=7 trials=8

## Four counters, constant memory

The lab keeps four counters for these paired binary outcomes, so storage stays constant however many trials accumulate. It reports a paired interval for the difference and a Wilson interval for each individual finish rate.

```cpp
// Stream matched binary outcomes in O(1) space.
// Add one pair per common weather draw.
class PairedOutcomes {
public:
    void add(bool comparison, bool reference) noexcept;
    // Comparison rate minus reference rate. Newcombe's method 10.
    [[nodiscard]] Interval95 difference95() const;

private:
    std::array<std::uint64_t, 4> counts_{};
};
```

> The uncertainty describes sampling within the model. The vehicle inputs and the weather assumptions still need their own validation.

The full interface is in [`lab_statistics.hpp`](https://github.com/YashIsACoder/ecm/blob/main/include/ecm/lab_statistics.hpp), and you can watch the fleet comparison run in [SolarRoute Studio](../../labs/ecm/data.html).

[^crn]: This is the method of common random numbers. It's the same reason a desk tests two strategies on the same historical tape.
