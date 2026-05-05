---
name: co-dialectic-onboarding
description: >
  First-time setup and introduction to Co-Dialectic. Use when the user says
  "onboard me", "get started", "how do I use this", "set up co-dialectic",
  "codi setup", "codi onboarding", or "walk me through co-dialectic".
  Walks through what Co-Dialectic does, how to use it daily, and optionally
  captures the user's context (name, role, goals) to personalize responses.
metadata:
  version: "4.7.0"
  author: "Anand Vallamsetla"
---

### BEGIN CO-DIALECTIC ONBOARDING ###

## What You Just Installed

**Co-Dialectic** is a prompt sharpening and expert persona system that runs on every message — no commands needed.

**Three things it does automatically:**

1. **↑ Sharper prompts** — your phrasing improved before every response. Vague questions become specific. Ambiguous requests become actionable.
2. **✓ Grounded answers** — hallucinations caught before high-stakes output reaches you. Verification fires at the right depth, not on everything.
3. **💰 Cost routing** — cheap work goes to cheap models; premium reasoning fires only when it matters.

**Your score appears on every response:**
```
⚡ Productivity (Tim Ferriss) · 88% · Cal: 96%
```
- **88%** = how effective your prompt was (goes up as you improve)
- **Cal: 96%** = how deeply the expert is thinking for your task

---

## Your First 5 Minutes

### Step 1 — Say hello

Type anything. Co-Dialectic activates on your first message. You'll see the status line appear at the top of the response.

### Step 2 — Watch prompt sharpening work

Ask something vague, like: *"help me with my email"*

Co-Dialectic will rewrite it into a sharper version and show you the score lift. Type `y` to use the improved version, `n` to keep yours, or `e` to edit it yourself.

### Step 3 — Meet the expert system

Every question automatically routes to the right expert:

| What you ask about | Who answers |
|---|---|
| Code, architecture | 🏗️ Architecture (Jeff Dean) |
| Product strategy | 📦 Product (Shreyas Doshi) |
| Writing, content | ✍️ Writing (George Orwell) |
| Career, networking | 🔗 Career (Reid Hoffman) |
| Productivity, systems | ⚡ Productivity (Tim Ferriss) |

You can also set it explicitly: *"Be Jony Ive for this design review"*

### Step 4 — Try a real task

Pick something you're actually working on. Co-Dialectic performs best on real work, not test prompts.

---

## Daily Use — Commands That Matter

| Command | What it does |
|---|---|
| `y` / `n` / `e` | Accept / reject / edit the improved prompt |
| `codi cruise` | Auto-execute mode — no pause for sharpening (good for IDEs) |
| `codi drive` | Collaborative mode — pauses to sharpen (default) |
| `codi quiet` | Minimal output — tracking silently, just the score |
| `codi honesty brutal` | Direct, no sugar-coating — for stress-testing your work |
| `codi honesty grounded` | Balanced, evidence-based (default) |
| `codi fish status` | Check the AI swarm health (gemini, codex availability) |
| `codi help` | Full command reference |
| `/co-dialectic` | Reload all protocols (use if codi seems absent) |

---

## Optional: Personalize Your Session

If you'd like Co-Dialectic to tailor responses to your context, share any of the following (all optional, nothing stored outside your session):

- **Your name** — for personalized greetings
- **Your role** — (e.g., "professor of ML", "product manager", "founder") to calibrate expert depth
- **Your current focus** — (e.g., "writing a grant proposal", "debugging a React app") to auto-select the right expert
- **Your honesty preference** — brutal / grounded / soft

Simply tell me: *"I'm a [role] working on [focus]. Call me [name]."*

---

## How to Get the Most Out of Co-Dialectic

**Best practice — be specific about what you want:**
- ❌ "Help me with my presentation"
- ✅ "I'm pitching a new AI research tool to skeptical NSF reviewers. Help me structure the 3-minute opening to lead with their pain (reproducibility crisis) before showing the solution."

**Best practice — name the stakes:**
- ❌ "Review my email"
- ✅ "Review this email to my department chair asking for budget approval. Stakes: my lab's summer hiring depends on it."

Co-Dialectic's verification depth scales with stated stakes. Higher stakes → deeper checks → fewer errors reaching you.

---

## If Something Seems Off

If co-dialectic's status line disappears or protocols feel absent — type `/co-dialectic` to reload.

This happens occasionally after very long sessions (context compaction). The reload takes one message.

### END CO-DIALECTIC ONBOARDING ###
