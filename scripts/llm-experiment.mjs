/**
 * 模型优先 S02＋S03 实验：对若干病人分别跑“规则基线”和“模型优先”，输出对照统计与分歧样本。
 *
 *   node scripts/llm-experiment.mjs <outDir> <patientDir>... \
 *     --a <baseURL>@<model> --b <baseURL>@<model> [--width 8]
 *
 * 跨病人共用缓存（<outDir>/cache），重跑只补没问过的句子。输出不进仓库（病历派生内容）。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPatient } from '../lib/engine/source.js'
import { runStages, countBy } from '../lib/engine/pipeline.js'
import { loadRulepack } from '../lib/rulepack/load.js'
import { createLlm } from '../lib/llm.js'
import { createCache } from '../lib/llm/first.js'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : d }
const A = flag('--a'); const B = flag('--b'); const width = Number(flag('--width', 8))
const [outDir, ...dirs] = args
if (!outDir || !dirs.length || !A || !B) { console.error('usage: node scripts/llm-experiment.mjs <outDir> <patientDir>... --a url@model --b url@model'); process.exit(1) }
const repo = fileURLToPath(new URL('..', import.meta.url))
if (resolve(outDir).startsWith(resolve(repo))) { console.error('outDir 不能在仓库里'); process.exit(1) }
const mk = (spec) => { const i = spec.lastIndexOf('@'); return createLlm({ baseURL: spec.slice(0, i), model: spec.slice(i + 1), timeoutMs: 300000 }) }
const models = { a: mk(A), b: mk(B) }
const cache = createCache(join(outDir, 'cache'))
const pack = await loadRulepack()
await mkdir(outDir, { recursive: true })

const ov = (x, y) => { const i = Math.max(0, Math.min(x.e, y.e) - Math.max(x.s, y.s)); const u = Math.max(x.e, y.e) - Math.min(x.s, y.s); return u ? i / u : 0 }

function compare(llmMs, ruleMs) {
  const L = llmMs.filter((m) => m.kind === '文书'); const R = ruleMs.filter((m) => m.kind === '文书')
  const byFrag = new Map()
  for (const m of R) { if (!byFrag.has(m.fragmentId)) byFrag.set(m.fragmentId, []); byFrag.get(m.fragmentId).push(m) }
  const used = new Set()
  const out = { llm: L.length, rule: R.length, exact: 0, overlap: 0, llmOnly: 0, type: 0, sub: 0, neg: 0, time: 0, timeComparable: 0, samples: { type: [], time: [], llmOnly: [], ruleOnly: [] } }
  for (const m of L) {
    let best = null; let bo = 0
    for (const r of byFrag.get(m.fragmentId) ?? []) { const o = ov(m, r); if (o > bo) { bo = o; best = r } }
    if (!best || bo < 0.5) { out.llmOnly++; if (out.samples.llmOnly.length < 40) out.samples.llmOnly.push({ text: m.text, type: `${m.type}›${m.subdivision}›${m.item}`, by: m.by }); continue }
    used.add(best.id)
    if (bo === 1) out.exact++; else out.overlap++
    if (best.type === m.type) out.type++
    else if (out.samples.type.length < 80) out.samples.type.push({ text: m.text, ruleText: best.text, llm: `${m.type}›${m.subdivision}›${m.item}${m.negative ? '·阴' : ''}`, rule: `${best.type}›${best.subdivision}›${best.item}${best.negative ? '·阴' : ''}`, ruleId: best.rules.classify, ruleFallback: best.fallback, by: m.by, section: m.section, recordType: m.recordType })
    if (best.type === m.type && best.subdivision === m.subdivision && best.item === m.item) out.sub++
    if (best.negative === m.negative) out.neg++
    if (m.occurFrom || m.occurTo || best.occurFrom || best.occurTo) {
      out.timeComparable++
      if (m.occurFrom === best.occurFrom && m.occurTo === best.occurTo) out.time++
      else if (out.samples.time.length < 80) out.samples.time.push({ text: m.text, written: m.writtenAt, llm: `${m.occurFrom}~${m.occurTo} ${m.timeSource}`, rule: `${best.occurFrom}~${best.occurTo} ${best.timeSource}`, by: m.by, section: m.section })
    }
  }
  const ruleOnly = R.filter((r) => !used.has(r.id))
  out.ruleOnly = ruleOnly.length
  out.ruleOnlyFallback = ruleOnly.filter((r) => r.fallback).length
  for (const r of ruleOnly.slice(0, 40)) out.samples.ruleOnly.push({ text: r.text, type: `${r.type}›${r.subdivision}›${r.item}`, rule: r.rules.classify })
  return out
}

const report = []
const t00 = Date.now()
for (const dir of dirs) {
  const name = basename(dir)
  const raw = await readPatient(dir, pack.source)
  const t0 = Date.now()
  let calls = 0; let failed = 0
  const r = await runStages(raw, pack, { llm: { models, cache, width, onCall: (c) => { calls++; if (!c.ok) failed++ } } })
  const ms = Date.now() - t0
  const cmp = compare(r.tables.mentions, r.baseline)
  const s = r.summary
  const row = {
    patient: name, ms, calls, failed,
    gates: Object.fromEntries(Object.entries(s.gates).map(([k, g]) => [k, g.pass])),
    units: s.llm.units, unique: s.llm.unique, cached: s.llm.cached, tokens: s.llm.tokens, invalid: s.llm.invalid,
    tally: s.llm.tally, coverage: s.llm.coverage, by: s.llm.by,
    mentions: s.mentions, events: s.events, findings: s.findings, verdicts: s.verdicts,
    compare: { ...cmp, samples: undefined },
    timeSources: Object.fromEntries(Object.entries(s.timeSources).slice(0, 15)),
  }
  report.push(row)
  await writeFile(join(outDir, `${name}.samples.json`), JSON.stringify(cmp.samples, null, 1))
  await writeFile(join(outDir, `${name}.mentions.jsonl`), r.tables.mentions.filter((m) => m.kind === '文书').map((m) => JSON.stringify({ id: m.id, recordType: m.recordType, section: m.section, text: m.text, type: m.type, subdivision: m.subdivision, item: m.item, subclass: m.subclass, negative: m.negative, occurFrom: m.occurFrom, occurTo: m.occurTo, timeSource: m.timeSource, by: m.by })).join('\n') + '\n')
  console.log(`${name}: ${(ms / 1000).toFixed(0)}s calls ${calls} failed ${failed} unique ${s.llm.unique}/${s.llm.units} cached ${JSON.stringify(s.llm.cached)} gates ${JSON.stringify(row.gates)} type ${(cmp.type / Math.max(1, cmp.exact + cmp.overlap) * 100).toFixed(1)}% time ${(cmp.time / Math.max(1, cmp.timeComparable) * 100).toFixed(1)}%`)
  await writeFile(join(outDir, 'report.json'), JSON.stringify({ models: { a: models.a.model, b: models.b.model }, totalMs: Date.now() - t00, patients: report }, null, 1))
}
console.log('done', ((Date.now() - t00) / 1000).toFixed(0), 's')
