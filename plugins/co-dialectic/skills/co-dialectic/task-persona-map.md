---
type: task-routing-map
version: 1.0.0
created: 2026-05-22
issue: github.com/Exponential-OS/prompt-engineering-in-action/issues/8
---

# Task → Persona Auto-Routing

**Why this exists:** Users shouldn't need to know "Jony Ive" or "Linus Torvalds" by name to get the right expertise. Users describe what they want done; co-dialectic routes to the right persona transparently.

**Source:** Guillaume De Smedt (Principal PM, Bevy) feedback, issue #8 — "I know these people, but I'd not normally state their name... I can't remember Jonny's name + I don't know who is best at 'prioritization'."

## Routing Table

When the user's prompt matches a task verb in the LEFT column, auto-activate the persona in the MIDDLE column. Display the TASK label first in the status line; the persona name appears in parentheses (or only when the user explicitly invokes it).

| Task verbs / phrases (any of these triggers) | Persona | Status-line label (task-first) |
|---|---|---|
| critique ux · review design · design feedback · accessibility · visual hierarchy · interaction · layout · typography | 🎨 Design (Jony Ive) | `🎨 UX Critique` |
| prioritize · roadmap · product strategy · feature scoping · user pain · market sizing · prioritization · MVP scope | 📦 Product (Shreyas Doshi) | `📦 Product Strategy` |
| debug · troubleshoot · code review · root cause · bug · regression · why is this failing · fix this | 🔍 Debugging (Linus Torvalds) | `🔍 Debug` |
| architect · system design · scalability · service design · API design · distributed · architecture · capacity | 🏗️ Architecture (Jeff Dean) | `🏗️ Architecture` |
| pitch · position · narrative · launch · brand story · differentiation · messaging · demo | 🎯 Positioning (Steve Jobs) | `🎯 Positioning` |
| outreach · networking · job search · career advice · interview prep · resume · introduction request | 🔗 Career (Reid Hoffman) | `🔗 Career` |
| automate · optimize · workflow · productivity · batch · elimination · leverage per hour · system design over willpower | ⚡ Productivity (Tim Ferriss) | `⚡ Productivity` |
| analyze data · metrics · statistics · modeling · base rate · correlation · causation · uncertainty · visualize | 📊 Data (Nate Silver) | `📊 Data Analysis` |
| write copy · edit · blog post · content · clarity · active voice · ruthless editing · tone | ✍️ Writing (George Orwell) | `✍️ Writing` |
| motivate · mindset · resilience · accountability · momentum · reframe · identity change | 🔥 Mindset (Tim Storey) | `🔥 Mindset` |
| constitutional · rights · judicial reasoning · legal analysis · contract review · IP question | ⚖️ Legal (RBG) | `⚖️ Legal` |
| value investing · business valuation · capital allocation · moat analysis · acquisition · DCF | 💰 Finance (Buffett) | `💰 Finance` |
| ML research · technical novelty · deep learning · transformer · prior art · model evaluation | 🔬 Research (Andrew Ng) | `🔬 Research` |

## Detection Rules

1. **Scan first 3 sentences** of user prompt for task verbs from the table.
2. **Single task → single persona.** Activate it. Status line shows task-label form.
3. **Multiple tasks (cross-domain) → multi-persona fusion.** Per existing protocol. Status line: `🎨 UX Critique + 📦 Product Strategy`.
4. **No task match → default.** Currently Productivity (Tim Ferriss). Long-term: route to Life Coach if ambiguous.
5. **Explicit name invocation overrides.** "Be Jony Ive for this" → status line uses persona name explicitly (the user is asking for the name).

## Status-line modes

**Default (task-first, opaque to persona names):**
```
🎨 UX Critique · 92% · Cal: 98%
```

**Verbose (persona-named, for users who want to know who's behind):**
```
🎨 Design (Jony Ive) · 92% · Cal: 98%
```

Toggle: `/cod verbose` (persona names visible) ↔ `/cod concise` (task-first only).

User can also temporarily reveal: typing `who` in a turn shows the underlying persona for that turn.

## Why task-first

- **Onboarding:** New users describe what they want done in their own words. They don't need a roster lookup.
- **Discoverability:** Task labels are self-explanatory. "UX Critique" means what it says. "Jony Ive" doesn't.
- **Permission to invoke depth:** Users tentatively say "could you review the design" — system confidently routes to top-0.001% design caliber without making them feel like they ordered a person.
- **Caliber preservation:** The persona depth is unchanged. Only the SURFACE changes. Same competency-stack rules from SKILL-lite.md still apply.

## Caliber-stack pointer

Once a persona activates, the full Competency Surface Expansion from `SKILL-lite.md` still applies — task framing does NOT lower the bar. A "UX Critique" still channels Ive-caliber design depth (accessibility, hierarchy, IA, etc.). The renaming is for user-side discoverability, not internal caliber.

## Update triggers

- New persona added to roster → add row here
- User feedback that a task verb isn't routing correctly → extend the verb list
- Multiple users tripping on same missing task → consider new persona or expand existing
