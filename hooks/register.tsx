// cc-grammar: English while you write a prompt, for your eyes only.
// - After a pause, the English of your draft shows in gray after it: your words translated from any
//   language, or your English corrected. The key you bind to the command `english` (Tab) takes it into
//   the prompt, and gives your words back.
// - English you never saw before Enter shows once, as a gray ✎ line under your message: the English of
//   your words, or up to three corrections of your English, simplest first.
// Nothing is sent for you and nothing goes on disk. Your own words go to Haiku for their English (a draft
// too, after a pause, even one you never send); the conversation's model never sees any of this.
import type { EngineInterface, PromptDecoration, PromptOrigin, Register } from 'claude-code'

import {
  SEGMENTS_SYSTEM,
  TRANSLATE_SYSTEM,
  afterNeed,
  clean,
  faithful,
  isSentAs,
  needOf,
  ownRuns,
  ownText,
  pairsSystem,
  parsePairs,
  parseSegments,
  rebuild,
  samish,
  segmentPrompt,
  typingToken,
} from './english'

const GRAY = '#999999'

type When = 'as I type and after I send' | 'as I type' | 'after I send' | 'off'
type Options = { when?: When; rule_names?: string; pause?: number; longest?: number }
// english.draft is the whole draft with each of your own runs in English and quotes in place;
// english.preview is what the gray text shows.
type English = { draft: string; preview: string }

let inert = false
let typing = true
let after = true
let ruleNames = 'English'
let pause = 700
let longest = 280

// The box: what it holds, what is offered for it, and whether it is in shell mode ('!'), where a command
// is typed and a fill of ours would switch the box back to a prompt.
let draft = ''
let edits = 0
let shell = false
let ghost: { for: string; english: English } | null = null
let taken: { original: string; english: string } | null = null
let note: { for: string; words: string } | null = null
let seq = 0
let timer: { cancel: () => void } | null = null
// Claude Code's own dim suggestion: shown in the empty box until the next submit, so the key takes it
// there, as Tab does.
let suggestion = ''
const seen = new Set<string>()
const fixes = new Map<string, string>()

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
const forget = () => {
  timer?.cancel()
  timer = null
  seq++
  draft = ''
  ghost = null
  taken = null
  note = null
  suggestion = ''
  seen.clear()
  fixes.clear()
}

// One Haiku call, sized to the words. Several runs of your own words (answers under several quotes) go as
// numbered parts and come back in place; any lost part, lost token, other language left or reply cut
// short means no English.
const englishFor = async ($: EngineInterface, text: string): Promise<English | null> => {
  const parts = ownRuns(text)
  if (parts.length === 0) return null
  const size = parts.join('').length
  const maxTokens = Math.min(8000, Math.max(1500, Math.ceil(size / 2) + 300))
  const timeoutMs = Math.min(60000, 10000 + size * 5)
  if (parts.length === 1) {
    const one = parts[0] ?? ''
    const r = await $.model.complete({ model: 'haiku', system: TRANSLATE_SYSTEM, prompt: `<text>\n${one}\n</text>`, maxTokens, timeoutMs })
    if (!r.isAnswered) return null
    const english = clean(r.text)
    return faithful(one, english) ? { draft: rebuild(text, [english]), preview: english } : null
  }
  const r = await $.model.complete({ model: 'haiku', system: SEGMENTS_SYSTEM, prompt: segmentPrompt(parts), maxTokens, timeoutMs: timeoutMs + 2000 })
  if (!r.isAnswered) return null
  const out = parseSegments(r.text, parts.length)
  if (!out || out.some((english, i) => !faithful(parts[i] ?? '', english))) return null
  return { draft: rebuild(text, out), preview: out.join(' / ') }
}

// Your own message: Enter at the terminal, or in the desktop app, which runs Claude Code as an SDK host. A -p
// run is an SDK host too, but nothing draws it: no ✎ line to show, so nothing goes to Haiku for it.
const yours = async ($: EngineInterface, origin: PromptOrigin) =>
  origin.kind === 'composer' || (origin.kind === 'sdk' && (await $.session.surfaces()).length > 0)

const unchanged = (text: string, english: English) => samish(english.preview, ownRuns(text).join(' / '))
const gray = (text: string, words: string): PromptDecoration => ({ start: text.length, end: text.length, virtualText: words, color: GRAY })

