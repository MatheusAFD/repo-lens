# RepoLens

An AI-powered repository analyzer that gives you a comprehensive health report of any codebase — powered by the Claude API.

Paste a GitHub repo URL or connect your GitHub account to select from your repositories. RepoLens analyzes the code, dependencies, architecture, and security posture, then streams a structured report in real time — designed to be readable by both developers and non-technical users.

## What it analyzes

- **Executive Summary** — plain-language overview of what the project does
- **Tech Stack** — languages, frameworks, databases, cloud, and testing tools detected
- **Architecture** — patterns, key observations, structural notes
- **Security** — OWASP Top 10 findings, overall grade (A–F), and positives
- **Dependencies** — health status by ecosystem, vulnerable/outdated packages highlighted
- **Update Plan** — critical, major, and minor updates grouped by priority with gains explained
- **Recommendations** — top 7 next actions ordered by impact

## Stack

| App / Package | Tech |
|---|---|
| **Portal** (`apps/portal`) | TanStack Start, React 19, TanStack Query |
| **API** (`apps/api`) | NestJS 11, Drizzle ORM, PostgreSQL |
| **UI** (`packages/ui`) | Shadcn/UI + Radix UI, Tailwind CSS v4 |
| **Auth** (`packages/auth`) | Better Auth (GitHub OAuth) |
| **Shared** (`packages/shared`) | TypeScript — types & utilities |

**Tooling:** Turborepo · pnpm · Biome · Husky · TypeScript 5

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (PostgreSQL)
cd apps/api && docker-compose up -d && cd ../..

# 3. Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/portal/.env.example apps/portal/.env
# Fill in: ANTHROPIC_API_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

# 4. Run database migrations
pnpm --filter @repo/api db:migrate

# 5. Start all apps in dev mode
pnpm dev
```

| Service | URL |
|---|---|
| RepoLens | http://localhost:3000 |
| API | http://localhost:4000 |

## Environment Variables

### `apps/api/.env`

```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mono_repo_auth
BETTER_AUTH_SECRET=your-super-secret-key-change-in-production-min-32-chars
BETTER_AUTH_URL=http://localhost:4000
ALLOWED_ORIGINS=http://localhost:3000

# AI Analysis
ANTHROPIC_API_KEY=sk-ant-...

# GitHub OAuth (create at github.com/settings/applications/new)
# Callback URL: http://localhost:4000/api/auth/callback/github
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

### `apps/portal/.env`

```env
VITE_API_URL=http://localhost:4000
```

## GitHub OAuth Setup

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → New OAuth App
2. Set **Homepage URL**: `http://localhost:3000`
3. Set **Authorization callback URL**: `http://localhost:4000/api/auth/callback/github`
4. Copy the Client ID and Client Secret into `apps/api/.env`

## Privacy & Security

- Your `ANTHROPIC_API_KEY` stays on the server — never exposed to the browser
- GitHub OAuth tokens are encrypted by Better Auth — never stored in plain text
- No sensitive credentials are persisted in the database
- This app is designed to run **locally only**

## Project Structure

```
├── apps/
│   ├── portal/            # RepoLens UI (port 3000)
│   └── api/               # REST API + auth server (port 4000)
├── packages/
│   ├── ui/                # Shared component library
│   ├── auth/              # Better Auth client config
│   ├── shared/            # Shared types & utilities
│   └── typescript-config/ # Base tsconfig presets
├── turbo.json
├── biome.json
└── pnpm-workspace.yaml
```

## Scripts

```bash
pnpm dev                # Start all apps
pnpm build              # Production build
pnpm typecheck          # Type-check everything
pnpm lint               # Lint all packages
pnpm format             # Format with Biome
```

## Git Hooks

Managed by **Husky**:

| Hook | What it does |
|---|---|
| `pre-commit` | Auto-fixes formatting and lint issues, then re-stages files |
| `commit-msg` | Enforces [Conventional Commits](https://www.conventionalcommits.org/) |
| `pre-push` | Runs full build — blocks push on failure |
