/**
 * 批次服务：规划 → 数据块（工作线程并行，断点续跑）→ 质检 → 交付 → 报告。
 * Agent 工具、/event 命令、页面 RPC 共用这一个服务；同时只跑一个批次。（做法与病历文书提取插件一致）
 *
 * 输出布局：
 *   <outputRoot>/output/<输入名>/<病人>/     交付：事件包（批次完成后才出现；同一输入重跑时以最新结果替换）；下游只读 output
 *   <outputRoot>/output/<输入名>/_cohort/   整批汇总表（多位病人时）
 *   <outputRoot>/_records/
 *     records.sqlite                       记录库（records/store.js）：批次、数据块、模型缓存、调用统计、人工判断（按稳定编号，重跑沿用）
 *     runs/<runId>/report.md|report.json   报告
 *     runs/<runId>/work/plan.json          规划（病人与数据块）
 *     runs/<runId>/work/review/part-*.ndjson.gz  复核单（按数据块）
 *     runs/<runId>/staging/<输入名>/        运行中的事件包；取消或失败时留在这里，不进 output
 */
import { randomBytes } from 'node:crypto'
import { readFileSync, createReadStream } from 'node:fs'
import { availableParallelism } from 'node:os'
import { getHeapStatistics } from 'node:v8'
import { cp, mkdir, readFile, readdir, realpath, rename, rm, stat, statfs, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline'
import { createGunzip, gunzipSync } from 'node:zlib'
import { Worker } from 'node:worker_threads'
import { writeCohortExports } from './package/write.js'
import { renderReport } from './report.js'
import { walkData, groupPatients } from './recognize/profile.js'
import { recognize, summarizeRecognition, loadElementDict } from './recognize/index.js'
import { openLibrary } from './recognize/library.js'
import { normalizeSpec, checkSpec, fixSpec } from './recognize/draft.js'
import { RECORD_TYPES, DOCUMENT_TYPES, STRUCTURED_TYPES, COMMON_ROLES } from './recognize/canon.js'
import { tierOf } from './engine/s05-judge.js'
import { openRecords } from './records/store.js'
import { GATE_BYTES, partName, processShard, readGate, packFor } from './engine/shard.js'
import { createServerProbe, createTuner, gated, gateLimiter, modelSlots, setLimit } from './engine/gate.js'
import { mentionId } from './engine/ids.js'
import { parseCategory, CODES } from './engine/taxonomy.js'
import { listModels } from './llm.js'

export const RECORDS = '_records'
/** 交付数据放在输出根目录的 output 里，和 _records 分开（同匿名化、病历文书提取插件）；下游只读 output */
export const DELIVERED = 'output'
/** 批次运行中的事件包：_records/runs/<批次>/staging；取消或失败时留在这里，不进 output */
export const STAGING = 'staging'
const PERSON_FILE = 'p_doc_dwd_psn_rcd.json'

export const DEFAULTS = {
  outputRoot: '',
  // 专科层规则包（rules/specialty/<名>），可多个；不装专科包也能跑
  specialty: ['hemodialysis'],
  // hybrid：模型通读＋规则对照（模型漏的规则补上；复查仍不一致时规则作第三票）；model：只用模型，复查仍不一致直接转人工
  readMode: 'hybrid',
  baseURL: '',
  model: '',
  apiKey: '',
  verifyBaseURL: '',
  verifyModel: '',
  disableThinking: true,
  timeoutMs: 120000,
  modelConcurrency: 8,
  verifyConcurrency: 8,
  autoConcurrency: true,
  // 复查轮次上限（1–6）
  maxRounds: 3,
  // 核验模型抽查的句子比例（按句子内容稳定抽样）；1 = 全部核验
  verifySampleRate: 0.1,
  // 质检⑤：核验一致率（复查前）阈值
  verifyThreshold: 0.9,
  workers: 0,
  // 每个数据块的病人数
  shardUnits: 4,
  // 格式识别（非内置格式）
  elementDict: '',
  borrowFormats: true,
  compress: true,
  xlsx: false,
  showSidebarEntry: true,
}
export const SAVABLE = Object.keys(DEFAULTS)
export const NO_MODEL = '没有配置通读模型：本插件由模型通读病历、规则对照。请到「设置 → 病历事件还原」填写模型端点（baseURL）和模型名称（model）后再开始'

/** 本插件家族各插件的输出目录（_medical-anonymizer、_medical-event…）与 _records：永远不当输入读。 */
const isToolOutput = (p) => /^_medical-[\w-]+$/.test(basename(p)) || basename(p) === RECORDS
async function exists(p) { try { await stat(p); return true } catch { return false } }
async function realish(p) {
  let cur = resolve(p); const rest = []
  for (;;) {
    try { return join(await realpath(cur), ...rest) } catch { /* climb */ }
    const up = dirname(cur)
    if (up === cur) return resolve(p)
    rest.unshift(basename(cur)); cur = up
  }
}
const inside = (child, parent) => child === parent || child.startsWith(parent + sep)
async function walkFiles(dir, out = [], skip = () => false) {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!skip(p)) await walkFiles(p, out, skip) } else if (e.isFile()) out.push(p)
  }
  return out
}

/**
 * 病人根目录：每个人口信息文件往上找、不含其他人口信息文件的最高一级目录（输入以下）。
 * 没有人口信息文件时整个输入是一位病人；不是区域平台导出时返回 []。
 */
