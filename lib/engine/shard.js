/**
 * 一个数据块：若干位病人 → 读入 → S01–S05（通读：模型优先）→ 写事件包（暂存区）与复核单。
 *
 *   <staging>/<病人>/                       事件包（批次完成后整体移到 output/<输入名>）
 *   work/review/part-NNNNN.ndjson.gz        复核项：通读的分歧（含复查后一致的，供抽查）、需人工确认的发现、需药师复核的药名
 *
 * 数据块是断点单位：复核单改名成功＝数据块完成；继续处理时跳过已完成的数据块。
 * 工作线程与主线程（测试、单线程时）都跑这一个函数；模型并发由共享闸门（gate.js）统一限流。
 */
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createGzip } from 'node:zlib'
import { readPatient } from './source.js'
import { runStages } from './pipeline.js'
import { SYSTEM } from './read.js'
import { loadRulepack } from '../rulepack/load.js'
import { writePackage } from '../package/write.js'
import { createLlm } from '../llm.js'
import { GATE_BYTES, gateLimiter, modelSlots } from './gate.js'

export const partName = (n) => `part-${String(n).padStart(5, '0')}.ndjson.gz`
export { GATE_BYTES, readGate } from './gate.js'

function gzWriter(path) {
  const gz = createGzip({ level: 6 })
  const out = createWriteStream(path)
  gz.pipe(out)
  return {
    write(obj) { gz.write(`${JSON.stringify(obj)}\n`) },
    close() { return new Promise((resolve, reject) => { out.on('finish', resolve); out.on('error', reject); gz.end() }) },
  }
}

/** 规则包按层载入（工作线程各自载入；识别出的数据源层随任务传来） */
const packCache = new Map()
export function packFor(specialty, sourcePack = null) {
  const key = JSON.stringify([specialty, sourcePack?.id ?? null, sourcePack?.version ?? null, sourcePack?.profileId ?? null])
  if (!packCache.has(key)) {
    const list = [].concat(specialty ?? []).filter(Boolean).map((s) => `../../rules/specialty/${s}/index.mjs`)
    packCache.set(key, loadRulepack({ source: '../../rules/source/zj-regional/index.mjs', general: '../../rules/general/index.mjs', specialty: list }, { sourcePack }))
  }
  return packCache.get(key)
}

/** 本位病人的待复核计数 */
export function reviewCounts(result) {
  const f = result.tables.findings ?? []
  const needs = f.filter((x) => x.certainty === '需人工确认' && !x.review)
  const drugs = (result.tables.events ?? []).filter((e) => e.aliases?.some((a) => /需药师复核/.test(a.nature)))
  const pendingTime = (result.tables.mentions ?? []).filter((m) => m.timeSource === '前句继承（待复核）')
  const reads = result.reviews ?? []
  const readOpen = reads.filter((r) => !r.resolved && !r.decided).length
  return { findings: needs.length, drugMappings: drugs.length, pendingTime: pendingTime.length, read: readOpen, readResolved: reads.filter((r) => r.resolved).length, pending: needs.length + readOpen }
}

function mappingsOf(result) {
  const seen = new Map()
  for (const e of result.tables.events ?? []) for (const a of e.aliases ?? []) {
    if (/需药师复核|需医生复核/.test(a.nature)) seen.set(`${a.alias}→${a.concept}`, { alias: a.alias, concept: a.concept, nature: a.nature, event: e.id })
  }
  return [...seen.values()]
}

/**
 * task: { runId, shard, units: [{ dir, patient, sub }], specialty, sourcePack, settings, mode, maxRounds, asOf, stagingDir, workDir, decisions: [[k, v]…], cacheOnly, producer }
 * env:  { store（记录库）, chatImpl?, modelGate?, isCancelled(), onProgress(patients) , onPatient(name, stage) }
 */
