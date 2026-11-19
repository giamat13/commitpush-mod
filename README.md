# commitpush

A Claude Code mod that adds two slash commands. Each runs a fresh subagent with no conversation context, on Haiku 5.5 at low effort.

- `/commit [hint]` stages and commits the current changes.
- `/commitpush [hint]` does the same, then pushes.

The subagent never creates branches, amends, force-pushes or skips hooks.

## Install

```
/plugin marketplace add GIAMAT13/commitpush-mod
/plugin install commitpush@commitpush-mod
```

## Files

- `.claude-plugin/plugin.json`: manifest
- `.claude-plugin/marketplace.json`: marketplace listing
- `hooks/register.ts`: registers the `committer` agent and the two commands

## License

MIT
