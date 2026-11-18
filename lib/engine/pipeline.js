/**
 * Run the engine for one patient: S01 → … up to `until`.
 * `asOf`: only fragments written (visible) at or before that instant are used;
 * every later stage recomputes from them.
 */
import { readPatient } from './source.js'
import { buildFragments } from './s01-fragments.js'
import { extractMentions, checkGate1 } from './s02-mentions.js'
import { classifyMentions } from './s03-classify.js'
import { mergeEvents } from './s04-merge.js'
import { buildLinks } from './s04-links.js'
import { judgeFindings } from './s05-judge.js'
import { buildUnits, judgeUnits, toMentions } from './read.js'
import { applyManual } from './manual.js'

const ORDER = ['S01', 'S02', 'S03', 'S04', 'S05']

export async function runPatient(dir, pack, opts = {}) {
  opts.onStage?.('S01')
  const raw = await readPatient(dir, pack.source)
  return runStages(raw, pack, opts)
}

/**
 * llm（批次里必有；单独跑规则时省略）：{ models: { a, b }, ask, store, mode, sampleRate, maxRounds, width, isCancelled } —— 模型优先的 S02＋S03（通读）：
 * 文书由模型读懂、规则执行；结构化行仍走规则；规则结果同时保留作对照与第三票（result.baseline）。
 * decisions（可选）：人工判断 Map（records.decisions()）：复核项（review）、提及（mention：reject／correct）、补充（add）、发现（finding）。
 * onStage（可选）：每进入一道工序时回调一次（'S01'…'S05'），供界面显示病人走到了哪一站。
 */
export async function runStages(raw, pack, { until = 'S05', asOf, llm = null, decisions = new Map(), onStage = () => {} } = {}) {
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

  onStage('S02')
  const s02 = extractMentions({ fragments, encounters: s01.encounters, person: s01.person }, pack.source, pack.vocab)
  tables.mentions = s02.mentions
  gates['①'] = { pass: s02.failures.length === 0, failures: countBy(s02.failures, (x) => x.gate), samples: s02.failures.slice(0, 20) }
  summary.mentions = s02.mentions.length
  summary.mentionsByKind = countBy(s02.mentions, (m) => m.kind)
  summary.timeSources = countBy(s02.mentions, (m) => m.timeSource)
  if (stop < 2 || !gates['①'].pass) return { tables, summary }

  onStage('S03')
  let s03 = classifyMentions({ mentions: s02.mentions, encounters: s01.encounters, fragments }, pack)
  let baseline = null
  let reviews = []
  if (llm) {
    // 规则结果作对照基线与第三票
    baseline = s03.mentions
    const ruleByFrag = new Map()
    for (const m of baseline) if (m.kind === '文书') { if (!ruleByFrag.has(m.fragmentId)) ruleByFrag.set(m.fragmentId, []); ruleByFrag.get(m.fragmentId).push(m) }
    const ruleOf = (u, loc) => {
      const s = u.s + loc.s; const e = u.s + loc.e
      let best = null; let bestO = 0
      for (const m of ruleByFrag.get(u.fragment.id) ?? []) {
        const inter = Math.max(0, Math.min(e, m.e) - Math.max(s, m.s))
        if (!inter) continue
        const o = inter / (Math.max(e, m.e) - Math.min(s, m.s))
        if (o > bestO) { bestO = o; best = m }
      }
      return best ? { s: best.s - u.s, e: best.e - u.s, type: best.type, subdivision: best.subdivision, timePhrase: best.timePhrase, timeSource: best.timeSource } : null
    }
    const { units, skipped } = buildUnits({ fragments }, pack.source)
    const mode = llm.mode === 'model' ? 'model' : 'hybrid'
    const judged = await judgeUnits(units, { ...llm, mode, ruleOf, decisions })
    const encStart = new Map(s01.encounters.map((e) => [e.id, e.start]))
    const strip = ({ type, subclass, subdivision, item, negative, templated, temporality, future, alsoContains, action, execStatus, certainty, adherence, origin, fallback, ...rest }) => rest
    const built = toMentions(units, judged.result, { encStart, person: s01.person, fill: mode === 'hybrid', ruleMentionsByFragment: new Map([...ruleByFrag].map(([k, v]) => [k, v.map(strip)])) })
    // 复核项落到本病人：同一句在本病人的每一处
    const occ = new Map()
    for (const u of units) { if (!occ.has(u.key)) occ.set(u.key, []); occ.get(u.key).push({ fragmentId: u.fragment.id, s: u.s, e: u.e, writtenAt: u.fragment.visibleAt }) }
    reviews = judged.reviews.map((r) => ({ ...r, occurrences: occ.get(r.unitKey) ?? [] }))
    // 没有栏目配置的文书片段仍用规则
    const skippedSet = new Set(skipped)
    const ruleDocsSkipped = s02.mentions.filter((m) => m.kind === '文书' && skippedSet.has(m.fragmentId))
    let merged = [...s02.mentions.filter((m) => m.kind !== '文书'), ...ruleDocsSkipped, ...built.mentions]
    // 人工：去掉、改类型、补漏提（逐份核对页）
    const manual = applyManual(merged, decisions, { fragments })
    merged = manual.mentions
    const fragOrder = new Map(fragments.map((f, i) => [f.id, i]))
    merged.sort((a, b) => (fragOrder.get(a.fragmentId) - fragOrder.get(b.fragmentId)) || a.s - b.s || a.e - b.e)
    const g1 = checkGate1(merged, fragments)
    gates['①'] = { pass: g1.length === 0, failures: countBy(g1, (x) => x.gate), samples: g1.slice(0, 20) }
    s03 = classifyMentions({ mentions: merged, encounters: s01.encounters, fragments }, pack)
    summary.read = { ...judged.stats, mode, coverage: built.coverage, manual: manual.stats, ruleCompare: compareWithRules(s03.mentions, baseline),
      by: countBy(built.mentions, (m) => (m.by ? `${m.by.span}/${m.by.type}` : '规则')) }
    summary.mentions = merged.length
    summary.timeSources = countBy(merged, (m) => m.timeSource)
    if (!gates['①'].pass) { tables.mentions = s03.mentions; return { tables, summary, baseline, reviews } }
  }
  tables.mentions = s03.mentions
  // 验收门②：设计的 3% 是抽样人工核对的错误率；这里只报兜底（Z2、Z9）命中率供抽查
  gates['②'] = { pass: true, fallbackRate: s03.gate.rate, fallback: s03.gate.fallback, documentMentions: s03.gate.documentMentions, sampling: '待人工抽样' }
  summary.ruleHits = s03.hits
  summary.types = countBy(s03.mentions, (m) => m.type)
  summary.subdivisions = countBy(s03.mentions, (m) => `${m.type}›${m.subdivision}`)
  summary.templated = countBy(s03.mentions.filter((m) => m.templated), (m) => m.templated)
  if (stop < 3) return { tables, summary, baseline, reviews }

  onStage('S04')
  const s04 = mergeEvents({ mentions: s03.mentions, fragments, encounters: s01.encounters }, pack)
  tables.events = s04.events
  tables.clues = s04.clues
  for (const m of tables.mentions) { const x = s04.m2e.get(m.id); m.eventId = x?.eventId ?? null; m.mergeRule = x?.mergeRule ?? null }
  const s04b = buildLinks({ events: s04.events, mentions: tables.mentions }, pack)
  tables.links = s04b.links
  const problems3 = [...s04.problems, ...s04b.problems]
  gates['③'] = { pass: problems3.length === 0, problems: countBy(problems3, (x) => x.gate), samples: problems3.slice(0, 10) }
  summary.links = countBy(s04b.links, (l) => `${l.relation}${l.to ? '' : '（无法印证）'}`)
  summary.events = s04.events.length
  summary.multiMentionEvents = s04.events.filter((e) => e.mentionCount > 1).length
  summary.eventForms = countBy(s04.events, (e) => e.form)
  summary.conceptGroups = countBy(s04.events, (e) => e.conceptGroup)
  summary.mergeRules = countBy(tables.mentions, (m) => m.mergeRule)
  summary.clues = countBy(s04.clues, (c) => c.kind)
  if (stop < 4 || !gates['③'].pass) return { tables, summary, baseline, reviews }

  onStage('S05')
  const s05 = judgeFindings({ events: s04.events, mentions: tables.mentions, clues: s04.clues, fragments }, pack)
  tables.findings = s05.findings
  // 人工判断（复核页）：按稳定编号沿用；旧版本存的 kind 是 findings
  for (const f of tables.findings) { const d = decisions.get(`finding\u0000${f.id}`) ?? decisions.get(`findings\u0000${f.id}`); if (d) f.review = { decision: d.decision, note: d.note ?? '', by: d.by ?? 'user', at: d.at } }
  tables.stageChanges = s05.stageChanges
  gates['④'] = { pass: s05.problems.length === 0, problems: countBy(s05.problems, (x) => x.gate) }
  summary.findings = s05.findings.length
  summary.verdicts = countBy(s05.findings, (f) => `${f.verdict}·${f.subclass}`)
  summary.stageChanges = s05.stageChanges.map((x) => `${x.pattern}: ${x.seq.map((s) => s.stage).join('→')}`)
  return { tables, summary, baseline, reviews }
}

