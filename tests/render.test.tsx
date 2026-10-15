import { expect, test } from 'claude-code/testing'

const usage = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const composer = { kind: 'composer' } as const
// The desktop app runs Claude Code as an SDK host: nobody at a terminal prompt, and its messages stamped `sdk`.
const sdk = { kind: 'sdk' } as const
const desktopSession = { cwd: '/', surface: null, isInteractive: false }

/** The ✎ work runs after the submit settles: give it time to finish (the test runtime has timers; the mod types do not declare them). */
const timers = globalThis as unknown as { setTimeout: (done: () => void, ms: number) => void }
const settle = () => new Promise<void>(resolve => timers.setTimeout(resolve, 50))

test('a message sent in another language gets its English once, as a gray ✎ line under it', async ($, on) => {
  on('model.complete', async () => ({ value: { isAnswered: true, text: 'Check why the export test fails on CI', usage } }))
  // The engine beneath: the message goes in as sent.
  on('prompt.submit', async ($, e) => ({ text: e.text }))
  on('ui.render', { component: 'UserMessage' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  const text = 'перевір чому тест експорту падає на CI'
  await $.prompt.submit({ text, wait: false, origin: composer })
  await settle()
  const sent = await $.ui.mount({ plugin: 'cc-grammar', surface: 'terminal', component: 'UserMessage', props: { text, origin: composer, isExpanded: false } })
  expect(await sent.find({ text: '✎ Check why the export test fails on CI' })).not.toBe(undefined)
  const other = await $.ui.mount({ plugin: 'cc-grammar', surface: 'terminal', component: 'UserMessage', props: { text: 'a message nobody checked', origin: composer, isExpanded: false } })
  expect(await other.find({ text: /✎/ })).toBe(undefined)
})

test('a message sent in the desktop app gets its ✎ line there', async ($, on) => {
  on('model.complete', async () => ({ value: { isAnswered: true, text: 'Check why the export test fails on CI', usage } }))
  on('session.start', async ($, e) => ({ cwd: e.cwd }))
  on('session.surfaces', async () => ({ value: ['desktop'] }))
  on('prompt.submit', async ($, e) => ({ text: e.text }))
  on('ui.render', { component: 'UserMessage' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  await $.session.start(desktopSession)
  const text = 'перевір чому тест експорту падає на CI'
  await $.prompt.submit({ text, wait: false, origin: sdk })
  await settle()
  const sent = await $.ui.mount({ plugin: 'cc-grammar', surface: 'desktop', component: 'UserMessage', props: { text, origin: sdk, isExpanded: false } })
  expect(await sent.find({ text: '✎ Check why the export test fails on CI' })).not.toBe(undefined)
})

test('a -p run, which nothing draws, sends nothing to Haiku', async ($, on) => {
  const asked: string[] = []
  on('model.complete', async () => {
    asked.push('haiku')
    return { value: { isAnswered: true, text: 'Check why the export test fails on CI', usage } }
  })
  on('session.start', async ($, e) => ({ cwd: e.cwd }))
  on('session.surfaces', async () => ({ value: [] }))
  on('prompt.submit', async ($, e) => ({ text: e.text }))
  await $.session.start(desktopSession)
  await $.prompt.submit({ text: 'перевір чому тест експорту падає на CI', wait: false, origin: sdk })
  await settle()
  expect(asked).toEqual([])
})

test('the ✎ check reads the message as the box showed it: a long paste is its placeholder, never its lines', async ($, on) => {
  const asked: string[] = []
  on('model.complete', async ($, e) => {
    asked.push((e as unknown as { prompt: string }).prompt)
    return { value: { isAnswered: true, text: '"this test fail" -> "this test fails" [agreement]', usage } }
  })
  on('prompt.edit', async ($, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })
  on('prompt.submit', async ($, e) => ({ text: e.text }))
  // The kit dispatches the composer's own edit event; its typings leave it out.
  const box = $.prompt as unknown as { edit: (e: object) => Promise<unknown> }
  const typed = '[Pasted text #1 +8 lines] why this test fail on CI'
  await box.edit({ origin: composer, text: '', cursor: 0, start: 0, end: 0, inputText: typed })
  // The message arrives with the paste expanded.
  await $.prompt.submit({ text: '<pasted_content id="1">\nline 1: tests was failing\n</pasted_content> why this test fail on CI', wait: false, origin: composer })
  await settle()
  expect(asked.length).toBe(1)
  expect(asked[0]).toContain('[Pasted text #1 +8 lines] why this test fail on CI')
  expect(asked[0]).not.toContain('tests was failing')
})

test('a message the box took with no edit, such as one recalled from history, is checked as sent', async ($, on) => {
  const asked: string[] = []
  on('model.complete', async ($, e) => {
    asked.push((e as unknown as { prompt: string }).prompt)
    return { value: { isAnswered: true, text: 'Check why the export test fails on CI', usage } }
  })
  on('prompt.edit', async ($, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })
  on('prompt.submit', async ($, e) => ({ text: e.text }))
  const box = $.prompt as unknown as { edit: (e: object) => Promise<unknown> }
  await box.edit({ origin: composer, text: '', cursor: 0, start: 0, end: 0, inputText: 'he go to eat a apple after the build' })
  // The box now holds an earlier message from history, which no edit brought: the mod never saw it.
  const sent = 'перевір чому тест експорту падає на CI'
  await $.prompt.submit({ text: sent, wait: false, origin: composer })
  await settle()
  expect(asked.length).toBe(1)
  expect(asked[0]).toContain(sent)
})

test('English with mistakes gets up to three corrections with their rule names', async ($, on) => {
  on('model.complete', async () => ({ value: { isAnswered: true, text: '"he go" -> "he goes" [agreement]\n"a apple" -> "an apple" [article]', usage } }))
  // The engine beneath: the message goes in as sent.
  on('prompt.submit', async ($, e) => ({ text: e.text }))
  on('ui.render', { component: 'UserMessage' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  const text = 'he go to eat a apple after the build'
  await $.prompt.submit({ text, wait: false, origin: composer })
  await settle()
  const sent = await $.ui.mount({ plugin: 'cc-grammar', surface: 'terminal', component: 'UserMessage', props: { text, origin: composer, isExpanded: false } })
  expect(await sent.find({ text: '✎ he go → he goes (agreement) · a apple → an apple (article)' })).not.toBe(undefined)
})
