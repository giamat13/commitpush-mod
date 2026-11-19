import { expect, test } from 'claude-code/testing'

test('git commit from the main thread is denied with the ask instructions', async $ => {
  const r = await $.tool.call({ tool: 'Bash', command: 'git commit -am "x"' })
  expect(r.deny ?? '').toContain('do not ask the user')
})

test('git push is denied too', async $ => {
  const r = await $.tool.call({ tool: 'Bash', command: 'git push' })
  expect(r.deny ?? '').toContain('push: true')
})

const engine = (on: any) => on('tool.call', () => ({ result: 'ran' }))

test('the skip marker lets it through', async ($, on) => {
  engine(on)
  const r = await $.tool.call({ tool: 'Bash', command: 'echo git commit # commitpush:skip' })
  expect(r.deny).toBeUndefined()
})

test('other commands pass', async ($, on) => {
  engine(on)
  const r = await $.tool.call({ tool: 'Bash', command: 'echo hi' })
  expect(r.deny).toBeUndefined()
})