export async function findPatients(inputDir, skip) {
  const files = await walkFiles(inputDir, [], skip)
  const persons = files.filter((f) => basename(f) === PERSON_FILE)
  if (!files.some((f) => /p_doc_\w+\.json$/.test(basename(f)))) return []
  if (persons.length <= 1) return [inputDir]
  const roots = new Set()
  for (const p of persons) {
    let cur = dirname(p)
    for (;;) {
      const up = dirname(cur)
      if (up === cur || relative(inputDir, up).startsWith('..') || up === dirname(inputDir)) break
      const others = persons.filter((q) => q !== p && (q + sep).startsWith(up + sep))
      if (others.length || resolve(up) === resolve(inputDir)) break
      cur = up
    }
    roots.add(cur)
  }
  return [...roots].sort()
}
async function sourceSnapshot(dir) {
  const snap = {}
  for (const f of await walkFiles(dir, [], isToolOutput)) { const s = await stat(f); snap[relative(dir, f)] = `${s.size}:${s.mtimeMs}` }
  return snap
}
const newRunId = () => {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${randomBytes(3).toString('hex')}`
}
/** 逐行读 ndjson(.gz) 文件夹（复核单） */
async function* readParts(dir, only = null) {
  let names = []
  try { names = (await readdir(dir)).filter((n) => n.endsWith('.ndjson.gz') && (!only || n === only)).sort() } catch { return }
  for (const n of names) {
    const rl = createInterface({ input: createReadStream(join(dir, n)).pipe(createGunzip()), crlfDelay: Infinity })
    for await (const line of rl) if (line) yield JSON.parse(line)
  }
}

/** 规划文件里有识别出的数据源层（含正则）：正则存成 { __re, flags }，读回时还原 */
const planJson = (plan) => JSON.stringify(plan, (k, v) => (v instanceof RegExp ? { __re: v.source, flags: v.flags } : v))
async function readPlan(file) {
  return JSON.parse(await readFile(file, 'utf8'), (k, v) => (v && typeof v === 'object' && typeof v.__re === 'string' ? new RegExp(v.__re, v.flags ?? '') : v))
}

let VERSION_CACHE = null
const VERSION = () => { if (!VERSION_CACHE) { try { VERSION_CACHE = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version } catch { VERSION_CACHE = '0.0.0' } } return VERSION_CACHE }

const STAGE_STEP = { S00: '格式识别', S01: '读入·片段', S02: '通读·提及', S03: '类型', S04: '事件归并·印证', S05: '矛盾判断', S07: '生成事件包' }

export function createService({ config = {}, defaultDirectory = process.cwd(), stateDir = null, chatImpl = null } = {}) {
  const settings = { ...DEFAULTS, ...config }
  // 旧设置：modelLimit、modelEnabled 已不用
  let active = null // { run, cancelled, workers, records, prevId, modelGate }
  let applying = null
  const stores = new Map()
  const runRoots = new Map()
  // 本机格式库（各输出根目录共用）；兄弟插件病历文书提取的格式库只读借用
  const library = openLibrary(stateDir)
  const siblings = () => {
    if (!stateDir || settings.borrowFormats === false) return []
    const lib = openLibrary(join(dirname(stateDir), 'medical-extract'))
    lib.label = '病历文书提取'
    return [lib]
  }

  async function recordsOf(outputRoot, { create = true } = {}) {
    if (!stores.has(outputRoot)) {
      if (!create && !(await exists(join(outputRoot, RECORDS)))) return null
      const p = openRecords(join(outputRoot, RECORDS))
      p.catch(() => stores.delete(outputRoot))
      stores.set(outputRoot, p)
    }
    return stores.get(outputRoot)
  }
  const rootsFile = () => (stateDir ? join(stateDir, 'roots.json') : null)
  async function rememberRoot(root) {
    const f = rootsFile(); if (!f) return
    let roots = []
    try { roots = JSON.parse(await readFile(f, 'utf8')) } catch { /* new */ }
    roots = [root, ...roots.filter((r) => r !== root)].slice(0, 20)
    await mkdir(dirname(f), { recursive: true })
    await writeFile(f, JSON.stringify(roots, null, 2))
  }
  async function knownRoots() {
    const f = rootsFile(); let roots = []
    if (f) try { roots = JSON.parse(await readFile(f, 'utf8')) } catch { /* none */ }
    for (const r of runRoots.values()) if (!roots.includes(r)) roots.push(r)
    return roots
  }
  async function allRuns() {
    const out = new Map()
    for (const root of await knownRoots()) {
      const rec = await recordsOf(root, { create: false }).catch(() => null)
      if (!rec) continue
      for (const r of rec.listRuns(50)) { out.set(r.id, normalizeOld(r, root)); runRoots.set(r.id, root) }
    }
    if (active) out.set(active.run.id, active.run)
    return [...out.values()].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
  }
  /** 0.2 及以前的批次：补齐新字段，页面照常能看 */
  function normalizeOld(r, root) {
    r.outputRoot ??= root
    r.runDir ??= join(root, RECORDS, 'runs', r.id)
    r.totals ??= {}
    r.patients ??= []
    r.gates ??= []
    r.shards ??= { total: 0, done: 0, running: 0 }
    return r
  }
  async function getRun(runId) {
    if (active && (!runId || active.run.id === runId)) return active.run
    const runs = await allRuns()
    return runId ? runs.find((r) => r.id === runId) ?? null : runs[0] ?? null
  }
  function modelInfo() {
    const on = Boolean(settings.baseURL && settings.model)
    return on || chatImpl ? { model: chatImpl?.a?.model ?? settings.model, verifyModel: chatImpl ? chatImpl.b?.model ?? '' : settings.verifyModel ?? '' } : null
  }

  async function resolvePaths({ inputDir, outputRoot }) {
    if (!inputDir) throw new Error('缺少输入目录（inputDir）')
    const input = await realish(isAbsolute(inputDir) ? inputDir : resolve(defaultDirectory, inputDir))
    if (!(await exists(input))) throw new Error(`输入不存在：${input}`)
    const st = await stat(input)
    const base = st.isDirectory() ? input : dirname(input)
    const out = await realish(outputRoot ? (isAbsolute(outputRoot) ? outputRoot : resolve(defaultDirectory, outputRoot)) : (settings.outputRoot || join(dirname(base), '_medical-event')))
    if (out === input || (inside(out, input) && st.isDirectory())) throw new Error('输出根目录不能与输入相同，也不能放在输入里面')
    if (st.isDirectory() && inside(input, out)) throw new Error('输出根目录不能包含输入')
    return { input, outputRoot: out, inputName: basename(input).replace(/\.[^.]+$/, '') || 'input' }
  }

  /** Start a batch. Returns immediately with the run id. */
  async function start(opts = {}) {
    if (active) throw Object.assign(new Error(`已有批次 ${active.run.id} 在运行；结束或取消后再开新批次`), { code: 'busy' })
    if (applying) throw Object.assign(new Error(`正在更新批次 ${applying} 的事件包；稍等再开新批次`), { code: 'busy' })
    let prev = null
    if (opts.resumeFrom) {
      prev = await getRun(opts.resumeFrom)
      if (!prev) throw new Error(`找不到批次 ${opts.resumeFrom}`)
      if (!['cancelled', 'failed'].includes(prev.status)) throw new Error(`批次 ${prev.id} 状态为 ${prev.status}，只有已取消或失败的批次可以继续`)
      if (!(await exists(join(prev.outputRoot, RECORDS, 'runs', prev.id, 'work', 'plan.json')))) throw new Error(`批次 ${prev.id} 是旧版本的批次（没有数据块规划），不能继续；请重新开始一个批次`)
    }
    if (!modelInfo()) throw Object.assign(new Error(NO_MODEL), { code: 'no-model' })
    const paths = prev ? { input: prev.input, outputRoot: prev.outputRoot, inputName: prev.inputName } : await resolvePaths(opts)
    if (!prev) {
      // 开批次前先看输入认不认得：认不得就直接报错，不留下一个“失败”的空批次
      const skipOut = (p) => resolve(p) === resolve(paths.outputRoot) || isToolOutput(p)
      if ((await stat(paths.input)).isFile()) throw Object.assign(new Error('请给一个目录：一位病人的导出目录，或包含多位病人的上级目录'), { code: 'unsupported-input' })
      if (!(await findPatients(paths.input, skipOut)).length && !(await walkData(paths.input, skipOut)).length) {
        const files = await walkFiles(paths.input, [], skipOut)
        throw Object.assign(new Error(`输入里没有能读的数据文件（json、ndjson、csv、tsv、xlsx）${files.length ? `；这个目录里有 ${files.length} 个文件，但都不是这些格式` : '；这个目录是空的'}。`), { code: 'unsupported-input' })
      }
    }
    const mode = prev ? prev.mode : (opts.mode ?? settings.readMode) === 'model' ? 'model' : 'hybrid'
    if (opts.mode && !['hybrid', 'model'].includes(opts.mode)) throw new Error('mode 应为 hybrid（模型通读＋规则对照）或 model（只用模型）')
    const asOf = prev ? prev.asOf : opts.asOf ? String(opts.asOf).trim() : null
    if (asOf && !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?$/.test(asOf)) throw new Error('asOf 格式应为 "YYYY-MM-DD HH:mm"')
    const records = await recordsOf(paths.outputRoot)
    const id = newRunId()
    const run = {
      id, status: 'running', startedAt: new Date().toISOString(), finishedAt: null, version: VERSION(),
      source: opts.source ?? { kind: 'agent' }, resumedFrom: prev?.id ?? null,
      input: paths.input, inputName: paths.inputName, outputRoot: paths.outputRoot, runDir: join(paths.outputRoot, RECORDS, 'runs', id),
      asOf, mode, specialty: prev ? prev.specialty : [].concat(opts.specialty ?? settings.specialty ?? []).filter(Boolean),
      maxRounds: prev ? prev.maxRounds : Math.max(1, Math.min(6, Number(opts.maxRounds ?? settings.maxRounds) || 3)),
      sampleRate: prev ? prev.sampleRate : Math.max(0, Math.min(1, Number(settings.verifySampleRate ?? 0.1))),
      model: modelInfo(), format: null, recognition: null,
      shards: { total: 0, done: 0, running: 0, active: [] }, patients: [], live: {},
      totals: emptyTotals(), gates: [], warnings: [], current: { stage: 'S00', step: '规划输入' }, output: null, error: null,
    }
    if (!run.model.verifyModel) run.warnings.push('未配置核验模型：不做抽样核验，质检⑤跳过；通读结果只有一个模型')
    active = { run, cancelled: false, workers: [], records, prevId: prev?.id ?? null }
    runRoots.set(id, paths.outputRoot)
    records.putRun(run)
    await rememberRoot(paths.outputRoot)
    execute(active).catch(() => { /* recorded in run */ })
    return { runId: id, outputRoot: paths.outputRoot, mode, modelConfigured: true, model: run.model.model, verifyModel: run.model.verifyModel || null }
  }

  const emptyTotals = () => ({ patients: 0, done: 0, failed: 0, failedGates: 0, documents: 0, mentions: 0, events: 0, findings: 0, review: 0, reviewResolved: 0, units: 0, unique: 0, sampled: 0, disputes: 0, byRule: 0, human: 0, resolved: 0, noAnswer: 0, invalid: 0, calls: 0, failedCalls: 0, agreement: { 边界: { n: 0, agree: 0 }, 分类: { n: 0, agree: 0 }, 时间: { n: 0, agree: 0 } }, resolvedByRound: [0, 0, 0, 0, 0, 0], ruleCompare: { model: 0, rule: 0, matched: 0, type: 0, time: 0, timeComparable: 0 }, coverage: { meaningful: 0, covered: 0, filled: 0 } })

  function totalsOf(run) {
    const t = { ...emptyTotals(), patients: run.totals.patients, calls: run.totals.calls, failedCalls: run.totals.failedCalls }
    for (const p of run.patients) {
      if (p.status === 'failed') { t.failed++; continue }
      t.done++
      if (p.failedGates?.length) t.failedGates++
      t.documents += p.counts.documents ?? 0; t.mentions += p.counts.mentions; t.events += p.counts.events; t.findings += p.counts.findings
      t.review += p.review?.pending ?? 0; t.reviewResolved += p.review?.readResolved ?? 0
      const r = p.read
      if (!r) continue
      for (const k of ['units', 'unique', 'sampled', 'disputes', 'byRule', 'human', 'noAnswer', 'invalid']) t[k] += r[k] ?? 0
      for (const k of Object.keys(t.agreement)) { t.agreement[k].n += r.agreement?.[k]?.n ?? 0; t.agreement[k].agree += r.agreement?.[k]?.agree ?? 0 }
      t.resolvedByRound = t.resolvedByRound.map((x, i) => x + (r.resolvedByRound?.[i] ?? 0))
      for (const k of Object.keys(t.ruleCompare)) t.ruleCompare[k] += r.ruleCompare?.[k] ?? 0
      for (const k of Object.keys(t.coverage)) t.coverage[k] += r.coverage?.[k] ?? 0
    }
    t.resolved = t.resolvedByRound.reduce((s, x) => s + x, 0)
    // 规则用量（整批合计）：规则包页的「这一批规则干了多少」
    const ru = { classify: {}, merge: {}, finding: {}, concepts: {}, unnormalized: {}, extract: {} }
    for (const p of run.patients) for (const k of Object.keys(ru)) for (const [x, n] of Object.entries(p.rules?.[k] ?? {})) ru[k][x] = (ru[k][x] ?? 0) + n
    run.ruleUse = ru
    return t
  }

  /** 模型表现（按角色）：数据块做完时并入，给流水线的模型房子与概览用 */
  function addModels(run, perf) {
    run.models ??= {}
    for (const [role, p] of Object.entries(perf ?? {})) {
      const x = (run.models[role] ??= { model: p.model, calls: 0, cached: 0, failed: 0, retries: 0, ms: 0, pt: 0, ct: 0, ptMax: 0, hist: [0, 0, 0, 0, 0, 0, 0] })
      for (const k of ['calls', 'cached', 'failed', 'retries', 'ms', 'pt', 'ct']) x[k] += p[k] ?? 0
      x.ptMax = Math.max(x.ptMax, p.ptMax ?? 0)
      x.hist = x.hist.map((v, i) => v + (p.hist?.[i] ?? 0))
    }
  }

  /** 质检：①–④ 每位病人都要过（不过的病人事件包停在那一步）；⑤ 核验一致率（复查前） */
  function gates(run) {
    const P = run.patients.filter((p) => p.status === 'done')
    const fail = (k) => P.filter((p) => p.failedGates?.includes(k)).map((p) => p.patient)
    const thr = Number(settings.verifyThreshold ?? 0.9)
    const fb = P.map((p) => p.fallbackRate).filter((x) => x != null)
    const out = [
      { id: '①', label: '提及与原文逐字一致、区间不倒置、不晚于写成', pass: !fail('①').length, detail: fail('①').length ? `未过 ${fail('①').length} 位：${fail('①').slice(0, 5).join('、')}` : `${P.length} 位全部通过` },
      { id: '②', label: '兜底规则命中率（供抽查）', pass: true, detail: fb.length ? `兜底命中率 ${(Math.min(...fb) * 100).toFixed(1)}%–${(Math.max(...fb) * 100).toFixed(1)}%（只算规则定类型的提及；模型已判定的不走兜底）` : '—' },
      { id: '③', label: '每条提及恰属一个事件', pass: !fail('③').length, detail: fail('③').length ? `未过 ${fail('③').length} 位：${fail('③').slice(0, 5).join('、')}` : `${P.length} 位全部通过` },
      { id: '④', label: '每条发现可回溯到原始提及', pass: !fail('④').length, detail: fail('④').length ? `未过 ${fail('④').length} 位` : `${P.length} 位全部通过` },
    ]
    if (!run.model?.verifyModel) out.push({ id: '⑤', label: `抽样核验一致率 ≥ ${thr}`, pass: true, skipped: true, detail: '未配置核验模型，跳过' })
    else {
      const A = run.totals.agreement
      const weak = Object.entries(A).filter(([, v]) => v.n >= 20 && v.agree / v.n < thr).map(([k, v]) => `${k} ${((v.agree / v.n) * 100).toFixed(1)}%`)
      const parts = Object.entries(A).map(([k, v]) => `${k} ${v.n ? ((v.agree / v.n) * 100).toFixed(1) : '—'}%（${v.n}）`)
      const T = run.totals
      out.push({ id: '⑤', label: `抽样核验一致率 ≥ ${thr}（复查前）`, pass: weak.length === 0, weak,
        detail: `抽查 ${T.sampled} 句：${parts.join('，')}；分歧 ${T.disputes} 项，复查后一致 ${T.resolved}，规则第三票 ${T.byRule}，转人工 ${T.human}${weak.length ? `；未达标：${weak.join('、')}（通读第一遍不够可靠，要改提示或换模型）` : ''}` })
    }
    return out
  }

  async function execute(job) {
    const { run, records } = job
    const runDir = run.runDir
    const workDir = join(runDir, 'work')
    const stagingDir = join(runDir, STAGING, run.inputName)
    const t00 = Date.now()
    // 模型闸门：两个模型各自的并发上限与计数（工作线程与主线程共用），见 engine/gate.js
    const slots = modelSlots(settings, chatImpl ? { extract: chatImpl.a, verify: chatImpl.b } : null)
    job.modelGate = new SharedArrayBuffer(GATE_BYTES)
    run.modelHouses = slots.slots.map(({ slot, max, model, host, roles }) => ({ slot, max, model, host, roles }))
    for (const x of slots.slots) setLimit(job.modelGate, x.slot, x.max)
    run.server = {}
    const probes = slots.slots.filter((x) => x.base).map((x) => createServerProbe(run.server[x.slot] = {}, x.base, x.model))
    let probeAt = 0
    run.autoConcurrency = settings.autoConcurrency !== false
    run.autoTune = {}
    const tuners = !run.autoConcurrency ? [] : slots.slots.map((x) => {
      const state = run.autoTune[x.slot] = { start: x.max, limit: x.max, ceiling: null, history: [] }
      return createTuner({
        state, windowMs: Number(settings.autoTuneMs) || 30000, server: () => run.server[x.slot],
        set: (v) => setLimit(job.modelGate, x.slot, v),
        read: () => { const g = readGate(job.modelGate); return { active: g.inflight[x.slot], queued: g.waiting[x.slot], limit: g.limits[x.slot], done: g.done[x.slot], tokens: g.tokens[x.slot], failed: g.failed[x.slot] } },
      })
    })
    /** 进度点：[毫秒, 已完成病人, 槽0在途, 槽1在途, 槽0排队, 槽1排队, 槽0完成, 槽1完成, 槽0 token, 槽1 token, 槽0 按工序在途×4, 槽1 按工序在途×4, 槽0失败, 槽1失败, 槽0上限, 槽1上限] */
    const mark = (force = false) => {
      const ms = Date.now() - t00
      const series = run.series ??= []
      const last = series[series.length - 1]
      if (!force && last && ms - last[0] < 400) return
      const g = readGate(job.modelGate)
      series.push([ms, run.patients.length, ...g.inflight, ...g.waiting, ...g.done, ...g.tokens, ...g.byStation[0], ...g.byStation[1], ...g.failed, ...g.limits])
      if (series.length > 240) run.series = series.filter((_, i) => i % 2 === 0 || i === series.length - 1)
      run.totals.calls = g.done[0] + g.done[1]; run.totals.failedCalls = g.failed[0] + g.failed[1]
    }
    const sample = () => {
      const u = process.memoryUsage()
      const m = run.memory ?? { peakHeap: 0, peakRss: 0 }
      Object.assign(m, { heapUsed: u.heapUsed, rss: u.rss, heapLimit: getHeapStatistics().heap_size_limit, peakHeap: Math.max(m.peakHeap, u.heapUsed), peakRss: Math.max(m.peakRss, u.rss) })
      run.memory = m
      if (Date.now() - probeAt >= 5000) { probeAt = Date.now(); for (const p of probes) p().catch(() => {}) }
      for (const tk of tuners) tk()
      mark(true)
      if (!(Date.now() - (sample.diskAt ?? 0) < 10000)) {
        sample.diskAt = Date.now()
        ;(async () => {
          for (const dir of [run.outputRoot, dirname(run.outputRoot)]) {
            try { const f = await statfs(dir); const free = Number(f.bavail) * Number(f.bsize); const total = Number(f.blocks) * Number(f.bsize); const d = run.disk ??= { minFree: free }; Object.assign(d, { free, total, minFree: Math.min(d.minFree ?? free, free) }); return } catch { /* 目录还没建：试上一级 */ }
          }
        })().catch(() => {})
      }
    }
    const save = () => { if (run.status === 'running') sample(); run.updatedAt = new Date().toISOString(); records.putRun(run) }
    let saveTimer = null
    try {
      await mkdir(workDir, { recursive: true })
      saveTimer = setInterval(save, 2000)
      const before = await sourceSnapshot(run.input)
      const skip = (p) => resolve(p) === resolve(run.outputRoot) || isToolOutput(p)
      let plan; let doneShards = new Set()
      if (job.prevId) {
        const prevDir = join(run.outputRoot, RECORDS, 'runs', job.prevId)
        plan = await readPlan(join(prevDir, 'work', 'plan.json'))
        const prevShards = records.shards(job.prevId).filter((s) => s.status === 'done')
        doneShards = new Set(prevShards.map((s) => s.shard))
        await mkdir(join(workDir, 'review'), { recursive: true })
        for (const s of prevShards) {
          const f = join(prevDir, 'work', 'review', partName(s.shard))
          if (await exists(f)) await cp(f, join(workDir, 'review', partName(s.shard)))
          for (const u of plan.shards[s.shard] ?? []) {
            const src = join(prevDir, STAGING, run.inputName, u.sub)
            if (await exists(join(src, 'manifest.json'))) await cp(src, join(stagingDir, u.sub), { recursive: true })
          }
          records.putShard(run.id, { ...s, stats: s.stats })
          run.patients.push(...(s.stats.patients ?? []))
          addModels(run, s.stats.perf)
        }
        run.format = plan.format ?? null; run.recognition = plan.recognition ?? null
      } else {
        let roots = await findPatients(run.input, skip)
        let sourcePack = null
        if (roots.length) run.format = { kind: 'builtin', id: 'zj-regional', name: '区域平台导出（p_doc_*）' }
        else {
          // S00 格式识别：不是内置格式的输入，先识别各表、组装数据源层
          run.current = { stage: 'S00', step: STAGE_STEP.S00 }
          save()
          const files = await walkData(run.input, skip)
          let dict = null
          if (settings.elementDict) {
            try { dict = await loadElementDict(isAbsolute(settings.elementDict) ? settings.elementDict : resolve(defaultDirectory, settings.elementDict)) } catch (e) { run.warnings.push(`数据元对照表读不了：${e.message}`) }
          }
          const rec = await recognize({
            files, root: run.input, library, siblings: siblings(), settings: { ...settings, maxRounds: run.maxRounds }, chatImpl: chatImpl ? { a: chatImpl.a, b: chatImpl.b } : null,
            cache: records, dict, onCall: (e) => { records.logCall(run.id, { at: new Date().toISOString(), ...e }); addModels(run, { [e.role]: { model: e.model, calls: e.cached ? 0 : 1, cached: e.cached ? 1 : 0, failed: e.ok === false ? 1 : 0, ms: e.ms ?? 0, pt: e.usage?.prompt_tokens ?? 0, ct: e.usage?.completion_tokens ?? 0 } }) },
            wrap: (role, llm) => gated(llm, gateLimiter(job.modelGate, { ...(role === 'verify' ? slots.verify ?? slots.extract : slots.extract), station: 'format' })),
            onProgress: (p) => { run.current = { stage: 'S00', step: `${STAGE_STEP.S00} ${p.done}/${p.total}` } },
            isCancelled: () => job.cancelled,
          })
          records.flushStats(run.id)
          run.recognition = summarizeRecognition(rec)
          run.format = { kind: 'recognized', id: rec.pack.id, version: rec.pack.version, name: '自动识别', tables: rec.tables.length, adopted: rec.adopted.length, held: rec.held.length, ignored: rec.ignored.length, dict: dict ? dict.size : 0, adjudicated: run.recognition.adjudicated }
          if (rec.held.length) run.warnings.push(`格式识别：${rec.held.length} 张表待确认（暂扣，没有用来生成事件）；在「格式」页确认后重新运行`)
          if (job.cancelled) throw Object.assign(new Error('已取消'), { code: 'cancelled' })
          if (!rec.adopted.length) { run.status = 'review'; throw Object.assign(new Error('没有采用的表'), { code: 'held' }) }
          sourcePack = rec.pack
          roots = await groupPatients(run.input, files)
        }
        const units = roots.map((root) => ({ dir: root, patient: relative(run.input, root) || basename(run.input), sub: roots.length === 1 ? '' : relative(run.input, root) || basename(run.input) }))
        const per = Math.max(1, Number(settings.shardUnits) || 4)
        const shards = []
        for (let i = 0; i < units.length; i += per) shards.push(units.slice(i, i + per))
        plan = { kind: run.format.kind, sourcePack, shards, format: run.format, recognition: run.recognition }
        await writeFile(join(workDir, 'plan.json'), planJson(plan))
      }
      if (job.prevId) await writeFile(join(workDir, 'plan.json'), planJson(plan))
      run.totals.patients = plan.shards.reduce((s, x) => s + x.length, 0)
      run.shards = { total: plan.shards.length, done: doneShards.size, running: 0, active: [] }
      run.totals = { ...totalsOf(run), patients: run.totals.patients }
      // 磁盘余量：每位病人的事件包约 6MB（压缩）／40MB（不压缩），按 1.5 倍预留
      try {
        const fsx = await statfs(dirname(runDir))
        const free = fsx.bavail * fsx.bsize
        const need = run.totals.patients * (settings.compress !== false ? 9 : 60) * 1024 * 1024
        if (free < need) run.warnings.push(`输出所在磁盘只剩 ${(free / 2 ** 30).toFixed(1)} GB，按估算本批需要约 ${(need / 2 ** 30).toFixed(1)} GB`)
      } catch { /* statfs unsupported */ }
      run.current = { stage: 'S02', step: '通读' }
      save()

      const decisions = [...records.decisions()]
      const todo = plan.shards.map((units, shard) => ({ shard, units })).filter((s) => !doneShards.has(s.shard))
      const task = (s) => ({
        kind: 'shard', id: s.shard, runId: run.id, shard: s.shard, units: s.units, specialty: run.specialty, sourcePack: plan.sourcePack ?? null,
        settings: { ...settings, verifyModel: run.model.verifyModel, model: run.model.model, verifySampleRate: run.sampleRate }, mode: run.mode, maxRounds: run.maxRounds, asOf: run.asOf,
        stagingDir, workDir, decisions, producer: { name: 'dsh-medical-event', version: VERSION() }, input: run.input, model: run.model,
      })
      const onShardDone = (shard, result) => {
        run.shards.done++
        run.patients.push(...result.stats.patients)
        for (const p of result.stats.patients) delete run.live[p.patient]
        addModels(run, result.stats.perf)
        records.putShard(run.id, { shard, status: 'done', patients: result.stats.patients.length, mentions: result.stats.patients.reduce((s, p) => s + (p.counts?.mentions ?? 0), 0), ms: result.stats.ms, finishedAt: new Date().toISOString(), stats: result.stats })
        run.totals = { ...totalsOf(run), patients: run.totals.patients }
      }
      const onPatient = (patient, stage) => { run.live[patient] = stage; run.current = { stage, step: STAGE_STEP[stage] ?? stage, patient } }
      const autoWorkers = Math.max(1, Math.min(8, availableParallelism() - 1))
      const nWorkers = chatImpl ? 1 : Math.max(1, Math.min(todo.length, Number(settings.workers) || autoWorkers))
      const inline = chatImpl || Number(settings.workers) === 1 || nWorkers === 1
      if (inline) {
        for (const s of todo) {
          if (job.cancelled) break
          run.shards.running = 1; run.shards.active = [s.shard]
          const result = await processShard(task(s), { store: records, chatImpl, modelGate: job.modelGate, isCancelled: () => job.cancelled, onPatient })
          run.shards.running = 0; run.shards.active = []
          if (result.cancelled) break
          onShardDone(s.shard, result)
        }
      } else {
        await runPool(job, todo.map(task), nWorkers, join(run.outputRoot, RECORDS), (t, result) => { if (!result.cancelled) onShardDone(t.shard, result) }, onPatient)
      }
      if (job.failure) throw job.failure
      run.shards.active = []; run.live = {}
      if (job.cancelled) throw Object.assign(new Error('已取消'), { code: 'cancelled' })
      run.totals = { ...totalsOf(run), patients: run.totals.patients }
      if (run.totals.failed) run.warnings.push(`${run.totals.failed} 位病人读不了或处理出错，已跳过：到「文件」页看原因`)

      // 整批汇总表
      const order = new Map(plan.shards.flat().map((u, i) => [u.patient, i]))
      run.patients.sort((a, b) => (order.get(a.patient) ?? 0) - (order.get(b.patient) ?? 0))
      const okPatients = run.patients.filter((p) => p.status === 'done')
      if (okPatients.length > 1) {
        run.current = { stage: 'S07', step: '整批汇总表' }
        run.cohort = await writeCohortExports(join(stagingDir, '_cohort'), okPatients.map((p) => ({ patient: p.patient, dir: join(stagingDir, p.sub) })), okPatients)
      }
      run.current = { stage: 'S07', step: '质检·交付' }
      run.gates = gates(run)
      const after = await sourceSnapshot(run.input)
      const changed = Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k])
      run.sourceCheck = { files: Object.keys(before).length, changed: changed.length }
      if (changed.length) run.warnings.push(`运行期间有 ${changed.length} 个源文件被改动（不是本插件改的）`)
      // 交付：<输出根目录>/output/<输入名>。同一输入重跑时以最新结果替换（每次的报告和记录仍在 _records 里）
      const target = join(run.outputRoot, DELIVERED, run.inputName)
      await rm(target, { recursive: true, force: true })
      await mkdir(dirname(target), { recursive: true })
      if (await exists(stagingDir)) await rename(stagingDir, target)
      else await mkdir(target, { recursive: true })
      await rm(join(runDir, STAGING), { recursive: true, force: true })
      run.output = target
      run.humanReview = { appliedAt: new Date().toISOString(), todo: run.totals.review, dirty: false }
      run.status = run.totals.failedGates || run.totals.review || run.totals.failed ? 'review' : 'completed'
    } catch (error) {
      if (error?.code === 'held') run.status = 'review'
      else {
        run.status = !job.failure && (error?.code === 'cancelled' || job.cancelled) ? 'cancelled' : 'failed'
        if (run.status === 'failed') run.error = String(error?.stack ?? error)
      }
    } finally {
      clearInterval(saveTimer)
      try { mark(true) } catch { /* ignore */ }
      run.current = null; run.live = {}
      run.finishedAt = new Date().toISOString()
      try { records.flushStats(run.id) } catch { /* ignore */ }
      run.calls = callSummary(records, run.id)
      try { await writeReport(run) } catch { /* best effort */ }
      save()
      if (active === job) active = null
    }
  }

  async function writeReport(run) {
    const report = renderReport(run)
    await mkdir(run.runDir, { recursive: true })
    await writeFile(join(run.runDir, 'report.md'), report.markdown)
    await writeFile(join(run.runDir, 'report.json'), JSON.stringify(report.json, null, 2))
  }
  function callSummary(records, runId) {
    try { return { byModel: records.callStats(runId), errors: records.callErrors(runId, 20) } } catch { return null }
  }

  /** 工作线程池：每个线程一次一个数据块 */
  async function runPool(job, tasks, n, recordsDir, onDone, onPatient) {
    const queue = [...tasks]
    let failure = null
    await Promise.all(Array.from({ length: Math.max(1, Math.min(n, tasks.length)) }, () => new Promise((resolveW) => {
      const w = new Worker(new URL('./engine/worker.js', import.meta.url), { workerData: { recordsDir, modelGate: job.modelGate ?? null } })
      job.workers.push(w)
      let current = null
      const finish = () => { job.workers = job.workers.filter((x) => x !== w); w.terminate().then(() => resolveW(), () => resolveW()) }
      const next = () => {
        if (job.cancelled || failure || !queue.length) { finish(); return }
        current = queue.shift()
        job.run.shards.running++; job.run.shards.active.push(current.shard)
        w.postMessage({ type: 'task', task: current })
      }
      const release = () => { job.run.shards.running--; job.run.shards.active = job.run.shards.active.filter((x) => x !== current.shard) }
      w.on('message', (m) => {
        if (m.type === 'ready') next()
        else if (m.type === 'patient') onPatient(m.patient, m.stage)
        else if (m.type === 'done') { release(); onDone(current, m.result); next() }
        else if (m.type === 'error') {
          release()
          failure ??= new Error(`数据块 ${current.shard} 失败：${m.error}`)
          job.cancelled = true
          for (const o of job.workers) o.postMessage({ type: 'cancel' })
          finish()
        }
      })
      w.on('error', (e) => { failure ??= e; job.cancelled = true; resolveW() })
    })))
    if (failure) { job.failure = failure; throw failure }
  }

  /* ----------------------------------------------------------- queries */
  async function status(runId) {
    const run = await getRun(runId)
    return { run, active: active?.run.id ?? null }
  }
  async function list() {
    return { runs: (await allRuns()).map((r) => ({ id: r.id, status: r.status, startedAt: r.startedAt, finishedAt: r.finishedAt ?? null, input: r.inputName, outputRoot: r.outputRoot, mode: r.mode ?? null, patients: r.totals?.patients ?? 0, mentions: r.totals?.mentions ?? 0, events: r.totals?.events ?? 0, findings: r.totals?.findings ?? 0, review: r.totals?.review ?? 0, resumable: ['cancelled', 'failed'].includes(r.status) })), active: active?.run.id ?? null }
  }
  async function report(runId) {
    const run = await getRun(runId)
    if (!run) throw new Error('还没有批次')
    const path = join(run.runDir, 'report.md')
    try { return { runId: run.id, path, markdown: await readFile(path, 'utf8') } } catch { return { runId: run.id, path, markdown: renderReport(run).markdown } }
  }
  function cancel(runId) {
    if (!active) return { cancelled: false, reason: '没有正在运行的批次' }
    if (runId && runId !== active.run.id) return { cancelled: false, reason: `正在运行的是 ${active.run.id}` }
    active.cancelled = true
    for (const w of active.workers) w.postMessage({ type: 'cancel' })
    return { cancelled: true, runId: active.run.id }
  }

  /**
   * 清空批次记录（只给页面用，不是 Agent 工具）：除正在运行的批次（及它续跑沿用的批次）外，删掉每个批次的
   * _records/runs/<批次> 和记录库里的批次行。保留人工判断、模型回复缓存、格式库；
   * deliverable: true 时一并删除 <输出根目录>/output 下的交付目录（只删 output 下一层）。
   */
  async function clearRuns({ deliverable = false } = {}) {
    let removed = 0; const failed = []; const outputs = new Set(); const tried = new Set()
    for (let pass = 0; pass < 1000; pass++) {
      const keep = new Set([active?.run.id, active?.prevId].filter(Boolean))
      const pending = (await allRuns()).filter((r) => !keep.has(r.id) && !tried.has(r.id))
      if (!pending.length) break
      for (const r of pending) {
        tried.add(r.id)
        try {
          const root = runRoots.get(r.id) ?? r.outputRoot
          if (!root || !/^[\w-]{1,80}$/.test(r.id)) throw new Error('找不到输出位置')
          if (deliverable && r.output) outputs.add(JSON.stringify([root, r.output]))
          await rm(join(root, RECORDS, 'runs', r.id), { recursive: true, force: true })
          ;(await recordsOf(root, { create: false }))?.deleteRun(r.id)
          runRoots.delete(r.id); removed++
        } catch (e) { failed.push({ id: r.id, error: String(e?.message ?? e) }) }
      }
    }
    let outputsRemoved = 0
    for (const item of outputs) {
      const [root, out] = JSON.parse(item)
      const base = resolve(root, DELIVERED); const target = resolve(out)
      if (dirname(target) !== base) { failed.push({ id: out, error: '交付数据不在输出根目录的 output 下，未删除' }); continue }
      await rm(target, { recursive: true, force: true }); outputsRemoved++
    }
    return { removed, outputsRemoved, failed, kept: active ? (active.prevId ? 2 : 1) : 0 }
  }

  /* ------------------------------------------------------------ 事件包 */
  /** 一位病人的事件包所在（已交付或暂存） */
  async function packageDir(run, patient) {
    const entry = run.patients.find((p) => p.patient === patient)
    const sub = entry ? (entry.sub ?? (entry.single ? '' : patient)) : patient === run.inputName ? '' : patient
    const candidates = [run.output && join(run.output, sub), join(run.runDir ?? join(run.outputRoot, RECORDS, 'runs', run.id), STAGING, run.inputName, sub), join(run.runDir ?? '', 'output', run.inputName, sub)].filter(Boolean)
    for (const c of candidates) if (await exists(join(c, 'manifest.json'))) return c
    return null
  }
  const fileCache = new Map()
  async function readJsonl(p0) {
    const p = (await exists(p0)) ? p0 : `${p0}.gz`
    try {
      const st = await stat(p)
      const hit = fileCache.get(p)
      if (hit && hit.mtime === st.mtimeMs) return hit.rows
      const buf = await readFile(p)
      const rows = (p.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
      fileCache.set(p, { mtime: st.mtimeMs, rows })
      if (fileCache.size > 40) fileCache.delete(fileCache.keys().next().value)
      return rows
    } catch { return [] }
  }
  async function patientData(runId, patient, parts = ['manifest', 'events', 'findings', 'encounters']) {
    const run = await getRun(runId)
    if (!run) throw new Error(`找不到批次 ${runId}`)
    const dir = await packageDir(run, patient)
    if (!dir) throw new Error(`找不到 ${patient} 的事件包`)
    const out = { patient, dir }
    for (const p of parts) {
      if (p === 'manifest') out.manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
      else if (p === 'stageChanges') { try { out.stageChanges = JSON.parse(await readFile(join(dir, 'stage-changes.json'), 'utf8')) } catch { out.stageChanges = [] } }
      else out[p] = await readJsonl(join(dir, `${p}.jsonl`))
    }
    if (out.findings) {
      const dec = (await recordsOf(run.outputRoot)).decisions()
      for (const f of out.findings) { const d = dec.get(`finding\u0000${f.id}`) ?? dec.get(`findings\u0000${f.id}`); f.review = d ? { decision: d.decision, note: d.note, by: d.by, at: d.at } : f.review ?? null }
    }
    return out
  }

  /** 患者清单（页面）：名字、状态、计数、待复核 */
  async function patients(runId, { q = '', only = null, offset = 0, limit = 500 } = {}) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const todo = await openReviewCounts(run)
    let rows = run.patients.map((p) => ({ patient: p.patient, status: p.status, error: p.error ?? null, failedGates: p.failedGates ?? [], counts: p.counts, fallbackRate: p.fallbackRate ?? null, ms: p.ms, todo: todo.byPatient.get(p.patient) ?? 0, review: p.review, agreement: p.read?.agreement ?? null, disputes: p.read?.disputes ?? 0 }))
    const all = rows.length; const withTodo = rows.filter((r) => r.todo > 0).length
    if (q) rows = rows.filter((r) => r.patient.includes(q))
    if (only === 'todo') rows = rows.filter((r) => r.todo > 0)
    return { items: rows.slice(offset, offset + limit), total: rows.length, patientsAll: all, patientsTodo: withTodo, todo: [...todo.byPatient.values()].reduce((s, n) => s + n, 0) }
  }

  /* --------------------------------------------------------------- 文件 */
  /** 文件页：输入单元（病人文件夹）逐个列出处理状态与小计 */
  async function files(runId, { status = 'all', q = '', offset = 0, limit = 200 } = {}) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    let plan = null
    try { plan = await readPlan(join(run.runDir, 'work', 'plan.json')) } catch { /* 旧批次 */ }
    const done = new Map(run.patients.map((p) => [p.patient, p]))
    const activeShards = new Set(run.status === 'running' ? run.shards?.active ?? [] : [])
    const rows = []
    const units = plan ? plan.shards.flatMap((us, shard) => us.map((u) => ({ ...u, shard }))) : run.patients.map((p) => ({ patient: p.patient, dir: join(run.input, p.patient), shard: null }))
    for (const u of units) {
      const p = done.get(u.patient)
      const st = p ? (p.status === 'failed' ? 'failed' : 'done') : run.live?.[u.patient] ? 'running' : activeShards.has(u.shard) ? 'queued' : run.status === 'running' ? 'waiting' : 'stopped'
      rows.push({ name: relative(run.input, u.dir) || basename(u.dir), patient: u.patient, shard: u.shard, status: st, stage: run.live?.[u.patient] ?? null, error: p?.error ?? null, documents: p?.counts?.documents ?? null, mentions: p?.counts?.mentions ?? null, events: p?.counts?.events ?? null, findings: p?.counts?.findings ?? null, review: p?.review?.pending ?? null, failedGates: p?.failedGates ?? [], ms: p?.ms ?? null })
    }
    const is = { all: () => true, running: (r) => r.status === 'running' || r.status === 'queued', failed: (r) => r.status === 'failed' || r.failedGates.length > 0, todo: (r) => (r.review ?? 0) > 0, waiting: (r) => r.status === 'waiting' || r.status === 'stopped' }
    const counts = Object.fromEntries(Object.entries(is).map(([k, f]) => [k, rows.filter(f).length]))
    const rank = { running: 0, queued: 1, failed: 2 }
    const listed = rows.filter((r) => (is[status] ?? is.all)(r) && (!q || r.name.includes(q))).sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3))
    return { items: listed.slice(offset, offset + limit), total: listed.length, counts }
  }

  /* --------------------------------------------------------------- 复核 */
  const reviewDirOf = (run) => join(run.runDir, 'work', 'review')
  const decidedOf = (dec, r) => dec.get(`${r.kind === 'mention' ? 'review' : r.kind}\u0000${r.id}`) ?? (r.kind === 'finding' ? dec.get(`findings\u0000${r.id}`) : null) ?? null
  /** 还没判断的转人工项：按病人、按片段计数 */
  async function openReviewCounts(run, { patient = null } = {}) {
    const dec = (await recordsOf(run.outputRoot)).decisions()
    const byPatient = new Map(); const byFragment = new Map()
    for await (const r of readParts(reviewDirOf(run))) {
      if (r.resolved || decidedOf(dec, r) || (patient && r.patient !== patient)) continue
      byPatient.set(r.patient, (byPatient.get(r.patient) ?? 0) + 1)
      for (const o of r.occurrences ?? []) byFragment.set(o.fragmentId, (byFragment.get(o.fragmentId) ?? 0) + 1)
    }
    return { byPatient, byFragment }
  }
  /**
   * 复核单（分页）：通读分歧（同一句在几位病人里出现只列一次，标出现在哪些病人）、需人工确认的发现、需药师复核的药名。
   * status：open＝转人工的（含已判断，默认）、todo＝还没判断、decided＝已判断、resolved＝复查后一致或规则第三票（供抽查）、all
   */
  async function reviewQueue(runId, { kind = null, dispute = null, status = 'open', patient = null, offset = 0, limit = 50 } = {}) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const dec = (await recordsOf(run.outputRoot)).decisions()
    const byId = new Map()
    const counts = { open: 0, todo: 0, decided: 0, resolved: 0, all: 0 }
    const kinds = {}
    for await (const r of readParts(reviewDirOf(run))) {
      const key = `${r.kind}\u0000${r.id}`
      const hit = byId.get(key)
      if (hit) { if (!hit.patients.includes(r.patient)) hit.patients.push(r.patient); continue }
      const d = decidedOf(dec, r)
      byId.set(key, { ...r, patients: [r.patient], decision: d ? { decision: d.decision, note: d.note, at: d.at, value: d.value } : null })
    }
    const items = []
    for (const r of byId.values()) {
      counts.all++
      if (r.resolved) counts.resolved++
      else { counts.open++; if (r.decision) counts.decided++; else counts.todo++ }
      const k = r.kind === 'mention' ? `mention:${r.dispute}` : r.kind
      kinds[k] = (kinds[k] ?? 0) + (r.resolved || r.decision ? 0 : 1)
      const inStatus = status === 'all' ? true : status === 'resolved' ? Boolean(r.resolved) : status === 'decided' ? !r.resolved && Boolean(r.decision) : status === 'todo' ? !r.resolved && !r.decision : !r.resolved
      if (!inStatus || (kind && r.kind !== kind) || (dispute && r.dispute !== dispute) || (patient && !r.patients.includes(patient))) continue
      items.push(r)
    }
    items.sort((a, b) => Number(Boolean(a.decision)) - Number(Boolean(b.decision)))
    return { runId: run.id, items: items.slice(offset, offset + limit), total: items.length, offset, counts, kinds, dirty: Boolean(run.humanReview?.dirty), hasOutput: Boolean(run.output), runStatus: run.status }
  }

  function markDirty(run, records) {
    run.humanReview = { ...(run.humanReview ?? {}), dirty: true }
    records.putRun(run)
  }
  /**
   * 人工判断（按稳定编号存在记录库，重跑沿用；「更新事件包」立即生效）：
   *   review（通读分歧）：confirm 维持当前结果、useVerify 改用另一方、reject 去掉这一条、clear 撤销
   *   finding（发现）：确认／不采用／改判（decision 原样存）、clear
   *   mapping（药名映射）：confirm、reject、clear
   *   mention（提及）：reject 去掉、correct（value：{ code, neg } 或 { from, to }）、clear
   *   add（人工补充的提及）：只能 clear；补充用 addMention
   */
  async function decide(runId, { kind = 'finding', target, id, decision, value = null, note = null } = {}) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    target ??= id
    if (!target) throw new Error('缺少要判断的编号（target）')
    if (kind === 'findings') kind = 'finding'
    const allowed = { review: ['confirm', 'useVerify', 'reject', 'clear'], mention: ['reject', 'correct', 'clear'], add: ['clear'], mapping: ['confirm', 'reject', 'clear'] }
    if (!['review', 'finding', 'mapping', 'mention', 'add'].includes(kind)) throw new Error('kind 应为 review、finding、mapping、mention 或 add')
    if (allowed[kind] && !allowed[kind].includes(decision)) throw new Error(`${kind} 的 decision 应为 ${allowed[kind].join('、')}`)
    if (!decision) throw new Error('缺少 decision')
    if (kind === 'mention' && decision === 'correct') {
      if (!value || (!value.code && value.from === undefined)) throw new Error('改类型给 value.code（类型代码，如 F03），改时间给 value.from／value.to（YYYY-MM-DD）')
      if (value.code && !parseCategory(value.code)) throw new Error(`类型代码 ${value.code} 不在类型表里`)
      for (const k of ['from', 'to']) if (value[k] && !/^\d{4}-\d{2}-\d{2}$/.test(value[k])) throw new Error('日期写成 YYYY-MM-DD')
    }
    const records = await recordsOf(run.outputRoot)
    records.decide({ kind, target, decision, value, note, by: 'user', runId: run.id })
    if (kind === 'finding') records.decide({ kind: 'findings', target, decision: 'clear', by: 'user', runId: run.id }) // 旧版本存的 kind
    markDirty(run, records)
    return { ok: true, saved: true, id: target, kind }
  }

  /** 在原文上补一条漏提的提及：位置由页面给（选中的文字），插件按原文核对；出处记「人工」，存为 add 判断 */
  async function addMention(runId, { patient, fragmentId, s, e, code, neg = false, from = null, to = null, note = null } = {}) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const d = await patientData(run.id, patient, ['fragments'])
    const f = d.fragments.find((x) => x.id === fragmentId)
    if (!f) throw new Error('找不到这份文书')
    s = Number(s); e = Number(e)
    if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || e > f.text.length || e <= s || e - s > 200) throw new Error('原文位置不对（要选中原文里 1–200 个字）')
    if (!parseCategory(code)) throw new Error(`类型代码 ${code} 不在类型表里`)
    for (const x of [from, to]) if (x && !/^\d{4}-\d{2}-\d{2}$/.test(x)) throw new Error('日期写成 YYYY-MM-DD')
    const id = mentionId(f.id, s, e)
    const sec = (() => { let name = ''; for (const m of d.mentions ?? []) if (m.fragmentId === f.id && m.s <= s) name = m.section; return name })()
    const value = { fragmentId: f.id, patient, s, e, text: f.text.slice(s, e), code: parseCategory(code).code, neg: Boolean(neg), from, to, section: sec }
    const records = await recordsOf(run.outputRoot)
    records.decide({ kind: 'add', target: id, decision: 'add', value, note, by: 'user', runId: run.id })
    markDirty(run, records)
    return { ok: true, id, value }
  }

  /**
   * 更新事件包：不调模型，按记录库里的全部人工判断把这一批的病人重新算一遍（模型回答全部来自缓存），
   * 替换交付目录里的事件包与整批汇总表，更新质检与报告。转人工的项都判断了，批次从「待复核」转为「完成」。
   */
  async function applyDecisions(runId) {
    if (active) throw new Error('有批次在运行；等它结束再更新事件包')
    if (applying) throw new Error(`正在更新批次 ${applying}`)
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    if (!run.output || !(await exists(run.output))) throw new Error('该批次没有交付目录，不能更新；请重跑批次')
    let plan
    try { plan = await readPlan(join(run.runDir, 'work', 'plan.json')) } catch { throw new Error('这是旧版本的批次（没有规划文件），不能只更新；请重跑批次') }
    if (!(await exists(run.input))) throw new Error(`输入目录已不在：${run.input}`)
    applying = run.id
    try {
      const records = await recordsOf(run.outputRoot)
      const decisions = [...records.decisions()]
      const tmp = join(run.runDir, 'reapply')
      const tmpStaging = join(tmp, run.inputName)
      await rm(tmp, { recursive: true, force: true })
      await rm(join(run.runDir, 'work', 'review-new'), { recursive: true, force: true })
      const patientsOut = []
      for (const [shard, units] of plan.shards.entries()) {
        const r = await processShard({
          kind: 'shard', id: shard, runId: run.id, shard, units, specialty: run.specialty, sourcePack: plan.sourcePack ?? null,
          settings: { ...settings, verifyModel: run.model?.verifyModel, model: run.model?.model, verifySampleRate: run.sampleRate ?? settings.verifySampleRate }, mode: run.mode, maxRounds: run.maxRounds, asOf: run.asOf,
          stagingDir: tmpStaging, workDir: join(tmp, 'work'), decisions, producer: { name: 'dsh-medical-event', version: VERSION() }, input: run.input, model: run.model, cacheOnly: true,
        }, { store: records, chatImpl, isCancelled: () => false })
        patientsOut.push(...r.stats.patients)
      }
      for (const p of patientsOut) {
        if (p.status !== 'done') continue
        const dst = join(run.output, p.sub)
        if (p.sub) await rm(dst, { recursive: true, force: true })
        else for (const n of await readdir(dst)) if (n !== '_cohort') await rm(join(dst, n), { recursive: true, force: true })
        if (p.sub) await rename(join(tmpStaging, p.sub), dst)
        else for (const n of await readdir(tmpStaging)) await rename(join(tmpStaging, n), join(dst, n))
      }
      await rm(join(run.runDir, 'work', 'review'), { recursive: true, force: true })
      await rename(join(tmp, 'work', 'review'), join(run.runDir, 'work', 'review'))
      run.patients = patientsOut
      run.totals = { ...totalsOf(run), patients: run.totals.patients }
      const ok = patientsOut.filter((p) => p.status === 'done')
      if (ok.length > 1) run.cohort = await writeCohortExports(join(run.output, '_cohort'), ok.map((p) => ({ patient: p.patient, dir: join(run.output, p.sub) })), ok)
      await rm(tmp, { recursive: true, force: true })
      run.gates = gates(run)
      const at = new Date().toISOString()
      run.humanReview = { appliedAt: at, todo: run.totals.review, dirty: false }
      if (run.status === 'review' && !run.totals.review && !run.totals.failedGates && !run.totals.failed) run.status = 'completed'
      await writeReport(run)
      records.putRun(run)
      return { status: run.status, todo: run.totals.review, patients: ok.length }
    } finally { applying = null }
  }

  /* --------------------------------------------------------- 逐份核对 */
  const TIER = { 1: '结构化记录', 2: '同期文书', 3: '同次补记', 4: '回顾转述', 5: '外院转述', 6: '模板化内容' }
  const brief = (m) => m && ({ id: m.id, text: m.text, recordType: m.recordType, section: m.section, writtenAt: m.writtenAt, occurFrom: m.occurFrom, occurTo: m.occurTo, timeSource: m.timeSource, type: m.type, subdivision: m.subdivision, item: m.item, negative: m.negative, templated: m.templated, fragmentId: m.fragmentId, tier: tierOf(m), tierName: TIER[tierOf(m)], rule: m.rules?.classify, extract: m.rules?.extract, by: m.by ?? null, eventId: m.eventId, s: m.s, e: m.e })

  /** 一位病人的文书（片段）清单，带提及数与待判断数 */
  async function documents(runId, patient) {
    const run = await getRun(runId)
    const d = await patientData(runId, patient, ['fragments', 'mentions'])
    const counts = new Map()
    for (const m of d.mentions) counts.set(m.fragmentId, (counts.get(m.fragmentId) ?? 0) + 1)
    const { byFragment } = await openReviewCounts(run, { patient })
    return { documents: d.fragments.filter((f) => f.kind === '文书').map((f) => ({ id: f.id, recordType: f.recordType, field: f.field, visibleAt: f.visibleAt, encounterId: f.encounterId ?? null, version: f.version ?? 1, mentions: counts.get(f.id) ?? 0, todo: byFragment.get(f.id) ?? 0 })) }
  }
  /** 一份文书的核对视图：原文、提及（带出处、人工判断）、人工补充的、落在这份文书上的复核项 */
  async function fragment(runId, patient, fragmentId) {
    const run = await getRun(runId)
    const d = await patientData(runId, patient, ['fragments', 'mentions', 'reviews'])
    const f = d.fragments.find((x) => x.id === fragmentId)
    if (!f) throw new Error('找不到片段')
    const dec = (await recordsOf(run.outputRoot)).decisions()
    const mentions = d.mentions.filter((m) => m.fragmentId === fragmentId).map((m) => ({ ...m, decision: dec.get(`mention\u0000${m.id}`) ?? null }))
    const added = [...dec].filter(([k, x]) => k.startsWith('add\u0000') && x.value?.fragmentId === fragmentId).map(([k, x]) => ({ id: k.slice(4), ...x.value, at: x.at }))
    const rejected = [...dec].filter(([k, x]) => k.startsWith('mention\u0000') && x.decision === 'reject').map(([k]) => k.slice(8))
    const reviews = (d.reviews ?? []).filter((r) => r.occurrences?.some((o) => o.fragmentId === fragmentId)).map((r) => {
      const x = dec.get(`review\u0000${r.id}`)
      return { ...r, decision: x ? { decision: x.decision, at: x.at, note: x.note } : null, at: r.occurrences.filter((o) => o.fragmentId === fragmentId).map((o) => ({ s: o.s, e: o.e })) }
    })
    return { fragment: f, mentions, added, rejected, reviews, dirty: Boolean(run.humanReview?.dirty), codes: CODES }
  }

  /* ------------------------------------------------------- 时间线、详情 */
  async function timeline(runId, patient) {
    const d = await patientData(runId, patient, ['manifest', 'events', 'findings', 'encounters', 'stageChanges'])
    const day = (x) => (x ? String(x).slice(0, 10) : null)
    const ev = d.events
    const top = (lst, n) => lst.sort((a, b) => b.mentionCount - a.mentionCount).slice(0, n)
    const lanes = []
    lanes.push({ id: 'visit', name: '就诊', kind: 'visit', rows: [
      { label: `住院 ${d.encounters.filter((e) => e.kind === '住院').length}`, items: d.encounters.filter((e) => e.kind === '住院').map((e) => ({ a: day(e.start), b: day(e.end) ?? day(e.start), kind: 'stay', label: e.dept ?? '' })) },
      { label: `门诊 ${d.encounters.filter((e) => e.kind === '门诊').length}`, items: d.encounters.filter((e) => e.kind === '门诊').map((e) => ({ a: day(e.start), b: day(e.start), kind: 'tick' })) },
    ] })
    const span = (e) => ({ a: day(e.firstWritten), b: day(e.lastWritten) })
    const dx = top(ev.filter((e) => e.conceptGroup === '诊断' && e.polarity === '阳性' && e.form === '状态' && e.concept), 14)
    lanes.push({ id: 'dx', name: '诊断', kind: 'judge', rows: dx.map((e) => ({ label: e.concept, items: [{ ...span(e), kind: 'bar', event: e.id, n: e.mentionCount }] })) })
    const dia = ev.filter((e) => e.conceptGroup === '透析')
    lanes.push({ id: 'dialysis', name: '透析', kind: 'decide', rows: [...new Set(dia.map((e) => e.concept))].map((c) => ({ label: c, items: dia.filter((e) => e.concept === c).map((e) => e.form === '状态' ? { ...span(e), kind: 'bar', event: e.id } : { a: e.consensus?.a ?? day(e.firstWritten), b: e.consensus?.b ?? day(e.firstWritten), kind: 'point', event: e.id, conflict: e.consensus && !e.consensus.consistent }) })) })
    const drugs = ev.filter((e) => e.conceptGroup === '用药')
    const names = top([...new Map(drugs.map((e) => [e.concept, { concept: e.concept, mentionCount: drugs.filter((x) => x.concept === e.concept).reduce((s, x) => s + x.mentionCount, 0) }])).values()], 16).map((x) => x.concept)
    lanes.push({ id: 'drug', name: '用药', kind: 'decide', rows: names.map((c) => ({ label: c, items: drugs.filter((e) => e.concept === c).map((e) => e.segment ? { a: e.segment.from, b: e.segment.to, kind: 'bar', event: e.id } : { a: e.consensus?.a ?? day(e.firstWritten), b: e.consensus?.a ?? day(e.firstWritten), kind: e.drugAction === '停止' ? 'stop' : 'point', event: e.id, label: e.drugAction }) })) })
    const surg = ev.filter((e) => e.conceptGroup === '手术操作' && e.normalized !== false && e.concept)
    lanes.push({ id: 'surgery', name: '手术', kind: 'decide', rows: [...new Set(surg.map((e) => e.concept))].slice(0, 8).map((c) => ({ label: c, items: surg.filter((e) => e.concept === c).map((e) => e.form === '状态' ? { ...span(e), kind: 'bar', event: e.id, faint: true } : { a: e.consensus?.a ?? day(e.firstWritten), b: e.consensus?.b ?? day(e.firstWritten), kind: 'point', event: e.id, conflict: e.consensus && !e.consensus.consistent }) })) })
    const sym = ev.filter((e) => e.conceptGroup === '症状' && e.concept && e.polarity === '阳性')
    const symNames = top([...new Map(sym.map((e) => [e.concept, { concept: e.concept, mentionCount: sym.filter((x) => x.concept === e.concept).length }])).values()], 8).map((x) => x.concept)
    lanes.push({ id: 'symptom', name: '症状', kind: 'fact', rows: symNames.map((c) => ({ label: c, items: sym.filter((e) => e.concept === c).map((e) => ({ a: e.consensus?.a ?? day(e.firstWritten), b: e.consensus?.b ?? e.consensus?.a ?? day(e.firstWritten), kind: 'bar', event: e.id })) })) })
    const labs = ev.filter((e) => e.conceptGroup === '检验结果' && Number.isFinite(Number(e.value)) && e.consensus?.a)
    const labCount = {}
    for (const e of labs) labCount[e.concept] = (labCount[e.concept] ?? 0) + 1
    const preferred = ['血钾', '血红蛋白', '肌酐', 'INR', '血磷', 'PTH', '白蛋白', 'BNP']
    const labNames = [...preferred.filter((n) => labCount[n] >= 3), ...Object.entries(labCount).sort((a, b) => b[1] - a[1]).map(([n]) => n)].filter((n, i, a) => a.indexOf(n) === i).slice(0, 4)
    const series = labNames.map((n) => ({ name: n, points: labs.filter((e) => e.concept === n).map((e) => ({ d: e.consensus.a, v: Number(e.value), event: e.id })).sort((x, y) => x.d.localeCompare(y.d)) }))
    const findings = d.findings.map((f) => ({ id: f.id, verdict: f.verdict, subclass: f.subclass, why: f.why, at: day(f.sides.map((x) => x.firstWritten).filter(Boolean).sort()[0]), events: f.events, review: f.review }))
    const recDays = [...d.encounters.map((e) => day(e.start)), ...series.flatMap((s) => s.points.map((p) => p.d)), ...ev.map((e) => day(e.firstWritten))].filter((x) => x && x > '1990').sort()
    const allDays = [...lanes.flatMap((l) => l.rows.flatMap((r) => r.items.flatMap((i) => [i.a, i.b]))), ...recDays].filter((x) => x && x > '1990').sort()
    return { patient, manifest: d.manifest, lanes, series, findings, stageChanges: d.stageChanges ?? [], range: { a: recDays[0] ?? allDays[0], b: allDays.at(-1) }, counts: d.manifest.counts }
  }
  async function eventDetail(runId, patient, eventId) {
    const d = await patientData(runId, patient, ['events', 'mentions', 'findings', 'links'])
    const e = d.events.find((x) => x.id === eventId)
    if (!e) throw new Error('找不到事件')
    const byId = new Map(d.mentions.map((m) => [m.id, m]))
    const evById = new Map(d.events.map((x) => [x.id, x]))
    const ms = e.mentions.map((id) => brief(byId.get(id))).filter(Boolean)
    const side = (id) => { const x = id ? evById.get(id) : null; return x ? { id: x.id, concept: x.concept, conceptGroup: x.conceptGroup, form: x.form, a: x.consensus?.a ?? x.firstWritten?.slice(0, 10) } : null }
    const links = d.links.filter((l) => l.from === eventId || l.to === eventId).map((l) => ({ ...l, dir: l.from === eventId ? 'out' : 'in', other: side(l.from === eventId ? l.to : l.from), evidence: l.mentions.slice(0, 3).map((id) => brief(byId.get(id))).filter(Boolean) }))
    return { event: e, mentions: ms.slice(0, 200), more: Math.max(0, ms.length - 200), findings: d.findings.filter((f) => f.events.includes(eventId)), links }
  }
  async function findingDetail(runId, patient, findingId) {
    const d = await patientData(runId, patient, ['findings', 'mentions'])
    const f = d.findings.find((x) => x.id === findingId)
    if (!f) throw new Error('找不到发现')
    const byId = new Map(d.mentions.map((m) => [m.id, m]))
    return { finding: { ...f, sides: f.sides.map((s) => ({ ...s, mentions: s.mentions.slice(0, 30).map((id) => brief(byId.get(id))), total: s.mentions.length })) } }
  }

  /**
   * 规则包页：一条规则（或一个概念）在这一批里命中的例子。逐位病人读事件包，凑够 limit 条就停。
   * kind：classify（类型规则号）、concept（"概念组\0概念"）、merge（归并规则）、finding（矛盾判断规则号）、extract（抽取出处）
   */
  async function ruleExamples(runId, { kind, id, limit = 8 } = {}) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const out = []
    for (const p of run.patients) {
      if (p.status !== 'done' || out.length >= limit) continue
      if (kind === 'finding') {
        const d = await patientData(run.id, p.patient, ['findings'])
        for (const f of d.findings) if (String(f.rule ?? '').split(' ')[0] === id && out.length < limit) out.push({ patient: p.patient, kind: 'finding', id: f.id, text: f.why, verdict: f.verdict, subclass: f.subclass })
        continue
      }
      if (kind === 'concept') {
        const d = await patientData(run.id, p.patient, ['events', 'mentions'])
        const byId = new Map(d.mentions.map((m) => [m.id, m]))
        for (const e of d.events) {
          if (out.length >= limit) break
          if (!(e.normalized && `${e.conceptGroup}\u0000${e.concept}` === id)) continue
          const m = byId.get(e.firstMention) ?? byId.get(e.mentions[0])
          if (m) out.push({ patient: p.patient, ...brief(m), aliases: (e.aliases ?? []).map((a) => a.alias).slice(0, 5), mentionCount: e.mentionCount })
        }
        continue
      }
      const d = await patientData(run.id, p.patient, ['mentions'])
      const hit = kind === 'classify' ? (m) => m.rules?.classify === id : kind === 'merge' ? (m) => m.mergeRule === id : (m) => m.rules?.extract === id
      for (const m of d.mentions) { if (out.length >= limit) break; if (hit(m)) out.push({ patient: p.patient, ...brief(m) }) }
    }
    return { kind, id, items: out }
  }

  async function rulepack(specialty, runId = null) {
    // 批次用的是自动识别的格式时，数据源层取那个批次的规划里组装出的那份
    let sourcePack = null
    const run = runId ? await getRun(runId) : null
    if (run?.format?.kind === 'recognized') { try { sourcePack = (await readPlan(join(run.runDir, 'work', 'plan.json'))).sourcePack ?? null } catch { /* 旧批次 */ } }
    const p = await packFor(specialty ?? run?.specialty ?? settings.specialty, sourcePack)
    const re = (x) => (x instanceof RegExp ? x.source : x)
    return {
      layers: p.layers, params: p.params,
      vocab: Object.fromEntries(Object.entries(p.vocab).map(([k, v]) => [k, re(v)])),
      classify: p.classify.map((r) => ({ id: r.id, name: r.name, type: r.type, subclass: r.subclass, fallback: Boolean(r.fallback), layer: r.layer ?? null, when: JSON.parse(JSON.stringify(r.when, (k, v) => (v instanceof RegExp ? `/${v.source}/` : v))) })),
      concepts: p.concepts, exclusive: p.exclusive, hypernyms: p.hypernyms, candidateSynonyms: p.candidateSynonyms,
      sections: Object.fromEntries(Object.entries(p.source.sections).map(([k, v]) => [k, { ...v, list: v.list?.map((s) => ({ ...s, re: s.re.source })) }])),
      taxonomy: CODES,
    }
  }

  /* ------------------------------------------------------------ 模型调用 */
  async function calls(runId) {
    const run = await getRun(runId)
    if (!run) throw new Error('找不到批次')
    const records = await recordsOf(run.outputRoot)
    return { runId: run.id, byModel: records.callStats(run.id), errors: records.callErrors(run.id, 100), series: run.series ?? [], modelHouses: run.modelHouses ?? [], autoTune: run.autoTune ?? {}, server: run.server ?? {} }
  }
  /** 设置页的模型下拉：读端点的 /models。已保存的 API Key 只发往已保存的端点，换了新地址时只用页面上新填的 Key */
  async function models({ baseURL, apiKey } = {}) {
    const norm = (u) => String(u ?? '').trim().replace(/\/+$/, '')
    const base = norm(baseURL) || norm(settings.baseURL)
    const saved = [norm(settings.baseURL), norm(settings.verifyBaseURL)].filter(Boolean)
    return listModels({ baseURL: base, apiKey: apiKey || (saved.includes(base) ? settings.apiKey : '') })
  }
  function configInfo() {
    return { hasApiKey: Boolean(settings.apiKey), apiKeySet: Boolean(settings.apiKey), mode: settings.readMode === 'model' ? 'model' : 'hybrid', modelConfigured: Boolean(modelInfo()), model: settings.model, verifyModel: settings.verifyModel, baseURL: settings.baseURL, verifyBaseURL: settings.verifyBaseURL, outputRoot: settings.outputRoot, specialty: settings.specialty, settings: Object.fromEntries(SAVABLE.filter((k) => k !== 'apiKey').map((k) => [k, settings[k]])) }
  }

  /* ------------------------------------------------------------ 格式 */
  async function formats(runId) {
    const run = runId ? await getRun(runId) : null
    const tables = []
    for (const t of run?.recognition?.tables ?? []) {
      const e = await library.get(t.signature)
      tables.push(e ? { ...t, status: e.status, recordType: e.spec?.recordType ?? null, spec: e.spec, drafts: e.drafts ?? {}, fields: e.fields ?? [], decidedBy: e.decidedBy ?? null, reason: e.reason ?? t.reason, problems: e.problems ?? [], diffs: e.diffs ?? [], firstDiffs: e.firstDiffs ?? [], rounds: e.rounds ?? [], adjudicated: e.adjudicated ?? null } : t)
    }
    const changed = tables.some((t, i) => t.status !== run.recognition.tables[i].status || (t.decidedBy === 'user' && run.recognition.tables[i].decidedBy !== 'user'))
    return {
      run: run ? { id: run.id, input: run.input, outputRoot: run.outputRoot, asOf: run.asOf, format: run.format ?? null } : null, tables, entries: tables, changed, dict: run?.format?.dict ?? 0,
      canon: { recordTypes: RECORD_TYPES, documents: Object.fromEntries(Object.entries(DOCUMENT_TYPES).map(([k, v]) => [k, v.sections.map((x) => x.name)])), structured: Object.fromEntries(Object.entries(STRUCTURED_TYPES).map(([k, v]) => [k, Object.keys(v.roles)])), common: Object.keys(COMMON_ROLES) },
    }
  }
  /** 判断一张表：confirm（采用当前读法，可带改过的 spec 或 use 某份方案）／reject（跳过）／reset（下次重新识别） */
  async function formatDecide({ signature, action, spec = null, use = null } = {}) {
    const e = await library.get(signature)
    if (!e) throw new Error(`格式库里没有这张表：${signature}`)
    if (action === 'reset') { await library.remove(signature); return { ok: true } }
    if (action === 'reject') { await library.put({ ...e, status: 'rejected', decidedBy: 'user', decidedAt: new Date().toISOString() }); return { ok: true } }
    if (action !== 'confirm') throw new Error('action 应为 confirm、reject 或 reset')
    if (use) { if (!e.drafts?.[use]) throw new Error(`没有「${use}」方案`); spec = e.drafts[use] }
    let next = e.spec
    if (spec) {
      const t = { fields: e.fields ?? [] }
      ;[next] = fixSpec(normalizeSpec(spec, use ?? 'user'), t)
      const problems = e.fields ? checkSpec(next, t) : []
      if (problems.length) throw Object.assign(new Error(`校验没通过：${problems.join('；')}`), { code: 'invalid-spec', problems })
    }
    await library.put({ ...e, spec: { ...next, origin: spec && !use ? 'user' : next.origin }, status: 'confirmed', decidedBy: 'user', decidedAt: new Date().toISOString(), problems: [] })
    return { ok: true }
  }

  async function dispose() {
    if (active) cancel()
    for (const p of stores.values()) { try { (await p).close() } catch { /* closed */ } }
    stores.clear()
  }

  return {
    settings, start, cancel, status, list, report, clearRuns, files, patients, patientData, documents, fragment, timeline, eventDetail, findingDetail,
    reviewQueue, decide, addMention, applyDecisions, rulepack, ruleExamples, calls, models, configInfo, formats, formatDecide, decideFormat: formatDecide,
    isRunning: () => Boolean(active), dispose, loadRun: getRun,
  }
}
