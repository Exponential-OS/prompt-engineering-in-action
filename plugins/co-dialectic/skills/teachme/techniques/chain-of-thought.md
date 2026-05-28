# Technique: Chain-of-Thought Prompting

<!-- product-vs-solution: example -->

## What it is

Chain-of-thought (CoT) prompting explicitly requests that the model show its reasoning before or alongside its answer. The canonical form is an instruction like "Think through the tradeoffs step by step before answering" or "Show your work." First formalized by Wei et al. (2022) at Google Brain, who demonstrated that simply adding "Let's think step by step" to arithmetic and reasoning prompts dramatically improved accuracy on multi-step tasks — not because the model learned anything new, but because the explicit reasoning trace scaffolded the generation of each subsequent step.

The technique comes in two flavors: **zero-shot CoT** ("think step by step" appended to any prompt, no examples needed) and **few-shot CoT** (providing worked examples where the intermediate reasoning is shown, then asking the model to do the same for a new problem). Both share the core mechanism — surfacing intermediate state — but few-shot CoT is stronger on complex domain-specific reasoning where the model benefits from seeing what "good intermediate steps" look like.

## Why it works

LLMs generate token-by-token: each token is conditioned on all previous tokens in the context. When a model generates an answer directly, the reasoning that leads to the answer is implicit — it happens inside the forward pass, invisible and unverifiable. When the model is prompted to reason explicitly, that reasoning becomes part of the context for each subsequent token. A wrong intermediate conclusion can then be self-corrected in the next step; a correct intermediate conclusion reinforces the right path. The final answer is conditioned on a chain of intermediate claims, not on the original question alone.

This is why CoT improves accuracy on multi-step tasks (arithmetic, logic, planning) far more than on single-step tasks (factual lookup). It also makes errors catchable: when the model reasons aloud, you can identify exactly where the reasoning goes wrong rather than just receiving a wrong answer and not knowing why.

## When to use

- **Multi-step reasoning tasks** — math, logic puzzles, architectural tradeoff analysis, debugging sequences where the answer depends on a chain of inferences.
- **When you need to audit the conclusion** — explicit reasoning lets you catch a bad assumption before it propagates into the answer. Especially valuable for high-stakes decisions.
- **Root-cause analysis** — "Walk through the causal chain from symptom to root cause, step by step" produces a diagnostic trace rather than a guess.
- **When prior direct answers have been wrong** — if the model keeps getting the same class of problem wrong, making the reasoning explicit often surfaces the systematic error.

## When NOT to use

- **Simple factual lookups** — "What year did Redis first release?" doesn't benefit from a reasoning trace. Adding CoT introduces verbosity with no quality gain.
- **When you need a concise final answer and don't want to parse reasoning** — CoT outputs are long. If you just need the answer and the reasoning is not diagnostic value for you, skip it.
- **Creative writing or open-ended brainstorming** — asking the model to "think step by step" about a poem introduces an analytical frame that competes with the generative one. Use constraints or audience priming instead.

## Two examples

**Example 1 (canonical — architectural tradeoff):**

- Direct: *"Should we use Kafka or SQS for this event pipeline?"*
- CoT: *"Think through this step by step before recommending: (1) What are the key differences between Kafka and SQS in terms of ordering guarantees, replay capability, and operational overhead? (2) What are the specific throughput and latency requirements implied by our use case? (3) What does the operational cost comparison look like at our scale? (4) Given all of the above, what's the recommendation and what's the condition under which you'd change it?"*

The CoT version produces a recommendation you can interrogate. The direct version produces a recommendation you have to accept or reject blindly.

**Example 2 (from engineering leadership context):**

- Direct: *"Is this the right time to promote this engineer to Staff?"*
- CoT: *"Think through this step by step: (1) What are the Staff-level criteria at this company, and which of them is this engineer demonstrably meeting today? (2) Which criteria are they not yet meeting — and is the gap a skill gap, a scope gap, or a visibility gap? (3) What's the cost of promoting too early vs. waiting another cycle? (4) What's the narrative I'd tell the engineer either way that's honest and keeps them motivated? Given all of that, what's the recommendation?"*

The CoT version surfaces the distinction between skill gap vs. scope gap vs. visibility gap — a tripartite distinction that a direct answer would collapse. It also forces the model to consider the cost of both errors (early and late), not just argue for one direction.

## Practice prompt

Take a decision you've been going back and forth on. Frame it as a CoT prompt:

> *"Think through this step by step before giving me a recommendation: (1) What are the 2-3 most important factors in this decision? (2) What does each factor say about each option? (3) Where do the factors point in the same direction, and where do they conflict? (4) Given that, what's the recommendation and what's the one condition that would change it?"*

Read the output as a reasoning trace, not just a conclusion. The value is in catching the step where the model's assumption diverges from yours.

## How this connects to the higher tiers

Chain-of-thought is an IMPROVED-tier technique when applied as a single-pass instruction. It becomes Socratic when you structure the CoT steps as questions that force the model to derive the chain rather than recite it. It becomes dialectic (`teach me dialectic-tas`) when the reasoning chain is run twice — once for the thesis, once for the antithesis — and the synthesis is the claim that survives both chains. The multi-step structure of CoT is the embryo of the dialectic's three-round sequence.
