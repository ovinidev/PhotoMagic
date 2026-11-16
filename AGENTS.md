# AGENTS.md

The agent guide for this repo is [CLAUDE.md](CLAUDE.md). Read it first; it is the source of truth for stack, commands, folders and rules.

## Session rule

- Each new task = a new PR = a new, clean Claude Code session.
- When a session reaches 45% of its context, run `/compact`.
- Never keep a long session that rereads the whole history on every step (it drains the shared usage limit).
