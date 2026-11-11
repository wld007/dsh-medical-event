/**
 * Run the engine for one patient: S01 → … up to `until`.
 */
import { readPatient } from './source.js'
import { buildFragments } from './s01-fragments.js'

const ORDER = ['S01', 'S02', 'S03', 'S04', 'S05']

export async function runPatient(dir, pack, { until = 'S05', asOf } = {}) {
  const stop = ORDER.indexOf(until)
  const raw = await readPatient(dir, pack.source)
  const s01 = buildFragments(raw, pack.source)
  let fragments = s01.fragments
  if (asOf) fragments = fragments.filter((f) => f.visibleAt <= asOf)
  const tables = { fragments, encounters: s01.encounters }
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
  }
  if (stop < 1) return { tables, summary }
  return { tables, summary }
}

export function countBy(list, fn) {
  const out = {}
  for (const x of list) { const k = fn(x); out[k] = (out[k] ?? 0) + 1 }
  return out
}
