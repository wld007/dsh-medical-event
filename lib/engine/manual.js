/**
 * 人工判断落到提及上（逐份核对页）：在 S03 定类型之前执行，结果仍按规则包往下算（S04 归并、S05 矛盾判断）。
 *
 *   mention\0<提及编号>  reject：去掉这一条；correct：改类型（value.code、value.neg）或发生时间（value.from、value.to）
 *   add\0<提及编号>      value：{ fragmentId, s, e, text, code, neg, from, to, section }——人工补的漏提；
 *                         原文按位置核对（片段里那一段必须与 value.text 一字不差），对不上的不采用并计数
 *
 * 每条受影响的提及在 by 里记「人工」，rules.extract 记 'manual'（补充的）。
 */
import { mentionId } from './ids.js'
import { dayOf } from './time.js'
import { parseCategory, deriveSubclass } from './taxonomy.js'

const decidedOf = (code, neg, text, recordType, section) => {
  const c = parseCategory(code)
  if (!c) return null
  return {
    type: c.t, subdivision: c.sd, item: c.it, negative: Boolean(neg), future: false, action: '', past: false,
    subclass: deriveSubclass({ t: c.t, sd: c.sd, it: c.it, neg: neg ? 1 : 0 }, { text, recordType, section }),
  }
}

export function applyManual(mentions, decisions, { fragments }) {
  const stats = { rejected: 0, corrected: 0, added: 0, unmatched: 0 }
  if (!decisions?.size) return { mentions, stats }
  const out = []
  for (const m of mentions) {
    const d = decisions.get(`mention\u0000${m.id}`)
    if (!d) { out.push(m); continue }
    if (d.decision === 'reject') { stats.rejected++; continue }
    if (d.decision === 'correct' && d.value) {
      const v = d.value
      const x = { ...m, by: { ...(m.by ?? {}) } }
      if (v.code) {
        const dec = decidedOf(v.code, v.neg, m.text, m.recordType, m.section)
        if (dec) { x.decided = dec; x.by.type = '人工' }
      }
      if (v.from !== undefined || v.to !== undefined) {
        const a = v.from || null; const b = v.to || v.from || null
        if (!(a && b && a > b) && !(b && dayOf(m.writtenAt) && b > dayOf(m.writtenAt))) {
          Object.assign(x, { occurFrom: a, occurTo: b, precision: a ? '日' : '无', timeSource: '人工', timePhrase: '' })
          x.by.time = '人工'
        }
      }
      stats.corrected++
      out.push(x)
      continue
    }
    out.push(m)
  }
  const fragById = new Map(fragments.map((f) => [f.id, f]))
  const have = new Set(out.map((m) => m.id))
  for (const [key, d] of decisions) {
    if (!key.startsWith('add\u0000') || d.decision !== 'add' || !d.value) continue
    const v = d.value
    const f = fragById.get(v.fragmentId)
    if (!f) continue // 不是本病人的
    const s = Number(v.s); const e = Number(v.e)
    if (!(Number.isInteger(s) && Number.isInteger(e) && s >= 0 && e <= f.text.length && e > s) || f.text.slice(s, e) !== v.text) { stats.unmatched++; continue }
    const id = mentionId(f.id, s, e)
    if (have.has(id)) continue
    const text = f.text.slice(s, e)
    const decided = decidedOf(v.code, v.neg, text, f.recordType, v.section ?? '')
    if (!decided) { stats.unmatched++; continue }
    const written = dayOf(f.visibleAt)
    const a = v.from || written; const b = v.to || a
    out.push({
      id, fragmentId: f.id, recordType: f.recordType, kind: '文书', writtenAt: f.visibleAt, encounterId: f.encounterId ?? null,
      section: v.section ?? '', sentence: 0, s, e, text, scope: '', timePhrase: '', timeSource: v.from ? '人工' : '写成当时（人工补充）',
      occurFrom: a, occurTo: b && written && b > written ? written : b, precision: '日', anchor: written,
      rules: { extract: 'manual' }, by: { span: '人工', type: '人工', time: '人工' }, decided,
    })
    have.add(id)
    stats.added++
  }
  return { mentions: out, stats }
}
