# Model pilot (2026-11-18, about 0.022 Pollen)

Three Wikimedia photos (canyon, kitchen utensils, cat), grid A–D × 1–3, crops of a cell plus 20% margin, upscaled to at least 512 px.

| Test | Result |
|---|---|
| Describer pins claims to cells | `z-ai/glm-5.3-flash`: cells matched the photo by eye (utensils 5/5). `openai/gpt-5.4-nano`: often one cell off (put the river in "valley slopes") |
| All crops in one call, pick a label for each | 14/25; the matcher mixed up the order of the crops |
| One crop per call, pick a label (`gpt-5.4-nano`) | 13/30; it echoed the labels it was given |
| One crop per call, yes/no (`openai/gpt-6-luna`) | own cell 10/10 yes, farthest cell 8/10 no (both misses were canyon slopes that really are everywhere), decoys 4/4 no |
| Same with `minimax/minimax-m3.1-flash` | farthest cell 6/10, three replies lost to "output token limit" errors |

Chosen: glm-5.3-flash explains and pins, gpt-6-luna checks each crop with a yes/no question, one decoy per photo as a control.
