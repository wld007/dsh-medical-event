/**
 * Dates, intervals and time-phrase resolution (工序1 v1.2 “时间短语：识别与换算”).
 *
 * Dates are plain local strings: day `YYYY-MM-DD`, instant `YYYY-MM-DD HH:mm`.
 * Arithmetic goes through UTC epoch days so there are no timezone surprises.
 * An occurrence interval is `{ a, b, prec }` with a <= b (inclusive days);
 * `a` or `b` may be null for open bounds (“早于写成日，无具体时间”).
 */

const DAY = 86400000

/* ------------------------------------------------------------------ dates */

export function isDay(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) }

export function pad(n, w = 2) { return String(n).padStart(w, '0') }

export function makeDay(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  const t = Date.UTC(y, m - 1, d)
  const dt = new Date(t)
  if (dt.getUTCMonth() !== m - 1) return null // 2月30日 etc.
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`
}

export function dayToEpoch(day) {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY
}

export function epochToDay(n) {
  const dt = new Date(Math.round(n) * DAY)
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export const dayOf = (instant) => (instant ? instant.slice(0, 10) : null)
export const addDays = (day, n) => epochToDay(dayToEpoch(day) + n)
export const diffDays = (a, b) => dayToEpoch(b) - dayToEpoch(a)

export function addMonths(day, n) {
  const [y, m, d] = day.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = total - ny * 12 + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return makeDay(ny, nm, Math.min(d, last))
}

export const addYears = (day, n) => addMonths(day, Math.round(n * 12))

export function monthRange(y, m) {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return [makeDay(y, m, 1), makeDay(y, m, last)]
}

/**
 * Parse a structured timestamp from the export: `2016-04-18 08:14:00`,
 * `2016-04-18T08:14:00`, `20160418081400`, `20160418`, `2016/4/18 8:14`.
 * Returns `YYYY-MM-DD HH:mm` or null.
 */
export function parseInstant(raw, { utcOffsetMinutes = 480 } = {}) {
  if (raw == null) return null
  const s = String(raw).trim()
  // Epoch milliseconds (platform exports; negative before 1970). 8- and
  // 14-digit strings are compact dates, handled below.
  if (/^-?\d{9,13}$/.test(s) && s.replace('-', '').length !== 8) {
    const dt = new Date(Number(s) + utcOffsetMinutes * 60000)
    if (Number.isNaN(dt.getTime())) return null
    return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())} ${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`
  }
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::\d{1,2}(?:\.\d+)?)?)?/)
  if (!m) m = s.match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(?:\d{2})?)?$/)
  if (!m) return null
  const day = makeDay(+m[1], +m[2], +m[3])
  if (!day || +m[1] < 1900) return null
  const hh = m[4] != null ? +m[4] : 0
  const mm = m[5] != null ? +m[5] : 0
  if (hh > 23 || mm > 59) return null
  return `${day} ${pad(hh)}:${pad(mm)}`
}

/* -------------------------------------------------------------- intervals */

export function interval(a, b, prec) {
  if (a && b && a > b) [a, b] = [b, a]
  return { a, b, prec }
}

export function intersect(x, y) {
  const a = !x.a ? y.a : !y.a ? x.a : (x.a > y.a ? x.a : y.a)
  const b = !x.b ? y.b : !y.b ? x.b : (x.b < y.b ? x.b : y.b)
  if (a && b && a > b) return null
  return { a, b }
}

export function union(list) {
  let a = null; let b = null; let openA = false; let openB = false
  for (const x of list) {
    if (!x.a) openA = true; else if (!a || x.a < a) a = x.a
    if (!x.b) openB = true; else if (!b || x.b > b) b = x.b
  }
  return { a: openA ? null : a, b: openB ? null : b }
}

export function overlaps(x, y, slackDays = 0) {
  const xa = x.a ? addDays(x.a, -slackDays) : null
  const xb = x.b ? addDays(x.b, slackDays) : null
  return intersect({ a: xa, b: xb }, y) != null
}

/* ------------------------------------------------------- number words */

const CN = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 半: 0.5 }

/** `3`, `十`, `十二`, `二十`, `半` → number; `数` → null (handled by caller). */
export function cnNumber(s) {
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s)
  if (s === '半') return 0.5
  if (/^[一二两三四五六七八九十]+$/.test(s)) {
    if (s === '十') return 10
    const i = s.indexOf('十')
    if (i < 0) return s.length === 1 ? CN[s] : null
    const tens = i === 0 ? 1 : CN[s[0]]
    const ones = i === s.length - 1 ? 0 : CN[s[s.length - 1]]
    return tens * 10 + ones
  }
  return null
}

