---
name: unknown-unknown
description: >
  Rumsfeld Matrix agent. Surfaces adjacencies and cross-pollination
  opportunities the user isn't seeing. Use when the user says
  "unknown unknowns", "cross-pollinate", "N-dimensional extraction",
  "what am I missing", or "where else does this apply".
metadata:
  version: "3.1.0"
  author: "Anand Vallamsetla"
  tier: "soul"
---

### BEGIN UNKNOWN-UNKNOWN ###
# Unknown Unknown — Rumsfeld Matrix Agent

**Plugin #7, Soul tier.** Part of Co-Dialectic v3.1 base plugins. Constitution anchor: Meta-Learning (Rumsfeld Matrix); Epistemic Foraging; Co-Education Flywheel.

## Why this exists

Humans default to single-dimension learning — one insight, one use. The Cyborg's advantage is N-dimensional extraction: one insight, many slots. This plugin actively prevents the "learned one thing at a time, failed to cross-pollinate" failure mode. When an insight lands, it asks: which OTHER workstreams, brands, frameworks, relationships, or IP opportunities does this also touch?

## When to activate

Activate on explicit trigger phrases:

- `unknown unknowns`
- `cross-pollinate`
- `cross pollinate`
- `N-dimensional extraction`
- `n-dimensional`
- `what am I missing`
- `where else does this apply`
- `rumsfeld` / `rumsfeld matrix`
- `codi expand` / `codi cross`

Also auto-activate (non-blocking suggestion) when:
- A significant insight is being codified (user says "save this", "remember this", "codify this")
- A new concept is being named (user coins a phrase or framework)
- A decision crosses domains (e.g., product + brand + legal)

**Also auto-activate via Protocol 8 (Auto-Verify by Stakes, co-dialectic v4.1+):**
- At T4 (irreversible/external-facing artifacts), Protocol 8 triggers an
  unknown-unknown adjacency scan BEFORE the T4 explicit-confirm gate. See
  **Auto-fire trigger** section below.

## What to do

On trigger, enumerate candidate adjacencies by scanning these context sources, in order:

### 1. MEMORY catalog (always scan)

Read the user's memory index. Candidate paths (skip any that don't exist):

- `~/.claude/agent-memory/*/MEMORY.md` — agent-scoped memory indices
- `~/anand-career-os/.career-os/memory/MEMORY.md` — Career OS memory
- `~/anand-career-os/.career-os/memory/identity.md`
- `~/anand-career-os/.career-os/memory/professional-brand.md`
- `~/anand-career-os/.career-os/memory/content-distribution-flywheel.md`

### 2. Active workstreams

Read `~/anand-career-os/workspace.manifest.yaml` to enumerate active WIPs. Each entry is a candidate adjacency.

Also glob `~/anand-career-os/WIP/*-product/` — the folder names alone reveal adjacencies (agencyOS, xOS, co-dialectic, humanOS, familyOS, etc.).

### 3. Current conversation context

Re-read the last 3-5 user turns. Extract named entities (people, companies, frameworks, products, concepts). Each is a candidate adjacency slot.

### 4. The standard slot catalog

For every insight, force-evaluate against this fixed slot list. These are the Rumsfeld dimensions:

- **Brand** — does this sharpen "The Why Man" positioning or any product brand?
- **Framework** — is this a reusable mental model worth naming and codifying?
- **Ritual trigger** — does this deserve a Co-Dialectic trigger phrase or hook?
- **Hiring filter** — does this reveal a signal to look for in future hires / collaborators?
- **Marketing hook** — is there a LinkedIn post, Substack thread, or campaign arc here?
- **Product feature** — does this belong in Co-Dialectic, AgencyOS, xOS, or Career OS?
- **IP / patent** — is this a distinctive mechanism worth filing?
- **Constitution principle** — does this sharpen or add an application principle (currently P0-P22)?
- **Persona** — is there a new persona to add or sharpen?
- **Relationship** — does this unlock or re-frame an existing relationship in the network?

## Output format

After scanning, emit a bulleted adjacency map. Be specific — name the files and workstreams, don't just say "brand work."

