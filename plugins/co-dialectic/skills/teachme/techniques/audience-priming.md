# Technique: Audience Priming

<!-- product-vs-solution: example -->

## What it is

Audience priming declares *who the output is for* before asking for the content. It is the complement to role priming: where role priming tells the model what expert to be, audience priming tells the model who that expert is speaking to. The form is: "Write for [specific audience with specific characteristics]" — e.g., "Write for Series A technical founders who are not AI specialists", "Write for SREs at FAANG-scale platforms who distrust anything that doesn't come with load-test numbers", "Write for a hiring committee that has already read 50 engineering manager cover letters today."

The technique has roots in classical rhetoric: Aristotle's *Rhetoric* (350 BCE) argued that persuasion is audience-relative — the logos, pathos, and ethos that move one audience are invisible to another. Modern UX writing operationalizes this as "writing for a persona." In prompt engineering, explicitly naming the audience shifts which prior knowledge, vocabulary, and skeptical questions the model assumes it can rely on.

## Why it works

LLMs generate text conditioned on context. When no audience is specified, the model defaults to a generic educated reader — a useful centroid that's wrong for almost any specific use case. Specifying the audience injects three things simultaneously: the vocabulary the model should assume is shared, the things the model must explain rather than assume, and the objections the model should pre-empt. A technical post written "for SREs at FAANG-scale platforms" can use terms like "P99 tail latency" and "MTTR" without definition; the same post written "for startup founders who are non-technical" must earn those terms or avoid them. The model infers the full calibration from the audience label.

The most powerful form of audience priming includes the audience's prior belief or skepticism: "Write for engineering managers who are skeptical that LLMs can replace structured tools in production pipelines." That one clause tells the model to lead with evidence, address reliability concerns early, and avoid breathless enthusiasm — a complete editorial stance in eleven words.

## When to use

- **Content that must land differently for different readers** — the same underlying idea written for a VC pitch vs. an internal engineering RFC vs. a LinkedIn post requires different vocabulary, depth, and framing.
- **When you know the audience's starting skepticism** — naming it explicitly lets the model pre-empt objections rather than ignore them.
- **Executive communication** — "Write for a C-suite audience with 30 seconds to decide whether to read further" produces a very different opening than an unconstrained draft.
- **Onboarding or documentation** — "Write for an engineer joining the team tomorrow who has never seen this codebase but has 5 years of Python experience" calibrates explanation depth precisely.

## When NOT to use

- **When the audience is implicit and universal** — some outputs (error messages, API responses, mathematical proofs) have constraints-determined form regardless of audience. Audience priming adds overhead with no return.
- **When you don't know your audience well enough to specify them** — a vague audience label ("for a general audience") is noise. If you can't characterize the audience's prior knowledge and skepticism, spend 30 seconds defining them first.
- **When the goal is to appeal to multiple distinct audiences simultaneously** — audience priming optimizes for one; if you genuinely need to span two audiences, you need two outputs, not one audience-primed output.

## Two examples

**Example 1 (canonical — technical writing):**

- Without audience prime: *"Explain why vector databases are useful."*
- With audience prime: *"Explain why vector databases are useful. Write for senior backend engineers at B2B SaaS companies who understand relational databases deeply but are skeptical of 'AI-native' tooling. They'll trust you more if you acknowledge the cases where a traditional full-text search (Elasticsearch, Postgres tsvector) is sufficient — and be explicit about where it isn't."*

The audience prime tells the model: use relational-DB vocabulary as shared ground, lead with trade-offs not hype, and acknowledge the cases where the audience's existing tools are fine. The output earns credibility rather than assuming it.

**Example 2 (from engineering leadership context):**

- Without audience prime: *"Write talking points for my performance review."*
- With audience prime: *"Write talking points for my performance review. The audience is a VP of Engineering who has 8 direct reports, attends 6 hours of meetings daily, and will have 20 minutes with me. She values impact on org velocity and team health above individual technical output. She's heard every engineer claim they 'unblocked the team' — I need language that's specific enough to be falsifiable, not generic enough to be forgettable."*

The audience prime activates executive-communication mode: lead with org-level impact, use specific metrics, avoid the clichés the audience has already heard 50 times this week.

## Practice prompt

Take a piece of content you're about to write. Before you write a word of the actual prompt, complete this sentence:

> *"The person reading this is [role/context], who already believes [prior knowledge/belief], and whose primary skepticism is [objection]. They'll trust me more if I [trust-building move] and less if I [trust-destroying move]."*

Feed that characterization as your audience prime. Notice how it reshapes not just vocabulary but the entire argumentative structure of the output.

## How this connects to the higher tiers

Audience priming is an IMPROVED-tier technique — single-pass, applied before generation. It's the complement to role priming: one positions the speaker, the other positions the listener. Together they form the rhetorical frame for a single output. The next rung up is Socratic (`teach me socratic-questioning`), where instead of framing the output you structure questions that force derivation; the rung after is dialectic (`teach me dialectic-tas`), where the audience prime evolves into the antithesis: the model inhabits the audience's strongest objection, not just their vocabulary.
