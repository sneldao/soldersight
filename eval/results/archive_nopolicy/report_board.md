# SolderSight PCB eval — results

| model | suite | tasks | trials | disp. acc | pass@k | pass^k | type acc | missed | false alarm | inconsistent | board acc |
|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | board | 90 | 3 | 0.233 | 0.367 | 0.067 | 0.922 | 0.044 | — | 0.478 | — |
| gemini-3-1-pro | board | 90 | 3 | 0.689 | 0.733 | 0.633 | 1.0 | 0.0 | — | 0.022 | — |
| gpt-5-5 | board | 90 | 3 | 0.1 | 0.2 | 0.033 | 1.0 | 0.0 | — | 0.244 | — |
| gpt-5-mini | board | 90 | 3 | 0.022 | 0.033 | 0.0 | 0.822 | 0.056 | — | 0.278 | — |

`missed_defect_rate` is the headline number: the fraction of defective
crops/boards the model called clean (`none`). In PCB QA a missed defect
ships a dead board; a false alarm costs a re-inspection.
