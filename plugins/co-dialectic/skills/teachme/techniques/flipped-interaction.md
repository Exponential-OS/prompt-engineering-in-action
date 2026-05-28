# Technique: Flipped Interaction

<!-- product-vs-solution: example -->

## What it is

Flipped interaction inverts the default prompt structure: instead of giving the LLM an instruction, you ask the LLM to ask *you* clarifying questions first. The canonical form is: "Before answering, ask me 3 questions that would make your response 10x better." Or: "Don't answer yet. Ask me the questions you'd need answered to give me advice as good as a consultant who has worked with this problem for a decade." The model becomes the questioner; you become the answerer. The "interview" surfaces what you didn't know you hadn't specified.

The technique shares structural DNA with Socratic questioning but the inversion is meaningful: in Socratic mode, *you* ask the model questions that force derivation. In flipped interaction, *the model* asks you questions that force you to specify. The model is acting as a requirements analyst, surfacing ambiguities in your own request that you couldn't see because you were too close to them. The same move appears in design thinking ("the five whys"), in consulting discovery sessions, and in how good therapists open a conversation — not with answers but with the questions that reveal what the client actually needs.

## Why it works

Most underspecified prompts are underspecified because the user genuinely doesn't know what they don't know. Asking for "better instructions" produces more of the same vagueness — you can't specify what you haven't surfaced. But when a well-primed model asks you pointed questions, it forces you to encounter the ambiguity directly: you either answer (and thereby specify) or you realize you don't know the answer (which is itself information). The flipped interaction turns the model's pattern-matching ability to your advantage — it knows what classes of ambiguity tend to produce bad outputs, and it can systematically surface them.

The technique also changes your relationship to the conversation. When you answer questions rather than write prompts, you're working from strengths — you know your own context better than any model could infer it. Answering good questions is often faster and more precise than writing an elaborate prompt from scratch.

## When to use

- **When you're not sure what you're actually asking** — if you find yourself writing a prompt and it keeps expanding, flip it: ask the model what it would need to know.
- **High-stakes, complex requests** — strategy documents, job offers, difficult personal decisions — where getting the framing wrong is expensive.
- **Starting a new type of task** — if you've never prompted for this kind of output before, flipped interaction discovers the prompt structure you should have written.
- **When past attempts produced outputs that missed the point** — if the model keeps answering a question you didn't ask, flip the interaction to surface the disconnect.

## When NOT to use

- **Routine, well-understood tasks** — if you've done this exact type of prompt 20 times and know what works, flipped interaction adds friction with no upside.
- **When you're time-constrained and the prompt is good enough** — flipped interaction is an investment. It pays off on complex requests but is overhead on simple ones.
- **When the question itself is the answer** — sometimes writing the question for the flipped interaction forces you to realize you already know what you need. In that case, skip the flip and write the refined prompt directly.

## Two examples

**Example 1 (canonical — strategy document):**

- Direct: *"Help me write a strategy for how our team should adopt AI tools."*
- Flipped: *"I need to write a strategy document for how our engineering team should adopt AI tools. Before you write anything, ask me the 5 questions that would most sharpen your advice. Don't answer yet — just the questions."*

Likely questions the model surfaces: What's the team's current AI fluency? What's the primary constraint — cost, security, or adoption resistance? Is this for internal productivity or customer-facing products? What's the time horizon? Who's the audience for this document? Each question contains information you hadn't specified — and each answer will materially change the strategy.

**Example 2 (from engineering leadership context):**

- Direct: *"Help me give feedback to an IC who keeps delivering late."*
- Flipped: *"I need to give difficult feedback to a senior IC who has missed three commitments this quarter. Before drafting anything, ask me the questions that would make the difference between generic HR feedback and feedback that actually changes behavior. Ask me 4 questions — nothing else yet."*

Likely questions: Is the lateness caused by underestimation, scope creep, blocking dependencies, or personal issues? Has this come up in previous 1:1s? What outcome am I trying to achieve — improvement, a PIP, or managing out? What's the IC's self-assessment of the problem? Answering these doesn't just improve the feedback — it often reveals that the feedback conversation needs to be a diagnosis conversation first.

## Practice prompt

Pick a request you'd normally write as a direct prompt. Instead, open with:

> *"I need help with [your situation in 2 sentences]. Before you respond, ask me the 3-5 questions whose answers would most sharpen your advice. Don't answer yet — just the questions."*

Answer each question in a single response. Then ask the model to use your answers to proceed. Compare the output to what you'd have gotten from the direct prompt.

## How this connects to the higher tiers

Flipped interaction is an IMPROVED-tier technique when used as a single discovery round. It becomes Socratic (`teach me socratic-questioning`) when the questions the model asks are structured to force *derivation* rather than just specification — not "what audience?" but "what would the audience find most counter-intuitive?" The full dialectic tier (`teach me dialectic-tas`) arrives when the questions the model asks are adversarial: not clarifying your position but actively constructing the strongest possible counter-position before synthesis.
