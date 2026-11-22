// The projects matrix. Edit this file to add or change a project.
// row: which domain it belongs to; col: what kind of thing it is.
// tap: what appears on the right when the project is zoomed —
//   { kind: 'iframe', src }        an existing lab, loaded on open
//   { kind: 'solar' }              the solar-leg explorable (home.js)
//   { kind: 'sprint' }             the playable QuantSprint (home.js)
//   { kind: 'code', title, lang, code }
//   { kind: 'image', src, alt }

export const ROWS = [
  { id: 'markets', name: 'Markets & maths', note: 'options, mental maths, replay', colour: '--peach' },
  { id: 'solar', name: 'Solar racing', note: 'energy, strategy, Sunswift', colour: '--yellow' },
  { id: 'algo', name: 'Algorithms & ML', note: 'from scratch, measured', colour: '--mauve' }
];

export const COLS = [
  { id: 'browser', name: 'Plays in your browser', note: 'open it, poke it' },
  { id: 'cpp', name: 'C++ libraries', note: 'CMake, tests, no magic' },
  { id: 'tool', name: 'Practice tools', note: 'things I train with' }
];

export const PROJECTS = [
  {
    id: 'payoff-lab', row: 'markets', col: 'browser',
    name: 'Payoff Lab', lang: 'TypeScript · React', ontap: true,
    one: 'An options book and Greeks simulator I built for MATH2991, Data and Algorithms in Trading, which UNSW teaches with Optiver.',
    about: [
      'Combine calls, puts and futures into one book, then change volatility or time to expiry and watch the value curve, the payoff at expiry and every Greek move together.',
      'I wanted to see why a butterfly’s value bends the way it does as expiry approaches, rather than memorise it. The lab draws that bend across time.'
    ],
    highlights: [
      'Any mix of long and short calls, puts and futures',
      'Value today against payoff at expiry, side by side',
      'Delta, gamma, theta and vega drawn across the whole price range',
      'Built for MATH2991, Data and Algorithms in Trading (taught with Optiver)'
    ],
    stack: ['TypeScript', 'React', 'Black–Scholes'],
    links: [{ label: 'Open full screen', href: 'labs/payoff/index.html', primary: true }],
    tap: { kind: 'iframe', src: 'labs/payoff/index.html', label: 'payoff-lab · live' }
  },
  {
    id: 'event-replay', row: 'markets', col: 'cpp', brewing: true,
    name: 'Event-replay engine', lang: 'C++20 · Linux',
    one: 'Bursty market events through bounded queues, measured against a p99 latency budget. A work in progress.',
    about: [
      'At the Commonwealth Bank of Australia I built tick-level replay for futures desks. This is a public, from-scratch take on the same problem.',
      'The question: how do fixed and deadline-aware batching change the highest event rate a replay stage can sustain within a p99 target, under bursty input and background CPU contention?'
    ],
    highlights: [
      'Sequence numbers, a reference replay and a deterministic digest prove every event is applied once, in order',
      'Arrivals scheduled independently of the consumer, so the latency numbers are honest',
      'Reports p50, p95 and p99, throughput, drops and queue depth',
      'Workloads from synthetic bursts and public ITCH or LOBSTER samples'
    ],
    stack: ['C++20', 'Linux', 'perf', 'CMake'],
    links: [],
    tap: { kind: 'code', title: 'the plan, in one loop', lang: 'cpp', code:
`// pseudocode for the measurement loop
for (auto& ev : workload.arrivals()) {      // scheduled, open-loop
    queue.push(ev, ev.scheduled_at);
}
while (auto batch = policy.next(queue)) {   // fixed or deadline-aware
    for (auto& ev : *batch) {
        book.apply(ev);                       // checked against a reference
        latency.record(now() - ev.scheduled_at);
    }
}
report(latency.p50(), latency.p99(), queue.max_depth(), drops);` }
  },
  {
    id: 'quantsprint', row: 'markets', col: 'tool',
    name: 'QuantSprint', lang: 'TypeScript', ontap: true,
    one: 'A Zetamac-style mental arithmetic trainer that tells you which facts are slowing you down.',
    about: [
      'Trading interviews love fast arithmetic, so I built the loop I practise with. Questions advance the moment the answer is right, and every response time is kept.',
      'The version here is a small taste. The full app runs offline and also ships as a standalone Mac app.'
    ],
    highlights: [
      '30-second, 60-second, 2-minute and 5-minute sprints',
      'Zetamac default ranges; subtraction and division generated in reverse',
      'Per-operation accuracy and pace, plus a slowest-facts report',
      'Device-local history, no account'
    ],
    stack: ['TypeScript', 'vinext', 'Mac app build'],
    links: [],
    tap: { kind: 'sprint' }
  },
  {
    id: 'solarroute', row: 'solar', col: 'browser',
    name: 'SolarRoute Studio', lang: 'ECM → JS', ontap: true,
    one: 'Replay a solar car from Darwin to Adelaide through control stops, and inspect its energy budget leg by leg.',
    about: [
      'The browser front end for ECM’s route lab. It replays a Cruiser against recorded checkpoints from the 2025 race and lets you compare pacing policies under the same weather.',
      'Everything you see is driven by the C++ model’s output, so the story on the map matches the numbers in the leg log.'
    ],
    highlights: [
      'Darwin to Adelaide with every control stop',
      'Recorded checkpoints from the 2025 race',
      'Fleet comparison: several cars, one shared weather draw',
      'Battery, solar and demand per leg'
    ],
    stack: ['JavaScript modules', 'ECM output', 'JSON replays'],
    links: [{ label: 'Open full screen', href: 'labs/ecm/index.html', primary: true }],
    tap: { kind: 'iframe', src: 'labs/ecm/index.html', label: 'solarroute-studio · live' }
  },
  {
    id: 'ecm', row: 'solar', col: 'cpp',
    name: 'ECM', lang: 'C++20 · pybind11',
    one: 'C++20 energy modelling for solar-electric vehicles, with a route-simulation lab adapted from Sunswift strategy work.',
    about: [
      'ECM estimates energy for a road segment or a continuous speed trace. The route lab uses those estimates to compare pacing and battery outcomes under the same simulated weather.',
      'SR7 defaults to the 2025 Cruiser limit of 55 MJ with overnight charging; SR8 is a provisional battery-and-solar scenario. The routes are synthetic.'
    ],
    highlights: [
      'Four models: fixed-speed segment, drive cycle with regen limits, mapped motor efficiency, gust-aware',
      'Paired weather experiments with Wilson and Newcombe intervals, in O(1) space',
      'CMake targets ECM::ecm, ECM::ecm_cont and ECM::lab',
      'The same targets in Python: pip install . then import ecm'
    ],
    stack: ['C++20', 'CMake', 'ctest', 'pybind11', 'Python'],
    links: [{ label: 'Source', href: 'https://github.com/YashIsACoder/ecm', primary: true }],
    tap: { kind: 'code', title: 'include/ecm/lab_statistics.hpp', lang: 'cpp', code:
`namespace ecm::lab {

struct Interval95 {
    double estimate;
    double low;
    double high;
};

// Wilson score interval for one binary outcome rate.
[[nodiscard]] Interval95 wilson95(std::uint64_t successes, std::uint64_t trials);

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

}  // namespace ecm::lab` }
  },
  {
    id: 'solar-ecm-cpp', row: 'solar', col: 'cpp',
    name: 'solar-ecm-cpp', lang: 'C++20 · no deps', ontap: true,
    one: 'The small, readable core: give it a car and a road and it tells you where the energy goes.',
    about: [
      'Work against drag, rolling resistance and gravity, the change in kinetic energy, and the electrical energy needed at the DC bus, plus a separate solar yield estimate. Built from standard longitudinal vehicle equations with synthetic parameters.',
      'The live panel runs the same equations. At 72 km/h in full sun with no wind it gives 152.3 Wh, the same as the C++ test.'
    ],
    highlights: [
      'A 36 km worked example, checked by the test suite',
      'Tests for wind direction, slope, acceleration, regen limits and invalid input',
      'Installs as a CMake package: find_package(solar_ecm)',
      'Nothing beyond the standard library'
    ],
    stack: ['C++20', 'CMake', 'ctest'],
    links: [{ label: 'Source', href: 'https://github.com/YashIsACoder', primary: true }],
    tap: { kind: 'solar' }
  },
  {
    id: 'cpp-mlp', row: 'algo', col: 'cpp',
    name: 'cpp-mlp', lang: 'C++17 · Eigen',
    one: 'A multilayer perceptron from scratch: dense layers, activations and backpropagation, trained on MNIST.',
    about: [
      'I wanted to know what a framework does for you, so I did it by hand. Modular dense layers, activation functions and backprop over Eigen matrices, with an MNIST training and evaluation example.'
    ],
    highlights: ['Modular layers and activations', 'Backprop written out, not borrowed', 'MNIST training and evaluation example'],
    stack: ['C++17', 'Eigen', 'CMake'],
    links: [{ label: 'Source', href: 'https://github.com/YashIsACoder/cpp-mlp', primary: true }],
    tap: null
  },
  {
    id: 'random-walk-sim', row: 'algo', col: 'cpp',
    name: 'random-walk-sim', lang: 'C++17 · SFML',
    one: 'A configurable random walk simulator in 1, 2 or 3 dimensions, with live plots, statistics and CSV export.',
    about: [
      'Seeded, reproducible stochastic walks with statistical summaries. The renderer draws the walk as it happens, and every run can be exported for analysis.'
    ],
    highlights: ['1D, 2D and 3D walks', 'Reproducible randomness from a seed', 'Statistical summaries and CSV export', 'SFML visualisation'],
    stack: ['C++17', 'SFML', 'Dear ImGui', 'CMake'],
    links: [{ label: 'Source', href: 'https://github.com/YashIsACoder/random-walk-sim', primary: true }],
    tap: null
  }
];
