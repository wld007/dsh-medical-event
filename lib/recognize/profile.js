/**
 * 本地画像：把输入目录里的数据文件按表汇总，算出每个字段的统计与少量截短样例。
 * 画像是发给模型的全部内容（字段名、统计、截短样例、文书里的栏目标签），不含整段病历。
 *
 * 字段种类（kind）：
 *   empty     全空
 *   pseudonym 匿名化假名（证件-XXXXXX 等），不发样例
 *   time      能解析成时间
 *   number    数值
 *   code      短代码（不同值少、长度短）
 *   text      短文字（平均 ≤ 40 字）
 *   long      长文字（叙述）；不发样例，只发其中行首的栏目标签
 *   embedded  base64 编码的 XML／HTML 文书；解码后只发栏目标签
 */
import { readdir } from 'node:fs/promises'
import { join, relative, sep, dirname, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { DATA_EXT, readDataFile, looksBase64, decodeEmbedded } from './read.js'
import { parseInstant } from '../engine/time.js'

export const PSEUDONYM = /^(证件|医院|医生|化名|就诊|住院|病历|地址|电话|社保|银行卡|单位|邮箱|网址|账号)-[0-9A-F]{6}$/
const SAMPLE_LEN = 20
const SAMPLE_N = 3
const ROWS_PER_TABLE = 400

export async function walkData(dir, skip = () => false, out = []) {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.startsWith('~$')) continue
    const p = join(dir, e.name)
    if (skip(p)) continue
    if (e.isDirectory()) await walkData(p, skip, out)
    else if (e.isFile() && DATA_EXT.test(e.name)) out.push(p)
  }
  return out.sort()
}

const present = (v) => v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null'

/** 时间判定比引擎更严：纯数字只认 8／12／14 位日期写法和合理年份的毫秒时间戳。 */
export function asTime(v) {
  const s = String(v).trim()
  if (/^\d+$/.test(s) && ![8, 12, 13, 14].includes(s.length)) return null
  const t = parseInstant(s)
  if (!t) return null
  const y = +t.slice(0, 4)
  return y >= 1900 && y <= 2100 ? t : null
}

/** 行首栏目标签：“主诉：”“4、入院查体：”“【现病史】”。 */
export function labelsIn(text) {
  const out = []
  for (const line of String(text).split('\n')) {
    const m = line.match(/^\s*(?:[一二三四五六七八九十\d]+[、.．)）]\s*)?(?:【([^】]{1,12})】|([^\s：:，,。；;]{1,12})\s*[：:])/)
    if (m) out.push((m[1] ?? m[2]).replace(/\s+/g, ''))
  }
  return out
}

function profileField(name, values) {
  const filled = values.filter(present)
  const f = { name, filled: filled.length, rows: values.length, fill: values.length ? Math.round(filled.length / values.length * 100) : 0 }
  if (!filled.length) return { ...f, kind: 'empty' }
  const strs = filled.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v).trim()))
  const lens = strs.map((s) => s.length)
  f.avgLen = Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)
  f.maxLen = Math.max(...lens)
  f.distinct = new Set(strs).size
  const pseudo = strs.filter((s) => PSEUDONYM.test(s))
  if (pseudo.length >= strs.length * 0.6) return { ...f, kind: 'pseudonym', pseudonym: pseudo[0].split('-')[0] }
  const b64 = strs.filter((s) => looksBase64(s))
  if (b64.length >= strs.length * 0.6 && f.avgLen >= 200) {
    const labels = {}; let decoded = 0
    for (const s of b64.slice(0, 20)) {
      const d = decodeEmbedded(s)
      if (!d) continue
      decoded++
      for (const l of new Set(labelsIn(d.text))) labels[l] = (labels[l] ?? 0) + 1
    }
    return { ...f, kind: 'embedded', decoded, sampled: Math.min(20, b64.length), labels: topLabels(labels, decoded) }
  }
  const times = strs.filter((s) => asTime(s))
  f.timeRate = Math.round(times.length / strs.length * 100)
  if (f.timeRate >= 80) {
    const sorted = times.map(asTime).sort()
    return { ...f, kind: 'time', range: [sorted[0], sorted.at(-1)], samples: sample(strs) }
  }
  if (strs.every((s) => /^-?\d+(\.\d+)?$/.test(s))) return { ...f, kind: f.distinct <= 12 && f.maxLen <= 4 ? 'code' : 'number', samples: sample(strs) }
  if (f.avgLen > 40 || f.maxLen > 300) {
    const labels = {}
    for (const s of strs.slice(0, 200)) for (const l of new Set(labelsIn(s))) labels[l] = (labels[l] ?? 0) + 1
    return { ...f, kind: 'long', labels: topLabels(labels, Math.min(200, strs.length)) }
  }
  if (f.distinct <= 20 && f.maxLen <= 12) return { ...f, kind: 'code', values: [...new Set(strs)].slice(0, 12).map(cut) }
  return { ...f, kind: 'text', samples: sample(strs) }
}

