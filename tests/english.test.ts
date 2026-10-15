import { expect, test } from 'claude-code/testing'
import {
  afterNeed,
  clean,
  faithful,
  isSentAs,
  keepTokens,
  needOf,
  ownRuns,
  pairsSystem,
  parsePairs,
  parseSegments,
  rebuild,
  samish,
  segmentPrompt,
  typingToken,
} from '../hooks/english'

test('words of another language are translated, English is corrected, a go or a digit is left alone', async () => {
  expect(needOf('зроби експорт замовлень у CSV тільки для адмінів')).toBe('translate')
  expect(needOf('haz la exportación de pedidos en CSV')).toBe('translate')
  expect(needOf('pls write me five sentence about csv')).toBe('fix')
  expect(needOf('go 2')).toBe(null)
  expect(needOf('го')).toBe(null)
  expect(needOf('2')).toBe(null)
  expect(needOf('all as you recommend')).toBe(null)
  expect(needOf('/clear the screen now')).toBe(null)
  expect(needOf('two words')).toBe(null)
  expect(needOf('> Plan: cache the report for an hour\nтак')).toBe(null)
  expect(needOf('please ask José to review the export tests')).toBe('fix')
  expect(needOf('перевір test експорту на CI')).toBe('translate')
})

test('the gray text waits for a short draft with no paste; the key takes any of your words', async () => {
  const long = 'перевір ' + 'дуже довгий опис проблеми '.repeat(20)
  expect(needOf(long)).toBe(null)
  expect(needOf(long, true)).toBe('translate')
  expect(needOf(long, false, 2000)).toBe('translate')
  expect(needOf('[Pasted text #1 +12 lines] перевір чому падає')).toBe(null)
  expect(needOf('[Pasted text #1 +12 lines] перевір чому падає', true)).toBe('translate')
  expect(needOf('перевір тест')).toBe(null)
  expect(needOf('перевір тест', true)).toBe('translate')
  expect(needOf('[Pasted text #1 +12 lines]', true)).toBe(null)
  expect(needOf('go 2', true)).toBe(null)
})

test('a mention or path at the end is a finished one unless the cursor is still in it', async () => {
  expect(needOf('перевір чому падає тест у @src/export.test.ts', true)).toBe('translate')
  expect(afterNeed('pls check why this test fail in @tests/export.test.ts')).toBe('fix')
  expect(typingToken('подивись на файл @', 18)).toBe(true)
  expect(typingToken('подивись на файл @src/exp', 25)).toBe(true)
  expect(typingToken('подивись на файл @src/export.ts і скажи', 39)).toBe(false)
  expect(typingToken('подивись на файл @src/exp', 8)).toBe(false)
})

test('after Enter: corrections for English of any length, the English only for a short message in another language', async () => {
  const longEn = 'please check why the export test fail on CI but pass locally, ' + 'and look at the runner time zone too '.repeat(8)
  const longUk = 'перевір чому тест експорту падає на CI ' + 'і подивись на часовий пояс раннера '.repeat(8)
  expect(longEn.length > 280 && longUk.length > 280).toBe(true)
  expect(afterNeed(longEn)).toBe('fix')
  expect(afterNeed(longUk)).toBe(null)
  expect(afterNeed(longUk, 2000)).toBe('translate')
  expect(afterNeed('перевір чому падає тест експорту')).toBe('translate')
  expect(afterNeed('так, далі')).toBe(null)
  expect(afterNeed('go 2')).toBe(null)
})

test('code, paths, numbers, capitals and a go survive, or the English is not shown', async () => {
  const draft = 'перевір `formatDate` у src/export.ts, рядок 42, і запусти CI перед go 1'
  expect(keepTokens(draft)).toEqual(expect.arrayContaining(['`formatDate`', 'src/export.ts', '42', 'CI', 'go 1']))
  expect(faithful(draft, 'check `formatDate` in src/export.ts, line 42, and run CI before go 1')).toBe(true)
  expect(faithful(draft, 'check formatDate in the export file, line 42, and run CI before go 1')).toBe(false)
  expect(faithful('перевір тест експорту', 'перевір тест експорту')).toBe(false)
  expect(faithful('перевір тест у Цюриху', 'check the test in Zürich')).toBe(true)
  expect(faithful('коротко', 'x'.repeat(200))).toBe(false)
})

