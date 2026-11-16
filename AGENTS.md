# AGENTS.md

The agent guide for this repo is [CLAUDE.md](CLAUDE.md). Read it first; it is the source of truth for stack, commands, folders and rules.

## Session rule

- Each new task = a new PR = a new, clean Claude Code session.
- Start every session with a short plan that names the files it will touch and its done criteria.
- Sonnet is the default model. Use Opus (medium effort) only for a genuinely hard bug, and say why in the PR.
- Launch headless sessions with `claude -p --max-turns 25`. If a task hits the cap, end the session and continue in a fresh one with a short written handoff: what's done, what's left, which files.
- Auto-compact runs at 30% of context. Never keep a long session that rereads the whole history on every step (it drains the shared usage limit).
- While iterating, run only the affected unit test or spec (`pnpm vitest run <files> --reporter=dot`, `pnpm playwright test <specs> --reporter=dot`). Run the full Playwright E2E at most once, at the end, with `--reporter=line`, and show only failures. The pre-push hook runs the full suite.
