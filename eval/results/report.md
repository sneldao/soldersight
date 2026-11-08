# SolderSight PCB eval — results

| model | suite | tasks | trials | disp. acc [95% CI] | pass@k | pass^k | type acc | missed | false alarm | inconsistent | board acc |
|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | board | 180 | 3 | 0.406 [0.3, 0.528] | 0.45 | 0.367 | 0.611 | 0.0 | 0.744 | 0.0 | — |
| claude-opus-5-5 | crop | 441 | 3 | 0.719 [0.642, 0.796] | 0.789 | 0.667 | 0.667 | 0.061 | 0.433 | 0.0 | 0.933 |
| claude-sonnet-5-5 | board | 180 | 3 | 0.438 [0.322, 0.556] | 0.55 | 0.317 | 0.764 | 0.0 | 0.467 | 0.0 | — |
| claude-sonnet-5-5 | crop | 441 | 3 | 0.721 [0.653, 0.787] | 0.789 | 0.673 | 0.669 | 0.117 | 0.324 | 0.0 | 0.767 |
| gemini-3-1-pro | board | 180 | 3 | 0.4 [0.3, 0.506] | 0.467 | 0.333 | 0.644 | 0.0 | 0.711 | 0.0 | — |
| gemini-3-1-pro | crop | 441 | 3 | 0.642 [0.542, 0.736] | 0.68 | 0.605 | 0.601 | 0.013 | 0.619 | 0.0 | 0.967 |
| gpt-5-5 | board | 180 | 3 | 0.256 [0.167, 0.35] | 0.367 | 0.15 | 0.556 | 0.0 | 0.889 | 0.0 | — |
| gpt-5-5 | crop | 441 | 3 | 0.404 [0.324, 0.483] | 0.435 | 0.367 | 0.331 | 0.017 | 0.995 | 0.0 | 0.8 |
| gpt-5-mini | board | 180 | 3 | 0.428 [0.372, 0.483] | 0.533 | 0.3 | 0.8 | 0.089 | 0.211 | 0.0 | — |
| gpt-5-mini | crop | 441 | 3 | 0.531 [0.464, 0.603] | 0.653 | 0.388 | 0.465 | 0.134 | 0.543 | 0.0 | 0.6 |
| grok-4-7 | board | 180 | 3 | 0.339 [0.222, 0.461] | 0.483 | 0.167 | 0.678 | 0.011 | 0.578 | 0.0 | — |
| grok-4-7 | crop | 441 | 3 | 0.508 [0.424, 0.582] | 0.619 | 0.361 | 0.415 | 0.056 | 0.714 | 0.0 | 0.733 |
| kimi-k3-1-pro | board | 180 | 3 | 0.339 [0.244, 0.439] | 0.533 | 0.15 | 0.611 | 0.0 | 0.767 | 0.0 | — |
| kimi-k3-1-pro | crop | 441 | 3 | 0.469 [0.396, 0.545] | 0.585 | 0.367 | 0.429 | 0.056 | 0.838 | 0.0 | 0.9 |

`missed_defect_rate` is the number QA cares about most: the fraction of
defective crops/boards the model called clean (`none`). A false alarm costs
a re-inspection.

## Can the model tell defective from clean?

Youden's J = TPR - FPR (0 = no discrimination, whatever the model's
tendency to flag). Independent of defect naming and of the disposition
rule. CIs resample whole boards.

| model | suite | TPR | FPR | Youden J [95% CI] | balanced acc [95% CI] |
|---|---|---|---|---|---|
| claude-opus-5-5 | board | 1.0 | 0.744 | 0.256 [0.122, 0.411] | 0.628 [0.561, 0.706] |
| claude-opus-5-5 | crop | 0.939 | 0.433 | 0.506 [0.385, 0.62] | 0.753 [0.693, 0.81] |
| claude-sonnet-5-5 | board | 1.0 | 0.467 | 0.533 [0.378, 0.689] | 0.767 [0.689, 0.844] |
| claude-sonnet-5-5 | crop | 0.883 | 0.324 | 0.559 [0.432, 0.701] | 0.78 [0.716, 0.851] |
| gemini-3-1-pro | board | 1.0 | 0.711 | 0.289 [0.144, 0.444] | 0.644 [0.572, 0.722] |
| gemini-3-1-pro | crop | 0.987 | 0.619 | 0.368 [0.24, 0.507] | 0.684 [0.62, 0.754] |
| gpt-5-5 | board | 1.0 | 0.889 | 0.111 [0.033, 0.189] | 0.556 [0.517, 0.594] |
| gpt-5-5 | crop | 0.983 | 0.995 | -0.013 [-0.048, 0.011] | 0.494 [0.476, 0.505] |
| gpt-5-mini | board | 0.911 | 0.211 | 0.7 [0.578, 0.811] | 0.85 [0.789, 0.906] |
| gpt-5-mini | crop | 0.866 | 0.543 | 0.323 [0.202, 0.461] | 0.661 [0.601, 0.731] |
| grok-4-7 | board | 0.989 | 0.578 | 0.411 [0.278, 0.556] | 0.706 [0.639, 0.778] |
| grok-4-7 | crop | 0.944 | 0.714 | 0.229 [0.113, 0.358] | 0.615 [0.557, 0.679] |
| kimi-k3-1-pro | board | 1.0 | 0.767 | 0.233 [0.122, 0.356] | 0.617 [0.561, 0.678] |
| kimi-k3-1-pro | crop | 0.944 | 0.838 | 0.106 [0.037, 0.183] | 0.553 [0.518, 0.592] |

## Constant-answer accuracy (the floor)

| suite | tasks | always pass | always rework | always scrap |
|---|---|---|---|---|
| board | 60 | 0.5 | 0.017 | 0.483 |
| crop | 147 | 0.476 | 0.231 | 0.293 |
| wide | 184 | 0.5 | 0.228 | 0.272 |
| wide/binary | 184 | 0.5 | 0.228 | 0.272 |
| wide/paired | 184 | 0.5 | 0.228 | 0.272 |
| wide/prior | 184 | 0.5 | 0.228 | 0.272 |
| wide/worst | 184 | 0.5 | 0.228 | 0.272 |
