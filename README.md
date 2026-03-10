# Next.js 16 Starter Template

A production-ready Next.js 16 starter with TypeScript 5 strict, React 19, Tailwind CSS v4, Auth.js v5, Zod, Vitest, Playwright, and a full GitHub Copilot AI setup.

## Stack

| Layer           | Choice                           |
| --------------- | -------------------------------- |
| Framework       | Next.js 16.1.6 (App Router)      |
| Runtime         | React 19                         |
| Language        | TypeScript 5 strict mode         |
| Styling         | Tailwind CSS v4                  |
| Auth            | Auth.js v5 (NextAuth)            |
| Validation      | Zod v4                           |
| State           | Zustand v5 (client only)         |
| Unit tests      | Vitest + Testing Library         |
| E2E tests       | Playwright                       |
| Package manager | pnpm                             |
| Git hooks       | Husky + lint-staged + commitlint |

## Project Structure

```
app/                    # Next.js App Router
  api/
    auth/[...nextauth]/ # Auth.js route handler
    health/             # Health check endpoint (edge)
  error.tsx             # Route-level error boundary
  global-error.tsx      # Root error boundary
  globals.css           # Global styles + Tailwind tokens
  layout.tsx            # Root layout (metadata, skip link, viewport)
  loading.tsx           # Accessible global loading spinner
  not-found.tsx         # 404 page
  page.tsx              # Home page
components/
  ui/                   # Reusable UI primitives
    badge.tsx           # Badge (variants: default, success, warning, danger…)
    button.tsx          # Button (variants + sizes + loading state)
    card.tsx            # Card, CardHeader, CardTitle, CardContent, CardFooter
hooks/                  # Client-side React hooks
  use-debounce.ts
  use-local-storage.ts
lib/                    # Shared utilities + configuration
  auth.ts               # getSession(), requireAuth() server helpers
  constants.ts          # APP_NAME, ROUTES, API_ROUTES
  schemas/
    user.schema.ts      # Zod v4 schemas: signIn, signUp, user CRUD
  utils.ts              # cn(), formatDate(), formatCurrency(), truncate()
store/                  # Zustand stores
  use-app-store.ts      # theme + sidebar, persisted to localStorage
tests/                  # Playwright E2E tests
  home.spec.ts
types/
  index.ts              # ApiResponse<T>, PaginatedResponse<T>, Theme, Status…
auth.ts                 # Auth.js v5 config (Google, session callbacks)
proxy.ts                # Route protection + auth redirect
playwright.config.ts
vitest.config.ts
vitest.setup.ts
commitlint.config.ts
lint-staged.config.ts
```

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the values inside `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Generate with: openssl rand -base64 32
AUTH_SECRET=your-secret

# OAuth providers (enable the ones you need)
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

### 3. Start development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                 | Description                            |
| ---------------------- | -------------------------------------- |
| `pnpm dev`             | Start development server               |
| `pnpm build`           | Production build                       |
| `pnpm start`           | Start production server                |
| `pnpm lint`            | ESLint                                 |
| `pnpm type-check`      | TypeScript type check (`tsc --noEmit`) |
| `pnpm test`            | Vitest unit tests                      |
| `pnpm test:watch`      | Vitest in watch mode                   |
| `pnpm test:e2e`        | Playwright E2E (headless)              |
| `pnpm test:e2e:ui`     | Playwright UI mode                     |
| `pnpm test:e2e:headed` | Playwright with visible browser        |
| `pnpm test:all`        | Unit + E2E                             |

## Quality Gates

All must pass before merging:

```bash
pnpm lint          # ESLint — zero errors
pnpm type-check    # TypeScript — zero type errors
pnpm test          # Vitest — all tests green
pnpm build         # Next.js production build
```

Pre-commit hooks run lint-staged + type-check automatically on every commit. Commit messages are enforced with [Conventional Commits](https://www.conventionalcommits.org/).

## Authentication

Auth.js v5 is pre-configured with Google OAuth. Protected routes: `/dashboard`, `/profile`, `/settings`.

```ts
// Server component — get the current session
import { getSession, requireAuth } from "@/lib/auth";

