import type { Register } from 'claude-code'

const BASE =
  'You commit work in the current git repository. You have no prior context: inspect with `git status` and `git diff` (staged and unstaged). ' +
  'Stage the relevant changes (`git add -A` unless something looks like a secret or junk), write one concise conventional commit message from the diff, and commit. ' +
  'Never create branches, never amend, never force, never skip hooks. If there is nothing to commit, say so and stop. ' +
  'End with one short line: the commit hash and message.'
const PUSH = ' After committing, run `git push` (set upstream with `git push -u origin HEAD` if none). Report the push result in the final line.'

const waiting = new Map<string, (s: string) => void>()
const done = new Map<string, string>()

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.agent.register({
      name: 'committer',
      description: 'Commits (and optionally pushes) git changes with no prior context.',
      prompt: BASE,
      tools: ['Bash'],
      model: 'claude-haiku-5-5',
      effort: 'low',
      omitClaudeMd: true,
    })
    await $.command.register({ name: 'commit', description: 'Commit changes (Haiku 5.5, low effort, no context)' })
    await $.command.register({ name: 'commitpush', description: 'Commit and push changes (Haiku 5.5, low effort, no context)' })
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId) {
      const r = waiting.get(e.agentId)
      if (r) { waiting.delete(e.agentId); r(e.answer) } else done.set(e.agentId, e.answer)
    }
    return next(e)
  })

  for (const name of ['commit', 'commitpush']) {
    on('command.run', { command: name }, async ($, e) => {
      const push = name === 'commitpush'
      const prompt =
        (push ? 'Commit and push all current changes.' : 'Commit all current changes. Do NOT push.') +
        (push ? PUSH : '') + (e.args ? ` Hint from the user: ${e.args}` : '')
      const { agentId, deny } = await $.agent.spawn({ subagentType: 'commitpush:committer', prompt, description: name })
      if (deny || !agentId) return { text: `${name} refused: ${deny ?? 'no agent'}` }
      const answer = done.has(agentId)
        ? done.get(agentId)!
        : await new Promise<string>((res) => waiting.set(agentId, res))
      done.delete(agentId)
      return { text: answer || '(no output)' }
    })
  }
}
