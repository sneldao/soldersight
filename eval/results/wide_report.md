# SolderSight PCB eval — results

| model | suite | tasks | trials | disp. acc [95% CI] | pass@k | pass^k | type acc | missed | false alarm | inconsistent | board acc |
|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | wide | 184 | 1 | 0.607 [0.522, 0.681] | — | — | 0.678 | 0.0 | 0.446 | 0.0 | — |
| claude-sonnet-5-5 | wide/binary | 184 | — | — | — | — | — | 0.0 | 0.435 | — | — |
| claude-sonnet-5-5 | wide/paired | 184 | 1 | 0.869 [0.819, 0.913] | — | — | 0.874 | 0.0 | 0.076 | 0.0 | — |
| claude-sonnet-5-5 | wide/prior | 184 | 1 | 0.723 [0.658, 0.788] | — | — | 0.766 | 0.087 | 0.207 | 0.0 | — |
| claude-sonnet-5-5 | wide/worst | 184 | 1 | 0.63 [0.554, 0.696] | — | — | 0.69 | 0.0 | 0.457 | 0.0 | — |
| gemini-3-1-pro | wide | 184 | 1 | 0.576 [0.5, 0.652] | — | — | 0.668 | 0.0 | 0.565 | 0.0 | — |
| gemini-3-1-pro | wide/binary | 184 | — | — | — | — | — | 0.0 | 0.304 | — | — |
| gemini-3-1-pro | wide/paired | 184 | 1 | 0.864 [0.804, 0.908] | — | — | 0.897 | 0.0 | 0.098 | 0.0 | — |
| gemini-3-1-pro | wide/prior | 184 | 1 | 0.696 [0.609, 0.766] | — | — | 0.75 | 0.043 | 0.304 | 0.0 | — |
| gemini-3-1-pro | wide/worst | 184 | 1 | 0.598 [0.522, 0.663] | — | — | 0.641 | 0.011 | 0.587 | 0.0 | — |
| gpt-5-5 | wide | 184 | 1 | 0.413 [0.337, 0.484] | — | — | 0.565 | 0.0 | 0.793 | 0.0 | — |
| gpt-5-5 | wide/binary | 184 | — | — | — | — | — | 0.0 | 0.75 | — | — |
| gpt-5-5 | wide/paired | 184 | 1 | 0.717 [0.652, 0.777] | — | — | 0.761 | 0.0 | 0.38 | 0.0 | — |
| gpt-5-5 | wide/prior | 184 | 1 | 0.522 [0.44, 0.592] | — | — | 0.658 | 0.0 | 0.598 | 0.0 | — |
| gpt-5-5 | wide/worst | 184 | 1 | 0.424 [0.353, 0.489] | — | — | 0.538 | 0.0 | 0.815 | 0.0 | — |
| gpt-5-mini | wide | 184 | 1 | 0.587 [0.505, 0.663] | — | — | 0.755 | 0.065 | 0.283 | 0.0 | — |
| gpt-5-mini | wide/binary | 184 | — | — | — | — | — | 0.054 | 0.065 | — | — |
| gpt-5-mini | wide/paired | 184 | 1 | 0.734 [0.668, 0.793] | — | — | 0.897 | 0.011 | 0.087 | 0.0 | — |
| gpt-5-mini | wide/prior | 184 | 1 | 0.647 [0.576, 0.712] | — | — | 0.799 | 0.109 | 0.174 | 0.0 | — |
| gpt-5-mini | wide/worst | 184 | 1 | 0.647 [0.571, 0.723] | — | — | 0.772 | 0.109 | 0.228 | 0.0 | — |

`missed_defect_rate` is the number QA cares about most: the fraction of
defective crops/boards the model called clean (`none`). A false alarm costs
a re-inspection.

## Can the model tell defective from clean?

Youden's J = TPR - FPR (0 = no discrimination, whatever the model's
tendency to flag). Independent of defect naming and of the disposition
rule. CIs resample whole boards.