const session = await getSession(); // returns session or null
const session = await requireAuth(); // throws if not authenticated
```

To add another provider, update `auth.ts` and add the corresponding env vars.

---

## GitHub Copilot Setup

This template ships with a full Copilot configuration out of the box.

### What's included

| Feature                                                           | Location                                 |
| ----------------------------------------------------------------- | ---------------------------------------- |
| Project-wide instructions                                         | `.github/copilot-instructions.md`        |
| Per-technology instruction files                                  | `.github/instructions/*.instructions.md` |
| Custom VS Code agents                                             | `.github/agents/*.agent.md`              |
| Reusable prompt files                                             | `.github/prompts/*.prompt.md`            |
| MCP servers (Context7, Playwright, Shadcn, Next Devtools, GitHub) | `.vscode/mcp.json`                       |
| Skills library                                                    | `.agents/skills/`                        |
| Lifecycle hooks                                                   | `.github/hooks/`                         |

### MCP Servers

Configured in `.vscode/mcp.json`. Active servers:

| Server                | What it enables                                                          |
| --------------------- | ------------------------------------------------------------------------ |
| **Context7**          | Up-to-date docs for any npm library, injected into context automatically |
| **Playwright MCP**    | Browser automation and UI debugging directly from chat                   |
| **Shadcn MCP**        | Add and configure shadcn/ui components                                   |
| **Next Devtools MCP** | Next.js-specific diagnostics and upgrades                                |
| **GitHub MCP**        | Create issues, PRs, branches, and read repo data from chat               |

### Custom Agents

Invoke from the VS Code agent panel or mention `@agent-name` in chat:

| Agent             | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `Feature Builder` | Build new features following project conventions     |
| `Test Generator`  | Generate Vitest unit tests and Playwright E2E tests  |
| `Code Reviewer`   | Review code for quality, security, and accessibility |
| `Debug`           | Systematically find and fix bugs                     |
| `Architect`       | Design system architecture with Mermaid diagrams     |
| `Planner`         | Generate implementation plans (read-only)            |
| `ADR Generator`   | Create Architectural Decision Records                |
| `PRD Creator`     | Turn feature ideas into structured PRDs              |
| `GitHub Actions`  | Create secure CI/CD workflows                        |

### Reusable Prompts

Available via `@prompt` in chat or from the prompt file picker:

- `create-component` — scaffold a new Server/Client component
- `create-page` — create a new App Router page
- `create-api-route` — create a Route Handler with Zod validation
- `create-schema` — generate a Zod schema
- `create-store` — create a Zustand store
- `generate-tests` — generate tests for a given file
- `health-check` — run lint + typecheck + tests

---

## GitHub Copilot CLI

Run Copilot directly from your terminal without switching to the IDE.

### Installation

```bash
# Requires GitHub CLI
brew install gh
gh extension install github/gh-copilot
```

### Daily workflow

```bash
# Ask anything in natural language
gh copilot suggest "create a pnpm script to run only changed tests"

# Explain a complex command
gh copilot explain "pnpm type-check"
```

### Slash commands (inside chat)

| Command     | What it does                                  |
| ----------- | --------------------------------------------- |
| `/fix`      | Fix the error or failing test in context      |
| `/test`     | Generate tests for the current file           |
| `/explain`  | Explain what the selected code does           |
| `/doc`      | Generate JSDoc/TSDoc for the current function |
| `/simplify` | Refactor the selection to be more readable    |

### Agentic CLI — handoff with coding agent

You can move work between the cloud coding agent and your local terminal:

```bash
# Pull a cloud coding agent session into your terminal
# (copy the command from "Continue in Copilot CLI" in the Agents panel on GitHub)
gh copilot session resume <session-id>

# Push current work back to the cloud agent and keep going locally
# Press & inside the CLI session
```

---

## Copilot Coding Agent — WRAP

See [AGENTS.md](./AGENTS.md) for the full WRAP methodology and best practices for delegating tasks to the coding agent.

**Quick reference:**

1. **W**rite a clear, atomic GitHub issue with examples
2. **R**efine `.github/copilot-instructions.md` to encode your conventions
3. **A**tomic tasks — each issue → one reviewable PR
4. **P**air — you handle the why and cross-system thinking; the agent handles execution

Assign an issue to the coding agent by setting **Copilot** as the assignee, or from the Agents panel on github.com.

---

## Using this template without GitHub Copilot

The following files are GitHub Copilot CLI / VS Code Copilot artifacts. They are committed intentionally so the whole team benefits from shared AI context, but they are **optional** — the app runs fine without them:

| File / folder                     | Purpose                                           | Safe to delete? |
| --------------------------------- | ------------------------------------------------- | --------------- |
| `.github/copilot-instructions.md` | Project-wide Copilot instructions                 | Yes             |
| `.github/instructions/`           | Per-directory instruction files                   | Yes             |
| `.github/agents/`                 | Custom Copilot agent definitions                  | Yes             |
| `.github/hooks/`                  | Agent lifecycle hooks (PostToolUse, etc.)         | Yes             |
| `.agents/skills/`                 | Reusable Copilot skill library                    | Yes             |
| `skills-lock.json`                | Skill version lock file                           | Yes             |
| `AGENTS.md`                       | Task-execution guide for AI coding agents         | Yes             |
| `CLAUDE.md`                       | Extended thinking context for Claude-based agents | Yes             |
| `.vscode/mcp.json`                | MCP server configuration for VS Code              | Yes             |

If you are forking this template for a non-Copilot open-source project, you can safely remove all of the above. The application code, tests, and quality gates are entirely independent of these files.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.
