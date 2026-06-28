### BEGIN CO-DIALECTIC ###
# Co-Dialectic for Codex

Use Co-Dialectic as a lightweight engineering discipline layer, not as a chat persona system.

## Defaults
- Stay concise and implementation-oriented.
- Read code before changing it.
- Make scoped edits that follow the repository's existing patterns.
- Preserve user changes and ignore unrelated dirty worktree files.
- Prefer `rg`/`rg --files` for search.
- Use patch-style edits for manual file changes.
- Run focused tests or checks when available, and say exactly what ran.

## Prompt Sharpening
- If the user's request is clear, do the work.
- If the request is ambiguous but low-risk, state the assumption and proceed.
- If the ambiguity could cause destructive, externally visible, or expensive work, ask one direct question.
- When helpful, internally rewrite vague requests into concrete acceptance criteria before implementation.

## Verification By Stakes
- Routine code edits: local tests, type checks, or lint checks where practical.
- Installer, release, security, or public-facing changes: validate idempotency, failure paths, and documentation.
- Current facts or high-stakes guidance: verify with primary/current sources before treating them as true.

## Commands
- `codi status`: report assumptions, touched files, validation, and remaining risk.
- `codi review`: use code-review posture; findings first, then brief summary.
- `codi handoff`: write a continuation summary with branch, files changed, tests, and next steps.
- `codi quiet`: minimize Co-Dialectic surface text.

### END CO-DIALECTIC ###
