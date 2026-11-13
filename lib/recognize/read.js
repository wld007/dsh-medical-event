/**
 * 通用读入：把各种导出文件读成“表 → 行”。
 *
 *   .json     数组；或对象里唯一的“对象数组”属性（data / rows / records / list / items …）；或单个对象
 *   .ndjson / .jsonl   每行一个对象
 *   .csv / .tsv / .txt（制表符或逗号分隔、首行表头）
 *   .xlsx / .xls       每个工作表一张表（表名 = 文件名#工作表名）
 *
 * 表的身份（tableKey）：去掉扩展名、按月／按日的日期后缀和“(1)”之类的副本标记后的文件名；
 * 同名文件在不同目录（不同病人、不同月份）算同一张表。
 *
 * 嵌入文档：字段值是 base64 编码的 XML／HTML 文书（电子病历编辑器存档）时，
 * decodeEmbedded 把它还原成带栏目标题的纯文字（“主诉：…\n现病史：…”）。
 */
import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'

export const DATA_EXT = /\.(json|ndjson|jsonl|csv|tsv|txt|xlsx|xls)$/i

/** 文件 → 表名（不含工作表）。 */
export function tableKeyOf(file) {
  let stem = basename(file).replace(/\.[^.]+$/, '')
  stem = stem.replace(/\s*[（(]\d+[)）]$/, '') // 副本 (1)
  stem = stem.replace(/[_\-. ]?(?:19|20)\d{2}[-_.]?(?:0[1-9]|1[0-2])(?:[-_.]?(?:0[1-9]|[12]\d|3[01]))?$/, '') // 日期后缀
  return stem || basename(file)
}

function rowsOfJson(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const arrays = Object.entries(data).filter(([, v]) => Array.isArray(v) && v.some((x) => x && typeof x === 'object' && !Array.isArray(x)))
    if (arrays.length === 1) return arrays[0][1]
    const pref = arrays.find(([k]) => /^(data|rows|records|list|items|result|results)$/i.test(k))
    if (pref) return pref[1]
    return [data]
  }
  return []
}

/** 简单 CSV：引号、转义引号、引号内换行。 */
export function parseDelimited(text, sep) {
  const rows = []; let row = []; let cell = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c
    } else if (c === '"' && cell === '') q = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows.filter((r) => r.some((x) => x !== ''))
  if (!head) return []
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim() || `列${i + 1}`, r[i] ?? ''])))
}

let XLSX = null
async function xlsx() {
  XLSX ??= await import('../../vendor/xlsx.mjs')
  return XLSX
}

/**
 * 读一个数据文件 → [{ table, rows }]（xlsx 可能多张）。读不了返回 [] 并给 error。
 */
export async function readDataFile(file) {
  const ext = extname(file).toLowerCase()
  const key = tableKeyOf(file)
  try {
    if (ext === '.xlsx' || ext === '.xls') {
      const X = await xlsx()
      const wb = X.read(await readFile(file))
      return wb.SheetNames.map((name) => ({ table: wb.SheetNames.length > 1 ? `${key}#${name}` : key, rows: X.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: false }) }))
    }
    const text = (await readFile(file, 'utf8')).replace(/^\uFEFF/, '')
    if (ext === '.json') return [{ table: key, rows: rowsOfJson(JSON.parse(text)).filter((r) => r && typeof r === 'object') }]
    if (ext === '.ndjson' || ext === '.jsonl') return [{ table: key, rows: text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((r) => r && typeof r === 'object') }]
    const first = text.split('\n', 1)[0]
    const sep = ext === '.tsv' || (first.split('\t').length > first.split(',').length) ? '\t' : ','
    return [{ table: key, rows: parseDelimited(text, sep) }]
  } catch (error) {
    return [{ table: key, rows: [], error: String(error?.message ?? error) }]
  }
}

/* -------------------------------------------------------- embedded docs */

const B64 = /^[A-Za-z0-9+/]+={0,2}$/

/** 看起来是 base64 的长串（至少 64 字、只含 base64 字符）。 */
export function looksBase64(v) {
  if (typeof v !== 'string' || v.length < 64) return false
  const s = v.replace(/\s+/g, '')
  return s.length % 4 === 0 && B64.test(s.slice(0, 4096))
}

const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' }
const unescapeXml = (s) => s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? m))

/** 属性串 → 对象。 */
function attrsOf(s) {
  const out = {}
  for (const m of s.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) out[m[1].toLowerCase()] = unescapeXml(m[2])
  for (const m of s.matchAll(/([\w:.-]+)\s*=\s*'([^']*)'/g)) out[m[1].toLowerCase()] ??= unescapeXml(m[2])
  return out
}

