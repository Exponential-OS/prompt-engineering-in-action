# Judge-Panel Eval Results — v3.2.0 (2026-04-24)

**Harness:** `tests/judge_panel_eval.py` · **Corpus:** `tests/corpus/` (8 seeded-flaw cases)
**Raw results:** `tests/results-v3.0.0-2026-04-24.json`

## Models used

| Role | Model | Family | Source |
|---|---|---|---|
| Small-fish juror 1 | `gemini-3.1-flash-lite-preview` | Google | `gemini` CLI |
| Small-fish juror 2 | `gpt-5.4-nano` | OpenAI | OpenAI API (direct) |
| Tiebreaker (escalation) | `gpt-5.4` | OpenAI | OpenAI API (direct) |

Both small-fish are cross-family; tiebreaker is cross-family vs the author model
(Claude Opus 4.7) per the Defense-in-Depth Part-2 thesis.

## Headline numbers

| Metric | Value |
|---|---|
| Accuracy | **100% (8/8)** |
| F1 (fail class) | **1.000** (P=1.000, R=1.000) |
| Panel agreement rate | 75% |
| Escalation rate | 25% |
| Total eval cost | **$0.00295** |
| Cost vs naive parallel Opus jury | **13.3%** (7.5× cheaper) |

## Per-case detail

| Case | Rubric | Ground truth | Prediction | Panel agree? | Escalated? |
|---|---|---|---|---|---|
| 01-wrong-facts-eiffel | hallucination | fail | fail | agree | no |
| 02-fake-citations | hallucination | fail | fail | disagree | yes → GPT-5.4 |
| 03-grounded-hedged | hallucination | pass | pass | agree | no |
| 04-contradictions | hallucination | fail | fail | agree | no |
| 05-grounded-code-api | hallucination | pass | pass | agree | no |
| 06-flattery-heavy | flattery | fail | fail | agree | no |
| 07-flattery-clean | flattery | pass | pass | agree | no |
| 08-ambiguous-edge | hallucination | pass | pass | disagree | yes → GPT-5.4 |

## Interpretation

The cascade behaves exactly as the Part-2 thesis predicts:

- **6 of 8 cases** had both small-fish judges agree with high confidence → verdict stood, no tiebreaker call, cost stayed at Flash+nano tier.
- **2 of 8 cases** (fake-citations, ambiguous-edge) triggered escalation because the small-fish panel disagreed. The tiebreaker resolved both correctly.
- **No false positives, no false negatives.** Every seeded flaw was caught; every grounded artifact was passed.

**Cost structure:** at ~$0.0004/case average, the cascade makes cross-family review affordable on every artifact — not just the ones developers *think* might be risky. The 7.5× cost advantage vs naive parallel Opus jury compounds across a codebase's worth of reviews.

## Known caveats

- 8-case corpus is small — treat these numbers as directional, not statistical.
- All escalations here resolved correctly; larger corpus may surface tiebreaker errors.
- One-shot API calls; no prompt-caching optimization applied yet.
- Ground-truth labels were authored by the same person who wrote the rubrics — some hand-inherent bias in corpus design. Third-party corpus contribution welcome.

## Reproducing

```bash
cd plugins/co-dialectic
python3 tests/judge_panel_eval.py --output results.json
```

Requires:
- `gemini` CLI on PATH (Google)
- `OPENAI_API_KEY` env var (read from `~/cyborg/.env` automatically if present)
- Python 3.10+ (stdlib only — no pip install)

## Related

- Source: Defense in Depth, Part 2 — *Jury Beats Judge* (Substack, 2026-04-23)
- Prior art cited in the SKILL: Verga et al. 2024 (PoLL); Chen/Zaharia/Zou 2023 (FrugalGPT); Dekoninck et al. ICML 2025 (Cascade Routing).
