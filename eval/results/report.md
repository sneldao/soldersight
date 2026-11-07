# SolderSight PCB eval — results

| model | suite | tasks | trials | disp. acc | pass@k | pass^k | type acc | missed | false alarm | inconsistent | board acc |
|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | board | 180 | 3 | 0.406 | 0.45 | 0.367 | 0.611 | 0.0 | 0.744 | 0.0 | — |
| claude-opus-5-5 | crop | 441 | 3 | 0.719 | 0.789 | 0.667 | 0.667 | 0.061 | 0.433 | 0.0 | 0.933 |
| claude-sonnet-5-5 | board | 180 | 3 | 0.438 | 0.55 | 0.317 | 0.764 | 0.0 | 0.467 | 0.0 | — |
| claude-sonnet-5-5 | crop | 441 | 3 | 0.721 | 0.789 | 0.673 | 0.669 | 0.117 | 0.324 | 0.0 | 0.767 |
| gemini-3-1-pro | board | 180 | 3 | 0.4 | 0.467 | 0.333 | 0.644 | 0.0 | 0.711 | 0.0 | — |
| gemini-3-1-pro | crop | 441 | 3 | 0.642 | 0.68 | 0.605 | 0.601 | 0.013 | 0.619 | 0.0 | 0.967 |
| gpt-5-5 | board | 180 | 3 | 0.256 | 0.367 | 0.15 | 0.556 | 0.0 | 0.889 | 0.0 | — |
| gpt-5-5 | crop | 441 | 3 | 0.404 | 0.435 | 0.367 | 0.331 | 0.017 | 0.995 | 0.0 | 0.8 |
| gpt-5-mini | board | 180 | 3 | 0.428 | 0.533 | 0.3 | 0.8 | 0.089 | 0.211 | 0.0 | — |
| gpt-5-mini | crop | 441 | 3 | 0.531 | 0.653 | 0.388 | 0.465 | 0.134 | 0.543 | 0.0 | 0.6 |
| grok-4-7 | board | 180 | 3 | 0.339 | 0.483 | 0.167 | 0.678 | 0.011 | 0.578 | 0.0 | — |
| grok-4-7 | crop | 441 | 3 | 0.508 | 0.619 | 0.361 | 0.415 | 0.056 | 0.714 | 0.0 | 0.733 |
| kimi-k3-1-pro | board | 180 | 3 | 0.339 | 0.533 | 0.15 | 0.611 | 0.0 | 0.767 | 0.0 | — |
| kimi-k3-1-pro | crop | 441 | 3 | 0.469 | 0.585 | 0.367 | 0.429 | 0.056 | 0.838 | 0.0 | 0.9 |

`missed_defect_rate` is the headline number: the fraction of defective
crops/boards the model called clean (`none`). In PCB QA a missed defect
ships a dead board; a false alarm costs a re-inspection.
