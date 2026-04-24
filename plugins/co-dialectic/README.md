# Co-Dialectic

**You sharpen the AI. The AI sharpens you. Both get better every day.**

**Version:** 3.2.0 — adds `judge-panel` (cross-family cascade-then-jury) + `hallucination-detector`. See the [v3.2.0 release](https://github.com/thewhyman/prompt-engineering-in-action/releases/tag/v3.2.0) for changelog.

![Co-Dialectic — prompt quality from 45% to 91% in 10 days](social-preview-github.png)

---

## Install (Claude Code / Cowork — recommended)

```
/plugin marketplace add thewhyman/prompt-engineering-in-action
/plugin install co-dialectic@thewhyman
```

This installs all six skills (below). For non-plugin environments (ChatGPT web, Claude.ai web, Gemini web), use the [main repo README](../../README.md#install) instructions.

---

## What It Does

Six composable skills activate automatically in a Co-Dialectic-enabled session:

| # | Skill | What it does |
|---|---|---|
| 1 | **co-dialectic** (core) | 10 expert personas auto-detected; per-prompt quality scoring (`📦 Product (Doshi) · 92%`); context-health smoke detector (🟢/🟡/🔴) with auto-handoff; auto-codification of corrections into generative principles; the AI teaches you back. |
| 2 | **calibration-auditor** | Zero-flattery gate. Scans every draft response for sycophancy markers ("Great question", "You're absolutely right", "Most productive session") and rewrites them out before they reach you. |
| 3 | **hallucination-detector** | Pre-flight risk-domain classification (legal / medical / factual / etc.) + post-flight hallucination scoring via `judge-panel`. Surfaces grounding suggestions before HIGH-risk prompts ship. |
| 4 | **judge-panel** *(new in v3.2.0)* | Cross-family cascade-then-jury review. Two cheap cross-family judges (Gemini Flash + GPT-nano) run first; if they agree with high confidence, verdict stands. If they disagree or confidence is low, escalates to one expensive cross-family tiebreaker (GPT-5.4). Operationalizes the Defense-in-Depth Part 2 "jury beats judge" thesis. ~0.04¢ per check. |
| 5 | **unknown-unknown** | Rumsfeld-Matrix adjacency surfacer. Asks: *which slots does this insight fit besides the one you named?* Prevents single-slot extraction. |
| 6 | **waky-waky** | Context-restoration ritual for new sessions. Loads Constitution, identity, active handoffs, and per-WIP state so a fresh session picks up where the last one ended. |

Six personas of the core skill: 🏗️ Architecture (Jeff Dean), 🎨 Design (Jony Ive), 🔍 Debugging (Linus Torvalds), 📦 Product (Shreyas Doshi), 🎯 Positioning (Steve Jobs), 🔗 Career (Reid Hoffman), ⚡ Productivity (Tim Ferriss), 📊 Data (Nate Silver), ✍️ Writing (George Orwell), 🔥 Mindset (Tim Storey).

## Architecture

The core SKILL.md is a thin protocol layer — it works standalone in any LLM that accepts system instructions. Extended capabilities (gamification, gifting, commands) live in the repo README's "For Agents" section as a CDN — evolving without reinstall. The five supporting skills (calibration-auditor / hallucination-detector / judge-panel / unknown-unknown / waky-waky) are independently composable — each has its own SKILL.md, its own activation triggers, and can be enabled or disabled per-session.

See the main [README](../../README.md) for install instructions, screenshots, and the full feature set. See [`tests/RESULTS.md`](tests/RESULTS.md) for the v3.2.0 eval results (judge-panel cascade, 100% accuracy on 8-case seeded-flaw corpus, 7.5× cheaper than a naive parallel Opus jury). See [`docs/PROTOCOL.md`](../../docs/PROTOCOL.md) for the Phase 2 portable-contract spec — how the six skills form an agent-agnostic protocol.

## Files

| File | Purpose |
|---|---|
| `skills/co-dialectic/SKILL.md` | Core skill — full version for Claude Pro / ChatGPT Plus / IDE use |
| `skills/co-dialectic/SKILL-lite.md` | Core skill — lite version for free tiers / high-frequency API |
| `skills/calibration-auditor/SKILL.md` | Zero-flattery scanner |
| `skills/hallucination-detector/SKILL.md` | Risk-domain classification + post-flight scoring |
| `skills/judge-panel/SKILL.md` | Cross-family cascade-then-jury |
| `skills/judge-panel/scripts/judge_panel.py` | Python harness (stdlib only) that executes the cascade |
| `skills/unknown-unknown/SKILL.md` | Rumsfeld-Matrix adjacency surfacer |
| `skills/waky-waky/SKILL.md` | Session-resurrection ritual |
| `tests/judge_panel_eval.py` + `tests/corpus/` | Reproducible eval harness + 8-case seeded-flaw corpus |
| `tests/RESULTS.md` | v3.2.0 eval results (F1=1.000 on 8 cases; $0.00295 total) |
| `screenshots/01-*.png` through `04-*.png` | Screenshots for README |
| `social-preview-github.png` | GitHub social preview image |
| `co-dialectic-handoff.png` | Context handoff screenshot |

## License

AGPL-3.0 (inherits from the repo — see [LICENSE](../../LICENSE) at the repo root).