/** Half or more of the words `before` had are still there: the draft is that one, edited. */
const akin = (now: string, before: string) => {
  const have = new Set(norm(now).split(' '))
  const had = norm(before).split(' ')
  return had.filter(w => have.has(w)).length * 2 >= had.length
}

// Every fill of ours goes through here: it sets the box (the cursor lands at its end) with its gray text.
// prompt.edit sees what `draft` should be; a key that landed between our read and our fill was replaced
// by it, so the box prompt.edit last saw comes back ('' after a submit).
const attach = async ($: EngineInterface, text: string, decorations: PromptDecoration[]) => {
  const before = edits
  await $.prompt.fill({ text, mode: 'replace', decorations })
  if (edits !== before && draft !== text) await $.prompt.fill({ text: draft, mode: 'replace', decorations: [] })
}

// A word in gray after the draft: at once with the cursor at the end, or with the next key or move, which
// a fill would not leave where it is.
const say = async ($: EngineInterface, text: string, cursor: number, words: string) => {
  if (cursor === text.length) await attach($, text, [gray(text, words)])
  else note = { for: text, words }
}

// One pause after an edit: ask Haiku once. The English shows after the draft at once if the cursor is at
// the end; with the cursor elsewhere a fill would move it, so the next key or move draws it.
const schedule = ($: EngineInterface, text: string, cursor: number) => {
  timer?.cancel()
  timer = null
  if (!typing || shell || !needOf(text, false, longest) || typingToken(text, cursor) || (ghost && ghost.for === text)) return
  const mine = ++seq
  timer = $.clock.after(pause, () => void (async () => {
    try {
      const box = await $.prompt.read()
      if (mine !== seq || box.text !== text) return
      const english = await englishFor($, text)
      if (mine !== seq || !english || unchanged(text, english)) return
      const again = await $.prompt.read()
      if (mine !== seq || again.text !== text || shell) return
      ghost = { for: text, english }
      if (again.cursor !== text.length) return
      seen.add(norm(text))
      await attach($, text, [gray(text, '  → ' + english.preview)])
    } catch {
      // A failed call shows nothing: no gray text is better than a wrong one.
    }
  })())
}

const take = async ($: EngineInterface, text: string, english: English) => {
  taken = { original: text, english: english.draft }
  seen.add(norm(text))
  seen.add(norm(english.draft))
  draft = english.draft
  await attach($, english.draft, [])
}

// The key. An empty box: Claude Code's own suggestion, as Tab takes it. Words: their English, or your
// words back after the English was taken. In shell mode it stays out of the way.
const onKey = async ($: EngineInterface) => {
  if (shell) return
  const box = await $.prompt.read()
  const text = box.text
  if (!text.trim()) {
    if (suggestion) await $.prompt.fill({ text: suggestion, mode: 'replace' })
    return
  }
  if (taken && text === taken.english) {
    const original = taken.original
    taken = null
    draft = original
    const back = ghost && ghost.for === original ? [gray(original, '  → ' + ghost.english.preview)] : []
    await attach($, original, back)
    return
  }
  if (ghost && ghost.for === text) return take($, text, ghost.english)
  // Asked for, so answered: say what happened, rather than go silent.
  if (!needOf(text, true, longest)) return say($, text, box.cursor, '  → nothing to translate')
  const mine = ++seq
  let words = '  → no English this time'
  try {
    if (box.cursor === text.length) await attach($, text, [gray(text, '  → …')])
    const english = await englishFor($, text)
    const again = await $.prompt.read()
    if (mine !== seq || again.text !== text) return
    if (english && !unchanged(text, english)) {
      ghost = { for: text, english }
      await take($, text, english)
      return
    }
    if (english) words = '  → no change'
  } catch {
    // A failed call says so below.
  }
  const now = await $.prompt.read()
  if (mine === seq && now.text === text) await say($, text, now.cursor, words)
}

