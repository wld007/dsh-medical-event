/**
 * 本机格式库：识别过的表按签名（表名＋字段集合）存一份，以后的批次直接复用。
 * 位置：插件状态目录（<profile>/plugin-data/medical-event/formats.json），各输出根目录共用。
 * 只存规格与统计，不存样例和病历内容。
 *
 * 条目：{ signature, table, status, spec, drafts, diffs, problems, updatedAt, decidedAt?, history[] }
 *   status: agreed（两方一致，自动采用） | confirmed（人工确认） | disputed（分歧，暂扣）
 *           | invalid（校验不过，暂扣） | rejected（人工驳回，跳过）
 */
import { mkdir, readFile, rename, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

export const ADOPTED = new Set(['agreed', 'confirmed'])
export const HELD = new Set(['disputed', 'invalid'])

const flat = (v) => (v == null ? [] : Array.isArray(v) ? v.flat(2) : [v]).filter((x) => typeof x === 'string' && x)
/** 规格里引用到的全部字段名。 */
export function specFields(spec) {
  if (!spec) return []
  const enc = spec.encounter ?? {}
  return [...new Set([
    ...flat(spec.written), ...flat(spec.occur), ...flat(spec.key), ...flat(spec.patient), ...flat(spec.invalid?.field),
    ...['outpatient', 'inpatient', 'admit', 'discharge', 'setting'].flatMap((k) => flat(enc[k])),
    ...Object.values(spec.roles ?? {}).flatMap(flat), ...(spec.measures ?? []).map((m) => m[0]), ...(spec.sections ?? []).map((x) => x[0]),
  ])]
}

export function openLibrary(stateDir) {
  const path = stateDir ? join(stateDir, 'formats.json') : null
  let cache = null
  let mtime = 0
  let chain = Promise.resolve()

  // 文件可能被另一个进程（另一个 DSH 窗口、命令行）改过：每次读都看修改时间，变了就重读
  async function load() {
    if (!path) return (cache ??= { version: 1, tables: {} })
    let m = 0
    try { m = (await stat(path)).mtimeMs } catch { /* none yet */ }
    if (cache && m === mtime) return cache
    try { cache = JSON.parse(await readFile(path, 'utf8')) } catch { cache = { version: 1, tables: {} } }
    cache.tables ??= {}
    mtime = m
    return cache
  }
  async function save() {
    if (!path) return
    await mkdir(stateDir, { recursive: true })
    const tmp = `${path}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(cache, null, 1))
    await rename(tmp, path)
    try { mtime = (await stat(path)).mtimeMs } catch { /* ignore */ }
  }
  /** 串行写，避免并发起草时互相覆盖。 */
  const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p }

  return {
    async get(signature) { return (await load()).tables[signature] ?? null },
    async all() { return Object.values((await load()).tables) },
    /**
     * 同名表、字段集合相近（重合 ≥ 60%）且规格用到的字段都还在：可以沿用（同一张表在不同病人子集里
     * 字段集合会略有出入——空字段有的行里根本不出现）。返回最近更新的那条或 null。
     */
    async findCompatible(table, fieldNames) {
      const now = new Set(fieldNames)
      const cands = Object.values((await load()).tables).filter((e) => e.table === table && e.fields?.length && e.status !== 'failed')
      const ok = cands.filter((e) => {
        const old = new Set(e.fields.map((f) => f.name))
        const inter = [...old].filter((x) => now.has(x)).length
        const jaccard = inter / (old.size + now.size - inter)
        return jaccard >= 0.6 && specFields(e.spec).every((f) => now.has(f))
      })
      // 人工裁定过的优先，其次最近更新的
      return ok.sort((a, b) => (b.decidedBy === 'user') - (a.decidedBy === 'user') || String(b.decidedAt ?? b.updatedAt).localeCompare(String(a.decidedAt ?? a.updatedAt)))[0] ?? null
    },
    put(entry) {
      return serial(async () => {
        const db = await load()
        const prev = db.tables[entry.signature]
        const history = [...(prev?.history ?? []), ...(prev ? [{ at: prev.updatedAt, status: prev.status, by: prev.decidedBy ?? prev.spec?.origin ?? null }] : [])].slice(-20)
        db.tables[entry.signature] = { ...entry, updatedAt: new Date().toISOString(), history }
        await save()
        return db.tables[entry.signature]
      })
    },
    remove(signature) {
      return serial(async () => { const db = await load(); delete db.tables[signature]; await save() })
    },
  }
}
