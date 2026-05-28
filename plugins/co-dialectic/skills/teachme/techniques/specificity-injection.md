# Technique: Specificity Injection

<!-- product-vs-solution: example -->

## What it is

The baseline prompt-engineering move: take a vague prompt and add concrete constraints — audience, length, tone, format, success criteria, examples. This is the IMPROVED tier of Co-Dialectic's Protocol 3 — the entry rung of the language ladder.

It is NOT yet Socratic (single-sided questioning) and NOT yet Platonic dialectic (two-sided refinement). It's the cheapest, fastest improvement available — and most prompts benefit from it dramatically.

## Why it works

LLMs are pattern-matchers across distributions. A vague prompt activates a broad distribution of plausible answers; the model picks something near the centroid — generic, safe, forgettable. Adding specificity SHRINKS the activated distribution. The model's "best guess" within that narrower space is dramatically sharper.

Concretely: "write about leadership" activates ~10^6 plausible responses. "Write a 200-word LinkedIn post for engineering managers at 50-200-person AI startups about the most common political mistake new EMs make in their first 90 days. Tone: confident, contrarian. End with a question." activates ~10^3. The model's centroid in the narrow space is much sharper than its centroid in the broad space.

## When to use

- **Always, as the entry move** — every Co-Dialectic Protocol 3 turn produces an IMPROVED tier
- **Fast iteration loops** — when you don't have time for Socratic or dialectic
- **Vague prompts** — specifically when you catch yourself writing "help me with..." or "tell me about..."
- **Mechanical tasks** — formatting, summarization, code generation: specificity is usually enough

## When NOT to use

- **When the prompt is already specific** — over-specifying constrains good output
- **When the answer requires DERIVATION** — Socratic does this better
- **When you're not sure what your own position is** — Socratic helps you discover it

## Six dimensions of specificity

When you find yourself injecting specificity, you're touching one or more of:

1. **Audience** — who is the output for? (engineers? executives? a single named person?)
2. **Length** — words / paragraphs / pages / a single sentence
3. **Tone** — confident / curious / contrarian / neutral / urgent
4. **Format** — list / paragraph / table / code / markdown / plain text
5. **Constraints** — must include X / must avoid Y / structural requirement
6. **Success criteria** — how will you know the output is good?

Most prompts benefit from 2-3 of these. All six is usually over-constraint.

## Two examples

**Example 1 (the ski shop scenario — from Anand's session 18):**

- Vague: *"Suggest some products."*
- Specific: *"You're a ski shop owner in Lake Tahoe in January. A first-time skier (mid-30s, 5'10", 180lbs, never skied) walks in with a $400 budget. Recommend 3 items prioritizing safety, ranked by importance. Format: name, price, why-this-matters in one line each."*

The vague prompt produces a Wikipedia-style list. The specific prompt produces actionable retail advice.

**Example 2 (debugging):**

- Vague: *"Why is this slow?"*
- Specific: *"This Python function processes 10K rows in 12 seconds. P95 latency is dominated by the inner loop at line 47. What's the most likely class of bottleneck, and what's the smallest profiling step to confirm?"*

## Practice prompt

Pick a recent prompt you wrote that produced bland output. Add 3 of the 6 dimensions:
- Did you specify the AUDIENCE?
- Did you specify the LENGTH?
- Did you specify the FORMAT?

Re-run. Compare.

## When you've internalized this

You stop writing "help me with..." prompts. You write paragraphs that contain audience, length, tone, format, and constraints — without thinking about it. At that point, you've climbed past IMPROVED. The next rung is Socratic (`teach me socratic-questioning`).

## How this connects to the higher tiers

| Tier | Cognitive move | When |
|---|---|---|
| IMPROVED (this card) | Inject constraints | Fast iteration, mechanical tasks |
| SOCRATIC | Reframe as questions that elicit derivation | Creative work, strategic analysis |
| DIALECTIC | Steel-man opposite, synthesize | High-stakes, irreversible, public-facing |

Most users start at IMPROVED and stay there. The 20% who climb to Socratic produce work measurably sharper. The 5% who climb to dialectic produce work that monologic reasoning cannot reach. The teachme skill is designed to surface the higher rungs so you can climb deliberately, not by accident.