| model | suite | TPR | FPR | Youden J [95% CI] | balanced acc [95% CI] |
|---|---|---|---|---|---|
| claude-sonnet-5-5 | wide | 1.0 | 0.446 | 0.554 [0.446, 0.652] | 0.777 [0.723, 0.826] |
| claude-sonnet-5-5 | wide/binary | 1.0 | 0.435 | 0.565 [0.457, 0.663] | 0.783 [0.728, 0.832] |
| claude-sonnet-5-5 | wide/paired | 1.0 | 0.076 | 0.924 [0.859, 0.967] | 0.962 [0.929, 0.984] |
| claude-sonnet-5-5 | wide/prior | 0.913 | 0.207 | 0.707 [0.609, 0.793] | 0.853 [0.804, 0.897] |
| claude-sonnet-5-5 | wide/worst | 1.0 | 0.457 | 0.543 [0.435, 0.641] | 0.772 [0.717, 0.821] |
| gemini-3-1-pro | wide | 1.0 | 0.565 | 0.435 [0.326, 0.533] | 0.717 [0.663, 0.766] |
| gemini-3-1-pro | wide/binary | 1.0 | 0.304 | 0.696 [0.598, 0.783] | 0.848 [0.799, 0.891] |
| gemini-3-1-pro | wide/paired | 1.0 | 0.098 | 0.902 [0.826, 0.957] | 0.951 [0.913, 0.978] |
| gemini-3-1-pro | wide/prior | 0.957 | 0.304 | 0.652 [0.533, 0.75] | 0.826 [0.766, 0.875] |
| gemini-3-1-pro | wide/worst | 0.989 | 0.587 | 0.402 [0.304, 0.5] | 0.701 [0.652, 0.75] |
| gpt-5-5 | wide | 1.0 | 0.793 | 0.207 [0.13, 0.293] | 0.603 [0.565, 0.647] |
| gpt-5-5 | wide/binary | 1.0 | 0.75 | 0.25 [0.163, 0.337] | 0.625 [0.582, 0.668] |
| gpt-5-5 | wide/paired | 1.0 | 0.38 | 0.62 [0.522, 0.707] | 0.81 [0.761, 0.853] |
| gpt-5-5 | wide/prior | 1.0 | 0.598 | 0.402 [0.293, 0.5] | 0.701 [0.647, 0.75] |
| gpt-5-5 | wide/worst | 1.0 | 0.815 | 0.185 [0.109, 0.261] | 0.592 [0.554, 0.63] |
| gpt-5-mini | wide | 0.935 | 0.283 | 0.652 [0.543, 0.75] | 0.826 [0.772, 0.875] |
| gpt-5-mini | wide/binary | 0.946 | 0.065 | 0.88 [0.815, 0.946] | 0.94 [0.908, 0.973] |
| gpt-5-mini | wide/paired | 0.989 | 0.087 | 0.902 [0.837, 0.957] | 0.951 [0.918, 0.978] |
| gpt-5-mini | wide/prior | 0.891 | 0.174 | 0.717 [0.63, 0.804] | 0.859 [0.815, 0.902] |
| gpt-5-mini | wide/worst | 0.891 | 0.228 | 0.663 [0.554, 0.761] | 0.832 [0.777, 0.88] |

## Wide suite: does the failure survive a fairer prompt?

Youden J (TPR - FPR) per prompt variant; same 92 defective + 92 clean boards
every time. production = the shipped prompt; worst = states the
report-the-worst-defect rule; prior = worst + a base-rate statement;
binary = defective yes/no only; paired = worst + golden reference image.

| model | production | worst | prior | binary | paired |
|---|---|---|---|---|---|
| claude-sonnet-5-5 | 0.554 (FPR 0.446) | 0.543 (FPR 0.457) | 0.707 (FPR 0.207) | 0.565 (FPR 0.435) | 0.924 (FPR 0.076) |
| gemini-3-1-pro | 0.435 (FPR 0.565) | 0.402 (FPR 0.587) | 0.652 (FPR 0.304) | 0.696 (FPR 0.304) | 0.902 (FPR 0.098) |
| gpt-5-5 | 0.207 (FPR 0.793) | 0.185 (FPR 0.815) | 0.402 (FPR 0.598) | 0.25 (FPR 0.75) | 0.62 (FPR 0.38) |
| gpt-5-mini | 0.652 (FPR 0.283) | 0.663 (FPR 0.228) | 0.717 (FPR 0.174) | 0.88 (FPR 0.065) | 0.902 (FPR 0.087) |

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