export async function processShard(task, env) {
  const t0 = Date.now()
  const { settings } = task
  const pack = await packFor(task.specialty, task.sourcePack)
  const decisions = new Map(task.decisions ?? [])
  const gate = env.modelGate ?? new SharedArrayBuffer(GATE_BYTES)
  const slots = modelSlots({ ...settings, verifyModel: settings.verifyModel }, env.chatImpl ? { extract: env.chatImpl.a, verify: env.chatImpl.b } : null)
  const mk = (base, model) => createLlm({ baseURL: base, model, apiKey: settings.apiKey, timeoutMs: settings.timeoutMs, disableThinking: settings.disableThinking })
  const a = env.chatImpl?.a ?? (settings.baseURL && settings.model ? mk(settings.baseURL, settings.model) : null)
  const b = env.chatImpl ? env.chatImpl.b ?? null : settings.verifyModel ? mk(settings.verifyBaseURL || settings.baseURL, settings.verifyModel) : null
  if (!a && !task.cacheOnly) throw new Error('没有配置通读模型')
  const STATION = { a: 'extract', b: 'verify', ra: 'adjudicate', rb: 'adjudicate' }
  const limits = {}
  const limiterOf = (role) => (limits[role] ??= gateLimiter(gate, { ...(role === 'b' || role === 'rb' ? slots.verify ?? slots.extract : slots.extract), station: STATION[role] }))
  const ROLE = { a: 'read', b: 'verify', ra: 'review-read', rb: 'review-verify' }
  const perf = {}
  let currentPatient = null
  /** 一次模型调用：限流、记统计；失败返回 null（这一批的单位没有答案，按规则补或留空，可继续处理时重试） */
  const ask = async (role, llm, prompt) => {
    if (task.cacheOnly) return null
    const lim = limiterOf(role)
    const entry = { at: new Date().toISOString(), patient: currentPatient, role: ROLE[role], model: llm.model }
    const p = (perf[ROLE[role]] ??= { model: llm.model, calls: 0, failed: 0, retries: 0, ms: 0, pt: 0, ct: 0, ptMax: 0, hist: [0, 0, 0, 0, 0, 0, 0] })
    p.calls++
    try {
      const r = await lim(() => llm.chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], { maxTokens: 6000 }))
      const pt = r.usage?.prompt_tokens ?? 0; const ct = r.usage?.completion_tokens ?? 0
      lim.tally(pt + ct)
      p.ms += r.ms ?? 0; p.pt += pt; p.ct += ct; p.retries += r.retries ?? 0; p.ptMax = Math.max(p.ptMax, pt)
      { const sec = (r.ms ?? 0) / 1000; const i = [0.5, 1, 2, 4, 8, 16].findIndex((b) => sec < b); p.hist[i === -1 ? 6 : i]++ }
      env.store.logCall(task.runId, { ...entry, ok: true, ms: r.ms, usage: r.usage })
      return r.content
    } catch (error) {
      lim.fail(); p.failed++
      env.store.logCall(task.runId, { ...entry, ok: false, error: String(error?.message ?? error) })
      return null
    }
  }
  const store = { cacheGet: (k) => env.store.cacheGet(k), cachePut: (k, m, v) => env.store.cachePut(k, m, v, task.runId) }
  const width = Math.max(4, slots.extract.max + (slots.verify && slots.verify.slot !== 0 ? slots.verify.max : 0), settings.autoConcurrency !== false ? 32 : 0)
  const llm = { models: { a: a ?? { model: settings.model || 'cache' }, b }, ask, store, mode: task.mode, sampleRate: Number(settings.verifySampleRate ?? 0.1), maxRounds: task.maxRounds, width, isCancelled: env.isCancelled }

  await mkdir(join(task.workDir, 'review'), { recursive: true })
  const name = partName(task.shard)
  const tmp = join(task.workDir, 'review', `${name}.tmp`)
  const rv = gzWriter(tmp)
  const patients = []
  for (const unit of task.units) {
    if (env.isCancelled()) break
    const p0 = Date.now()
    currentPatient = unit.patient
    env.onPatient?.(unit.patient, 'S01')
    let result
    try {
      const raw = await readPatient(unit.dir, pack.source)
      result = await runStages(raw, pack, { asOf: task.asOf ?? undefined, llm, decisions, onStage: (st) => env.onPatient?.(unit.patient, st) })
    } catch (e) {
      // 读不了或处理出错的病人记原因、跳过，同一数据块的其他病人照常处理
      patients.push({ patient: unit.patient, status: 'failed', error: String(e?.message ?? e).slice(0, 400), ms: Date.now() - p0, failedGates: [], counts: { fragments: 0, mentions: 0, events: 0, findings: 0 }, review: { findings: 0, read: 0, pending: 0 } })
      continue
    }
    if (env.isCancelled()) break
    // 句子答案命中缓存（别的病人、别的批次问过）：记进调用统计的「缓存复用」
    const hit = result.summary.read?.cached
    if (hit && !task.cacheOnly) {
      for (const [k, role, llmOf] of [['a', 'read', a], ['b', 'verify', b], ['r', 'review-read', a]]) {
        const n = hit[k] ?? 0
        if (!n || !llmOf) continue
        const pp = (perf[role] ??= { model: llmOf.model, calls: 0, failed: 0, retries: 0, ms: 0, pt: 0, ct: 0, ptMax: 0, hist: [0, 0, 0, 0, 0, 0, 0] })
        pp.cached = (pp.cached ?? 0) + n
        for (let i = 0; i < n; i++) env.store.logCall(task.runId, { role, model: llmOf.model, cached: true, ok: true })
      }
    }
    env.onPatient?.(unit.patient, 'S07')
    // 复核项：通读分歧标上已有的人工判断（decided）
    for (const r of result.reviews ?? []) { const d = decisions.get(`review\u0000${r.id}`); if (d) r.decided = { decision: d.decision, at: d.at } }
    const review = reviewCounts(result)
    const dir = join(task.stagingDir, unit.sub)
    await rm(dir, { recursive: true, force: true })
    await writePackage(dir, result, { compress: settings.compress !== false, xlsx: settings.xlsx === true, patient: unit.patient, runId: task.runId, producer: task.producer, upstream: { input: task.input ?? null }, createdAt: new Date().toISOString(), review, model: task.model ?? null })
    for (const r of result.reviews ?? []) rv.write({ ...r, patient: unit.patient })
    for (const f of result.tables.findings ?? []) {
      if (f.certainty !== '需人工确认' && f.verdict !== '矛盾') continue
      rv.write({ id: f.id, kind: 'finding', patient: unit.patient, verdict: f.verdict, subclass: f.subclass, title: f.why, certainty: f.certainty, events: f.events, decided: f.review ? { decision: f.review.decision, at: f.review.at } : null, resolved: f.certainty !== '需人工确认' ? { by: '规则确定' } : null })
    }
    const mappings = mappingsOf(result)
    for (const m of mappings) rv.write({ id: `${m.alias}→${m.concept}`, kind: 'mapping', patient: unit.patient, title: `${m.alias} → ${m.concept}`, nature: m.nature, event: m.event, resolved: null })
    const g = result.summary.gates
    const rd = result.summary.read ?? null
    patients.push({
      patient: unit.patient, sub: unit.sub, status: 'done', ms: Date.now() - p0, failedGates: Object.entries(g).filter(([, v]) => !v.pass).map(([k]) => k),
      counts: { fragments: result.summary.fragments, documents: result.tables.fragments.filter((f) => f.kind === '文书').length, mentions: result.summary.mentions ?? 0, events: result.summary.events ?? 0, findings: result.summary.findings ?? 0 },
      mappings: mappings.length, verdicts: result.summary.verdicts ?? {}, types: result.summary.types ?? {}, fallbackRate: g['②']?.fallbackRate ?? null, review,
      read: rd && { units: rd.units, unique: rd.unique, sampled: rd.sampled, noAnswer: rd.noAnswer, calls: rd.calls, cached: rd.cached, failed: rd.failed, agreement: rd.agreement, missed: rd.missed, disputes: rd.disputes,
        resolvedByRound: rd.resolvedByRound, changedA: rd.changedA, changedB: rd.changedB, byRule: rd.byRule, human: rd.human, decided: rd.decided, invalid: Object.values(rd.invalid ?? {}).reduce((s, n) => s + n, 0),
        coverage: rd.coverage, manual: rd.manual, ruleCompare: rd.ruleCompare, tally: rd.tally },
      gates: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { pass: v.pass, fallbackRate: v.fallbackRate }])),
    })
    env.onProgress?.(1)
  }
  await rv.close()
  env.store.flushStats?.(task.runId)
  if (env.isCancelled()) { await rm(tmp, { force: true }); return { cancelled: true, stats: { patients, perf } } }
  await rename(tmp, join(task.workDir, 'review', name))
  return { cancelled: false, stats: { patients, perf, ms: Date.now() - t0 } }
}
