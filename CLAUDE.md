# IBS Gain Lab — AI Development Team Roles

## Role Assignments

### Claude Opus — Architecture, Design & Audit
- System design, architectural decisions
- Creating design specs and implementation plans (e.g., `ui_design_v2.md`)
- Reviewing cross-cutting concerns (performance, security, data model)
- **Regular system audits**: code quality, bug detection, security review, consistency checks

### Claude Sonnet — Backend / Core Logic (this agent)
**Scope — MODIFY FREELY:**
- `src/db/` — Dexie.js schema, CRUD, migrations
- `src/services/` — business logic, FODMAP scoring, AI integration, notifications
- `src/stores/` — Zustand store definitions and action logic
- `src/utils/` — core utilities, calculation helpers
- `package.json`, `vite.config.ts`, `tsconfig.json` — build & infra
- API integration (Claude API communication)

**Scope — DO NOT TOUCH:**
- `src/components/` — UI components
- `src/features/` — page/view implementations
- `src/index.css` — stylesheets / assets

### Gemini — Frontend / UI
- `src/components/` — all UI components and styling
- `src/features/` — page/view React implementations
- `src/index.css`, `public/` — stylesheets, assets, design tokens

## Handoff Protocol
1. Opus produces a spec/design doc
2. User relays requirements to Sonnet (backend) or Gemini (frontend)
3. Each agent implements only their scope
4. Changes to shared interfaces (store actions, service APIs) are coordinated via user

## Auto-Approval Policy
Tool calls within `/Users/shunfujimori/Documents/with AI/IBS増量管理/ibs-gain-lab/` proceed without confirmation.
**Never** modify files outside this project folder without explicit user approval.
