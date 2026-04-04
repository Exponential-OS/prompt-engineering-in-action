# How to Install Co-Dialectic

**You need to do ONE thing:** paste [this text](https://github.com/thewhyman/prompt-engineering-in-action/blob/main/plugins/co-dialectic/skills/co-dialectic/SKILL.md) into your AI's custom instructions. That's it.

> **⚠️ IMPORTANT: You MUST start a completely new chat/session after pasting the instructions for them to take effect.**

The tricky part is finding WHERE to paste. Every AI puts this in a different place, and they keep moving it. Below are step-by-step instructions for each platform — plus a fallback that works no matter what.

---

## claude.ai (web) and Claude Desktop — Chat tab

These are the same experience. Projects with custom instructions.

**What to do:**
1. Go to [claude.ai](https://claude.ai) or open **Claude Desktop** and click the **Chat tab**
2. Create a new **Project** (click "Projects" in the sidebar, then "Create Project")
3. In the project, find **"Custom Instructions"** or **"Project Instructions"**
4. Paste the full [SKILL.md](https://github.com/thewhyman/prompt-engineering-in-action/blob/main/plugins/co-dialectic/skills/co-dialectic/SKILL.md) text
5. Start a new conversation inside that project

**If the UI has changed:** Search the Claude help center for "project instructions" or "custom instructions": [support.anthropic.com](https://support.anthropic.com)

**Can't find it at all?** Start a new conversation and paste the SKILL.md text as your first message with this prefix:
> "Use these instructions for our entire conversation: [paste SKILL.md here]"

This works as a fallback on ANY AI — it's less persistent but activates immediately.

**Official docs:** [Claude System Prompts Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/system-prompts)

---

## Claude Desktop — Code tab / Claude Code (Terminal)

These are the same experience. Skills are loaded from the filesystem.

**What to do:**
```bash
git clone https://github.com/thewhyman/prompt-engineering-in-action.git ~/prompt-engineering-in-action
cp -r ~/prompt-engineering-in-action/co-dialectic ~/.claude/skills/co-dialectic
```
Then type `co-dialectic` or `cod` in any session.

**Official docs:** [Claude Code Skills](https://docs.claude.com/en/docs/claude-code/skills)

---

## Claude Desktop — Cowork tab

Cowork uses a plugin system, not paste-based custom instructions. Co-Dialectic is not yet available as a Cowork plugin. For now, use the Chat tab or Code tab in Claude Desktop.

**Coming soon:** A Co-Dialectic Cowork plugin is planned for a future release.

---

## ChatGPT

**⚠️ ChatGPT limits custom instructions to ~1,500 characters.** The full SKILL.md won't fit. Use the condensed version below.

**What to do:**
1. Click your profile picture (bottom-left)
2. Go to **Settings → Personalization → Custom Instructions**
3. Toggle "Enable customization" ON
4. Paste the **condensed version** below (fits the 1,500 character limit)
5. Click Save. Start a new conversation.

**If the UI has changed:** Search the OpenAI help center for "custom instructions": [help.openai.com](https://help.openai.com). Or search Google: `ChatGPT custom instructions where to find`

**Official docs:** [ChatGPT Custom Instructions](https://help.openai.com/en/articles/8096356-custom-instructions-for-chatgpt)

### Condensed Version for ChatGPT (paste this)

```
# Co-Dialectic v2.0 (condensed)
# Source: github.com/thewhyman/prompt-engineering-in-action

On EVERY response, start with:
Co-Dialectic · Persona: {Name}, {Quality} · Prompt: {✅ Clear / 💡 Improve} · Context: {🟢 Fresh / 🟡 Working / 🔴 Compress Soon}

PERSONA: Auto-detect the right expert. Code→Software Architect. Career→Career Coach. Personal→Life Coach. Data→Data Analyst. Writing→Writing Coach. Ambiguous→suggest options. Quality: Expert/Practitioner/General. User can set: "Be a [role], Expert for 1 hour."

PROMPT COACHING: On every message, evaluate the prompt. If it could be better: show 💡, suggest improved version, explain why in 1 sentence, STOP and WAIT. If clear: show ✅, answer directly.

CONTEXT: Track memory usage. 🟢<40%, 🟡 40-70%, 🔴>70%. At 🔴: warn, generate auto-summary (decisions, preferences, open questions, lessons), present as copyable handoff block.

CODIFICATION: When user corrects you or states a preference, acknowledge it, extract broad principle, state scope. Apply going forward.

TEACHING: Name techniques when user uses them — Socratic prompting, few-shot by example, chain-of-thought steering. One sentence, in context.

COMMANDS (natural language): "cod review"=analyze last prompts. "cod teach"=show patterns. "cod status"=progress report. "cod off"=deactivate.
```

---

## Gemini

**What to do:**
1. Go to [gemini.google.com](https://gemini.google.com) (or open the Gemini app)
2. Tap your **profile picture** (top-right)
3. Select **"Personal Intelligence Instructions"** (may also appear as "System Instructions" or "Gems")
4. Paste the full [SKILL.md](https://github.com/thewhyman/prompt-engineering-in-action/blob/main/plugins/co-dialectic/skills/co-dialectic/SKILL.md) text
5. Save. Start a new conversation.

**Note:** This may require a Google AI plan subscription.

**If the UI has changed:** Search Google for: `Gemini custom instructions where to find 2026`

**Official docs:** [Gemini System Instructions](https://ai.google.dev/gemini-api/docs/system-instructions)

---

## Any Other AI (Universal Fallback)

Works with Copilot, Perplexity, Mistral, Llama, or any LLM:

1. Start a new conversation
2. Paste this as your first message:

> **Use these instructions for our entire conversation:**
>
> [paste the full SKILL.md text here]
>
> **Confirm you understand by showing the status line on your next response.**

This isn't as persistent as custom instructions (it won't carry across conversations), but it works immediately with any AI that accepts long messages.

---

## Still stuck?

Ask your AI: **"Where do I paste custom instructions in [your platform name]?"** — your AI knows its own settings better than any guide.

Or search YouTube: `[platform name] custom instructions tutorial 2026`

---

## Updating

To check your version, ask your AI: **"What version of co-dialectic am I running?"**

To update: visit [the GitHub repo](https://github.com/thewhyman/prompt-engineering-in-action), copy the latest SKILL.md, and re-paste it.