const LABEL_ATTRS = ['title', 'name', 'caption', 'label']
const TEXT_ATTRS = ['text', 'value', 'content']
const BLOCK = /^(p|div|br|tr|li|h[1-6]|section|title|paragraph|panel|para|table)$/i

/**
 * XML／HTML 文书 → 纯文字。
 *   - 带“栏目标签”属性（title/name/caption/label，以冒号结尾，如 name="主诉："）的元素另起一行写标签；
 *   - 叶子元素的 text/value 属性和文本节点按文档顺序接上；
 *   - 块级元素换行；脚本、样式、二进制内容丢掉。
 */
export function xmlToText(xml) {
  const s = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, t) => t.replace(/</g, '&lt;')).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>|<![A-Za-z][^>]*>/g, '')
  const out = []
  let line = ''
  const flush = () => { if (line.trim()) out.push(line.trim()); line = '' }
  for (const m of s.matchAll(/<(\/?)([A-Za-z][\w:.-]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    if (m[5] != null) {
      // 多行的大段纯文字（编辑器的全文副本）另作候选，不并进结构化渲染
      if (m[5].length >= 40 && (m[5].match(/\n|&#xA;|&#10;/gi) ?? []).length >= 2) continue
      const t = unescapeXml(m[5]).replace(/\s+/g, ' ')
      if (t.trim() && !looksBase64(t.trim())) line += t
      continue
    }
    const closing = m[1] === '/'; const tag = m[2]; const selfClose = m[4] === '/'
    if (closing) { if (BLOCK.test(tag)) flush(); continue }
    const a = attrsOf(m[3])
    const label = LABEL_ATTRS.map((k) => a[k]).find((v) => v && /[:：]\s*$/.test(v) && v.length <= 20)
    if (label) { flush(); line = label.replace(/\s+/g, '').replace(/:$/, '：') }
    else if (BLOCK.test(tag) && !selfClose) flush()
    const text = TEXT_ATTRS.map((k) => a[k]).find((v) => v && v.trim() && !looksBase64(v))
    if (text && (selfClose || !label)) line += (line && !/[：:]$/.test(line) ? ' ' : '') + text.trim()
    if (/^br$/i.test(tag)) flush()
  }
  flush()
  // 同一栏目标签出现多次（编辑器把表单与正文各存一份）：留内容最长的那份，位置按第一次出现
  const best = new Map()
  out.forEach((l, i) => {
    const m = l.match(/^([^：:]{1,12})[：:]/)
    if (!m) return
    const prev = best.get(m[1])
    if (!prev || l.length > out[prev.i].length) best.set(m[1], { i, first: prev?.first ?? i })
  })
  const keep = out.map((l, i) => {
    const m = l.match(/^([^：:]{1,12})[：:]/)
    if (!m) return l
    const b = best.get(m[1])
    return i === b.first ? out[b.i] : null
  })
  return keep.filter((l, i) => l != null && l !== keep[i - 1]).join('\n')
}

const hanCount = (s) => (s.match(/[\u4e00-\u9fa5]/g) ?? []).length

/** 大段纯文字节点（如编辑器的 ElementText）：保留原有换行。 */
function plainTextNodes(xml) {
  const out = []
  for (const m of xml.matchAll(/>([^<]{40,})</g)) {
    const t = unescapeXml(m[1]).replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t\u3000]+/g, ' ').trim()).filter(Boolean).join('\n')
    if (hanCount(t) >= 30 && !looksBase64(m[1].trim())) out.push(t)
  }
  return out
}

/**
 * 嵌入文档解码：base64 → (UTF-8 / UTF-16) → XML/HTML → 文字。
 * 返回 { text, format } 或 null（不是能读的文书：压缩包、PDF、图片……）。
 */
export function decodeEmbedded(value) {
  if (typeof value !== 'string') return null
  let raw = value.trim()
  if (looksBase64(raw)) {
    const buf = Buffer.from(raw.replace(/\s+/g, ''), 'base64')
    const head = buf.subarray(0, 4).toString('hex')
    if (head.startsWith('fffe')) raw = buf.subarray(2).toString('utf16le')
    else if (head.startsWith('feff')) raw = buf.subarray(2).swap16().toString('utf16le')
    else if (/^(efbbbf)?3c/.test(head)) raw = buf.toString('utf8').replace(/^\uFEFF/, '')
    else return null
  }
  if (!/^\s*</.test(raw)) return null
  // 候选：结构化渲染；以及每个大段纯文字节点。取汉字最多的那个
  const text = [xmlToText(raw), ...plainTextNodes(raw)].sort((a, b) => hanCount(b) - hanCount(a))[0] ?? ''
  return text.trim() ? { text, format: /<html|<body|<div|<p\b/i.test(raw.slice(0, 2000)) ? 'html' : 'xml' } : null
}
