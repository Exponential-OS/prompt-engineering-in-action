# Technique: Few-Shot Prompting by Example

<!-- product-vs-solution: example -->

## What it is

Few-shot prompting provides one or more input→output exemplars *before* asking for the new output. The canonical form: present a complete example (or two or three) of what you want — question, reasoning, answer — then present your real question and let the model complete the pattern. The template is: `Q: <example question> A: <example answer> Q: <your real question> A:` — the trailing `A:` signals the model to complete the pattern. Brown et al. (2020) formalized this in the GPT-3 paper as "in-context learning": the model doesn't need to be fine-tuned; it learns the task from the examples in the context window.

The technique spans a spectrum from zero-shot (no examples, just instructions) through one-shot (a single exemplar) through few-shot (2-5 exemplars). The inflection point is typically around 3 examples — beyond that, marginal quality gain per example declines while token cost grows. For highly stylized or novel output formats, 2-3 well-chosen examples are almost always worth more than a lengthy prose description of what you want.

## Why it works

Describing desired output in prose requires the reader (the model) to construct a mental model of the target from abstract description. Providing an example communicates the same information through pattern — a channel that is simultaneously more compact and more precise for stylistic, structural, and tonal properties that are hard to verbalize. "Write in a confident, direct, no-hedging tone with short sentences and a provocative opening" is a prose description that will be interpreted variably across runs. A single exemplar that actually demonstrates that tone is unambiguous — the model can pattern-match against the actual style rather than inferring it from a description.

This is especially powerful for formats that are hard to articulate: a specific brand voice, a particular JSON schema with nuanced field relationships, a style of code comment, a type of rhetorical opening. The exemplar is a complete behavioral specification compressed into a demonstration.

## When to use

- **Novel or highly stylized output formats** — when the desired style is easier to show than to describe, one example is worth a page of prose instructions.
- **Consistent multi-output generation** — when you need the same structural form repeated across many instances (e.g., 20 product descriptions in the same style), a single exemplar locks in the pattern.
- **Precision tasks where deviation is expensive** — JSON schemas, code generation with specific style conventions, structured report formats where the model's default structure would require significant editing.
- **When prose instructions have produced inconsistent results** — if the model keeps misinterpreting what you want, show it rather than describe it more precisely.

## When NOT to use

- **When good examples are hard to produce** — creating a high-quality exemplar takes time. If you'd spend more time writing the example than you'd save in editing, write clearer instructions instead.
- **When the example is too narrow** — a single example communicates a pattern but also its idiosyncrasies. If your exemplar has a quirk you don't intend to repeat, the model will often reproduce it. Vary your examples or annotate them.
- **When you want open-ended creative output** — exemplars constrain the distribution toward what you showed. If you want unexpected creative directions, few-shot is the wrong tool; try Socratic questioning instead.

## Two examples

**Example 1 (canonical — structured summaries):**

You want one-paragraph executive summaries in a specific form: problem, what was done, outcome, what's next. Rather than describing this, you show it:

*"Here's an example of the format I want:*

*Example input: [Project status update, 500 words]*
*Example output: The payment retry system was dropping 2% of retries under peak load. We identified a race condition in the deduplication layer and deployed a fix last Thursday. Retry success rate is now 99.8% (up from 98%). Next: extend the same deduplication pattern to the refund pipeline by EOQ.*

*Now apply the same format to: [your new project update]."*

The exemplar communicates voice, length, structure, and the "what's next" convention in a way that a description of those properties would not.

**Example 2 (from engineering leadership context):**

You want to generate several "role and impact" bullet points for a promotion packet in the same style. Rather than describing "make them punchy, metric-grounded, and scope-signaling," you provide a worked example:

*"Format I want — here's a sample bullet:*
*'Led the redesign of the ML feature-serving pipeline (3-engineer team, 6 months), reducing P99 latency from 340ms to 80ms and cutting infra cost by 40%. Unblocked the product team's real-time personalization roadmap which had been stalled for two quarters.'*

*Now write 3 more bullets in that exact format for: [specific accomplishments described in rough notes]."*

The exemplar encodes the entire style guide (metrics first, business impact at the end, team scope named) in a single bullet.

## Practice prompt

Identify a recent output you had to heavily edit for format or style. Instead of writing new instructions, write the ideal version of a single output yourself (spend 5 minutes — make it genuinely good). Then prepend it as an example to your next request:

> *"Here's an example of the format and style I want: [your worked example]. Now apply the same format to: [your actual prompt]."*

Notice how much your editing burden drops on the next output.

## How this connects to the higher tiers

Few-shot prompting is an IMPROVED-tier technique — single-pass, applied before generation, no back-and-forth. Its contribution is communicating desired behavior through demonstration rather than description. The next rung is Socratic (`teach me socratic-questioning`), where instead of showing the model what you want you construct questions that force the model to derive it; the rung after is dialectic (`teach me dialectic-tas`), where the exemplar evolves into a paired thesis and antithesis — two worked examples in deliberate opposition — and the synthesis is the output that survives both.