export const register: Register = (on, options) => {
  const opts = (options ?? {}) as Options
  const when: When = opts.when ?? 'as I type and after I send'
  typing = when === 'as I type and after I send' || when === 'as I type'
  after = when === 'as I type and after I send' || when === 'after I send'
  ruleNames = (opts.rule_names ?? 'English').trim() || 'English'
  pause = opts.pause ?? 700
  longest = opts.longest ?? 280

  // The desktop app and -p runs draw their own prompt box, or none: no gray text, no key there. The ✎ line
  // is decided per message, in prompt.submit.
  on('session.start', async ($, e, next) => {
    inert = !e.isInteractive
    if (!inert) {
      await $.command.register({
        name: 'english',
        description: 'Take the gray English of your draft, or give your words back (bind it to Tab)',
        immediate: true,
      })
    }
    return next(e)
  })

  // /clear and /resume start another conversation in the same process: the box starts over.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') forget()
    return next(e)
  })

  on('command.run', { command: 'english' }, async $ => {
    void onKey($).catch(() => undefined)
    return {}
  })

  on('prompt.suggest', async ($, e, next) => {
    const r = await next(e)
    if (r.isShown) suggestion = e.text
    return r
  })

  // The hint row is the only place that tells shell mode: '! for shell mode'.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    shell = /shell mode/i.test(e.props.hint)
    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    edits++
    const r = await next(e)
    if (inert) return r
    const text = r.text
    if (text !== draft) {
      draft = text
      note = null
      // Editing the English you took: the English of your own words no longer applies.
      if (taken && text !== taken.english) {
        taken = null
        ghost = null
      }
      // The last English stays, marked '…', while the draft is still that one, edited: the box keeps its
      // height until the next pause brings the new English.
      if (ghost && (!needOf(text, false, longest) || !akin(text, ghost.for))) ghost = null
      schedule($, text, r.cursor)
    }
    const mine: PromptDecoration[] = []
    if (note && note.for === text) mine.push(gray(text, note.words))
    // The English you took is in the box: its gray twin would only repeat it.
    else if (typing && ghost && !taken && !shell) {
      if (text === ghost.for) seen.add(norm(text))
      mine.push(gray(text, '  → ' + ghost.english.preview + (text === ghost.for ? '' : ' …')))
    }
    return mine.length ? { ...r, decorations: [...(r.decorations ?? []), ...mine] } : r
  })

  on('prompt.submit', async ($, e, next) => {
    // Any submit ends Claude Code's suggestion.
    suggestion = ''
    if (!(await yours($, e.origin))) return next(e)
    edits++
    timer?.cancel()
    timer = null
    seq++
    // What you saw in the box: a long paste is still its [Pasted text] chip there, never its contents. A box
    // that changed with no edit (a history recall, a clear) showed another message: then the one sent.
    const typed = isSentAs(draft, e.text) ? draft : e.text
    const sawIt = seen.has(norm(typed))
    ghost = null
    taken = null
    note = null
    draft = ''
    if (sawIt) fixes.delete(norm(e.text))
    if (after && !shell && !e.command && !sawIt && afterNeed(typed, longest)) {
      void (async () => {
        try {
          let line = ''
          if (needOf(typed, true, longest) === 'translate') {
            const english = await englishFor($, typed)
            if (english && !unchanged(typed, english)) line = '✎ ' + english.preview
          } else {
            const r = await $.model.complete({ model: 'haiku', system: pairsSystem(ruleNames), prompt: `<text>\n${ownText(typed)}\n</text>`, maxTokens: 300, timeoutMs: 10000 })
            const pairs = r.isAnswered ? parsePairs(clean(r.text)) : []
            if (pairs.length) line = '✎ ' + pairs.map(p => `${p.from} → ${p.to}${p.rule ? ` (${p.rule})` : ''}`).join(' · ')
          }
          if (line) {
            fixes.set(norm(e.text), line)
            $.ui.invalidate('ui.render')
          }
        } catch {
          // No line is better than a wrong one.
        }
      })()
    }
    return next(e)
  })

  // English you did not see before Enter: one gray line under your own message.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const theirs = await next(e)
    if (!after || (e.props.origin.kind !== 'composer' && e.props.origin.kind !== 'sdk')) return theirs
    const line = fixes.get(norm(e.props.text))
    if (!line) return theirs
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {theirs}
        <Box paddingLeft={2}>
          <Text color={GRAY}>{line}</Text>
        </Box>
      </Box>
    )
  })
}
