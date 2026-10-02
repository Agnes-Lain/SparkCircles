# SparkCircles

Mobile app that reduces the mental load of parents and gives their children a joyful universe. It combines four modules:

1. **Events**: search, create, join and get recommended outings and activities.
2. **Community**: small groups of nearby families with shared services, starting with the **shared routine** (recurring tasks such as school pick-ups, with turn-taking).
3. **Market**: verified marketplace for childcare and family services.
4. **Travel**: vacation house exchange between verified families.

Survey insight (80 parents): socializing/organizing events is pain point #1, vacations #2, daily routine and childcare #3.

## People and roles

- **The user is the Product Manager (PM).** The PM decides priorities and approves every handoff. Never skip an approval.
- Five subagents live in `.claude/agents/`: `po`, `designer`, `developer`, `qa`, `marketing`.
- Reply to the PM in the language they write in (French or English). Write files in English.

## Source of truth

- Design: `docs/SPARKCIRCLES_Design_System_EN.md` (v1.4). Read it before any design or UI work. If something is missing or contradictory, **flag it, don't invent it**.
- Backlog of deferred work: `docs/backlog.md` (maintained by `po`; the PM decides what moves into a spec)
- Specs: `docs/specs/<feature>.md`
- Design deliverables: `docs/design/<feature>.md` and `docs/design/mockups/`
- Validated "Today" dashboard mockup (reference for v1.2): `docs/design/canvas/Variant.dc.html`. `Main.dc.html` is the earlier palette, kept for history; `Nav.dc.html` shows each tab active. Canvas files are exports from the Claude design canvas and don't render standalone. Read them as markup, don't edit them.
- API contracts: `docs/api/<feature>.md`
- QA reports: `docs/qa/<feature>.md`
- Marketing drafts (French + English): `docs/marketing/` (release announcements, social posts, newsletters)

## Workflow (one feature at a time)

```
PM idea → po (spec) → PM approves → designer (flow + mockups) → PM approves
        → developer (code + PR) → qa (test report) → PM reviews PR and merges
        → marketing (release announcement + social posts, FR + EN) → PM approves and publishes
```

The `marketing` agent can also be called at any time for promotion content that isn't tied to a release. It only communicates features that are merged and QA-validated, and it never publishes anything itself.

Agents cannot see each other's work in progress. **Handoffs happen through the files above**: each agent reads the previous agent's file and writes its own. Name every file after the feature slug (e.g. `shared-routine-swap`).

## Tech stack

Monorepo with two apps. The PM knows Ruby on Rails well: keep backend code idiomatic and conventional Rails.

**`api/`: backend, Ruby on Rails 8 in API-only mode** (`rails new api --api`)
- PostgreSQL
- JSON REST endpoints versioned under `/api/v1`
- Token authentication for the mobile app (the exact approach is proposed to the PM at setup)
- All business rules, permissions and verification checks live here, never only in the app
- RSpec (request and model specs) + FactoryBot, RuboCop (`rubocop-rails-omakase`)

**`mobile/`: app, React Native with Expo, TypeScript**
- NativeWind (Tailwind tokens from section 15 of the design system)
- Lucide icons, line style, stroke 1.8
- Calls the API only through a typed client in `mobile/src/api/`. The base URL comes from `EXPO_PUBLIC_API_URL`.
- Jest + React Native Testing Library for unit/component tests

**API contract**: every feature that touches the backend gets `docs/api/<feature>.md`, listing endpoints, params, JSON responses, error codes and auth. The developer writes it before coding, and the Rails request specs and the mobile client both follow it.

Confirm the setup (Ruby/Rails versions, auth approach, Expo template) with the PM before the first build.

## Non-negotiables

- Follow the design system tokens exactly. No hard-coded hex values in components, use the Tailwind tokens.
- Accessibility: text contrast ≥ 4.5:1, touch targets ≥ 44px, visible labels, `aria-label` on icon-only controls, respect reduced motion.
- Reducing mental load beats adding options. One primary action per screen.
- Tone of voice: warm, efficient, reassuring. Sentence case. No "please", no "successfully".
- Verification status is always visible before the call to action on anything involving strangers, homes or children.

## Git rules

- Never push to `main`. One branch per feature: `feat/<feature-slug>`. One PR per feature, covering both `api/` and `mobile/` when the feature touches both.
- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`).
- PR description links to the spec and the design file and lists the acceptance criteria covered.
- Use the GitHub CLI (`gh`) for PRs and issues.

## Definition of done

A feature is done when: spec approved, design approved, API contract written (if the feature has a backend part), all acceptance criteria implemented, RSpec and Jest suites pass, QA report says PASS, and the PM merged the PR.
