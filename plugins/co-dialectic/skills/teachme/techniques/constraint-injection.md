# Technique: Constraint Injection

<!-- product-vs-solution: example -->

## What it is

Constraint injection is the explicit declaration of limits on a response: length, format, structure, tone, what to include, what to exclude. The canonical form is a set of hard rules appended to or embedded in a prompt: "Exactly 200 words. Two paragraphs. No bullet points. End with a question." Or: "Return a JSON object with exactly these keys. No prose. No explanation." Constraint injection is a sub-technique within specificity injection — it is the *structural* dimension of specificity, distinct from the audience, tone, or success-criteria dimensions.

The concept has roots in constrained writing movements — the French literary group Oulipo (founded 1960) produced masterworks under artificial constraints (Georges Perec's *La Disparition* was written without the letter 'e'). The insight: constraints don't limit creativity, they redirect it. When easy options are removed, the writer is forced to find harder-to-find ones that are often better.

## Why it works

Unconstrained LLM generation follows the path of least resistance: verbose, hedged, balanced, ending in a summary. This is statistically safe but editorially weak — it satisfies every possible reader superficially and delights none. Constraints force the model to make choices about what to cut, and cutting is the hardest editorial judgment. A 200-word constraint on a topic that could fill 2,000 words forces the model to identify the load-bearing 200; a "no bullet points" constraint forces it to find connective prose; a "end with a question" constraint forces it to treat the output as an opening move rather than a final statement.

The model's choices under constraint are also diagnostic: when a constrained response is bad, you can read the constraint violation to understand what the model's defaults are — and tighten the constraint further or change it to a different one.

## When to use

- **Social media and short-form content** — where the platform enforces a character limit anyway, injecting it explicitly produces output calibrated to the limit rather than output you then have to cut.
- **Structured data extraction** — "Return a JSON object with exactly these keys" is more reliable than "format this as JSON" because it names every field.
- **When you know your medium's specific form** — a press release has a canonical structure (dateline, lede, body, boilerplate); injecting that structure produces a press release rather than an essay about a press release.
- **When prior attempts were too long, too hedged, or too listy** — add the anti-pattern as a constraint ("no hedging language like 'it depends', 'on the one hand'").

## When NOT to use

- **Exploratory or brainstorming phases** — constraints narrow the search space; if you don't know what you're looking for yet, constraints cut off the unexpected connection you needed.
- **When you're over-constraining** — all six specificity dimensions specified simultaneously often produces output that satisfies the constraints while missing the point. Constraints are a tool, not a checklist; 2-3 is usually right.
- **When the constraint is arbitrary rather than medium-derived** — "exactly 137 words" with no reason is noise. Constraints should be derived from the actual requirements of the output channel.

## Two examples

**Example 1 (canonical — LinkedIn post):**

- Without constraint: *"Write a LinkedIn post about why most 1:1s between managers and ICs fail."*
- With constraint: *"Write a LinkedIn post about why most 1:1s between managers and ICs fail. Exactly 150 words. Three short paragraphs — no bullet points. Open with a claim that sounds wrong but is true. End with a question that invites disagreement."*

The constrained version forces the model to pick the sharpest possible claim (not the safest), write connective prose (not a listicle), and structure for engagement (not just completeness). The constraints encode the editorial judgment of an experienced LinkedIn writer.

**Example 2 (from engineering leadership context):**

- Without constraint: *"Summarize the three risks in this architecture proposal."*
- With constraint: *"Summarize the three risks in this architecture proposal. For each: one sentence naming the risk, one sentence naming the failure mode it produces, one sentence naming the cheapest mitigation. No other prose. No introduction. No conclusion."*

The constraint produces a decision-ready artifact. The unconstrained version produces a narrative that buries the risks in paragraphs that must be skimmed before use.

## Practice prompt

Take a recent output that was too long, too hedged, or structured in a way that required you to edit it significantly before use. Identify the one structural problem. Add it as a single explicit constraint:

> *"[Your original prompt]. [One hard constraint that eliminates the problem you identified — length, format, required ending, forbidden phrase type]."*

Re-run. Notice how much editing you saved — and whether the output found something better in the space the constraint created.

## How this connects to the higher tiers

Constraint injection is an IMPROVED-tier technique — it shapes a single generation pass by narrowing the output space before the model begins. Like all IMPROVED-tier techniques, it's single-pass and cheap. The next rung is Socratic (`teach me socratic-questioning`), where instead of constraining the output form you restructure the prompt as a sequence of questions that force derivation; the rung after is dialectic (`teach me dialectic-tas`), where the deepest constraint of all is applied — the constraint of having to survive the strongest possible counter-argument.