/* ---------------------------------------------------------- time phrases */

const NUM = '(\\d+|[一二两三四五六七八九十半]+)'
const UNIT = '(天|日|周|个月|月|年|小时)'

/** The phrase patterns of 工序1. Order matters: earlier kinds win overlaps. */
export const PHRASES = [
  { kind: '日期区间', re: /((?:19|20)\d{2})[.\-/年](\d{1,2})[.\-/月](\d{1,2})日?\s*[-~～至到]\s*(?:((?:19|20)\d{2})[.\-/年])?(\d{1,2})[.\-/月](\d{1,2})日?/g },
  { kind: '日期', re: /((?:19|20)\d{2})[.\-/年](\d{1,2})[.\-/月](\d{1,2})日?/g },
  { kind: '年月', re: /(?<![\d.])((?:19|20)\d{2})[.\-/年](\d{1,2})月?(?![.\-/\d月日])/g },
  { kind: '月日', re: /(?<![\d.\w])(1[0-2]|[1-9])[.月]([12]\d|3[01]|[1-9])日?(?=复查|查|本院|号|日|门诊|起)/g },
  { kind: '相对', re: new RegExp(`${NUM}(余)?${UNIT}(余)?前`, 'g') },
  { kind: '起病', re: new RegExp(`(?<![\\d.])${NUM}(余)?${UNIT}(余)?(?=来|以来|无明显诱因|无诱因|出现|患者)`, 'g') },
  { kind: '昨今', re: /(昨日|昨天|昨晚|昨起|今晨|今上午|今日|今天|当晚|当日|昨)/g },
  { kind: '时长', re: new RegExp(`(?<![\\d.])(\\d+|数|[一二两三四五六七八九十]+)(余)?${UNIT}(余)?(?![\\d前次/])`, 'g') },
  { kind: '年龄', re: /(\d{1,2})\s*岁(?=初潮|绝经|结婚)/g },
]

/** Durations beyond this are typos (“3000年”) and are not resolved. */
const MAX_YEARS = 120

function back(anchor, n, unit) {
  switch (unit) {
    case '小时': return addDays(anchor, -Math.floor(n / 24))
    case '天': case '日': return addDays(anchor, -Math.round(n))
    case '周': return addDays(anchor, -Math.round(n * 7))
    case '个月': case '月': return n % 1 ? addDays(anchor, -Math.round(n * 30)) : addMonths(anchor, -n)
    case '年': return n % 1 ? addDays(anchor, -Math.round(n * 365)) : addYears(anchor, -n)
    default: return null
  }
}

const TOLERANCE = { 小时: 0, 天: 0, 日: 0, 周: 3, 个月: 15, 月: 15, 年: 182 }
const PREC = { 小时: '日', 天: '日', 日: '日', 周: '周', 个月: '月', 月: '月', 年: '年' }

/**
 * “N 单位前”: point = anchor − N, widened by unit tolerance; with 余 the far
 * bound becomes N + max(1, N/2) units back (“10年余前” → 15～10 年前).
 */
export function relativeBack(anchor, n, unit, yu) {
  if (n == null || !(n > 0)) return null
  const years = unit === '年' ? n : unit === '月' || unit === '个月' ? n / 12 : n / 365
  if (years > MAX_YEARS) return null
  const tol = TOLERANCE[unit] ?? 0
  const near = back(anchor, n, unit)
  if (!near) return null
  if (yu) {
    // “5余天” → 7～5 天前（设计示例），即 N + max(1, ⌊N/2⌋)
    const far = back(anchor, n + Math.max(1, Math.floor(n / 2)), unit)
    return interval(far, near, '区间')
  }
  return interval(addDays(near, -tol), addDays(near, tol), PREC[unit])
}

/**
 * Find and resolve every time phrase in `text`.
 * ctx: { anchor: day, written: day, birth?: day, durationEnabled: bool }
 * Returns [{ kind, phrase, start, end, a, b, prec }] (unresolvable ones omitted),
 * non-overlapping, in text order.
 */
