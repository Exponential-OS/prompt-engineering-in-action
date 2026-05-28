# Technique: Thesis-Antithesis-Synthesis (Plato's Dialectic)

<!-- product-vs-solution: example -->

## What it is

The two-sided form Plato (428-348 BCE) extended from his teacher Socrates' one-sided questioning. The Republic codifies it: take a position (thesis), construct its strongest opposite (antithesis), then synthesize what survives both. Repeat across rounds until contradictions resolve into a sharper truth.

Co-Dialectic implements this as a three-round prompt sequence:

- **Round 1 — Thesis**: state the strongest version of your initial position.
- **Round 2 — Antithesis**: ask the AI to steel-man the opposite — the version someone reasonable could believe.
- **Round 3 — Synthesis**: identify what survives both rounds; that's the sharpened claim.

## Why it works

Most thinking is monological — one mind, one position, refinement through extension. Dialectic forces the most uncomfortable cognitive move: *fully entering the opposite view*. Steel-manning is harder than straw-manning because you must understand the position so well you could defend it for sixty seconds under hostile questioning.

The synthesis that emerges is not a compromise. It is the *sharper* claim — the one that survived the strongest objection your AI partner could construct. Compromise averages two positions; synthesis selects what survives stress-testing.

This is why Plato called dialectic the highest form of reasoning. It's not faster. It's not cheaper (3x the API calls in Co-Dialectic). But for high-stakes claims — public-facing arguments, decisions you'll commit to for years, conversations with people you love — it produces outputs that monologic reasoning cannot reach.

## When to use

- **Public-facing content** that will be read by an audience smarter than you (article, talk, pitch)
- **Decisions you cannot easily reverse** (hire, fire, ship, sign, marry)
- **Contrarian claims** where the audience's default is the opposite
- **Conversations with someone you love** about something hard — kid, spouse, parent, business partner
- **Strategic pivots** where the cost of being wrong is high

## When NOT to use

- **Fast iteration loops** (debugging, code edits, scratch work) — 3x cost not worth it
- **Single-answer factual queries** ("what's the syntax for X") — there's no thesis to oppose
- **Low-stakes communication** (Slack messages, casual notes) — dialectic on every prompt is over-engineering

## Two examples

**Example 1 (canonical — from product positioning):**

- Original prompt: *"Help me write a LinkedIn post arguing AI won't replace engineers."*
- Thesis: *"AI cannot replace engineering judgment because it lacks lived production experience."*
- Antithesis (steel-man the opposite): *"AI WILL replace engineers within 5 years; the lived-experience gap is closing fast as agents accumulate operational data."*
- Synthesis: *"AI replaces the parts of engineering that are pattern-matching against history. What survives is the judgment that requires staking your reputation on an irreversible call — and an AI has no reputation to stake. Senior engineers will not be replaced; they'll have AI assistants that handle the pattern-matching, and the senior's job becomes the irreversible-call part exclusively."*

The synthesis is sharper than the original thesis. It says something neither side started with.

**Example 2 (from a real Co-Dialectic user session):**

- Original: *"Should I take the AI Fund EIR offer or wait for a director role?"*
- Thesis: *"Take EIR — income secured, network access, optionality for next founding."*
- Antithesis: *"Wait — director role is the legible step that compounds toward Anthropic/OpenAI tier; EIR is a holding pattern that looks lateral on the resume."*
- Synthesis: *"Take EIR AND treat it as the explicit narrative bridge: 'I'm spending a structured year inside an investor org to learn the venture-formation craft before my own next 0-to-1.' That story makes EIR LEGIBLE for the next role, whereas declining EIR forfeits 12 months of paid network-building."*

## Practice prompt

Try this in your next decision-class conversation:

> *"Help me think about [decision]. Use full dialectic: (1) Steel-man my current leaning — strongest case for [my position]. (2) Steel-man the opposite — strongest case against. (3) Synthesize what survives both stress tests. Don't compromise; tell me the sharper claim."*

Run this for one decision a week for a month. Notice how the synthesis is consistently different from where you started — and consistently sharper than any straight-forward analysis would have produced.

## Where dialectic spills over

The cognitive habit transfers. After enough Co-Dialectic dialectic turns, you start asking yourself — in conversations with no AI present — *"what's the strongest version of the opposite of what I'm about to say?"* That single habit reshapes:

- How you argue with your spouse (steel-man their position before responding)
- How you mentor your kid (don't dismiss their position; steel-man it, then offer the antithesis as a question)
- How you negotiate (you've already done the other side's argument, so you're never surprised)

This is what identity.md means by "dialectical thinking practiced with AI spills over into how you reason with other humans." The plugin trains the habit; the habit reshapes every relationship.
