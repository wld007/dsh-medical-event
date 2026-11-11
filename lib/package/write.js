/**
 * 写事件包（格式 event-package/0，见 docs/event-package.md）与可再生的导出视图。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const FORMAT = 'event-package/0'

const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')
const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const csv = (header, rows) => [header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join('\n') + '\n'

export function buildExports(patient, tables) {
  const byId = new Map(tables.mentions.map((m) => [m.id, m]))
  const drugRows = []
  for (const e of tables.events.filter((x) => x.conceptGroup === '用药')) {
    const natures = [...new Set(e.aliases.map((a) => a.nature).filter(Boolean))].join('；')
    if (e.segment) drugRows.push({ patient, drug: e.concept, kind: '在用片段', from: e.segment.from, to: e.segment.to, mentions: e.mentionCount, docs: e.docCount, aliasNature: natures, eventId: e.id })
    else drugRows.push({ patient, drug: e.concept, kind: e.drugAction ?? '点', from: e.consensus?.a ?? '', to: e.consensus?.b ?? '', mentions: e.mentionCount, docs: e.docCount, aliasNature: natures, eventId: e.id })
  }
  const labRows = []
  for (const e of tables.events.filter((x) => x.conceptGroup === '检验结果')) {
    const ms = e.mentions.map((id) => byId.get(id)).filter(Boolean)
    const struct = ms.find((m) => m.kind === '结构化')
    labRows.push({ patient, item: e.concept, value: e.value, unit: struct ? (struct.text.match(/\d\s+(\S+)/)?.[1] ?? '') : '', date: e.consensus?.a ?? '', source: struct ? '结构化' : '文书转述', flag: /↑/.test((struct ?? ms[0]).text) ? '↑' : /↓/.test((struct ?? ms[0]).text) ? '↓' : '', mentions: e.mentionCount, timeConsistent: e.consensus?.consistent ?? '', eventId: e.id })
  }
  const byFrag = new Map()
  for (const m of tables.mentions) {
    if (m.kind !== '文书') continue
    if (!byFrag.has(m.fragmentId)) byFrag.set(m.fragmentId, [])
    byFrag.get(m.fragmentId).push(m)
  }
  const samples = []
  for (const f of tables.fragments) {
    const ms = byFrag.get(f.id)
    if (!ms) continue
    samples.push({ fragmentId: f.id, recordType: f.recordType, writtenAt: f.visibleAt, anchorAt: f.anchorAt ?? f.visibleAt, text: f.text,
      mentions: ms.map((m) => ({ s: m.s, e: m.e, text: m.text, section: m.section, type: m.type, subclass: m.subclass, subdivision: m.subdivision, item: m.item,
        negative: m.negative, scope: m.scope, timePhrase: m.timePhrase, timeSource: m.timeSource, occurFrom: m.occurFrom, occurTo: m.occurTo, precision: m.precision })) })
  }
  return { drugRows, labRows, samples }
}

/**
 * dir: 这位病人的交付目录；result: runPatient 的结果；meta: { patient, runId, upstream, producer }
 */
export async function writePackage(dir, result, meta) {
  const T = result.tables
  await mkdir(join(dir, 'exports'), { recursive: true })
  const manifest = {
    format: FORMAT,
    producer: meta.producer,
    runId: meta.runId,
    patient: meta.patient,
    upstream: meta.upstream ?? null,
    rulepacks: result.summary.rulepack,
    asOf: result.summary.asOf,
    person: result.summary.person,
    counts: { fragments: T.fragments.length, encounters: T.encounters.length, mentions: T.mentions?.length ?? 0, events: T.events?.length ?? 0, findings: T.findings?.length ?? 0 },
    gates: result.summary.gates,
    review: meta.review ?? null,
    createdAt: meta.createdAt,
  }
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  for (const [name, rows] of [['fragments', T.fragments], ['encounters', T.encounters], ['mentions', T.mentions ?? []], ['events', T.events ?? []], ['findings', T.findings ?? []], ['clues', T.clues ?? []]]) {
    await writeFile(join(dir, `${name}.jsonl`), jsonl(rows))
  }
  await writeFile(join(dir, 'stage-changes.json'), JSON.stringify(T.stageChanges ?? [], null, 2))
  if (T.events) {
    const x = buildExports(meta.patient, T)
    await writeFile(join(dir, 'exports', 'drug_exposure.csv'), csv(['patient', 'drug', 'kind', 'from', 'to', 'mentions', 'docs', 'aliasNature', 'eventId'], x.drugRows))
    await writeFile(join(dir, 'exports', 'labs_long.csv'), csv(['patient', 'item', 'value', 'unit', 'date', 'source', 'flag', 'mentions', 'timeConsistent', 'eventId'], x.labRows))
    await writeFile(join(dir, 'exports', 'extraction_samples.jsonl'), jsonl(x.samples))
  }
  return manifest
}
