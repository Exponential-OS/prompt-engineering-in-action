# Co-Dialectic

**Free. Open-source. One install. In 10 days, you and your AI stop needing corrections.**

![Co-Dialectic — prompt quality from 45% to 91% in 10 days](social-preview-github.png)

---

You type a vague question. Instead of a vague answer, this happens:

> **You:** Summarize this document.
>
> **Co-Dialectic** `Persona: Life Coach, Expert` · `Prompt: 💡 Improve` · `Context: 🟢 Fresh`
>
> *Sharper version: "What are the 3 key tensions — and what does the author assume that might be wrong?" That gets you analysis, not just a summary. Want me to answer your original, or the improved one?*

You pick the improved version. Better answer. Better question. Both sides 1% smarter.

Do that for 10 days. 1% daily compounds to **37x in a year** — but you feel it in the first week.

---

## [Five Things That Happen Automatically]

### [Persona] — The right expert shows up

> **You:** Help me debug this authentication error.
>
> **Co-Dialectic** `Persona: Software Architect, Expert` · `Prompt: ✅ Clear` · `Context: 🟢 Fresh`
>
> The 401 is misleading — your token is valid but the scope doesn't include `write:users`. Root cause is in the OAuth config.

> **You:** I'm overwhelmed. Too many things on my plate.
>
> **Co-Dialectic** `Persona: Life Coach, Expert` · `Prompt: ✅ Clear` · `Context: 🟢 Fresh`
>
> Name the three things weighing on you most. We'll sort them into "must do today," "can wait," and "someone else's problem."

The AI picks the right expert. You can also set it: *"Be a Data Scientist, Expert for the next hour."*

The **quality bar** (`Expert`, `Practitioner`, `General`) controls depth. You always know who's thinking.

---

### [Prompt Quality] — Every prompt gets coached

> **You:** What should I do about my project?
>
> **Co-Dialectic** `Persona: Life Coach, Expert` · `Prompt: 💡 Improve` · `Context: 🟢 Fresh`
>
> *Try: "I'm leading a data migration with 3 vendors, a hard deadline in 6 weeks, and my lead engineer just quit. Think through my options." — Specificity unlocks better reasoning.*

Then it **waits for your choice.** Over days, 💡 appears less — because you've gotten better.

---

### [Context Size] — Context never silently degrades

Every AI conversation has a memory limit. Chat long enough and the AI quietly forgets earlier decisions. You'd never know. Co-Dialectic makes it visible — and does something about it.

![Co-Dialectic auto-handoff when context degrades](co-dialectic-handoff.png)

> **Co-Dialectic** `Persona: Software Architect, Expert` · `Prompt: ✅ Clear` · `Context: 🔴 Compress Soon`
>
> ⚠️ Memory at 78%. Auto-summary for your next conversation:
>
> — **Decisions:** PostgreSQL over MongoDB for the write-heavy service
> — **Preferences:** Event-sourcing over CDC
> — **Open question:** Kafka vs SQS for the event bus
> — **Your style:** Direct, no fluff, show trade-offs before deciding
>
> Copy this into your next conversation. You'll start warm — no lost context.

**That handoff is free.** No setup. The AI detects degradation, preserves your decisions and preferences, and gives you a warm start next time.

---

### [Auto-Codification] — Every correction becomes permanent

> **You:** When I say "show me," I mean images — not text descriptions.
>
> **AI:** Captured as a broad principle: *always use the richest format — images over descriptions, charts over numbers, demos over explanations.* This applies everywhere going forward.

Correct once. Benefit forever. The AI saves lessons that survive across sessions.

---

### [Teaching] — The AI teaches you back

Three techniques it names when you use them — through practice, not lectures:

**Socratic prompting** — ask, don't tell. *"What decisions were made?"* beats *"Summarize the notes."*

**Few-shot by example** — one correction, one principle. *"Learn this as a concept, not a keyword."*

**Chain-of-thought steering** — *"Think through the trade-offs"* for full reasoning. *"Just do it"* for speed.

---

