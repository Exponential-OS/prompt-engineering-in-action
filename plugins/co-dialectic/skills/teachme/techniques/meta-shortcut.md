# Technique: Meta-Shortcut (Prompt Codification)

<!-- product-vs-solution: example -->

## What it is

A meta-shortcut is the act of detecting a prompt you write repeatedly and codifying it as a persistent rule — so the instruction only needs to be written once. The canonical form: "Whenever I [trigger pattern], treat it as [task class] — always [first step], then [second step], then [third step]. Don't ask for clarification on these steps unless I explicitly say otherwise." The rule is then placed in a system prompt, a persistent instruction, or a Co-Dialectic codification that fires automatically on the matching trigger.

The name reflects its nature: it is a shortcut about your prompting habits, not about a specific task. Where specificity injection improves individual prompts, a meta-shortcut improves the *pattern* of prompts — it is a one-time investment that eliminates repeated friction. The concept maps to Don't Repeat Yourself (DRY) in software engineering, applied to the prompt layer: if you're writing the same instructional overhead on every prompt of a given class, that overhead is a candidate for codification.

## Why it works

LLM sessions are stateless by default — every prompt starts from zero unless context is explicitly carried forward. Meta-shortcuts break the statefulness problem for the patterns you already know. Instead of incurring the cognitive overhead of reconstructing the same framing on every relevant prompt ("remember to first identify the failure class, then the smallest repro, then the fix"), the pattern is injected automatically on the trigger. This reduces both friction (fewer tokens to write) and variance (the model's behavior is consistent across sessions, not dependent on whether you remembered to include the framing this time).

The act of writing the meta-shortcut is also diagnostic: it forces you to articulate a process you've been running implicitly. Many implicit processes, when written down, reveal steps you were skipping, orderings that don't hold up, or conditions you hadn't noticed. Codifying the shortcut often improves the underlying process, not just its invocation.

## When to use

- **Recurring task classes with a stable process** — debugging sequences, code review patterns, outreach drafting workflows, meeting prep formats. Any time you find yourself writing the same framing for the third time, it's a meta-shortcut candidate.
- **When inconsistent behavior across sessions is causing rework** — if you've noticed the model behaves differently on the same class of task across different sessions, codification fixes the variance.
- **After a session where you wrote an especially effective prompt** — that prompt is a codification candidate. Don't let it evaporate when the session ends.
- **Cross-tool consistency** — when you use multiple AI tools (Claude, Copilot, a custom agent) and want consistent behavior on a task class across all of them, the codified rule becomes the portable specification.

## When NOT to use

- **One-off tasks** — if you'll never run this exact class of prompt again, the investment in codification doesn't pay off. Meta-shortcuts are for patterns, not instances.
- **When the process is still unstable** — if you're still experimenting with what the right steps are, codify too early and you lock in a bad pattern. Get 3-5 consistent good outputs before codifying.
- **When the trigger is too broad** — "whenever I send a message" is not a useful trigger. Meta-shortcuts work when the trigger is specific enough to identify a distinct task class unambiguously.

## Two examples

**Example 1 (canonical — stack trace debugging):**

You've written "first identify the failure class, then the smallest repro, then the fix" on every stack trace you've pasted for two weeks. Meta-shortcut:

*"Whenever I paste a stack trace, treat it as a debugging request. Always: (1) Identify the failure class (e.g., null pointer, network timeout, resource exhaustion). (2) Identify the smallest repro case that isolates the failure. (3) Propose the fix with the lowest blast radius. Don't ask if I want this process — just run it."*

Now every pasted stack trace triggers the full three-step without any per-prompt overhead.

**Example 2 (from engineering leadership context):**

You prep for every difficult 1:1 by asking the same framing questions. After the third time, you codify:

*"Whenever I describe a difficult 1:1 I need to have (a performance conversation, a tough feedback moment, a disagreement about a decision), treat it as a conversation-prep request. Always: (1) Identify the underlying interests on both sides (not the stated positions). (2) Identify the most likely defensive response and a counter that keeps the conversation productive. (3) Draft a 3-sentence opening that gets to the issue without triggering defensiveness. Don't add caveats about 'every situation being different' — I know that; I want the framework."*

The rule codifies not just the process but also a constraint on the output ("don't add caveats") that reflects a pattern you noticed in prior outputs.

## Practice prompt

Review your last 10 prompts. Identify any task class you prompted more than twice with similar framing overhead. Write the meta-shortcut for that class:

> *"Whenever I [specific trigger — 'paste a stack trace', 'describe a decision I'm stuck on', 'share a draft LinkedIn post for review'], always [step 1], then [step 2], then [step 3]. [One constraint on the output form]. Don't ask — just run the process."*

Add it to your system prompt or Co-Dialectic's persistent instructions. Measure how many prompts per week that rule saves.

## How this connects to the higher tiers

Meta-shortcut is an IMPROVED-tier technique — it's an optimization over single-pass prompts, not a new prompting modality. Like all IMPROVED-tier work, it's single-directional: you instruct, the model executes. The next rung is Socratic (`teach me socratic-questioning`), where instead of codifying a process you structure questions that force the model to derive the process for a new situation. The rung after is dialectic (`teach me dialectic-tas`), where the codified rule itself becomes a thesis to stress-test — "here is my current process; steel-man why this process is wrong" — producing a sharper process through synthesis.