test('mentions and quoted literals stay as written; an English cut short is not shown', async () => {
  expect(faithful('додай @notes.md і @src/export.ts до контексту', 'add notes.md and src/export.ts to the context')).toBe(false)
  expect(faithful('додай @notes.md і @src/export.ts до контексту', 'add @notes.md and @src/export.ts to the context')).toBe(true)
  const label = 'заміни напис "Зберегти" на "Підтвердити" у кнопці експорту'
  expect(faithful(label, 'replace the label "Save" with "Confirm" on the export button')).toBe(false)
  expect(faithful(label, 'replace the label "Зберегти" with "Підтвердити" on the export button')).toBe(true)
  const long = 'перевір чому падає тест експорту на CI і подивись на часовий пояс раннера та формат дати у назві файлу'
  expect(faithful(long, 'Check why the export test')).toBe(false)
})

test('model text is cleaned, near-equal English is no change, and corrections are read', async () => {
  expect(clean('<text>\n"Check the export."\n</text>')).toBe('Check the export.')
  expect(clean('ok\x1b[31m red\x1b[0m​')).toBe('ok red')
  expect(samish('Check the export test.', 'check the export test')).toBe(true)
  expect(samish('Check the export test.', 'check the import test')).toBe(false)
  expect(parsePairs('"he go" -> "he goes" [agreement]\n"a apple" -> "an apple"\nnoise')).toEqual([
    { from: 'he go', to: 'he goes', rule: 'agreement' },
    { from: 'a apple', to: 'an apple', rule: undefined },
  ])
  expect(parsePairs('NO_ERRORS')).toEqual([])
})

test('the grammar check names each rule in the chosen language, or not at all', async () => {
  expect(pairsSystem('Ukrainian')).toContain('ONE word in Ukrainian')
  expect(pairsSystem('Ukrainian')).toContain('Never write the rule in English')
  expect(pairsSystem('Ukrainian')).not.toContain('[agreement]')
  expect(pairsSystem('none')).not.toContain('[rule]')
  expect(pairsSystem('none')).toContain('"original" -> "fix"')
  expect(pairsSystem()).toContain('[agreement], [tense]')
})

test('answers under several quotes are translated in place, or not at all', async () => {
  const draft = '> Plan: cache the report for an hour\nні, на добу\n> Note: the export runs at night\nтак, лишаємо'
  expect(ownRuns(draft)).toEqual(['ні, на добу', 'так, лишаємо'])
  expect(segmentPrompt(['ні', 'так'])).toBe('<p1>\nні\n</p1>\n<p2>\nтак\n</p2>')
  expect(parseSegments('<p1>No, for a day</p1>\n<p2>Yes, we keep it</p2>', 2)).toEqual(['No, for a day', 'Yes, we keep it'])
  expect(parseSegments('<p1>No</p1>', 2)).toBe(null)
  expect(parseSegments('<p1>No</p1><p2>Yes</p2><p3>Extra</p3>', 2)).toBe(null)
  expect(rebuild(draft, ['No, for a day', 'Yes, we keep it'])).toBe('> Plan: cache the report for an hour\nNo, for a day\n> Note: the export runs at night\nYes, we keep it')
})

test('the draft the box last showed is the message sent: the same words, with its paste chips expanded', async () => {
  expect(isSentAs('why this test fail on CI', 'why this test fail on CI')).toBe(true)
  expect(isSentAs('[Pasted text #1 +8 lines] why this test fail on CI', '<pasted_content id="1">\nline 1\n</pasted_content> why this test fail on CI')).toBe(true)
  expect(isSentAs('he go to eat a apple after the build', 'перевір чому тест експорту падає на CI')).toBe(false)
  expect(isSentAs('[Pasted text #1 +8 lines] why this test fail', 'other words entirely')).toBe(false)
  expect(isSentAs('', 'why this test fail on CI')).toBe(false)
})