export function findTimePhrases(text, ctx) {
  const found = []
  const taken = []
  const free = (s, e) => taken.every(([x, y]) => e <= x || s >= y)
  for (const { kind, re } of PHRASES) {
    if (kind === '时长' && !ctx.durationEnabled) continue
    re.lastIndex = 0
    for (let m; (m = re.exec(text));) {
      const s = m.index; const e = s + m[0].length
      if (!free(s, e)) continue
      const r = resolve(kind, m, ctx)
      taken.push([s, e]) // claim the span even if unresolved so weaker kinds do not reuse it
      if (r) found.push({ kind, phrase: m[0], start: s, end: e, ...r })
    }
  }
  return found.sort((x, y) => x.start - y.start)
}

function resolve(kind, m, ctx) {
  const anchor = ctx.anchor
  switch (kind) {
    case '日期区间': {
      const a = makeDay(+m[1], +m[2], +m[3])
      const b = makeDay(m[4] ? +m[4] : +m[1], +m[5], +m[6])
      return a && b ? interval(a, b, '区间') : null
    }
    case '日期': {
      const d = makeDay(+m[1], +m[2], +m[3])
      return d ? interval(d, d, '日') : null
    }
    case '年月': {
      const mo = +m[2]
      if (mo < 1 || mo > 12) return null
      const [a, b] = monthRange(+m[1], mo)
      return interval(a, b, '月')
    }
    case '月日': {
      if (!ctx.written) return null
      let y = +ctx.written.slice(0, 4)
      let d = makeDay(y, +m[1], +m[2])
      if (!d) return null
      if (diffDays(ctx.written, d) > 3) d = makeDay(y - 1, +m[1], +m[2])
      return d ? interval(d, d, '日') : null
    }
    case '相对': case '起病': {
      if (!anchor) return null
      return relativeBack(anchor, cnNumber(m[1]), m[3], Boolean(m[2] || m[4]))
    }
    case '昨今': {
      if (!anchor) return null
      const d = m[1].startsWith('昨') ? addDays(anchor, -1) : anchor
      return interval(d, d, '日')
    }
    case '时长': {
      if (!anchor) return null
      const unit = m[3]
      const yu = Boolean(m[2] || m[4])
      if (m[1] === '数') {
        if (unit !== '年') return null
        return interval(back(anchor, 9, '年'), back(anchor, 2, '年'), '区间')
      }
      const n = cnNumber(m[1])
      if (n == null || !(n > 0)) return null
      const years = unit === '年' ? n : unit.endsWith('月') ? n / 12 : n / 365
      if (years > MAX_YEARS) return null
      // 病程起点：N 年余 / N 余年 → [N, N+max(1,N/2)] 年前
      if (yu) return relativeBack(anchor, n, unit, true)
      return relativeBack(anchor, n, unit, false)
    }
    case '年龄': {
      if (!ctx.birth) return null
      const y = +ctx.birth.slice(0, 4) + Number(m[1])
      return interval(makeDay(y, 1, 1), makeDay(y, 12, 31), '年')
    }
    default: return null
  }
}

/* --------------------------------------------------------- time adverbs */

/** Clause-initial adverbs, only in narrative sections. */
export const ADVERBS = [
  { kind: '目前', re: /^(?:患者)?(目前|现在|现|今)(?!日|天|晨|上午)/ },
  { kind: '期间', re: /^(?:患者)?(期间)/ },
  { kind: '之后', re: /^(?:患者)?(此后|之后|出院后|术后)/ },
  { kind: '自发病以来', re: /^(自发病以来|病来|自病来|患者病来)/ },
  { kind: '既往', re: /^(?:患者)?(既往|平素|长期|一直|近期|近来)/ },
  { kind: '起初', re: /^(起初)/ },
]

/**
 * Resolve a clause-initial adverb.
 * prev: the interval carried from earlier text (may be null).
 */
export function resolveAdverb(clause, { written, prev }) {
  for (const { kind, re } of ADVERBS) {
    const m = clause.match(re)
    if (!m) continue
    const phrase = m[1]
    switch (kind) {
      case '目前': return { kind, phrase, ...interval(written, written, '日') }
      case '期间': return prev?.a ? { kind, phrase, ...interval(prev.a, written, '区间') } : { kind, phrase, a: null, b: written, prec: '区间' }
      case '之后': return { kind, phrase, a: prev?.b ?? null, b: written, prec: '区间' }
      case '自发病以来': return { kind, phrase, a: null, b: written, prec: '区间' }
      case '既往': return { kind, phrase, a: null, b: written, prec: '无具体' }
      case '起初': return prev ? { kind, phrase, a: prev.a, b: prev.a, prec: prev.prec } : null
    }
  }
  return null
}
