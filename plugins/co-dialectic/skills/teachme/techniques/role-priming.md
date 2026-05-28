# Technique: Role Priming

<!-- product-vs-solution: example -->

## What it is

Role priming is the practice of telling the LLM *what role to inhabit* before it responds. The canonical form is "You are X" — where X is a specific, well-defined expert: "You are a Senior Staff Engineer at a payments processor", "You are a hostile design critic whose job is to reject weak proposals", "You are a UX writer with 10 years at Apple." The framing precedes your actual question; it is not decoration — it is an instruction about the distribution of responses the model should draw from.

The concept traces to cognitive-role theory in psychology: people genuinely reason differently when they consciously inhabit a role (Goffman's dramaturgical model, 1959). For LLMs the mechanism is simpler but analogous — the role label shifts which region of the training distribution the model samples from, activating vocabulary, constraints, reasoning patterns, and tonal norms typical of that expert class.

## Why it works

LLMs are trained on heterogeneous text written by heterogeneous humans with heterogeneous levels of expertise. Without a role prime, the model samples from a broad posterior — the centroid of "person who might answer this." That centroid is generically competent and generically cautious. A role prime narrows the posterior to a subpopulation: "people who reason about this the way a Staff Engineer at a payments processor would." The centroid of that narrower distribution is sharper — it includes failure-mode vocabulary, constraint awareness, and professional blindspots specific to that role.

Critically, adversarial roles ("You are a hostile reviewer trying to reject this proposal") are among the most valuable: they force the model to surface the weakest parts of your work, which a cooperative default persona would soften or omit.

## When to use

- **Technical reviews** — "You are a security engineer at a FAANG company doing a threat-model review of this architecture" surfaces different risks than an unconstrained review.
- **Adversarial pre-mortems** — "You are a VC who has decided to pass on this pitch; explain every objection" activates a different reasoning mode than "critique this pitch."
- **Domain translation** — when you need output calibrated to a specific professional context (legal reasoning, SRE incident analysis, clinical triage logic) rather than a general summary.
- **Tone calibration** — when the default AI tone (helpful-assistant-neutral) is wrong for the output channel (e.g., "You are a direct, no-bullshit technical writer" for internal engineering docs).

## When NOT to use

- **Factual lookups where domain doesn't change the answer** — the capital of France is Paris regardless of which expert you ask. Role priming adds overhead with no payoff.
- **When you don't know what expert would actually think about this** — a poorly-specified role ("You are a smart person") is noise, not signal. Under-specified roles can lower output quality by activating an incoherent distribution.
- **When you need the model's default breadth** — brainstorming across domains benefits from the unconstrained posterior; a narrow role prime cuts off cross-domain connections prematurely.

## Two examples

**Example 1 (canonical — architecture review):**

- Without role prime: *"Review this API design."*
- With role prime: *"You are a Senior Staff Engineer at Stripe whose team processes 500K payments/day. You are known for catching edge cases that junior engineers miss. Review this API design and surface every assumption that would fail at scale — not just best practices, but specifically the failure modes that only show up past 10K RPS."*

The role prime activates production-scale reasoning: idempotency concerns, retry storms, partial failure modes, rate-limiting at third-party dependencies. The unconstrained version surfaces textbook best-practices.

**Example 2 (from engineering leadership context):**

- Without role prime: *"Help me prepare for a difficult conversation with an underperforming IC."*
- With role prime: *"You are a Staff-level engineering manager at a 200-person AI startup. You've had to manage out two people this year and have learned what language works vs. what triggers defensiveness. Help me prepare a script for a performance conversation with an IC who is technically strong but consistently misses commitments. I want to preserve the relationship if possible; I want to be clear that this is a final warning if not."*

The role prime activates manager-practitioner wisdom — concrete scripts, likely defensive responses and counters — rather than generic HR-style advice about "providing clear feedback."

## Practice prompt

Try this on your next technical decision or document review:

> *"You are [specific expert with specific constraints and known professional biases]. [Your actual question]. Focus especially on [the failure mode that role would weight most heavily]."*

Then run the same question without the role prime. Compare not just what the output says but what it surfaces that you hadn't thought to look for.

## How this connects to the higher tiers

Role priming is an IMPROVED-tier technique — it's single-pass, no back-and-forth. It sharpens the prior before generation. The next rung is Socratic (`teach me socratic-questioning`), where you structure questions to force derivation rather than recitation; the rung after is full dialectic (`teach me dialectic-tas`), where the role prime becomes explicit: you inhabit the thesis, the AI inhabits the antithesis, and the synthesis emerges from the collision.
