import { expect, test } from 'claude-code/testing'

const composer = { kind: 'composer' } as const
const presentation = { isFullscreen: true, columns: 120 }
const timers = globalThis as unknown as { setTimeout: (done: () => void, ms: number) => void }
const settle = () => new Promise<void>(resolve => timers.setTimeout(resolve, 50))

test('in an empty box the key takes Claude Code\'s own suggestion, until the next message is sent', async ($, on) => {
  const filled: string[] = []
  on('prompt.suggest', async () => ({ isShown: true }))
  on('prompt.read', async () => ({ value: { text: '', cursor: 0 } }))
  on('prompt.fill', async ($, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  on('prompt.submit', async ($, e) => ({ text: e.text }))
  const press = async () => {
    await $.command.run({ command: 'english', args: '', origin: composer, presentation })
    await settle()
  }
  await $.prompt.suggest({ text: 'Run the export tests', origin: { kind: 'suggestion' } })
  await press()
  expect(filled).toEqual(['Run the export tests'])
  // Typed over and deleted, the box shows the suggestion again: the key takes it again.
  await press()
  expect(filled).toEqual(['Run the export tests', 'Run the export tests'])
  // A message sent ends it.
  await $.prompt.submit({ text: 'ok', wait: false, origin: composer })
  await press()
  expect(filled.length).toBe(2)
})

test('in shell mode the key leaves the box alone', async ($, on) => {
  const filled: string[] = []
  const asked: string[] = []
  on('prompt.read', async () => ({ value: { text: 'git commit -m "виправ тест експорту"', cursor: 35 } }))
  on('prompt.fill', async ($, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  on('model.complete', async () => {
    asked.push('haiku')
    return { value: { isAnswered: false, reason: 'empty-reply', usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }
  })
  on('ui.render', { component: 'PromptHint' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.hint}</Text>
  })
  await $.ui.mount({ plugin: 'cc-grammar', surface: 'terminal', component: 'PromptHint', props: { isDraft: true, isWorking: false, hint: '! for shell mode' } })
  await $.command.run({ command: 'english', args: '', origin: composer, presentation })
  await settle()
  expect(filled).toEqual([])
  expect(asked).toEqual([])
  // Back in prompt mode, the same key asks for the English again.
  await $.ui.mount({ plugin: 'cc-grammar', surface: 'terminal', component: 'PromptHint', props: { isDraft: true, isWorking: false, hint: '(shift+tab to cycle)' } })
  await $.command.run({ command: 'english', args: '', origin: composer, presentation })
  await settle()
  expect(asked).toEqual(['haiku'])
})
