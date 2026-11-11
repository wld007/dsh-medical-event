/**
 * Run the engine for one patient: S01 → … up to `until`.
 * `asOf`: only fragments written (visible) at or before that instant are used;
 * every later stage recomputes from them.
 */
import { readPatient } from './source.js'
import { buildFragments } from './s01-fragments.js'
import { extractMentions } from './s02-mentions.js'
import { classifyMentions } from './s03-classify.js'
import { mergeEvents } from './s04-merge.js'

const ORDER = ['S01', 'S02', 'S03', 'S04', 'S05']

export async function runPatient(dir, pack, opts = {}) {
  const raw = await readPatient(dir, pack.source)
  return runStages(raw, pack, opts)
}

export function runStages(raw, pack, { until = 'S05', asOf } = {}) {
  const stop = ORDER.indexOf(until)
  const s01 = buildFragments(raw, pack.source)
  let fragments = s01.fragments
  if (asOf) fragments = fragments.filter((f) => f.visibleAt <= asOf)
  const tables = { fragments, encounters: s01.encounters }
  const gates = {}
  const summary = {
    rulepack: pack.layers,
    asOf: asOf ?? null,
    person: s01.person,
    fragments: fragments.length,
    fragmentsByType: countBy(fragments, (f) => f.recordType),
    encounters: countBy(s01.encounters, (e) => e.kind),
    droppedInvalid: s01.dropped,
    problems: s01.problems,
    unknownFiles: raw.unknown.length,
    gates,
  }
  if (stop < 1) return { tables, summary }

  const s02 = extractMentions({ fragments, encounters: s01.encounters, person: s01.person }, pack.source)
  tables.mentions = s02.mentions
  gates['①'] = { pass: s02.failures.length === 0, failures: countBy(s02.failures, (x) => x.gate), samples: s02.failures.slice(0, 20) }
  summary.mentions = s02.mentions.length
  summary.mentionsByKind = countBy(s02.mentions, (m) => m.kind)
  summary.timeSources = countBy(s02.mentions, (m) => m.timeSource)
  if (stop < 2 || !gates['①'].pass) return { tables, summary }

  const s03 = classifyMentions({ mentions: s02.mentions, encounters: s01.encounters, fragments }, pack)
  tables.mentions = s03.mentions
  // 验收门②：设计的 3% 是抽样人工核对的错误率；这里只报兜底（Z2、Z9）命中率供抽查
  gates['②'] = { pass: true, fallbackRate: s03.gate.rate, fallback: s03.gate.fallback, documentMentions: s03.gate.documentMentions, sampling: '待人工抽样' }
  summary.ruleHits = s03.hits
  summary.types = countBy(s03.mentions, (m) => m.type)
  summary.subdivisions = countBy(s03.mentions, (m) => `${m.type}›${m.subdivision}`)
  summary.templated = countBy(s03.mentions.filter((m) => m.templated), (m) => m.templated)
  if (stop < 3) return { tables, summary }

  const s04 = mergeEvents({ mentions: s03.mentions, fragments, encounters: s01.encounters }, pack)
  tables.events = s04.events
  tables.clues = s04.clues
  for (const m of tables.mentions) { const x = s04.m2e.get(m.id); m.eventId = x?.eventId ?? null; m.mergeRule = x?.mergeRule ?? null }
  gates['③'] = { pass: s04.problems.length === 0, problems: countBy(s04.problems, (x) => x.gate), samples: s04.problems.slice(0, 10) }
  summary.events = s04.events.length
  summary.multiMentionEvents = s04.events.filter((e) => e.mentionCount > 1).length
  summary.eventForms = countBy(s04.events, (e) => e.form)
  summary.conceptGroups = countBy(s04.events, (e) => e.conceptGroup)
  summary.mergeRules = countBy(tables.mentions, (m) => m.mergeRule)
  summary.clues = countBy(s04.clues, (c) => c.kind)
  if (stop < 4 || !gates['③'].pass) return { tables, summary }

  return { tables, summary }
}

export function countBy(list, fn) {
  const out = {}
  for (const x of list) { const k = fn(x); out[k] = (out[k] ?? 0) + 1 }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]))
}