const cut = (s) => (s.length > SAMPLE_LEN ? `${s.slice(0, SAMPLE_LEN)}…` : s)
function sample(strs) {
  const out = []
  for (const s of strs) { const c = cut(s); if (!out.includes(c)) out.push(c); if (out.length >= SAMPLE_N) break }
  return out
}
function topLabels(counts, n) {
  return Object.entries(counts).filter(([, c]) => c >= Math.max(1, n * 0.2)).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([l]) => l)
}

/** 表的签名：表名＋字段集合。同一签名的表在格式库里直接复用。 */
export function signatureOf(table, fieldNames) {
  return createHash('sha256').update(`${table}\u0000${[...fieldNames].sort().join('\u0001')}`).digest('hex').slice(0, 16)
}

/**
 * 画像：files → [{ table, signature, files, dirs, rows, fields, errors }]
 */
export async function profileTables(files, root) {
  const byTable = new Map()
  for (const file of files) {
    for (const { table, rows, error } of await readDataFile(file)) {
      const t = byTable.get(table) ?? { table, files: 0, dirs: new Set(), rows: 0, sample: [], fieldNames: new Set(), errors: [] }
      t.files++
      t.dirs.add(relative(root, dirname(file)).split(sep).slice(-1)[0] || '.')
      if (error) t.errors.push(error)
      t.rows += rows.length
      for (const r of rows) for (const k of Object.keys(r)) t.fieldNames.add(k)
      // 均匀取样：每个文件最多取一部分，避免只看第一个病人
      const room = ROWS_PER_TABLE - t.sample.length
      if (room > 0) t.sample.push(...rows.slice(0, Math.max(20, Math.ceil(room / 4))).slice(0, room))
      byTable.set(table, t)
    }
  }
  return [...byTable.values()].map((t) => ({
    table: t.table,
    signature: signatureOf(t.table, t.fieldNames),
    files: t.files,
    dirs: [...t.dirs].slice(0, 5),
    rows: t.rows,
    errors: t.errors.slice(0, 3),
    fields: [...t.fieldNames].map((name) => profileField(name, t.sample.map((r) => r[name]))),
  })).sort((a, b) => a.table.localeCompare(b.table))
}

/**
 * 病人分组（通用格式）：
 *   - 输入的下一级子目录里有 ≥2 个各自含多张同名表（表集合相似）→ 每个子目录是一位病人；
 *   - 否则整个输入是一位病人。
 * 区域平台导出仍按人口信息文件分组（service.findPatients）。
 */
export async function groupPatients(input, files) {
  const top = new Map()
  for (const f of files) {
    const rel = relative(input, f).split(sep)
    if (rel.length < 2) continue
    const head = rel[0]
    if (!top.has(head)) top.set(head, new Set())
    top.get(head).add(basename(f).replace(/\.[^.]+$/, ''))
  }
  const dirs = [...top.entries()].filter(([, s]) => s.size >= 3)
  if (dirs.length >= 2) {
    const sets = dirs.map(([, s]) => s)
    let similar = 0; let pairs = 0
    for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < Math.min(sets.length, i + 6); j++) {
      const a = sets[i]; const b = sets[j]
      const inter = [...a].filter((x) => b.has(x)).length
      similar += inter / (a.size + b.size - inter); pairs++
    }
    if (pairs && similar / pairs >= 0.4) return dirs.map(([d]) => join(input, d)).sort()
  }
  return [input]
}
