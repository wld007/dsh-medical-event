/**
 * Span-based splitting: every function returns [start, end) offsets into the
 * original text, so mentions stay verbatim.
 */

const TRIM = new Set([' ', '\t', '\n', '\r', '\u3000', '，', ',', '。', '；', ';', '、', '：', ':', '.', '\u00a0'])

export function trimSpan(text, s, e) {
  while (s < e && TRIM.has(text[s])) s++
  while (e > s && TRIM.has(text[e - 1])) e--
  return [s, e]
}

/** Split [s,e) at every match of `sep` (a global regex), dropping separators. */
export function splitBy(text, s, e, sep) {
  const out = []
  const part = text.slice(s, e)
  sep.lastIndex = 0
  let last = 0
  for (let m; (m = sep.exec(part));) {
    if (m[0].length === 0) { sep.lastIndex++; continue }
    out.push([s + last, s + m.index])
    last = m.index + m[0].length
  }
  out.push([s + last, e])
  return out
}

export const SENTENCE = /[。\n]/g
export const CLAUSE = /[，；;]|,(?!\d)|\n/g
export const TEMPLATE = /\n|\t| {2,}|\u3000+|。/g
export const CELLS = /\t+| {2,}|\u3000+/g

/** Template split; a single CJK char left alone (“头 部:”) is merged into the next piece. */
export function splitTemplate(text, s, e) {
  const pieces = splitBy(text, s, e, TEMPLATE).map(([a, b]) => trimSpan(text, a, b)).filter(([a, b]) => b > a)
  const out = []
  for (let i = 0; i < pieces.length; i++) {
    const [a, b] = pieces[i]
    if (b - a === 1 && /[\u4e00-\u9fa5]/.test(text[a]) && i + 1 < pieces.length) {
      out.push([a, pieces[i + 1][1]]); i++
    } else out.push([a, b])
  }
  return out
}

/**
 * 顿号拆分：not after a digit (“1、”), not when the next piece starts with a
 * label (“头部:”).
 */
export function splitDun(text, s, e) {
  const cuts = []
  for (let i = s; i < e; i++) {
    if (text[i] !== '、') continue
    if (i > s && /\d/.test(text[i - 1])) continue
    if (/^\s*[\u4e00-\u9fa5]{1,4}\s*[:：]/.test(text.slice(i + 1, Math.min(e, i + 12)))) continue
    cuts.push(i)
  }
  if (!cuts.length) return [[s, e]]
  const out = []
  let last = s
  for (const c of cuts) { out.push([last, c]); last = c + 1 }
  out.push([last, e])
  return out
}

/**
 * 测量表格行（超声“名称  测量值”）：按制表符/多空格切成单元格，数值单元格并回前一个名称，
 * 得到“主动脉根部内径(AoR)  31”这样的名称–数值对。
 */
export function splitCells(text, s, e) {
  const cells = splitBy(text, s, e, CELLS).map(([a, b]) => trimSpan(text, a, b)).filter(([a, b]) => b > a)
  const isValue = ([a, b]) => /^-?\d+(?:\.\d+)?\s*(?:mm|cm|%|ml|cm\/s|m\/s)?$/i.test(text.slice(a, b))
  if (cells.length < 2 || !cells.some(isValue)) return null
  const out = []
  for (const c of cells) {
    if (isValue(c) && out.length && !isValue(out[out.length - 1])) out[out.length - 1] = [out[out.length - 1][0], c[1]]
    else out.push(c)
  }
  return out
}
