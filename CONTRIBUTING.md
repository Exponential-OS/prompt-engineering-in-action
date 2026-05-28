# Contributing to Co-Dialectic

Thanks for your interest in contributing. This document covers how to submit changes and the legal agreement that applies to all contributions.

## Contributor License Agreement (CLA) + Developer Certificate of Origin (DCO)

By submitting a pull request or patch to this repository, you agree to the following:

### Developer Certificate of Origin (DCO)

You certify, under the [Developer Certificate of Origin v1.1](https://developercertificate.org/):

> (a) The contribution was created in whole or in part by me and I have the right to submit it under the open source license indicated in the file; or
>
> (b) The contribution is based upon previous work that, to the best of my knowledge, is covered under an appropriate open source license and I have the right under that license to submit that work with modifications; or
>
> (c) The contribution was provided directly to me by some other person who certified (a), (b) or (c) and I have not modified it.

### CLA — Grant of Relicensing Rights

In addition to the DCO, by submitting a contribution you grant **Exponential OS, Inc.** a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable license to reproduce, prepare derivative works of, publicly display, publicly perform, **sublicense**, and distribute your contribution and derivative works thereof — **under any license**, including proprietary licenses.

This grant enables Exponential OS to offer Co-Dialectic under dual licensing (AGPL-3.0 for open-source use + commercial/OEM licenses for organizations). Without this grant, contributor code would be AGPL-locked and could never be included in a commercially licensed version.

You retain copyright ownership of your contributions. This CLA grants a license, not an assignment.

### How to sign

Add a `Signed-off-by` line to every commit in your pull request:

```
Signed-off-by: Your Name <your-email@example.com>
```

Git can do this automatically with `git commit -s`.

The `Signed-off-by` line constitutes your agreement to both the DCO and the CLA above. No separate document or signing ceremony required.

If you cannot agree to these terms, we unfortunately cannot accept your contribution.

---

## What to contribute

1. **Bug fixes** — with a test or reproduction steps
2. **Skill improvements** — sharper prompts, better detection patterns, new persona caliber checklists
3. **New skills** — see existing skills in `plugins/co-dialectic/skills/` for the expected structure
4. **Hook improvements** — TypeScript + Bun handlers in `plugins/co-dialectic/hooks/`

## Quality bar

- Must work with at least 2 different LLMs (Claude + one other)
- Must be tested by pasting SKILL.md into a fresh conversation
- Hooks must be TypeScript + Bun (no Python, no shell scripts in the rules tree)
- All existing CI tests must pass (`bash test-plugin.sh` from repo root)

## File structure

Skills follow this structure:

```
plugins/co-dialectic/skills/your-skill-name/
├── SKILL.md       (the loadable instructions)
└── scripts/       (optional TypeScript handlers)
```

## Code of conduct

Be kind. Teach through practice, not lectures.

## License

This project is licensed under [AGPL-3.0](LICENSE). Commercial and OEM licenses are also available — see [LICENSE-COMMERCIAL](LICENSE-COMMERCIAL) and [LICENSE-OEM](LICENSE-OEM). By contributing, you agree that your contributions may be distributed under any of these licenses per the CLA above.
