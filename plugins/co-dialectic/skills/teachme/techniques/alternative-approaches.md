# Technique: Alternative Approaches (Framing Before Committing)

<!-- product-vs-solution: example -->

## What it is

Alternative approaches prompting asks the LLM to surface 2-3 meaningfully different framings *before* proceeding with any of them. The canonical form: "Before answering, identify 2-3 different ways this question could be approached. Briefly describe each. Then ask which direction I want to go." Or: "I see this problem from 3 different angles: (A) ... (B) ... (C) ... Which framing is most useful for what I'm trying to accomplish?" The key move is separating the *choice of framing* from the *execution of the chosen framing* — two distinct cognitive operations that are usually collapsed into one by default.

The technique has roots in design thinking's "How Might We" divergent phase (IDEO, 1970s–present) and in decision analysis, where Robert Keeney's 1994 work on "value-focused thinking" argued that most decision errors happen not in the choice between options but in the failure to generate the right option set in the first place. In prompt engineering, the framing error is analogous: the model (and often the user) commits to the first reasonable interpretation of a prompt, which may not be the interpretation that produces the most useful output.

## Why it works

LLMs have a strong bias toward satisficing on the first plausible interpretation of a prompt. This is efficient for simple tasks and problematic for complex ones: the first plausible interpretation is often the most conventional one — the centroid of how "people like you asking questions like this" tend to proceed. When a problem has multiple structurally different approaches (analytical vs. practical, short-term vs. long-term, individual vs. systemic), committing to one before explicitly choosing costs you the possibility of the others. The user often doesn't know which approach they want until they see the alternatives named — the very act of naming them forces the implicit preference to surface.

The technique is especially powerful when the prompt is ambiguous in a way the user didn't notice: "how do I handle this situation with my lead?" could be a question about communication tactics, about organizational design, about managing upward, or about whether the situation is actually a problem. Each interpretation generates a materially different response. Surfacing them takes 30 seconds; committing to the wrong one wastes 10 minutes and produces an output that misses the point.

## When to use

- **Complex or multi-dimensional problems** — any time the answer depends strongly on how the question is framed, and different framings produce qualitatively different outputs.
- **When you feel mild dissatisfaction with prior responses** — if outputs keep missing something you can't articulate, the problem is often framing. Ask for alternatives and the implicit preference will surface.
- **Strategic planning and architecture work** — "build vs. buy vs. compose" is a trivial three-framing split; more nuanced architectural questions often have less-obvious framing splits that are worth surfacing before designing.
- **Whenever you're about to ask a long, complex question** — running a 10-minute generation in the wrong direction is expensive. A 30-second alternatives check before a long task is almost always worth it.

## When NOT to use

- **Well-defined, single-answer tasks** — "what is the time complexity of quicksort?" has one framing. Asking for alternatives adds overhead with no payoff.
- **When you've already decided on the framing and just need execution** — if you know the approach and are confident in it, asking for alternatives is a distraction. Trust the clarity.
- **Tight time loops** — code review on a specific diff, bug fix with a clear stack trace. The problem is well-bounded; framing isn't the variable. Use specificity injection or constraint injection instead.

## Two examples

**Example 1 (canonical — team problem):**

- Direct: *"How do I address the communication breakdown between my two senior engineers?"*
- Alternative approaches: *"Before you advise me on this, identify 3 structurally different framings of this problem. For example: (A) communication tactics — specific things to say or do. (B) structural/org design — whether the team structure is causing the problem. (C) individual development — whether each person has a feedback or growth gap. Briefly describe what each framing would focus on, then ask which direction I want."*

The user may have assumed they needed communication tactics (A). The model's framing might surface that the real issue is that both engineers are competing for the same promotion band (structural, B) — a problem where communication tactics will fail regardless of how well-executed they are.

**Example 2 (from engineering leadership context):**

- Direct: *"Should I build the observability layer in-house or use a vendor?"*
- Alternative approaches: *"Before recommending, identify 3 ways to frame this build/buy decision. Consider at minimum: (A) a pure cost and time analysis. (B) a strategic differentiation analysis — does observability create competitive advantage for us? (C) a team capability analysis — what does building in-house do to the team's skill development and future optionality? Describe each framing in 2 sentences, then ask which one I want to go deep on."*

In a prior session the user might have gotten a cost comparison and acted on it. The strategic differentiation framing (B) might surface that their observability needs are highly domain-specific and a vendor lock-in at the observability layer creates a long-term architectural risk that the cost analysis doesn't capture.

## Practice prompt

The next time you're about to ask a complex question, prepend this:

> *"Before answering, identify 2-3 structurally different ways to approach this. Describe each in 1-2 sentences — what it would focus on and what it would optimize for. Then ask me which direction to take."*

Answer the follow-up question. Notice whether you pick the framing you would have assumed the model would use — and what you learn about the alternatives you hadn't considered.

## How this connects to the higher tiers

Alternative approaches is an IMPROVED-tier technique — it surfaces options before committing to one, but it's still single-pass once the framing is chosen. It is the gateway move to Socratic (`teach me socratic-questioning`): once you have three framings, you can construct Socratic questions for each that force derivation rather than recitation. The full dialectic (`teach me dialectic-tas`) goes further — it treats two of the framings as thesis and antithesis, forces the strongest case for each, and synthesizes a framing that survives both. What alternative approaches surfaces implicitly, dialectic stress-tests explicitly.
