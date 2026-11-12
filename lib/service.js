/**
 * 批次服务：所有调用方（Agent 工具、/event 命令、页面 RPC）共用。
 *
 * 输出布局（与匿名化插件一致）：
 *   <outputRoot>/<输入名>/<病人>/        交付：事件包（批次完成后才出现在根目录）
 *   <outputRoot>/_records/
 *     index.json                         最近批次
 *     decisions.json                     人工裁定表（按稳定编号，重跑沿用）
 *     runs/<runId>/run.json|report.md|report.json|output/|model/
 */
import { mkdir, readFile, writeFile, readdir, rename, rm, stat, realpath } from 'node:fs/promises'
import { join, resolve, relative, basename, dirname, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { statfs } from 'node:fs/promises'
import { runPatient } from './engine/pipeline.js'
import { loadRulepack } from './rulepack/load.js'
import { writePackage, writeCohortExports } from './package/write.js'
import { renderReport } from './report.js'
import { createModelRunner, lexiconOf } from './model.js'
import { tierOf } from './engine/s05-judge.js'

const PERSON_FILE = 'p_doc_dwd_psn_rcd.json'
const RECORDS = '_records'

export const DEFAULTS = {
  outputRoot: '',
  specialty: ['hemodialysis'],
  baseURL: '',
  model: '',
  apiKey: '',
  verifyBaseURL: '',
  verifyModel: '',
  disableThinking: true,
  timeoutMs: 120000,
  modelConcurrency: 4,
  modelEnabled: true,
  showSidebarEntry: true,
  compress: true,
  xlsx: false,
}

async function exists(p) { try { await stat(p); return true } catch { return false } }

/** realpath of the nearest existing ancestor, plus the rest (the path may not exist yet). */
async function realish(p) {
  let cur = resolve(p); const rest = []
  for (;;) {
    try { return join(await realpath(cur), ...rest) } catch { /* climb */ }
    const up = dirname(cur)
    if (up === cur) return resolve(p)
    rest.unshift(basename(cur)); cur = up
  }
}

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
 * Patient roots: for every person file, the highest ancestor (below the input)
 * that contains no other person file. Without person files the input is one patient.
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
  const files = await walkFiles(dir)
  const snap = {}
  for (const f of files) { const s = await stat(f); snap[relative(dir, f)] = `${s.size}:${s.mtimeMs}` }
  return snap
}