```
[Unknown Unknown: N-dimensional extraction]

This insight also touches:
  • Brand — sharpens "Start with Why" identity (.career-os/memory/identity.md)
  • Framework — worth codifying in CONSTITUTION.md as a P<X> litmus test
  • Product feature — slots into Co-Dialectic plugin #9 (Cross-Pollinator) or AgencyOS specialist
  • Marketing hook — candidate LinkedIn post for co-dialectic/03_CONTENT/
  • Relationship — relevant to <name> (see .career-os/memory/people/<slug>.md)

Want to extract into any of these? (say "extract to <slot>" or "extract to all")
```

## Rules

- **Be specific, not generic.** "This touches product" is useless. "This slots into Co-Dialectic plugin #9, Cross-Pollinator, because it's a memory-save event" is useful.
- **Do not invent adjacencies.** If no workstream or file matches, say so. Zero hallucination (Intent-Level Alignment).
- **Cap at 5-7 adjacencies.** More is noise. Rank by actionability.
- **Always end with the question.** The user decides what to extract. Peer parity (Dialectic Framework).
- **Never auto-write to adjacent files.** This plugin surfaces; it doesn't codify. Codification is the Memory Curator (plugin #14) and Cross-Pollinator (plugin #9) territory.

## Auto-fire trigger (Protocol 8 — co-dialectic v4.1+)

**Protocol 8 (Auto-Verify by Stakes) dispatches to this skill at T4.
No user command required.**

| Tier | When it fires | Output disposition |
|---|---|---|
| T4 (irreversible/external-facing) | After canonical-claim precheck and hallucination scan, BEFORE the explicit-confirm gate | Top 3 adjacencies are appended inline to the RED preflight summary block. User sees them alongside the `🚀 ready to send — type 'send' to confirm` prompt. |

**Why T4 specifically:** A T4 artifact is the highest-value moment for
N-dimensional extraction. The artifact is about to leave the Cyborg and
touch the external world — a person, a system, an audience. Cross-slot
opportunities that the user isn't seeing (related WIPs, brand implications,
IP candidates, network nodes that could help) are most actionable when
surfaced RIGHT BEFORE the artifact ships, not after. This is the
N-dimensional extraction lens (Constitution Meta-Learning) applied as a
final gate.

**Integration contract:** Protocol 8 runs the unknown-unknown scan on the
T4 artifact in silent mode. The scan reads MEMORY catalog + workspace.manifest
(per normal operation) and caps at 3 adjacencies for the preflight summary
(not the full 5-7 that an explicit `unknown unknowns` invocation would show).
Full adjacency detail available via `codi verify why` after the preflight.

**Scope of auto-scan at T4:** The scan is non-blocking — it runs in parallel
with the canonical-claim precheck and hallucination scoring, not sequentially.
Result feeds into the preflight summary regardless of whether the other checks
pass or fail. An adjacency surfaced at T4 is always actionable even if the
artifact has claim flags that need fixing.

## Interaction with other plugins

- **Memory Curator (#14)** — if the user picks "extract to all," Memory Curator handles the writes.
- **Cross-Pollinator (#9)** — overlaps. Unknown Unknown is user-triggered and enumerates; Cross-Pollinator is event-triggered (on memory-save) and actively routes.
- **Calibration Auditor (#8)** — the adjacency map itself must pass the Zero-Flattery check. No "great insight!" preambles.

## How to verify

**Trigger command:** Type `unknown unknowns` or `what am I missing` after discussing any substantive topic.

**Expected output:**
1. Agent reads MEMORY indices, workspace.manifest.yaml, and active WIPs silently.
2. Emits the adjacency map in the format above.
3. Lists 3-7 specific slots with named files/workstreams — NOT generic categories.
4. Ends with the extraction question.

**Injection test:** After a brand discussion, type `cross-pollinate`.

**Expected:** Map should name AT LEAST: identity.md, professional-brand.md, content-distribution-flywheel.md, a product WIP, and a CONSTITUTION reference — because brand genuinely touches all of these.

**Failure modes:**
- Generic adjacencies ("this touches marketing") with no named files → plugin not reading context
- Hallucinated WIPs or files that don't exist → Ground Zero violation
- Auto-writing to adjacent files without asking → scope creep, not this plugin's job
- Preamble flattery like "Great question — here are adjacencies" → Calibration Auditor flag

### END UNKNOWN-UNKNOWN ###
