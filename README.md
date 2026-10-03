# SparkCircles

A mobile app that lightens parents' mental load and gives children a joyful universe. It combines four modules: Events, Community (with the shared routine), Market and Travel.

## How this repo is built

The app is built by Claude Code with five specialized subagents, one feature at a time. The PM approves each handoff:

```
PM idea → po → designer → developer → qa → PM merges → marketing
```

| Agent | Role | Writes to |
|---|---|---|
| `po` | Spec, user stories, acceptance criteria | `docs/specs/<feature>.md` |
| `designer` | User path, screens, states, HTML mockups | `docs/design/<feature>.md`, `docs/design/mockups/` |
| `developer` | API contract, Rails API, Expo app, tests, feature branch and PR | `docs/api/<feature>.md`, `api/`, `mobile/` |
| `qa` | Test report with PASS/FAIL verdict | `docs/qa/<feature>.md` |
| `marketing` | Release announcements and social posts (FR + EN) | `docs/marketing/` |

Project rules for every agent are in [CLAUDE.md](CLAUDE.md). Agent definitions are in [.claude/agents/](.claude/agents/).

## Repository layout

| Path | Contents |
|---|---|
| `api/` | Backend: Ruby on Rails 8.1, API-only, PostgreSQL, RSpec. See [api/README.md](api/README.md) |
| `mobile/` | App: React Native with Expo SDK 57, TypeScript, Expo Router, NativeWind, Jest. How to run it on an iPhone: [mobile/README.md](mobile/README.md) |
| `CLAUDE.md` | Product context, workflow, tech stack, non-negotiables, git rules |
| `.claude/agents/` | The five subagent definitions |
| `docs/SparkCircles_Design_System_EN.md` | Design system v1.4.1, the source of truth for all UI |
| `docs/specs/`, `docs/design/`, `docs/api/`, `docs/qa/`, `docs/marketing/` | Handoff files between agents, named after the feature slug |
| `docs/mobile/` | Mobile setup proposal and decisions |
| `.github/workflows/` | CI: `api.yml` for `api/**`, `mobile.yml` for `mobile/**` |

## Getting started

Open this folder in Claude Code and describe a feature, for example: "Use the po agent to spec swapping a shared-routine turn."
