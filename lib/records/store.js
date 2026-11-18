/**
 * 记录库：每个输出根目录一个 SQLite（<outputRoot>/_records/records.sqlite），各批次共用，表里用 run_id 区分批次。
 * WAL 模式，主线程与各工作线程各开一个连接。交付数据（事件包）和给人看的报告（report.md / report.json）仍是文件。
 *
 *   runs          批次（列出常用字段，全量放 data 列的 JSON）
 *   shards        数据块进度（断点续跑：已完成的数据块跳过）与小计
 *   model_cache   模型回复缓存（key = sha256(模型＋提示)，或按句子单位的答案），同一输出根目录下各批次复用
 *   call_stats    模型调用统计（按批次×角色×模型累计；不逐条记）
 *   call_errors   最近的失败调用（每批次最多 500 条）
 *   decisions     人工判断的当前值（按 kind＋稳定编号，重跑沿用）
 *   decision_log  人工判断的每一次改动（只追加，审计用）
 *   model_calls   旧版本的逐条调用流水（只读：旧批次的模型调用页从这里统计）
 *
 * 字段只用 TEXT / INTEGER，时间是 ISO 文本，复杂结构放 JSON 文本列。表结构版本记在 PRAGMA user_version，
 * 升级时自动迁移；库比插件新时拒绝打开。
 *
 * 旧布局（index.json、runs/<runId>/run.json、decisions.json、逐批 model-cache.jsonl / calls.jsonl）
 * 在第一次打开库时并入，原文件保留不动、此后不再写。
 */
import { mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const RECORDS_FILE = 'records.sqlite'
export const SCHEMA_VERSION = 3
const PRODUCER = 'dsh-medical-event'

const MIGRATIONS = [
  // v1：模型缓存与调用流水
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS model_cache (key TEXT PRIMARY KEY, model TEXT NOT NULL, content TEXT NOT NULL, run_id TEXT, created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS model_calls (
     id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, at TEXT NOT NULL, patient TEXT, kind TEXT, role TEXT, model TEXT,
     ok INTEGER, cached INTEGER NOT NULL DEFAULT 0, ms INTEGER, prompt_tokens INTEGER, completion_tokens INTEGER, error TEXT, usage TEXT);
   CREATE INDEX IF NOT EXISTS model_calls_run ON model_calls (run_id);`,
  // v2：批次与人工判断
  `CREATE TABLE IF NOT EXISTS runs (
     id TEXT PRIMARY KEY, status TEXT NOT NULL, started_at TEXT, finished_at TEXT, input TEXT, input_name TEXT, output TEXT,
     patients INTEGER, findings INTEGER, review INTEGER, data TEXT NOT NULL, updated_at TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS runs_started ON runs (started_at);
   CREATE TABLE IF NOT EXISTS decisions (kind TEXT NOT NULL, target TEXT NOT NULL, decision TEXT, note TEXT, by TEXT, at TEXT NOT NULL, run_id TEXT, PRIMARY KEY (kind, target));
   CREATE TABLE IF NOT EXISTS decision_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, kind TEXT NOT NULL, target TEXT NOT NULL, decision TEXT, note TEXT, by TEXT, at TEXT NOT NULL, run_id TEXT);
   CREATE INDEX IF NOT EXISTS decision_log_target ON decision_log (kind, target);`,
  // v3：数据块、调用统计与失败调用；判断带值（改用、补充的内容）
  `CREATE TABLE IF NOT EXISTS shards (
     run_id TEXT NOT NULL, shard INTEGER NOT NULL, status TEXT NOT NULL, patients INTEGER, mentions INTEGER,
     started_at TEXT, finished_at TEXT, ms INTEGER, stats TEXT, PRIMARY KEY (run_id, shard));
   CREATE TABLE IF NOT EXISTS call_stats (
     run_id TEXT NOT NULL, role TEXT NOT NULL, model TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, cached INTEGER NOT NULL DEFAULT 0,
     failed INTEGER NOT NULL DEFAULT 0, ms INTEGER NOT NULL DEFAULT 0, prompt_tokens INTEGER NOT NULL DEFAULT 0, completion_tokens INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (run_id, role, model));
   CREATE TABLE IF NOT EXISTS call_errors (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, at TEXT NOT NULL, patient TEXT, role TEXT, model TEXT, error TEXT);
   CREATE INDEX IF NOT EXISTS call_errors_run ON call_errors (run_id);
   ALTER TABLE decisions ADD COLUMN value TEXT;
   ALTER TABLE decision_log ADD COLUMN value TEXT;`,
]

let sqlite = null
async function loadSqlite() {
  if (!sqlite) {
    // node:sqlite 在部分 Node 版本里会打一条实验特性警告；不往宿主日志里刷
    const emit = process.emitWarning
    process.emitWarning = (w, ...rest) => { if (!String(w?.message ?? w).includes('SQLite')) emit.call(process, w, ...rest) }
    try { sqlite = await import('node:sqlite') } catch { sqlite = null } finally { process.emitWarning = emit }
  }
  return sqlite
}

const readJson = (path, fallback) => { try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return fallback } }
const readLines = (path) => { try { return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] } }

/** 批次列表里的一行。 */
export const runBrief = (run) => ({
  id: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt ?? null, input: run.inputName, outputRoot: run.outputRoot,
  patients: run.totals?.patients ?? 0, mentions: run.totals?.mentions ?? 0, events: run.totals?.events ?? 0, findings: run.totals?.findings ?? 0, review: run.totals?.review ?? 0,
})

/**
 * 打开输出根目录的记录库。
 *   opts.create === false：_records 目录不存在时返回 null（只读场景，不在已删除的输出目录里重建）
 *   opts.legacy === false：不并入旧布局（工作线程用：主线程已经并过）
 */
export async function openRecords(recordsDir, { create = true, legacy = true } = {}) {
  if (!create && !existsSync(recordsDir)) return null
  const mod = await loadSqlite()
  if (!mod?.DatabaseSync) throw new Error('当前运行时没有 node:sqlite（需要 Node 22.5 以上）：本插件的记录库用它存批次、缓存与人工判断')
  mkdirSync(recordsDir, { recursive: true })
  const path = join(recordsDir, RECORDS_FILE)
  const db = new mod.DatabaseSync(path)
  const tx = (fn) => {
    db.exec('BEGIN')
    try { const r = fn(); db.exec('COMMIT'); return r } catch (e) { try { db.exec('ROLLBACK') } catch { /* none */ } throw e }
  }
  try {
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 30000;')
    const version = db.prepare('PRAGMA user_version').get().user_version
    if (version > SCHEMA_VERSION) throw new Error(`记录库 ${path} 的版本（${version}）比本插件新（${SCHEMA_VERSION}），请升级插件`)
    for (let v = version; v < SCHEMA_VERSION; v++) {
      tx(() => {
        // 同一条迁移可能被另一个连接抢先做完：再看一眼版本
        if (db.prepare('PRAGMA user_version').get().user_version > v) return
        for (const stmt of MIGRATIONS[v].split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
          try { db.exec(stmt) } catch (e) { if (!/duplicate column/i.test(String(e?.message))) throw e }
        }
        db.exec(`PRAGMA user_version = ${v + 1}`)
      })
    }
  } catch (e) { db.close(); throw e }

  const q = (sql) => db.prepare(sql)
  const S = {
    meta: q('SELECT value FROM meta WHERE key = ?'),
    setMeta: q('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    cacheGet: q('SELECT content FROM model_cache WHERE key = ?'),
    cachePut: q('INSERT OR IGNORE INTO model_cache (key, model, content, run_id, created_at) VALUES (?, ?, ?, ?, ?)'),
    statAdd: q(`INSERT INTO call_stats (run_id, role, model, calls, cached, failed, ms, prompt_tokens, completion_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (run_id, role, model) DO UPDATE SET calls = calls + excluded.calls, cached = cached + excluded.cached, failed = failed + excluded.failed,
      ms = ms + excluded.ms, prompt_tokens = prompt_tokens + excluded.prompt_tokens, completion_tokens = completion_tokens + excluded.completion_tokens`),
    statsOf: q('SELECT role, model, calls, cached, failed, ms, prompt_tokens, completion_tokens FROM call_stats WHERE run_id = ?'),
    oldStatsOf: q(`SELECT role, model, SUM(CASE WHEN cached = 0 THEN 1 ELSE 0 END) AS calls, SUM(cached) AS cached, SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failed,
      SUM(COALESCE(ms, 0)) AS ms, SUM(COALESCE(prompt_tokens, 0)) AS prompt_tokens, SUM(COALESCE(completion_tokens, 0)) AS completion_tokens FROM model_calls WHERE run_id = ? GROUP BY role, model`),
    errCount: q('SELECT COUNT(*) AS n FROM call_errors WHERE run_id = ?'),
    errAdd: q('INSERT INTO call_errors (run_id, at, patient, role, model, error) VALUES (?, ?, ?, ?, ?, ?)'),
    errorsOf: q('SELECT at, patient, role, model, error FROM call_errors WHERE run_id = ? ORDER BY id DESC LIMIT ?'),
    oldCallPut: q('INSERT INTO model_calls (run_id, at, patient, kind, role, model, ok, cached, ms, prompt_tokens, completion_tokens, error, usage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    oldCallsOf: q('SELECT 1 FROM model_calls WHERE run_id = ? LIMIT 1'),
    runPut: q(`INSERT INTO runs (id, status, started_at, finished_at, input, input_name, output, patients, findings, review, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, started_at = excluded.started_at, finished_at = excluded.finished_at, input = excluded.input,
        input_name = excluded.input_name, output = excluded.output, patients = excluded.patients, findings = excluded.findings, review = excluded.review,
        data = excluded.data, updated_at = excluded.updated_at`),
    runGet: q('SELECT data FROM runs WHERE id = ?'),
    runList: q('SELECT data FROM runs ORDER BY started_at DESC LIMIT ?'),
    runDel: q('DELETE FROM runs WHERE id = ?'), shardDel: q('DELETE FROM shards WHERE run_id = ?'),
    statDel: q('DELETE FROM call_stats WHERE run_id = ?'), errDel: q('DELETE FROM call_errors WHERE run_id = ?'), oldCallDel: q('DELETE FROM model_calls WHERE run_id = ?'),
    shardPut: q(`INSERT INTO shards (run_id, shard, status, patients, mentions, started_at, finished_at, ms, stats) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (run_id, shard) DO UPDATE SET status = excluded.status, patients = excluded.patients, mentions = excluded.mentions, started_at = excluded.started_at,
      finished_at = excluded.finished_at, ms = excluded.ms, stats = excluded.stats`),
    shardsOf: q('SELECT shard, status, patients, mentions, ms, stats FROM shards WHERE run_id = ? ORDER BY shard'),
    decAll: q('SELECT kind, target, decision, value, note, by, at FROM decisions'),
    decPut: q(`INSERT INTO decisions (kind, target, decision, value, note, by, at, run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(kind, target) DO UPDATE SET decision = excluded.decision, value = excluded.value, note = excluded.note, by = excluded.by, at = excluded.at, run_id = excluded.run_id`),
    decImport: q('INSERT OR IGNORE INTO decisions (kind, target, decision, value, note, by, at, run_id) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)'),
    decDel: q('DELETE FROM decisions WHERE kind = ? AND target = ?'),
    decLog: q('INSERT INTO decision_log (action, kind, target, decision, value, note, by, at, run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    decHistory: q('SELECT action, decision, value, note, by, at, run_id AS runId FROM decision_log WHERE kind = ? AND target = ? ORDER BY id'),
  }
  const now = () => new Date().toISOString()
  const n = (x) => (Number.isFinite(x) ? x : null)
  let open = true
  if (legacy) { S.setMeta.run('schema_version', String(SCHEMA_VERSION)); S.setMeta.run('producer', PRODUCER) }

  const putRun = (run) => {
    const b = runBrief(run)
    S.runPut.run(run.id, run.status ?? 'unknown', run.startedAt ?? null, run.finishedAt ?? null, run.input ?? null, run.inputName ?? null, run.output ?? null,
      n(b.patients), n(b.findings), n(b.review), JSON.stringify(run), now())
  }

  /* 旧布局并入（每个库只做一次；原文件不动） */
  if (legacy && !S.meta.get('legacy_imported')) {
    const runsDir = join(recordsDir, 'runs')
    let ids = []
    try { ids = readdirSync(runsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) } catch { /* none */ }
    const runs = []
    for (const id of ids) {
      const run = readJson(join(runsDir, id, 'run.json'), null)
      if (run?.id) runs.push({ run, cache: readLines(join(runsDir, id, 'model-cache.jsonl')), calls: readLines(join(runsDir, id, 'calls.jsonl')) })
    }
    const decisions = readJson(join(recordsDir, 'decisions.json'), {})
    tx(() => {
      for (const { run, cache, calls } of runs) {
        if (!S.runGet.get(run.id)) putRun(run)
        for (const r of cache) if (r?.key && r.content != null) S.cachePut.run(r.key, '', r.content, run.id, now())
        if (calls.length && !S.oldCallsOf.get(run.id)) {
          for (const e of calls) S.oldCallPut.run(run.id, e.at ?? now(), e.patient ?? null, e.kind ?? null, e.role ?? null, e.model ?? null, e.ok == null ? null : e.ok ? 1 : 0, e.cached ? 1 : 0, n(e.ms), n(e.usage?.prompt_tokens), n(e.usage?.completion_tokens), e.error ?? null, e.usage ? JSON.stringify(e.usage) : null)
        }
      }
      for (const [kind, byId] of Object.entries(decisions ?? {})) {
        for (const [target, d] of Object.entries(byId ?? {})) {
          S.decImport.run(kind, target, d?.decision ?? null, d?.note ?? '', d?.by ?? 'user', d?.at ?? now(), null)
          S.decLog.run('import', kind, target, d?.decision ?? null, null, d?.note ?? '', d?.by ?? 'user', d?.at ?? now(), null)
        }
      }
      S.setMeta.run('legacy_imported', now())
    })
  }

  const pendingStats = new Map() // runId → Map(role\0model → 累计)
  const store = {
    kind: 'sqlite',
    path,
    db,
    /* 模型缓存（同步；插件停用、库已关闭时不读写） */
    cacheGet: (key) => (open ? S.cacheGet.get(key)?.content ?? null : null),
    cachePut: (key, model, content, runId = null) => { if (open) S.cachePut.run(key, model ?? '', content, runId, now()) },
    /** 记一次调用：先在内存里累计，flushStats() 写库；失败的调用另记原因（每批次最多 500 条） */
    logCall(runId, e) {
      if (!open) return
      const by = pendingStats.get(runId) ?? new Map()
      pendingStats.set(runId, by)
      const k = `${e.role}\u0000${e.model}`
      const s = by.get(k) ?? { role: e.role, model: e.model ?? '', calls: 0, cached: 0, failed: 0, ms: 0, pt: 0, ct: 0 }
      if (e.cached) s.cached++
      else { s.calls++; if (e.ok === false) s.failed++; s.ms += e.ms ?? 0; s.pt += e.usage?.prompt_tokens ?? 0; s.ct += e.usage?.completion_tokens ?? 0 }
      by.set(k, s)
      if (e.ok === false && !e.cached && S.errCount.get(runId).n < 500) S.errAdd.run(runId, e.at ?? now(), e.patient ?? null, e.role ?? null, e.model ?? null, String(e.error ?? '').slice(0, 500))
    },
    flushStats(runId) {
      if (!open) return
      for (const [rid, by] of pendingStats) {
        if (runId && rid !== runId) continue
        for (const s of by.values()) S.statAdd.run(rid, s.role, s.model, s.calls, s.cached, s.failed, s.ms, s.pt, s.ct)
        pendingStats.delete(rid)
      }
    },
    /** 调用统计：本版本的批次读 call_stats；旧批次从逐条流水汇总 */
    callStats(runId) {
      const rows = S.statsOf.all(runId)
      return rows.length ? rows : S.oldStatsOf.all(runId).map((r) => ({ ...r, role: r.role ?? '', model: r.model ?? '' }))
    },
    callErrors: (runId, limit = 100) => S.errorsOf.all(runId, limit),

    /* 批次 */
    putRun(run) { if (open) putRun(run) },
    getRun(id) { const r = S.runGet.get(id); return r ? JSON.parse(r.data) : null },
    listRuns: (limit = 100) => S.runList.all(limit).map((r) => JSON.parse(r.data)),
    /** 删掉一个批次的行（批次、数据块、调用统计、失败调用）。人工判断和模型缓存按稳定编号跨批次共用，不删 */
    deleteRun(id) { tx(() => { for (const st of [S.runDel, S.shardDel, S.statDel, S.errDel, S.oldCallDel]) st.run(id) }) },

    /* 数据块 */
    putShard(runId, s) { if (open) S.shardPut.run(runId, s.shard, s.status, s.patients ?? 0, s.mentions ?? 0, s.startedAt ?? null, s.finishedAt ?? null, s.ms ?? 0, JSON.stringify(s.stats ?? {})) },
    shards: (runId) => S.shardsOf.all(runId).map((r) => ({ ...r, stats: JSON.parse(r.stats ?? '{}') })),

    /* 人工判断 */
    decide({ kind, target, decision, value = null, note = null, by = 'user', runId = null }) {
      const at = now()
      const v = value == null ? null : JSON.stringify(value)
      if (decision === 'clear') { S.decDel.run(kind, target); S.decLog.run('clear', kind, target, null, null, note, by, at, runId) }
      else { S.decPut.run(kind, target, decision, v, note ?? '', by, at, runId); S.decLog.run('set', kind, target, decision, v, note ?? '', by, at, runId) }
    },
    /** Map(`${kind}\0${target}` → { kind, target, decision, value, note, by, at }) */
    decisions() {
      const out = new Map()
      for (const r of S.decAll.all()) out.set(`${r.kind}\u0000${r.target}`, { kind: r.kind, target: r.target, decision: r.decision, value: r.value == null ? null : JSON.parse(r.value), note: r.note ?? '', by: r.by ?? 'user', at: r.at })
      return out
    },
    decisionHistory: (kind, target) => S.decHistory.all(kind, target).map((r) => ({ ...r, value: r.value == null ? null : JSON.parse(r.value) })),
    /** 一批写入合成一个事务（批量判断等），出错整批回滚 */
    transaction: (fn) => tx(fn),
    close() { if (open) { open = false; try { db.close() } catch { /* closed */ } } },
  }
  return store
}
