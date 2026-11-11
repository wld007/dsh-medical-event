/**
 * Run the engine for one patient: S01 → … up to `until`.
 * `asOf`: only fragments written (visible) at or before that instant are used;
 * every later stage recomputes from them.
 */
import { readPatient } from './source.js'
import { buildFragments } from './s01-fragments.js'
import { extractMentions } from './s02-mentions.js'

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

  return { tables, summary }
}

export function countBy(list, fn) {
  const out = {}
  for (const x of list) { const k = fn(x); out[k] = (out[k] ?? 0) + 1 }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]))
}
