/**
 * 过程记录库：每个输出根目录一个 SQLite（<outputRoot>/_records/records.sqlite），各批次共用，
 * 表里用 run_id 区分批次。交付数据（事件包）和给人看的报告（report.md / report.json）仍是文件。
 *
 *   runs          批次（列出常用字段，全量放 data 列的 JSON）
 *   decisions     人工裁定的当前值（按 kind + 稳定编号，重跑沿用）
 *   decision_log  人工裁定的每一次改动（只追加，审计用）
 *   model_cache   模型回复缓存（key = sha256(模型 + 提示)），同一输出根目录下各批次复用
 *   model_calls   模型调用流水（含命中缓存的调用），统计用量
 *
 * 字段只用 TEXT / INTEGER，时间是 ISO 文本，复杂结构放 JSON 文本列——以后整表 upsert 到
 * 线上库（如 Postgres）时可以原样接住。
 *
 * 旧布局（index.json、runs/<runId>/run.json、decisions.json、逐批 model-cache.jsonl / calls.jsonl）
 * 在第一次打开库时并入，原文件保留不动、此后不再写。
 *
 * 运行时没有 node:sqlite（Node < 22.13）时退回旧布局的文件读写，行为与引入记录库之前一致。
 */
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const RECORDS_FILE = 'records.sqlite'
export const SCHEMA_VERSION = 2
const PRODUCER = 'dsh-medical-event'
const DECISION_KINDS = ['findings', 'mentions', 'concepts']

