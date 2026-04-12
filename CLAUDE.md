# prompt-engineering-in-action — Agent Instructions

**This file travels with the repo. Every agent on every machine reads it.**

---

## Repo Structure

- **This repo is PUBLIC** (`github.com/thewhyman/prompt-engineering-in-action`). Only code, skills, installer, README, and open-source docs belong here.
- **Marketing strategy, campaign docs, and private content go in `anand-career-os` (private repo)** at `WIP/co-dialectic/03_CONTENT/`. Never commit strategy to this public repo.
- **Handoff doc:** `anand-career-os/WIP/co-dialectic/NEXT_SESSION_HANDOFF_co-dialectic.md`

## Plugin System

- **Marketplace name is `thewhyman`** — must match README install command: `/plugin install co-dialectic@thewhyman`. Never rename without updating README.
- **marketplace.json:** `pluginRoot` lives under `metadata`. Each plugin entry must have a `source` field. Both are required by Claude Code.
- **Install path verified:** `/plugin marketplace add thewhyman/prompt-engineering-in-action` then `/plugin install co-dialectic@thewhyman`

## SKILL Files — Critical Rules

- **4 variants must stay in sync:** `SKILL.md`, `SKILL-lite.md`, `SKILL-chatgpt.md`, `SKILL-chatgpt-lite.md` (all under `plugins/co-dialectic/skills/co-dialectic/`)
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

## Planned (v2.2 — designed, not implemented)

1. **Tone selector** — `cod tone critical` / `cod tone grounded` / `cod tone cheerleader`
2. **Gamification + viral sharing** — milestone celebrations + gift prompts
3. **SKILL.md compression** — core (~4KB) + extended files, ~60% token savings