/** 规则对照：模型提及与规则提及（重叠 ≥ 50%）的位置、大类、时间一致率（文书提及） */
export function compareWithRules(mentions, baseline) {
  const L = mentions.filter((m) => m.kind === '文书' && m.rules?.extract === 'model')
  const byFrag = new Map()
  for (const m of baseline.filter((x) => x.kind === '文书')) { if (!byFrag.has(m.fragmentId)) byFrag.set(m.fragmentId, []); byFrag.get(m.fragmentId).push(m) }
  const out = { model: L.length, rule: baseline.filter((x) => x.kind === '文书').length, matched: 0, exact: 0, type: 0, time: 0, timeComparable: 0 }
  for (const m of L) {
    let best = null; let bo = 0
    for (const r of byFrag.get(m.fragmentId) ?? []) {
      const i = Math.max(0, Math.min(m.e, r.e) - Math.max(m.s, r.s)); const u = Math.max(m.e, r.e) - Math.min(m.s, r.s)
      const o = u ? i / u : 0
      if (o > bo) { bo = o; best = r }
    }
    if (!best || bo < 0.5) continue
    out.matched++; if (bo === 1) out.exact++
    if (best.type === m.type) out.type++
    if (m.occurFrom || m.occurTo || best.occurFrom || best.occurTo) { out.timeComparable++; if (m.occurFrom === best.occurFrom && m.occurTo === best.occurTo) out.time++ }
  }
  return out
}

export function countBy(list, fn) {
  const out = {}
  for (const x of list) { const k = fn(x); out[k] = (out[k] ?? 0) + 1 }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]))
}
