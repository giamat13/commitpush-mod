import type { Register } from 'claude-code'

const BASE =
  'You commit work in the current git repository. You have no prior context: inspect with `git status` and `git diff` (staged and unstaged). ' +
  'Stage the relevant changes (`git add -A` unless something looks like a secret or junk), write one concise conventional commit message from the diff, and commit. ' +
  'Never create branches, never amend, never force, never skip hooks. If there is nothing to commit, say so and stop. ' +
  'End with one short line: the commit hash and message.'
const PUSH = ' After committing, run `git push` (set upstream with `git push -u origin HEAD` if none). Report the push result in the final line.'

const names = new Map<string, string>()

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.agent.register({
      name: 'committer',
      description: 'Commits (and optionally pushes) git changes, with no prior context.',
      prompt: BASE + '',
      tools: ['Bash'],
      model: 'claude-haiku-5-5',
      effort: 'low',
      omitClaudeMd: true,
    })
    await $.command.register({ name: 'commit', description: 'Commit changes (Haiku 5.5, low effort, no context)' })
    await $.command.register({ name: 'commitpush', description: 'Commit and push changes (Haiku 5.5, low effort, no context)' })
    await $.tool.register({
      name: 'commit',
      description:
        'Commit (and optionally push) all current git changes on a cheap context-free Haiku subagent. ' +
        'Prefer this over running git commit / git push yourself. The result arrives later as a notice.',
      inputSchema: {
        type: 'object',
        properties: {
          push: { type: 'boolean', description: 'Also push after committing.' },
          hint: { type: 'string', description: 'Optional hint for the commit message.' },
        },
      },
      isDeferred: false,
    })
    return next(e)
  })

  // Model-callable version of /commit and /commitpush.
  on('tool.run', { tool: 'mcp__commitpush__commit' }, async ($, e) => {
    const input = e as { push?: boolean; hint?: string }
    const name = input.push ? 'commitpush' : 'commit'
    return { result: await start($, name, input.hint) }
  })

  // When Claude runs git commit/push itself, make it ask the user first.
  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    const cmd = String((e as { command?: unknown }).command ?? '')
    if (e.agentId && names.has(e.agentId)) return next(e) // our committer
    if (!/\bgit\s+(commit|push)\b/.test(cmd) || cmd.includes(SKIP)) return next(e)
    return {
      deny:
        'Before committing or pushing yourself, ask the user with AskUserQuestion: ' +
        '"Use the commitpush plugin (cheap Haiku subagent) to commit' + (/\bpush\b/.test(cmd) ? ' and push' : '') + '?" ' +
        'with options "Yes (Recommended)" and "No, commit directly". ' +
        'On yes: call mcp__commitpush__commit (push: true if pushing). ' +
        `On no: rerun the same command with the comment \`${SKIP}\` appended.`,
    }
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId && names.has(e.agentId)) {
      const n = names.get(e.agentId)
      names.delete(e.agentId)
      $.ui.toast(`/${n}: ${e.answer || '(no output)'}`)
    }
    return next(e)
  })

  for (const name of ['commit', 'commitpush']) {
    on('command.run', { command: name }, async ($, e) => ({ text: await start($, name, e.args) }))
  }
}

const SKIP = '# commitpush:skip'

async function start($: any, name: string, hint?: string): Promise<string> {
  const push = name === 'commitpush'
  const prompt =
    (push ? 'Commit and push all current changes.' : 'Commit all current changes. Do NOT push.') +
    (push ? PUSH : '') + (hint ? ` Hint from the user: ${hint}` : '')
  const { agentId, deny } = await $.agent.spawn({ subagentType: 'commitpush:committer', prompt, description: name })
  if (deny || !agentId) return `${name} refused: ${deny ?? 'no agent'}`
  names.set(agentId, name)
  return `/${name} started on Haiku 5.5 (low effort); the result will appear as a notice.`
}
