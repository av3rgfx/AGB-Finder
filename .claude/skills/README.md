# Installed Skills

Claude Code skills vendored into this repository. Each subdirectory is an
independent skill (`SKILL.md` + supporting files) and is auto-discovered by
Claude Code when working in this repo.

## Sources

| Skill(s) | Source | Version | License |
|----------|--------|---------|---------|
| `brainstorming`, `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, `using-superpowers`, `verification-before-completion`, `writing-plans`, `writing-skills` | [obra/Superpowers](https://github.com/obra/Superpowers) | 6.1.0 | MIT |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 3.8.0 | Apache-2.0 |
| `llm-council` | adapted from [karpathy/llm-council](https://github.com/karpathy/llm-council) | — | MIT |

The companion agent for `impeccable` lives at
`.claude/agents/impeccable-manual-edit-applier.md`.

The `llm-council` skill is **not a vendored copy** — `karpathy/llm-council` is a
standalone FastAPI + React web app, not a skill. It was converted into a Claude
Code skill that runs the same 3-stage council deliberation (independent opinions
→ anonymized peer ranking → chairman synthesis) either via Claude subagents (no
setup) or via real multi-provider models through OpenRouter
(`scripts/council.mjs`). The original stage prompts are reproduced verbatim.

## Notes

- These are vendored copies. To update, re-pull from the upstream repos
  (Superpowers ships as a Claude Code plugin/marketplace; impeccable ships via
  `npx impeccable install`).
- **Optional automatic hooks were intentionally *not* installed.** impeccable
  upstream ships a `PostToolUse` design-detector hook, and Superpowers ships a
  `SessionStart` announce hook. Both modify `.claude/settings.json` and add
  automatic behavior on every edit/session. The skills work without them via
  normal skill discovery; enable the hooks from the upstream repos if you want
  that behavior.
- `karpathy/llm-council` is **not** a Claude Code skill upstream (it's a
  standalone web app). Rather than skip it, its methodology was reimplemented as
  the `llm-council` skill above.
