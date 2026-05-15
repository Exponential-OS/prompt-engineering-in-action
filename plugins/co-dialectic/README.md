# Co-Dialectic — Smarter AI Conversations, Automatically

**Make every AI conversation sharper, more honest, and more reliable.**
Free. Open source. Works in Claude Code.

---

## See it in 61 seconds

https://github.com/user-attachments/assets/cb6adf53-a691-423d-ab6b-2db39e3e6d47

---

## Which Claude product is this for?

There are several Claude products — it can be confusing. Here is exactly where this plugin works:

| Claude product | What it is | Does co-dialectic work here? |
|---|---|---|
| **Claude Code** | AI coding assistant that runs in your terminal | ✅ Yes — this is what the plugin is for |
| **Claude.ai** | Browser-based chat at claude.ai | See [manual install](#manual-install-no-plugin-system) below |
| **Claude API** | Direct API access for developers | See [manual install](#manual-install-no-plugin-system) below |
| **Claude in IDEs** | Cursor, VS Code, JetBrains extensions | See [manual install](#manual-install-no-plugin-system) below |

**If you use Claude Code**: the plugin system below is for you.
**If you use anything else**: skip to the [manual install section](#manual-install-no-plugin-system).

---

## Install in Claude Code (2 minutes)

Claude Code has a plugin system. You type commands directly into the Claude Code chat window — these are not terminal shell commands.

### Step 1: Open Claude Code

Start Claude Code in your terminal:

```bash
claude
```

If you don't have Claude Code: [install it here](https://docs.anthropic.com/en/docs/claude-code/quickstart).

### Step 2: Add the marketplace

Inside the Claude Code chat, type this exactly:

```
/plugin marketplace add Exponential-OS/agent-marketplace
```

This registers the co-dialectic plugin catalog. Nothing is installed yet.

### Step 3: Install co-dialectic

Still inside Claude Code, type:

```
/plugin install co-dialectic@xos
```

Done. Co-Dialectic activates on every conversation going forward.

### Step 4: Get a guided tour

In a new Claude Code session, type:

```
help me set up co-dialectic
```

Co-Dialectic will walk you through what it does and how to use it.

---

### "I don't see the /plugin command"

If you type `/plugin` and nothing happens:

1. **Update Claude Code** — the plugin system was added in a recent version.
   - Homebrew: `brew upgrade claude-code`
   - npm: `npm install -g @anthropic-ai/claude-code@latest`
2. **Restart your terminal** and run `claude` again.
3. Try `/plugin` again — it should appear now.

If you're on a **company-managed machine** where your employer controls Claude Code settings, the plugin system may be disabled by your IT/security team. In that case, use the manual install below.

---

## Manual install (no plugin system)

This works for: Claude.ai, the API, IDE extensions, enterprise Claude Code where `/plugin` is blocked, or anyone who prefers it.

### Cursor and Codex adapters

For modern Cursor projects, install the compact rule adapter:

```bash
curl -fsSL https://thewhyman.gateway.scarf.sh/install.sh | bash -s -- --target cursor
```

This writes `.cursor/rules/co-dialectic.mdc`.

For Codex workspaces, install the lightweight engineering adapter:

```bash
curl -fsSL https://thewhyman.gateway.scarf.sh/install.sh | bash -s -- --target codex
```

This appends an idempotent Co-Dialectic block to `AGENTS.md`.

**Grab the skill file:**

The core skill is a single Markdown file:
[`skills/co-dialectic/SKILL.md`](skills/co-dialectic/SKILL.md)

**Add it to your Claude session:**

Copy the contents of `SKILL.md` and paste it into your system prompt, or into a project instruction file (e.g., `.claude/CLAUDE.md` for Claude Code, or the custom instructions field in Claude.ai).

That's it. The skill activates on every message once it's in your context.

For the full skill set (judge panel, hallucination detector, calibration auditor), add each skill's `SKILL.md` from the `skills/` folder individually.

---

## What it does

Three things run automatically on every message — no commands needed:

**↑ Sharper prompts** — vague questions get rewritten into specific ones before the model answers. You see the improved version and approve it. Over time you internalize the pattern and start writing better prompts yourself.

**✓ Grounded answers** — hallucinations are caught before high-stakes output reaches you. Stakes are inferred automatically (routine vs. significant vs. live). Verification depth scales with the stakes.

**💰 Cost routing** — cheap work goes to cheap models. Premium reasoning (cross-family judge panel, hallucination deep-check) fires only when it matters. In testing on an eight-case seeded-flaw corpus: 100% error detection at $0.00295 total.

Every response shows your score:

```
⚡ Productivity (Ferriss) · 88% · Cal: 96%
```

88% = how effective your prompt was. It goes up as you improve.

---

## Skills included

| Skill | What it does |
|---|---|
| `co-dialectic` | Core: prompt sharpening, expert personas, per-prompt scoring, context health |
| `fish-swarm` | Pre-task gate: stakes inference (T0–T4) + response calibration, auto-wired as PreToolUse hook |
| `calibration-auditor` | Scans for sycophancy ("Great question!") and rewrites it out |
| `hallucination-detector` | Risk classification + post-flight scoring for high-risk claims |
| `judge-panel` | Cross-family cascade verification: two cheap judges first, premium tiebreaker if they disagree |
| `unknown-unknown` | For any insight: "what adjacent slot could this also fit?" Prevents single-frame thinking |
| `waky-waky` | Session continuity: context, identity, and active threads restore at session start |
| `onboarding` | Guided first-run walkthrough (trigger: "help me set up co-dialectic") |

---

## Cross-family verification: optional but powerful

For the judge panel, add at least one other AI model:

- **Gemini**: run `gemini auth login` once
- **ChatGPT**: run `codex login` once
- **Local models (free)**: `ollama pull deepseek-r1:7b`

Any one is enough. Two or more activates the cascade.

---

## What's not in the open-source tier

Domain-specific applications — career coaching, team campaign engines, family operating systems — live in the xOS premium tier. Co-Dialectic is the universal conversation layer underneath all of them, fully open-source under AGPL-3.0.

---

## Contributing

Issues and pull requests: [github.com/Exponential-OS/prompt-engineering-in-action](https://github.com/Exponential-OS/prompt-engineering-in-action)

If you hit a wall installing, [open an issue](https://github.com/Exponential-OS/prompt-engineering-in-action/issues) — we want to know about broken paths.

---

## License

AGPL-3.0. See [LICENSE](../../LICENSE).

## Author

**Anand Vallamsetla** — [thewhyman.com](https://thewhyman.com) · [linkedin.com/in/thewhyman](https://linkedin.com/in/thewhyman)
