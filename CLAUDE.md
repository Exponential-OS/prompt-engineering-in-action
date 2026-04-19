# prompt-engineering-in-action — Agent Instructions

**This file travels with the repo. Every agent on every machine reads it.**

---

## Repo Structure

- **This repo is PUBLIC** (`github.com/thewhyman/prompt-engineering-in-action`). Only code, skills, installer, README, and open-source docs belong here.
- **Marketing strategy, campaign docs, and private content go in `anand-career-os` (private repo)** at `WIP/co-dialectic/03_CONTENT/`. Never commit strategy to this public repo.
- **Handoff doc:** `anand-career-os/WIP/co-dialectic/NEXT_SESSION_HANDOFF_co-dialectic.md`

## Private Repo References (anand-career-os)

When working on marketing, distribution, or identity-related tasks, lazy-load from these files:

- **Content distribution flywheel:** `.career-os/memory/content-distribution-flywheel.md` — platform choices, algorithm rules, campaign patterns, hub URLs, posting rules
- **Identity:** `.career-os/memory/identity.md` — who Anand is, philosophies, values, co-intelligence thesis
- **Professional brand:** `.career-os/memory/professional-brand.md` — brand statement, headlines, LinkedIn about, differentiators
- **Brand identity & handles:** `WIP/common/BRAND_IDENTITY.md` — master social handle table, creative assets
- **Campaign status:** `WIP/co-dialectic/CAMPAIGN_STATUS.md` — execution state, engagement metrics, what's posted/pending
- **Article drafts:** `WIP/co-dialectic/03_CONTENT/` — Substack drafts, LinkedIn articles, social post copy

Generic distribution principles live in the Constitution (P16 Content Flywheel). These files are the personal Layer 2 choices.

## Plugin System

- **Marketplace name is `thewhyman`** — must match README install command: `/plugin install co-dialectic@thewhyman`. Never rename without updating README.
- **marketplace.json:** Keep minimal — only fields that working plugins use: `name`, `owner`, `plugins[]` with `name`, `source`, `description`, `version`, `category`. No `metadata.pluginRoot`, no `tags`, no `homepage`.
- **plugin.json:** Keep minimal — only: `name`, `description`, `version`, `author`. No `homepage`, `repository`, `license`, `keywords`.
- **Install path:** `/plugin marketplace add thewhyman/prompt-engineering-in-action` then `/plugin install co-dialectic@thewhyman`

## SKILL / README Architecture (v2.2+)

- **SKILL.md is the thin core** — all 5 protocols, persona list, fetch directive. Must work standalone without URL access.
- **README.md "For Agents" section is the CDN** — extended features (gamification, gifting, commands, philosophy) live here and evolve without reinstall.
- **The contract is semantic, not syntactic** — SKILL.md says "read the Gamification section," not "#agent-gamification". LLMs match by meaning. Section headings in the Agent section can be renamed as long as meaning is preserved.
- **The structural contract** — the "For Agents" section must exist at the GitHub repo URL. This is the one syntactic contract; everything within it is semantic.
- **README has 3 sections** — (1) For Humans: simple gift-prompt CTA, (2) For Agents: CDN content, (3) Support/Donate.
- **Never duplicate CDN content back into SKILL files** — the whole point is single source of truth in README.

## SKILL Files — Critical Rules

- **2 variants must stay in sync:** `SKILL.md`, `SKILL-lite.md` (all under `plugins/co-dialectic/skills/co-dialectic/`). ChatGPT variants were removed (OpenAI plugin bug filed, never responded — files recoverable from git history).
- **"Coaching" is BANNED** — ChatGPT rejected the plugin for health-coaching policy. Use "sharpening" everywhere: prompt sharpening, Socratic sharpening, 🛑 Refine (not Coach), 💡 Sharpen (not Improve), Mindset (not Life Coach).
- **Run `bash test-plugin.sh` after any SKILL/plugin changes** — must pass 42/42.
- **After editing, reinstall locally:** `cp plugins/co-dialectic/skills/co-dialectic/SKILL.md ~/.claude/skills/co-dialectic/SKILL.md`

## Installers

- **install.sh / install.ps1:** use `install_skill` for Claude Code and Antigravity paths (full file overwrite). Use `append_or_replace` for IDE paths (.cursorrules, .windsurfrules, etc.). Never append to skill files — it causes frontmatter duplication.

## Git

- **Committer:** `Anand Vallamsetla <avallam@thewhyman.com>`
- **thewhyman.com:** limit to 1 mention across SKILL files (footer hub only). Use GitHub repo URL for all technical CTAs/nudges.

## 10 Personas (v2.1.0)

🎨 Design (Jony Ive) · 🏗️ Architecture (Jeff Dean) · 🔍 Debugging (Linus Torvalds) · 📦 Product (Shreyas Doshi) · 🎯 Positioning (Steve Jobs) · 🔗 Career (Reid Hoffman) · ⚡ Productivity (Tim Ferriss) · 📊 Data (Nate Silver) · ✍️ Writing (George Orwell) · 🔥 Mindset (Tim Storey)

## Shipped (v2.2)

1. **Tone selector** — `cod tone critical` / `cod tone grounded` / `cod tone cheerleader`
2. **Gamification + viral sharing** — milestone celebrations + gift prompts
3. **SKILL.md compression** — thin core + README CDN architecture. ~33% token savings.

## Planned (v3.0 — designed, not implemented)

1. **Personal Constitution** — users build their own living constitution from accumulated lessons. Premium/donation-gated.
2. **Deep Personalization System** — modular reasoning styles as swappable skills.
