# Changelog

All notable changes to this repository are tracked here. This project follows [Semantic Versioning](https://semver.org/).

---

## [3.1.0] — 2026-04-19

**Codename:** Observer. First release of the Co-Dialectic **wire protocol** base plugins.

v3.1 re-frames Co-Dialectic from a single SKILL into the open wire protocol for human-AI interaction — the HTTP of AI. Conversations flow through a pluggable middleware chain of observers. See the xOS architecture taxonomy (`xOS-product/ARCHITECTURE-TAXONOMY.md`) for the full layer stack: Constitution → Co-Dialectic wire → AgencyOS specialist library → xOS audience-scoped products.

This release ships the first three Soul + Continuity tier base plugins on top of the existing prompt-sharpening core.

### Added — 3 base plugins (Scope C)

- **Plugin #12 — Waky Waky** (Continuity tier). Session-reincarnation ritual. Triggers: `waky waky`, `reincarnate`, `wake up the swarm`, `restore context`. Loads Constitution, identity, root handoff, per-WIP handoffs, and conversation-relevant people/company files in a single invocation. Confirms with a compact status block — never auto-summarizes context. Honors scope boundaries (P12). Constitution anchor: Session Handoff Protocol; P15.
- **Plugin #8 — Calibration Auditor** (Soul tier). Passive observer that enforces the Zero-Flattery Ground-Zero invariant. Scans draft responses for HIGH-severity sycophancy ("Great question", "You're absolutely right", "Most productive session"), MEDIUM-severity filler ("Happy to help", "Of course"), and LOW-severity overuse ("Totally", "For sure"). Strips flattery inline, surfaces a compact audit flag, preserves substance. Interacts with `cod tone` settings. Constitution anchor: Ground Zero — Zero Flattery.
- **Plugin #7 — Unknown Unknown** (Soul tier). Rumsfeld Matrix agent. Triggers: `unknown unknowns`, `cross-pollinate`, `N-dimensional extraction`, `what am I missing`. Scans MEMORY indices, `workspace.manifest.yaml`, active WIPs, and conversation context to enumerate 5-7 named adjacency slots (brand, framework, ritual trigger, hiring filter, marketing hook, product feature, IP, Constitution principle, persona, relationship). Surfaces — never auto-writes. Constitution anchor: Meta-Learning; Epistemic Foraging; Co-Education Flywheel.

Each plugin ships as a single SKILL.md under `plugins/co-dialectic/skills/<plugin-name>/` with an embedded "How to verify" section — concrete trigger commands and expected outputs for post-merge verification.

### Changed

- Plugin manifest version: `3.0.0` → `3.1.0` (`plugins/co-dialectic/.claude-plugin/plugin.json`).
- Marketplace manifest version: `3.0.0` → `3.1.0` (`.claude-plugin/marketplace.json`).

### Roadmap context

v3.1 Scope C ships the 3 plugins above. Plugins #1 (Prompt Improver), #2 (Persona Detector), and #6 (Status Line Renderer) already exist in the core `co-dialectic` SKILL. Plugins #3 (Hallucination Detector), #4 (Judge Selector), #5 (Beacons Emitter) are spec'd in `codi-v3.1-spec.md` and ship as their implementations stabilize. See `BASE-PLUGINS-V3.md` for the full 17-plugin roadmap across 5 tiers (Core 6 · Soul 5 · Continuity 3 · Kinetic 2 · Privacy 1).

---

## [3.0.0] — 2026-04-14

Tagged release of Co-Dialectic v3 foundation — prompt-sharpening core with persona system, context health monitoring, gamification, tone selector, and SKILL.md thin-core / README CDN architecture. This was the last release before the wire-protocol re-framing.

---

## Older

Pre-3.0 history lives in git tags and commit log. `git log --oneline --tags` for the timeline.