const MIGRATIONS = [
  // v1：模型缓存与调用流水
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS model_cache (
     key TEXT PRIMARY KEY,
     model TEXT NOT NULL,
     content TEXT NOT NULL,
     run_id TEXT,
     created_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS model_calls (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     run_id TEXT NOT NULL,
     at TEXT NOT NULL,
     patient TEXT,
     kind TEXT,
     role TEXT,
     model TEXT,
     ok INTEGER,
     cached INTEGER NOT NULL DEFAULT 0,
     ms INTEGER,
     prompt_tokens INTEGER,
     completion_tokens INTEGER,
     error TEXT,
     usage TEXT
   );
   CREATE INDEX IF NOT EXISTS model_calls_run ON model_calls (run_id);`,
  // v2：批次与人工裁定
  `CREATE TABLE IF NOT EXISTS runs (
     id TEXT PRIMARY KEY,
     status TEXT NOT NULL,
     started_at TEXT,
     finished_at TEXT,
     input TEXT,
     input_name TEXT,
     output TEXT,
     patients INTEGER,
     findings INTEGER,
     review INTEGER,
     data TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS runs_started ON runs (started_at);
   CREATE TABLE IF NOT EXISTS decisions (
     kind TEXT NOT NULL,
     target TEXT NOT NULL,
     decision TEXT,
     note TEXT,
     by TEXT,
     at TEXT NOT NULL,
     run_id TEXT,
     PRIMARY KEY (kind, target)
   );
   CREATE TABLE IF NOT EXISTS decision_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     action TEXT NOT NULL,
     kind TEXT NOT NULL,
     target TEXT NOT NULL,
     decision TEXT,
     note TEXT,
     by TEXT,
     at TEXT NOT NULL,
     run_id TEXT
   );
   CREATE INDEX IF NOT EXISTS decision_log_target ON decision_log (kind, target);`,
]

let sqliteModule
async function loadSqlite() {
  if (sqliteModule === undefined) {
    try { sqliteModule = await import('node:sqlite') } catch { sqliteModule = null }
  }
  return sqliteModule
}

async function exists(p) { try { await stat(p); return true } catch { return false } }
async function readJson(path, fallback) { try { return JSON.parse(await readFile(path, 'utf8')) } catch { return fallback } }
async function readLines(path) {
  try { return (await readFile(path, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] }
}

const emptyDecisions = () => Object.fromEntries(DECISION_KINDS.map((k) => [k, {}]))
/** 批次列表里的一行（与旧 index.json 相同）。 */
export const runBrief = (run) => ({ id: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt ?? null, input: run.inputName, patients: run.totals?.patients ?? 0, findings: run.totals?.findings ?? 0, review: run.totals?.review ?? 0 })

const callRow = (r) => ({
  at: r.at, patient: r.patient, kind: r.kind, role: r.role, model: r.model,
  ok: r.ok == null ? undefined : Boolean(r.ok), cached: Boolean(r.cached) || undefined,
  ms: r.ms ?? undefined, error: r.error ?? undefined,
  usage: r.usage ? JSON.parse(r.usage) : (r.prompt_tokens != null || r.completion_tokens != null ? { prompt_tokens: r.prompt_tokens, completion_tokens: r.completion_tokens } : undefined),
})

/* ------------------------------------------------------------------ sqlite */

async function sqliteRecords(DatabaseSync, recordsDir) {
  const path = join(recordsDir, RECORDS_FILE)
  const db = new DatabaseSync(path)
  const tx = (fn) => {
    db.exec('BEGIN')
    try { const r = fn(); db.exec('COMMIT'); return r } catch (e) { db.exec('ROLLBACK'); throw e }
  }
  try {
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;')
    const version = db.prepare('PRAGMA user_version').get().user_version
    if (version > SCHEMA_VERSION) throw new Error(`记录库 ${path} 的版本（${version}）比本插件新（${SCHEMA_VERSION}），请升级插件`)
    for (let v = version; v < SCHEMA_VERSION; v++) tx(() => { db.exec(MIGRATIONS[v]); db.exec(`PRAGMA user_version = ${v + 1}`) })
  } catch (e) { db.close(); throw e }

  const q = {
    meta: db.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    cacheGet: db.prepare('SELECT content FROM model_cache WHERE key = ?'),
    cachePut: db.prepare('INSERT OR IGNORE INTO model_cache (key, model, content, run_id, created_at) VALUES (?, ?, ?, ?, ?)'),
    callPut: db.prepare('INSERT INTO model_calls (run_id, at, patient, kind, role, model, ok, cached, ms, prompt_tokens, completion_tokens, error, usage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    calls: db.prepare('SELECT * FROM model_calls WHERE run_id = ? ORDER BY id'),
    runPut: db.prepare(`INSERT INTO runs (id, status, started_at, finished_at, input, input_name, output, patients, findings, review, data, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, started_at = excluded.started_at, finished_at = excluded.finished_at,
        input = excluded.input, input_name = excluded.input_name, output = excluded.output, patients = excluded.patients,
        findings = excluded.findings, review = excluded.review, data = excluded.data, updated_at = excluded.updated_at`),
    runGet: db.prepare('SELECT data FROM runs WHERE id = ?'),
    runList: db.prepare('SELECT data FROM runs ORDER BY started_at DESC LIMIT ?'),
    decisionsAll: db.prepare('SELECT kind, target, decision, note, by, at FROM decisions'),
    decisionPut: db.prepare(`INSERT INTO decisions (kind, target, decision, note, by, at, run_id) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(kind, target) DO UPDATE SET decision = excluded.decision, note = excluded.note, by = excluded.by, at = excluded.at, run_id = excluded.run_id`),
    decisionImport: db.prepare('INSERT OR IGNORE INTO decisions (kind, target, decision, note, by, at, run_id) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    decisionDel: db.prepare('DELETE FROM decisions WHERE kind = ? AND target = ?'),
    decisionLog: db.prepare('INSERT INTO decision_log (action, kind, target, decision, note, by, at, run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    decisionHistory: db.prepare('SELECT action, decision, note, by, at, run_id AS runId FROM decision_log WHERE kind = ? AND target = ? ORDER BY id'),
  }
  q.setMeta.run('schema_version', String(SCHEMA_VERSION))
  q.setMeta.run('producer', PRODUCER)

  const n = (x) => (Number.isFinite(x) ? x : null)
  const now = () => new Date().toISOString()
  let open = true

  const putRun = (run) => {
    const b = runBrief(run)
    q.runPut.run(run.id, run.status ?? 'unknown', run.startedAt ?? null, run.finishedAt ?? null, run.input ?? null, run.inputName ?? null, run.output ?? null,
      n(b.patients), n(b.findings), n(b.review), JSON.stringify(run), now())
  }

  /* 旧布局并入（每个库只做一次；原文件不动） */
  if (!q.meta.get('legacy_imported')) {
    const runs = []
    const runsDir = join(recordsDir, 'runs')
    let ids = []
    try { ids = (await readdir(runsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name) } catch { /* none */ }
    for (const id of ids) {
      const run = await readJson(join(runsDir, id, 'run.json'), null)
      if (run?.id) runs.push({ run, cache: await readLines(join(runsDir, id, 'model-cache.jsonl')), calls: await readLines(join(runsDir, id, 'calls.jsonl')) })
    }
    const decisions = await readJson(join(recordsDir, 'decisions.json'), {})
    tx(() => {
      for (const { run, cache, calls } of runs) {
        if (!q.runGet.get(run.id)) putRun(run)
        for (const r of cache) if (r?.key && r.content != null) q.cachePut.run(r.key, '', r.content, run.id, now())
        if (calls.length && !q.calls.all(run.id).length) {
          for (const e of calls) q.callPut.run(run.id, e.at ?? now(), e.patient ?? null, e.kind ?? null, e.role ?? null, e.model ?? null, e.ok == null ? null : e.ok ? 1 : 0, e.cached ? 1 : 0, n(e.ms), n(e.usage?.prompt_tokens), n(e.usage?.completion_tokens), e.error ?? null, e.usage ? JSON.stringify(e.usage) : null)
        }
      }
      for (const [kind, byId] of Object.entries(decisions ?? {})) {
        for (const [target, d] of Object.entries(byId ?? {})) {
          q.decisionImport.run(kind, target, d?.decision ?? null, d?.note ?? '', d?.by ?? 'user', d?.at ?? now(), null)
          q.decisionLog.run('import', kind, target, d?.decision ?? null, d?.note ?? '', d?.by ?? 'user', d?.at ?? now(), null)
        }
      }
      q.setMeta.run('legacy_imported', now())
    })
  }

  return {
    kind: 'sqlite',
    path,
    forRun(runId) {
      return {
        // 插件停用时库已关闭，还在途的调用不再读写（批次随后记为已取消）
        async cacheGet(key) { return open ? q.cacheGet.get(key)?.content : undefined },
        async cachePut(key, model, content) { if (open) q.cachePut.run(key, model ?? '', content, runId, now()) },
        async logCall(e) {
          if (!open) return
          q.callPut.run(runId, e.at ?? now(), e.patient ?? null, e.kind ?? null, e.role ?? null, e.model ?? null,
            e.ok == null ? null : e.ok ? 1 : 0, e.cached ? 1 : 0, n(e.ms), n(e.usage?.prompt_tokens), n(e.usage?.completion_tokens),
            e.error ?? null, e.usage ? JSON.stringify(e.usage) : null)
        },
      }
    },
    async calls(runId) { return q.calls.all(runId).map(callRow) },

    async saveRun(run) { if (open) putRun(run) },
    async loadRun(id) { const r = q.runGet.get(id); return r ? JSON.parse(r.data) : null },
    async listRuns(limit = 100) { return q.runList.all(limit).map((r) => runBrief(JSON.parse(r.data))) },

    async loadDecisions() {
      const out = emptyDecisions()
      for (const r of q.decisionsAll.all()) (out[r.kind] ??= {})[r.target] = { decision: r.decision, note: r.note ?? '', by: r.by ?? 'user', at: r.at }
      return out
    },
    /** value 为 null 表示撤销该裁定。 */
    async saveDecision(kind, target, value, runId = null) {
      tx(() => {
        if (value == null) {
          q.decisionDel.run(kind, target)
          q.decisionLog.run('clear', kind, target, null, null, null, now(), runId)
        } else {
          q.decisionPut.run(kind, target, value.decision ?? null, value.note ?? '', value.by ?? 'user', value.at ?? now(), runId)
          q.decisionLog.run('set', kind, target, value.decision ?? null, value.note ?? '', value.by ?? 'user', value.at ?? now(), runId)
        }
      })
    },
    async decisionHistory(kind, target) { return q.decisionHistory.all(kind, target) },

    close() { if (open) { open = false; db.close() } },
  }
}

/* ------------------------------------------------------- 旧布局（文件）退路 */

function fileRecords(recordsDir) {
  const runDirOf = (runId) => join(recordsDir, 'runs', runId)
  const decisionsPath = join(recordsDir, 'decisions.json')
  const indexPath = join(recordsDir, 'index.json')
  return {
    kind: 'jsonl',
    path: null,
    forRun(runId) {
      const dir = runDirOf(runId)
      const cachePath = join(dir, 'model-cache.jsonl')
      let mem = null
      const load = async () => {
        if (!mem) { mem = new Map(); for (const x of await readLines(cachePath)) mem.set(x.key, x.content) }
        return mem
      }
      return {
        async cacheGet(key) { return (await load()).get(key) },
        async cachePut(key, model, content) {
          const m = await load()
          if (m.has(key)) return
          m.set(key, content)
          await mkdir(dir, { recursive: true }); await appendFile(cachePath, JSON.stringify({ key, content }) + '\n')
        },
        async logCall(e) {
          if (e.cached) return // 旧格式只记真正发出的调用
          await mkdir(dir, { recursive: true }); await appendFile(join(dir, 'calls.jsonl'), JSON.stringify(e) + '\n')
        },
      }
    },
    async calls(runId) { return readLines(join(runDirOf(runId), 'calls.jsonl')) },

    async saveRun(run) {
      await mkdir(runDirOf(run.id), { recursive: true })
      await writeFile(join(runDirOf(run.id), 'run.json'), JSON.stringify(run, null, 2))
      const idx = await readJson(indexPath, [])
      await writeFile(indexPath, JSON.stringify([runBrief(run), ...idx.filter((r) => r.id !== run.id)].slice(0, 100), null, 2))
    },
    async loadRun(id) { return readJson(join(runDirOf(id), 'run.json'), null) },
    async listRuns(limit = 100) { return (await readJson(indexPath, [])).slice(0, limit) },

    async loadDecisions() { return { ...emptyDecisions(), ...(await readJson(decisionsPath, {})) } },
    async saveDecision(kind, target, value) {
      const d = await this.loadDecisions()
      d[kind] ??= {}
      if (value == null) delete d[kind][target]
      else d[kind][target] = { decision: value.decision, note: value.note ?? '', by: value.by ?? 'user', at: value.at ?? new Date().toISOString() }
      await mkdir(recordsDir, { recursive: true })
      await writeFile(decisionsPath, JSON.stringify(d, null, 2))
    },
    async decisionHistory() { return [] },

    close() {},
  }
}

/**
 * 打开输出根目录的记录库。
 *   opts.sqlite === false  强制用旧布局文件（测试、排障用）
 *   opts.create === false  _records 目录不存在时返回 null（只读场景，不在已删除的输出目录里重建）
 */
export async function openRecords(recordsDir, { sqlite = true, create = true } = {}) {
  if (!create && !(await exists(recordsDir))) return null
  await mkdir(recordsDir, { recursive: true })
  const mod = sqlite ? await loadSqlite() : null
  return mod?.DatabaseSync ? sqliteRecords(mod.DatabaseSync, recordsDir) : fileRecords(recordsDir)
}
