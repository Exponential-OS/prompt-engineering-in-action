# Co-Dialectic — A Universal AI Conversation Layer

**Make every AI conversation 5× more reliable.**
Free. Open source. Two-minute install.
Works in Claude Code, Cowork, ChatGPT, Gemini, and any LLM that accepts a system prompt.
No infrastructure. No subscriptions required.

```
/plugin marketplace add thewhyman/agent-marketplace
/plugin install co-dialectic@thewhyman
```

---

## Why co-dialectic exists

Most people use AI the way they once used search: type a question, accept the first answer, move on. That worked for Google because the cost of a wrong link was a second click. With LLMs the cost is a confidently wrong answer that looks correct, sounds authoritative, and shapes a real decision before anyone notices the error.

The standard fixes — write better prompts, double-check the output, ask a colleague — all put the burden on the human. Co-dialectic moves the burden to the conversation layer. Before your prompt reaches the model, it gets sharpened. Before the answer reaches you, it gets audited. When the stakes are high, a second model from a different family reviews the first one's work. The user does nothing differently. The reliability floor moves up.

The name is the thesis. A monologue between you and one model is a closed loop with shared blind spots. A dialectic across multiple models, personas, and verifiers is an open loop where errors have somewhere to surface.

## What it does

- **Prompt sharpening** — vague prompts are rewritten into specific ones before the model answers.
- **Persona detection** — ten expert lenses (architecture, design, debugging, product, positioning, career, productivity, data, writing, mindset) auto-activate based on what you're asking.
- **Hallucination detector** — pre-flight risk classification (legal, medical, factual) plus post-flight scoring; high-risk claims get flagged before they ship.
- **Cross-family judge panel** — two cheap judges from different model families review first; if they disagree, an expensive tiebreaker resolves. Catches what same-family review structurally cannot.
- **Calibration auditor** — scans every draft for sycophancy ("Great question," "You're absolutely right") and rewrites it out before delivery.
- **Unknown-unknown surfacer** — for any insight, asks "what adjacent slot could this also fit?" Prevents the most common form of single-frame thinking.
- **Session continuity** — context, identity, and active threads restore at session start, so a fresh conversation picks up where the last one ended.

## Install (60 seconds, no infrastructure)

```
/plugin marketplace add thewhyman/agent-marketplace
/plugin install co-dialectic@thewhyman
```

That's it. Open Claude Code or Cowork; co-dialectic activates on every conversation.

For cross-family verification (judge panel), add credentials for one or more of:

- **ChatGPT Plus** — run `codex login` once
- **Gemini Pro** — run `gemini auth login` once
- **Local LLMs (free, no auth)** — `ollama pull deepseek-r1:7b`

Any one is sufficient. Two or more activates the cascade.

## Demo: feel the difference in two minutes

### Demo 1 — Prompt sharpening

Type: *"Help me with my resume."*

Without co-dialectic, you get a generic resume rewrite. With it, the prompt is rewritten to surface what's missing — target role, current resume, what's not landing — and you see both versions side by side. You learn the prompt pattern; next time you write the better version yourself.

### Demo 2 — Hallucination detection

Type a claim that mixes truth and fiction — for example, *"Summarize Berkeley Haas's 2024 case study on AI-assisted teaching, the one by Professor Chatman."* The model would normally fabricate a confident-sounding summary. Co-dialectic flags the unsupported assertion before the answer ships, and asks whether you want it to search rather than confabulate.

### Demo 3 — Cross-family verification

Ask a contested question — economic forecasts, medical guidance, contested historical claims. Co-dialectic runs the answer past Anthropic, OpenAI, and Google models in parallel and shows you where they agree, where they diverge, and which claims survived all three. You see the consensus and the disagreement.

## How it stays cheap

The cost ceiling is the reason most "verified AI" tools stay in research labs. Co-dialectic uses a cascade-then-jury pattern:

- **Local models** (DeepSeek 7B via Ollama and similar) handle routine checks at zero marginal cost.
- **Cheap-API fallback** (Gemini Flash, GPT-nano) handles second-tier checks for sub-cent.
- **Premium APIs** fire only when the cheap judges disagree or the artifact is high-stakes.

In testing on an eight-case seeded-flaw corpus, the cascade caught 100% of injected errors at $0.00295 total — 7.5× cheaper than running a naive parallel jury of premium models, with identical accuracy. Full eval at [`tests/RESULTS.md`](tests/RESULTS.md).

## Architecture

Co-dialectic is a **terminal layer**: it works standalone in any LLM that accepts a system prompt. There is no server, no account, no telemetry. The plugin installs six composable skills, each with its own activation triggers, each independently enable-able.

| Skill | Role |
|---|---|
| `co-dialectic` (core) | Prompt sharpening, persona detection, per-prompt quality scoring, context-health monitoring |
| `calibration-auditor` | Sycophancy scanner |
| `hallucination-detector` | Risk classification + post-flight scoring |
| `judge-panel` | Cross-family cascade-then-jury verification |
| `unknown-unknown` | Adjacency surfacer (Rumsfeld matrix) |
| `waky-waky` | Session-continuity ritual |

The skills compose. They also stand alone — if you only want the calibration auditor, install only that. The plugin is a coherent set, not a monolith.

Co-dialectic is independent of every other system. It does not require an account at thewhyman.com, and it does not assume any other plugin is installed. It composes optionally with xOS — a premium kernel for advanced reasoning workflows — but neither needs the other to function.

Full design notes: [`docs/PROTOCOL.md`](../../docs/PROTOCOL.md).

## What's not in the open-source tier

Domain-specific applications — career coaching, team campaign engines, family operating systems — live in the xOS premium tier. Co-dialectic itself is the universal conversation layer underneath those products and is fully open-source under AGPL-3.0. You can use, modify, and self-host it. If you ship a derivative as a network service, AGPL requires you to publish your modifications.

## Roadmap

**v3.5.0 (this release)** — hook-callback extension surface, demo-ready packaging. The shipping surface is the marketplace plug-in for IDE / CLI runtimes (Claude Code, Cursor, Cowork). Web users today have a copy-paste path: paste the SKILL.md content as a system prompt on any web AI chat app — codi behaviors operate immediately.

**Beyond v3.5 — user-driven.** Direction is determined by beta-tester signal: installs, retention, friction reports, and feature requests. New surface areas (browser extensions, IDE-specific extensions, etc.) are evaluated when demand justifies the engineering cost. No commitments; no version pins.

**Want to drive the roadmap?** [Open an issue](https://github.com/thewhyman/anand-career-os/issues) with what's missing, what feels rough, what you'd pay for.

## Contributing

Issues and pull requests welcome at [`thewhyman/anand-career-os`](https://github.com/thewhyman/anand-career-os). Reproducible eval harness at [`tests/`](tests/) — run your own corpus through the cascade before deciding whether the reliability claims hold for your domain.

## License and acknowledgements

AGPL-3.0. Built on the Claude Code platform. Indebted to the prompt-engineering, LLM-eval, and AI-safety research communities — particularly the literature on cross-model verification, constitutional AI, and dialectic reasoning.

## Author

**Anand Vallamsetla** — [thewhyman.com](https://thewhyman.com) · [linkedin.com/in/thewhyman](https://linkedin.com/in/thewhyman)

---

**License:** AGPL-3.0. See [LICENSE](../../LICENSE) at the repo root.