const newRunId = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${randomBytes(3).toString('hex')}`
}

export function createService({ config = {}, defaultDirectory = process.cwd(), stateDir = null, chatImpl = null } = {}) {
  const settings = { ...DEFAULTS, ...config }
  let active = null // { id, cancel: bool, run }
  const runsCache = new Map()

  async function packFor(specialty = settings.specialty) {
    const list = [].concat(specialty ?? []).filter(Boolean).map((s) => `../../rules/specialty/${s}/index.mjs`)
    return loadRulepack({ source: '../../rules/source/zj-regional/index.mjs', general: '../../rules/general/index.mjs', specialty: list })
  }

  async function rootsFile() { return stateDir ? join(stateDir, 'roots.json') : null }
  async function rememberRoot(root) {
    const f = await rootsFile()
    if (!f) return
    let roots = []
    try { roots = JSON.parse(await readFile(f, 'utf8')) } catch { /* new */ }
    roots = [root, ...roots.filter((r) => r !== root)].slice(0, 20)
    await mkdir(dirname(f), { recursive: true })
    await writeFile(f, JSON.stringify(roots, null, 2))
  }
  async function knownRoots() {
    const f = await rootsFile()
    try { return f ? JSON.parse(await readFile(f, 'utf8')) : [] } catch { return [] }
  }

  async function saveRun(run) {
    runsCache.set(run.id, run)
    await mkdir(run.runDir, { recursive: true })
    await writeFile(join(run.runDir, 'run.json'), JSON.stringify(run, null, 2))
    const idxPath = join(run.outputRoot, RECORDS, 'index.json')
    let idx = []
    try { idx = JSON.parse(await readFile(idxPath, 'utf8')) } catch { /* new */ }
    const brief = { id: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt ?? null, input: run.inputName, patients: run.totals.patients, findings: run.totals.findings, review: run.totals.review }
    idx = [brief, ...idx.filter((r) => r.id !== run.id)].slice(0, 100)
    await writeFile(idxPath, JSON.stringify(idx, null, 2))
  }

  async function resolveOutputRoot(input, requested) {
    const root = resolve(requested || settings.outputRoot || join(dirname(input), '_medical-event'))
    const inReal = await realpath(input)
    const rootAbs = await realish(root)
    if (rootAbs === inReal) throw new Error('输出根目录不能与输入相同')
    if ((inReal + sep).startsWith(rootAbs + sep)) throw new Error('输出根目录不能包含输入目录')
    return rootAbs
  }

  /** Start a batch; returns immediately. */
  async function start(request = {}) {
    if (active) throw new Error(`已有批次 ${active.id} 在运行`)
    let prev = null
    if (request.resumeFrom) {
      prev = await loadRun(request.resumeFrom)
      if (!prev) throw new Error(`找不到批次 ${request.resumeFrom}`)
      if (prev.status === 'completed') throw new Error('该批次已完成，无需继续')
    }
    const input = resolve(defaultDirectory, prev?.input ?? request.inputDir ?? '')
    if (!(await exists(input))) throw new Error(`输入不存在：${input}`)
    const outputRoot = prev?.outputRoot ?? await resolveOutputRoot(input, request.outputRoot)
    const id = prev?.id ?? newRunId()
    const runDir = join(outputRoot, RECORDS, 'runs', id)
    const run = prev ?? {
      id, status: 'running', input, inputName: basename(input), outputRoot, runDir,
      startedAt: new Date().toISOString(), source: request.source ?? null, asOf: request.asOf ?? null,
      specialty: request.specialty ?? settings.specialty,
      model: settings.modelEnabled && settings.baseURL && settings.model ? { model: settings.model, verifyModel: settings.verifyModel || null } : null,
      patients: [], totals: { patients: 0, done: 0, failedGates: 0, mentions: 0, events: 0, findings: 0, review: 0, suggestions: 0, modelCalls: 0 },
      warnings: [], current: null,
    }
    run.status = 'running'
    run.finishedAt = null
    active = { id, cancel: false, run }
    await saveRun(run)
    await rememberRoot(outputRoot)
    execute(run).catch(async (error) => {
      run.status = 'failed'; run.error = String(error?.stack ?? error); run.finishedAt = new Date().toISOString()
      await saveRun(run).catch(() => {})
    }).finally(() => { if (active?.id === id) active = null })
    return { runId: id, outputRoot, modelConfigured: Boolean(run.model), model: run.model?.model ?? null }
  }

  async function execute(run) {
    const pack = await packFor(run.specialty)
    const skip = (p) => resolve(p) === resolve(run.outputRoot) || basename(p) === '_medical-event' || basename(p) === RECORDS
    const roots = await findPatients(run.input, skip)
    if (!roots.length) throw new Error('输入里没有找到平台导出文件（p_doc_*.json）')
    const before = await sourceSnapshot(run.input)
    const decisions = await loadDecisions(run.outputRoot)
    const model = run.model || chatImpl ? createModelRunner(settings, { runDir: run.runDir, chatImpl, onCall: () => { run.totals.modelCalls++ } }) : null
    const staging = join(run.runDir, 'output', run.inputName)
    const done = new Map(run.patients.map((p) => [p.patient, p]))
    run.totals.patients = roots.length
    // 磁盘余量：每位病人的事件包约 6MB（压缩）／40MB（不压缩），按 1.5 倍预留
    try {
      const fsx = await statfs(dirname(run.runDir))
      const free = fsx.bavail * fsx.bsize
      const need = roots.length * (settings.compress !== false ? 9 : 60) * 1024 * 1024
      if (free < need) run.warnings.push(`输出所在磁盘只剩 ${(free / 2 ** 30).toFixed(1)} GB，按估算本批需要约 ${(need / 2 ** 30).toFixed(1)} GB`)
    } catch { /* statfs unsupported */ }
    for (const root of roots) {
      if (active?.cancel) break
      const patient = relative(run.input, root) || basename(run.input)
      if (done.get(patient)?.status === 'done') continue
      run.current = { patient, step: '规则引擎' }
      await saveRun(run)
      const t0 = Date.now()
      const result = await runPatient(root, pack, { asOf: run.asOf ?? undefined })
      applyDecisions(result, decisions)
      let suggestions = []
      if (model && result.tables.events) {
        run.current = { patient, step: '模型补充' }
        await saveRun(run)
        suggestions = await model.suggest(patient, result, { isCancelled: () => active?.cancel, lexicon: lexiconOf(pack) })
      }
      const dir = join(staging, patient === basename(run.input) && roots.length === 1 ? '' : patient)
      const review = reviewCounts(result, suggestions)
      await writePackage(dir, result, { compress: settings.compress !== false, xlsx: settings.xlsx === true, patient, runId: run.id, producer: 'dsh-medical-event', upstream: { input: run.input }, createdAt: new Date().toISOString(), review })
      if (suggestions.length) {
        await mkdir(join(run.runDir, 'model'), { recursive: true })
        await writeFile(join(run.runDir, 'model', `${patient.replace(/[\\/]/g, '__')}.jsonl`), suggestions.map((s) => JSON.stringify(s)).join('\n') + '\n')
      }
      const g = result.summary.gates
      const failed = Object.entries(g).filter(([, v]) => !v.pass).map(([k]) => k)
      const entry = {
        patient, status: 'done', ms: Date.now() - t0, failedGates: failed,
        counts: { fragments: result.summary.fragments, mentions: result.summary.mentions ?? 0, events: result.summary.events ?? 0, findings: result.summary.findings ?? 0 },
        mappings: mappingsOf(result), single: roots.length === 1,
        verdicts: result.summary.verdicts ?? {}, types: result.summary.types ?? {}, fallbackRate: g['②']?.fallbackRate ?? null, review, suggestions: suggestions.length,
        summary: slimSummary(result.summary),
      }
      done.set(patient, entry)
      run.patients = [...done.values()]
      run.totals = totalsOf(run)
    }
    run.current = null
    if (!active?.cancel && run.patients.length > 1) {
      run.current = { patient: '全体', step: '队列导出' }
      const dirs = run.patients.map((p) => ({ patient: p.patient, dir: join(staging, p.patient) }))
      run.cohort = await writeCohortExports(join(staging, '_cohort'), dirs, run.patients)
      run.current = null
    }
    const after = await sourceSnapshot(run.input)
    const changed = Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k])
    run.sourceCheck = { files: Object.keys(before).length, changed: changed.length }
    if (changed.length) run.warnings.push(`运行期间有 ${changed.length} 个源文件被改动（不是本插件改的）`)
    if (active?.cancel) {
      run.status = 'cancelled'
    } else {
      // 完成：交付数据从暂存区移到输出根目录（同名已存在时加序号）
      let target = join(run.outputRoot, run.inputName)
      for (let n = 2; await exists(target); n++) target = join(run.outputRoot, `${run.inputName} (${n})`)
      await rename(staging, target)
      run.output = target
      run.status = run.totals.failedGates || run.totals.review ? 'review' : 'completed'
    }
    run.finishedAt = new Date().toISOString()
    const report = renderReport(run)
    await writeFile(join(run.runDir, 'report.md'), report.markdown)
    await writeFile(join(run.runDir, 'report.json'), JSON.stringify(report.json, null, 2))
    await saveRun(run)
  }

  function mappingsOf(result) {
    const seen = new Map()
    for (const e of result.tables.events ?? []) for (const a of e.aliases ?? []) {
      if (/需药师复核|需医生复核/.test(a.nature)) seen.set(`${a.alias}→${a.concept}`, a)
    }
    return [...seen.values()]
  }
  /** run.json 里每位病人只留界面要用的统计（全量在事件包 manifest 里）。 */
  function slimSummary(s) {
    return { types: s.types, gates: Object.fromEntries(Object.entries(s.gates ?? {}).map(([k, g]) => [k, { pass: g.pass, fallbackRate: g.fallbackRate }])) }
  }

  function totalsOf(run) {
    const t = { patients: run.totals.patients, done: 0, failedGates: 0, mentions: 0, events: 0, findings: 0, review: 0, suggestions: 0, modelCalls: run.totals.modelCalls }
    for (const p of run.patients) {
      t.done++
      if (p.failedGates.length) t.failedGates++
      t.mentions += p.counts.mentions; t.events += p.counts.events; t.findings += p.counts.findings
      t.review += p.review.pending; t.suggestions += p.suggestions
    }
    return t
  }

  function reviewCounts(result, suggestions) {
    const f = result.tables.findings ?? []
    const needs = f.filter((x) => x.certainty === '需人工确认' && !x.review)
    const drugs = (result.tables.events ?? []).filter((e) => e.aliases?.some((a) => /需药师复核/.test(a.nature)))
    const pendingTime = (result.tables.mentions ?? []).filter((m) => m.timeSource === '前句继承（待复核）')
    const toReview = suggestions.filter((x) => x.outcome === 'review' && !x.agreesWithRule).length
    const candidates = suggestions.filter((x) => x.outcome === 'candidate' && !x.agreesWithRule).length
    return { findings: needs.length, drugMappings: drugs.length, pendingTime: pendingTime.length, suggestions: suggestions.length, modelReview: toReview, ruleCandidates: candidates, pending: needs.length }
  }

  /* ----------------------------------------------------- decisions */
  const decisionsPath = (root) => join(root, RECORDS, 'decisions.json')
  async function loadDecisions(root) {
    try { return JSON.parse(await readFile(decisionsPath(root), 'utf8')) } catch { return { findings: {}, mentions: {}, concepts: {} } }
  }
  function applyDecisions(result, decisions) {
    for (const f of result.tables.findings ?? []) {
      const d = decisions.findings?.[f.id]
      if (d) f.review = d
    }
  }
  async function decide(runId, request) {
    const run = await loadRun(runId)
    if (!run) throw new Error(`找不到批次 ${runId}`)
    const decisions = await loadDecisions(run.outputRoot)
    const kind = request.kind ?? 'findings'
    decisions[kind] ??= {}
    if (request.clear) delete decisions[kind][request.id]
    else decisions[kind][request.id] = { decision: request.decision, note: request.note ?? '', by: request.by ?? 'user', at: new Date().toISOString() }
    await mkdir(join(run.outputRoot, RECORDS), { recursive: true })
    await writeFile(decisionsPath(run.outputRoot), JSON.stringify(decisions, null, 2))
    return { saved: true, id: request.id, kind }
  }

  /* --------------------------------------------------------- reads */
  async function loadRun(id) {
    if (active?.id === id) return active.run
    if (runsCache.has(id)) return runsCache.get(id)
    for (const root of await knownRoots()) {
      try {
        const run = JSON.parse(await readFile(join(root, RECORDS, 'runs', id, 'run.json'), 'utf8'))
        runsCache.set(id, run)
        return run
      } catch { /* try next */ }
    }
    return null
  }
  async function list() {
    const out = []
    for (const root of await knownRoots()) {
      try { for (const r of JSON.parse(await readFile(join(root, RECORDS, 'index.json'), 'utf8'))) out.push({ ...r, outputRoot: root }) } catch { /* gone */ }
    }
    out.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
    return { runs: out, active: active?.id ?? null }
  }
  async function latestId() { return (await list()).runs[0]?.id ?? null }
  async function status(runId) {
    const id = runId || active?.id || await latestId()
    const run = id ? await loadRun(id) : null
    return { run: run ? { ...run, patients: run.patients.map(({ summary, ...p }) => p) } : null, active: active?.id ?? null }
  }
  async function report(runId) {
    const id = runId || await latestId()
    const run = id ? await loadRun(id) : null
    if (!run) throw new Error('还没有批次')
    const path = join(run.runDir, 'report.md')
    try { return { runId: id, path, markdown: await readFile(path, 'utf8') } } catch { return { runId: id, path, markdown: renderReport(run).markdown } }
  }
  async function cancel(runId) {
    if (!active || (runId && runId !== active.id)) return { cancelled: false, reason: '没有运行中的批次' }
    active.cancel = true
    return { cancelled: true, runId: active.id }
  }

  /** Where a patient's package lives (delivered or staged). */
  async function packageDir(run, patient) {
    const entry = run.patients.find((p) => p.patient === patient)
    const sub = entry?.single || (!entry && patient === run.inputName) ? '' : patient
    const candidates = [run.output && join(run.output, sub), join(run.runDir, 'output', run.inputName, sub)].filter(Boolean)
    for (const c of candidates) if (await exists(join(c, 'manifest.json'))) return c
    return null
  }
  const fileCache = new Map() // path → { mtime, rows }
  async function readJsonl(p0) {
    // 大表可能是 .jsonl.gz
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
  /** One patient's tables for the page. */
  async function patientData(runId, patient, parts = ['manifest', 'events', 'findings', 'encounters']) {
    const run = await loadRun(runId)
    if (!run) throw new Error(`找不到批次 ${runId}`)
    const dir = await packageDir(run, patient)
    if (!dir) throw new Error(`找不到 ${patient} 的事件包`)
    const out = { patient, dir }
    for (const p of parts) {
      if (p === 'manifest') out.manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
      else if (p === 'stageChanges') out.stageChanges = JSON.parse(await readFile(join(dir, 'stage-changes.json'), 'utf8'))
      else if (p === 'suggestions') out.suggestions = await readJsonl(join(run.runDir, 'model', `${patient.replace(/[\\/]/g, '__')}.jsonl`))
      else out[p] = await readJsonl(join(dir, `${p}.jsonl`))
    }
    if (out.findings) {
      const decisions = await loadDecisions(run.outputRoot)
      for (const f of out.findings) f.review = decisions.findings?.[f.id] ?? f.review ?? null
    }
    return out
  }
  /** One fragment with its mentions (原文标注). */
  async function fragment(runId, patient, fragmentId) {
    const d = await patientData(runId, patient, ['fragments', 'mentions'])
    const f = d.fragments.find((x) => x.id === fragmentId)
    if (!f) throw new Error('找不到片段')
    return { fragment: f, mentions: d.mentions.filter((m) => m.fragmentId === fragmentId) }
  }
  /** Document list for 原文标注 (no text). */
  async function documents(runId, patient) {
    const d = await patientData(runId, patient, ['fragments', 'mentions'])
    const counts = new Map()
    for (const m of d.mentions) counts.set(m.fragmentId, (counts.get(m.fragmentId) ?? 0) + 1)
    return { documents: d.fragments.filter((f) => f.kind === '文书').map((f) => ({ id: f.id, recordType: f.recordType, field: f.field, visibleAt: f.visibleAt, version: f.version ?? 1, mentions: counts.get(f.id) ?? 0 })) }
  }


  /* ------------------------------------------------------- page views */
  const TIER = { 1: '结构化记录', 2: '同期文书', 3: '同次补记', 4: '回顾转述', 5: '外院转述', 6: '模板化内容' }
  const brief = (m) => m && ({ id: m.id, text: m.text, recordType: m.recordType, section: m.section, writtenAt: m.writtenAt, occurFrom: m.occurFrom, occurTo: m.occurTo, timeSource: m.timeSource, type: m.type, subdivision: m.subdivision, item: m.item, negative: m.negative, templated: m.templated, fragmentId: m.fragmentId, tier: tierOf(m), tierName: TIER[tierOf(m)], rule: m.rules?.classify, eventId: m.eventId })

  /** Compact timeline for one patient: lanes of bars/points, lab series, findings. */
  async function timeline(runId, patient) {
    const d = await patientData(runId, patient, ['manifest', 'events', 'findings', 'encounters', 'stageChanges'])
    const day = (x) => (x ? String(x).slice(0, 10) : null)
    const ev = d.events
    const top = (list, n) => list.sort((a, b) => b.mentionCount - a.mentionCount).slice(0, n)
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
    // labs: most frequent structured items
    const labs = ev.filter((e) => e.conceptGroup === '检验结果' && Number.isFinite(Number(e.value)) && e.consensus?.a)
    const labCount = {}
    for (const e of labs) labCount[e.concept] = (labCount[e.concept] ?? 0) + 1
    const preferred = ['血钾', '血红蛋白', '肌酐', 'INR', '血磷', 'PTH', '白蛋白', 'BNP']
    const labNames = [...preferred.filter((n) => labCount[n] >= 3), ...Object.entries(labCount).sort((a, b) => b[1] - a[1]).map(([n]) => n)].filter((n, i, a) => a.indexOf(n) === i).slice(0, 4)
    const series = labNames.map((n) => ({ name: n, points: labs.filter((e) => e.concept === n).map((e) => ({ d: e.consensus.a, v: Number(e.value), event: e.id })).sort((x, y) => x.d.localeCompare(y.d)) }))
    const findings = d.findings.map((f) => ({ id: f.id, verdict: f.verdict, subclass: f.subclass, why: f.why, at: day(f.sides.map((x) => x.firstWritten).filter(Boolean).sort()[0]), events: f.events, review: f.review }))
    // 时间轴范围：以有记录的时期为准（就诊、检验、写成时间），更早的转述（“10年前”）画在左端
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
    const d = await patientData(runId, patient, ['findings', 'mentions', 'suggestions'])
    const f = d.findings.find((x) => x.id === findingId)
    if (!f) throw new Error('找不到发现')
    const byId = new Map(d.mentions.map((m) => [m.id, m]))
    return { finding: { ...f, sides: f.sides.map((s) => ({ ...s, mentions: s.mentions.slice(0, 30).map((id) => brief(byId.get(id))), total: s.mentions.length })) }, model: d.suggestions.filter((x) => x.target === findingId) }
  }

  /** Review queue across patients of a run. */
  async function reviewQueue(runId) {
    const run = await loadRun(runId || await latestId())
    if (!run) return { items: [] }
    const decisions = await loadDecisions(run.outputRoot)
    const items = []
    for (const p of run.patients) {
      const d = await patientData(run.id, p.patient, ['findings', 'suggestions'])
      for (const f of d.findings) {
        if (f.certainty !== '需人工确认' && f.verdict !== '矛盾') continue
        items.push({ kind: 'finding', patient: p.patient, id: f.id, verdict: f.verdict, subclass: f.subclass, title: f.why, review: decisions.findings?.[f.id] ?? null, model: d.suggestions.filter((x) => x.target === f.id).map((x) => ({ suggest: x.suggest?.verdict, verify: x.verify?.verdict, outcome: x.outcome })) [0] ?? null })
      }
      for (const s of d.suggestions) {
        if (s.kind === 'finding' || s.agreesWithRule || s.outcome === 'discarded') continue
        items.push({ kind: s.kind, patient: p.patient, id: s.target, outcome: s.outcome, title: s.text, suggest: s.suggest, verify: s.verify, review: decisions[s.kind]?.[s.target] ?? null })
      }
      for (const a of p.mappings ?? []) {
        const id = `${a.alias}→${a.concept}`
        if (items.some((x) => x.kind === 'mapping' && x.id === id)) continue
        items.push({ kind: 'mapping', patient: p.patient, id, title: `${a.alias} → ${a.concept}`, nature: a.nature, review: decisions.mapping?.[id] ?? null })
      }
    }
    return { runId: run.id, items }
  }

  async function rulepack(specialty) {
    const p = await packFor(specialty)
    const re = (x) => (x instanceof RegExp ? x.source : x)
    return {
      layers: p.layers,
      params: p.params,
      vocab: Object.fromEntries(Object.entries(p.vocab).map(([k, v]) => [k, re(v)])),
      classify: p.classify.map((r) => ({ id: r.id, name: r.name, type: r.type, subclass: r.subclass, fallback: Boolean(r.fallback), when: JSON.parse(JSON.stringify(r.when, (k, v) => (v instanceof RegExp ? `/${v.source}/` : v))) })),
      concepts: p.concepts,
      exclusive: p.exclusive,
      hypernyms: p.hypernyms,
      candidateSynonyms: p.candidateSynonyms,
      sections: Object.fromEntries(Object.entries(p.source.sections).map(([k, v]) => [k, { ...v, list: v.list?.map((s) => ({ ...s, re: s.re.source })) }])),
    }
  }

  async function calls(runId) {
    const run = await loadRun(runId || await latestId())
    if (!run) return { calls: [] }
    const rows = await readJsonl(join(run.runDir, 'calls.jsonl'))
    const by = {}
    for (const c of rows) {
      const k = `${c.role}\u0000${c.model}`
      const x = by[k] ??= { role: c.role, model: c.model, calls: 0, failed: 0, cached: 0, ms: 0, promptTokens: 0, completionTokens: 0, kinds: {} }
      x.calls++; if (c.ok === false) x.failed++; if (c.cached) x.cached++
      x.ms += c.ms ?? 0; x.promptTokens += c.usage?.prompt_tokens ?? 0; x.completionTokens += c.usage?.completion_tokens ?? 0
      x.kinds[c.kind] = (x.kinds[c.kind] ?? 0) + 1
    }
    return { runId: run.id, models: Object.values(by), recent: rows.slice(-200) }
  }

  function configInfo() {
    const { apiKey, ...rest } = settings
    return { ...rest, apiKeySet: Boolean(apiKey) }
  }

  return { settings, start, cancel, status, list, report, decide, calls, timeline, eventDetail, findingDetail, reviewQueue, patientData, fragment, documents, rulepack, configInfo, loadRun, isRunning: () => Boolean(active), dispose: () => { if (active) active.cancel = true } }
}
