# Technique: Socratic Questioning (Elicitation)

<!-- product-vs-solution: example -->

## What it is

The single-sided method Socrates (470-399 BCE) gave us: instead of instructing the LLM, ASK it questions that force it to derive the answer from first principles. Socrates called himself a midwife — he didn't give birth to the truth; he helped others bring it forth from inside themselves.

In prompt-engineering terms: replace "do X" with "what would X look like if Y, given Z?" — questions that contain enough structure to constrain the search space but leave the derivation to the model.

This is the middle rung of the language ladder. It's deeper than mere specificity-injection (the IMPROVED tier), but single-sided — you and the AI are not yet refining opposing positions (that's Plato's dialectic).

## Why it works

LLMs trained on instruction-tuned data are good at answering questions but EXCELLENT at deriving answers when the question itself contains the right scaffolding. A direct instruction ("write a LinkedIn post") draws from generic templates. A Socratic question ("what's the central counter-intuitive insight in X that audience Y would find disturbing-yet-true?") forces the model to first locate the insight, then locate the audience, then locate the disturbing-yet-true pivot — producing output that's grounded in derivation rather than recitation.

This is also how Anand uses Co-Dialectic naturally — *"Anand was already doing these intuitively; naming them completes the co-education loop"* (identity.md). Socratic questioning is the technique you discover yourself if you experiment enough; this card just names what works.

## When to use

- **Creative work** where templates produce bland output (posts, talks, copy)
- **Strategic analysis** where you want the AI to surface what it knows, not regurgitate definitions
- **Personal reasoning** where you're not sure what your own position is yet
- **Coaching others** — Socratic questions are how good mentors and therapists work; same shape works with AI

## When NOT to use

- **Factual lookups** ("what's the capital of X") — overhead with no payoff
- **Mechanical tasks** (code edits, formatting) — direct instruction is faster
- **When you actually know the answer and just want execution** — questioning slows you down without adding quality

## Two examples

**Example 1 (canonical):**

- Direct: *"Write a LinkedIn post about co-intelligence."*
- Socratic: *"What's the single most counter-intuitive insight about co-intelligence that AI engineering leaders on LinkedIn would find disturbing-yet-true? For that insight, what's the 8-word hook that lands hardest? What's the question at the end that keeps comments rolling?"*

The Socratic version forces the AI to do three derivations (insight, hook, hook-line) instead of one shallow generation. Output quality scales roughly with the number of structured questions in the prompt.

**Example 2 (debugging):**

- Direct: *"Fix this Python script that's failing."*
- Socratic: *"What three classes of failure could produce this stack trace? For each class, what's the smallest test that would distinguish it? Which test do I run first if I want to falsify the most-likely cause?"*

Socratic debugging produces falsifiable hypotheses, not guesses.

## Practice prompt

Pick one task you'd normally instruct the AI to do directly. Rewrite it as 3-4 Socratic questions:

1. *What is the central [X] that [audience] would find [quality]?*
2. *Given that, what's the [structural element] that [test]?*
3. *Given both, what's the [output] that [success criterion]?*

Notice the difference in output quality.

## How this connects to dialectic

Socratic questioning is single-sided — the AI does the deriving; you provide the structure. It's powerful, but it's not yet the full Platonic dialectic. The next rung up is when YOU bring a position AND the AI brings the opposite, and the synthesis emerges from the collision. That's the DIALECTIC tier (see `teach me dialectic-tas`).

Most users plateau at Socratic. The 5% who climb to dialectic produce work that's measurably sharper than the 95% who don't.