## [Your Progress] — The co-learning flywheel

**Day 1:** `Prompt Quality: 45% clear` — You correct the AI. It saves broad principles.

**Day 3:** `Prompt Quality: 62% clear` — The AI applies lessons automatically. Fewer corrections.

**Day 7:** `Prompt Quality: 78% clear` — The AI coaches your prompts. You learn new patterns.

**Day 10:** `Prompt Quality: 91% clear` — You anticipate each other. What took 10 exchanges now takes 1.

---

## [The Status Line]

Every AI response starts with a dashboard:

**Co-Dialectic** · `Persona: {Name}, {Quality}` · `Prompt: ✅ Clear or 💡 Improve` · `Context: 🟢 Fresh / 🟡 Working / 🔴 Compress`

| What you see | What it means |
|---|---|
| `Persona: Software Architect, Expert` | Which expert is thinking and at what depth |
| `Prompt: ✅ Clear` | Your prompt was specific — no improvement needed |
| `Prompt: 💡 Improve` | AI has a suggestion — shows it, then waits for your choice |
| `Context: 🟢 Fresh` | Less than 40% memory used — full accuracy |
| `Context: 🟡 Working` | 40–70% — still good, getting long |
| `Context: 🔴 Compress Soon` | Over 70% — AI auto-summarizes for handoff |

---

## [Install] — Paste one text. Any AI. 30 seconds.

### Claude Code / Cowork Plugin (recommended)

```
/plugin marketplace add thewhyman/prompt-engineering-in-action
/plugin install co-dialectic@thewhyman
```

Done. Auto-updates on new versions.

### All other platforms

**Step 1:** Copy [SKILL.md](https://github.com/thewhyman/prompt-engineering-in-action/blob/main/plugins/co-dialectic/skills/co-dialectic/SKILL.md) (click "Raw", then Ctrl+A, Ctrl+C).

**Step 2:** Paste into your AI's custom instructions:

| Platform | Where to paste | If you can't find it |
|----------|---------------|---------------------|
| **claude.ai** (web) | Projects → Create Project → Custom Instructions | [Claude docs](https://support.anthropic.com) — search "project instructions" |
| **Claude Desktop — Chat tab** | Same as claude.ai — Projects → Custom Instructions | Same experience as the web app |
| **ChatGPT** | Profile icon → Settings → Personalization → Custom Instructions | [ChatGPT docs](https://help.openai.com/en/articles/8096356-custom-instructions-for-chatgpt). ⚠️ 1,500 char limit — use the [condensed version](./install-instructions.md#condensed-version-for-chatgpt-paste-this) |
| **Gemini** | Profile picture → Personal Intelligence Instructions | [Gemini docs](https://ai.google.dev/gemini-api/docs/system-instructions) — search "custom instructions" |
| **Any other AI** | Start a new chat. Paste as your first message with: "Use these instructions for our entire conversation:" | Works with Copilot, Perplexity, Mistral, Llama — anything |

**Step 3:** Start a conversation. The status line appears immediately.

> **⚠️ IMPORTANT: You MUST start a completely new chat/session after pasting the instructions. They will not apply to existing conversations.**

**UIs change fast.** If the path above doesn't match what you see, search your platform's help center or ask your AI: *"Where do I paste custom instructions?"* — it knows its own settings.

**Full install guide with screenshots:** [install-instructions.md](./install-instructions.md)

**No install at all** — just read [SKILL.md](https://github.com/thewhyman/prompt-engineering-in-action/blob/main/plugins/co-dialectic/skills/co-dialectic/SKILL.md) and use the techniques in your next conversation. The ideas work without any setup.

---

## Attribution

Inspired by Ethan Mollick's [Co-Intelligence](https://www.oneusefulthing.org/). Built on [Dr. Jules White's Prompt Engineering specialization](https://www.coursera.org/specializations/prompt-engineering) on Coursera. Dialectical Behavior Therapy (DBT) — holding two opposing truths ("I have wisdom AI doesn't" AND "AI has capabilities I don't") — the synthesis exceeds either.

MIT License.
