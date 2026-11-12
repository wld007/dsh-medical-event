/**
 * S04b 印证关系：跨类型、只连不并（验收门③不允许不同类型并成一个事件）。
 *
 *   L1 提及印证    一条提及的原文里说到某次手术/一次性事件，而它自己属于别的事件
 *                  （如影像所见“桡动脉与头静脉吻合术后”印证内瘘成形术）
 *   L2 执行佐证    收费项目与手术／操作同名，时间相近 → 证明确实做了
 *   L3 检查原件    文书里转述的检查结果 ↔ 检查报告表里同类、日期相近的报告
 *   L4 术后状态    “××术后”状态 ↔ 更早的那次手术
 *
 * 每条：{ id, from, to, relation, rule, mentions: 依据提及, note }；
 * to 为 null 表示“提到了，但记录里找不到它本身”（无法印证）。
 */
import { stableId } from './ids.js'
import { dayOf, diffDays } from './time.js'
import { buildLexicon, normText } from './s04-merge.js'

const day = (e) => e.consensus?.a ?? dayOf(e.firstWritten)

export function buildLinks({ events, mentions }, pack) {
  const lex = buildLexicon(pack.concepts)
  const P = pack.params
  const byMention = new Map(mentions.map((m) => [m.id, m]))
  const evById = new Map(events.map((e) => [e.id, e]))
  const links = new Map()
  const add = (from, to, relation, rule, mentionId, note) => {
    const key = `${from}\u0000${to ?? ''}\u0000${relation}`
    if (!links.has(key)) links.set(key, { id: stableId('L', from, to ?? '-', relation), from, to: to ?? null, relation, rule, mentions: [], note })
    const l = links.get(key)
    if (mentionId && l.mentions.length < 20 && !l.mentions.includes(mentionId)) l.mentions.push(mentionId)
  }

  // 可被印证的目标：手术操作（非“术后”状态）、一次性事件
  const surgeryBy = new Map()
  const postOpBy = new Map()
  for (const e of events) {
    if (!e.concept) continue
    if (e.conceptGroup === '手术操作' && e.form === '状态') (postOpBy.get(e.concept) ?? postOpBy.set(e.concept, []).get(e.concept)).push(e)
    else if (e.conceptGroup === '手术操作' || e.form === '一次性') (surgeryBy.get(e.concept) ?? surgeryBy.set(e.concept, []).get(e.concept)).push(e)
  }
  const targetGroups = ['手术操作', '透析']

  // L1 提及印证：只看说“已经做过”的事实、判断与转述；收费归 L2；计划、宣教不算
  for (const m of mentions) {
    const own = m.eventId ? evById.get(m.eventId) : null
    if (!own || m.future || ['收费', '宣教模板', '诊疗流程'].includes(own.conceptGroup)) continue
    for (const g of targetGroups) {
      const hit = lex.find(g, m.text)
      // 换药、拆线、清创这类可重复的操作没有“那一次”可印证
      if (!hit || hit.concept.repeatable || !(hit.concept.once || g === '手术操作')) continue
      const concept = hit.concept.name
      if (own.concept === concept) continue
      if (g === '透析' && !hit.concept.once) continue
      const occ = dayOf(m.occurTo ?? m.occurFrom ?? m.writtenAt)
      // 只连到早于（或同日）提及所说时间的那次；多次时取最近的一次
      const cands = (surgeryBy.get(concept) ?? []).filter((e) => !occ || day(e) <= occ).sort((a, b) => day(b).localeCompare(day(a)))
      const imaging = own.item === '影像／心电／超声' || own.item === '检查结论' || ['检查', '检查结论'].includes(own.conceptGroup) || m.recordType === '检查报告'
      const relation = imaging ? '影像印证' : '转述印证'
      if (cands.length) add(own.id, cands[0].id, relation, 'L1 提及印证', m.id, `${concept}：${hit.alias}`)
      else {
        const post = (postOpBy.get(concept) ?? [])[0]
        if (post && post.id !== own.id) add(own.id, post.id, relation, 'L1 提及印证', m.id, `${concept}：只找到“术后”状态，没有手术本身的记录`)
        else add(own.id, null, relation, 'L1 提及印证', m.id, `${concept}：记录里找不到这次手术本身`)
      }
    }
  }

  // L2 执行佐证：收费 → 手术／操作
  for (const e of events.filter((x) => x.conceptGroup === '收费' && x.concept)) {
    const hit = lex.find('手术操作', e.concept)
    if (!hit) continue
    const d = day(e)
    const cands = (surgeryBy.get(hit.concept.name) ?? []).filter((s) => d && Math.abs(diffDays(day(s), d)) <= (P.executionWindowDays ?? 30))
    if (cands.length) add(e.id, cands[0].id, '执行佐证', 'L2 收费佐证', e.firstMention, `${e.concept} → ${hit.concept.name}`)
  }

  // L3 检查原件：文书转述的检查 ↔ 检查报告
  const exams = events.filter((x) => x.conceptGroup === '检查')
  const isReport = (e) => e.mentions.some((id) => byMention.get(id)?.recordType === '检查报告')
  const reports = exams.filter(isReport)
  for (const e of exams.filter((x) => !isReport(x))) {
    const d = day(e)
    // 报告要早于（或同日于）转述它的文书
    const r = reports.find((x) => x.concept === e.concept && d && day(x) && Math.abs(diffDays(day(x), d)) <= P.labDayTolerance && dayOf(x.firstWritten) <= dayOf(e.firstWritten))
    if (r) add(e.id, r.id, '检查原件', 'L3 检查原件', e.firstMention, `${e.concept} ${d} ↔ 报告 ${day(r)}`)
  }

  // L4 术后状态 → 手术本身
  for (const [concept, list] of postOpBy) {
    for (const st of list) {
      const cands = (surgeryBy.get(concept) ?? []).filter((s) => day(s) <= dayOf(st.firstWritten)).sort((a, b) => day(b).localeCompare(day(a)))
      if (cands.length) add(st.id, cands[0].id, '术后状态', 'L4 术后状态', st.firstMention, `“${concept}术后”`)
      else add(st.id, null, '术后状态', 'L4 术后状态', st.firstMention, `“${concept}术后”：记录里找不到这次手术本身`)
    }
  }

  const out = [...links.values()]
  const problems = out.filter((l) => !evById.has(l.from) || (l.to && !evById.has(l.to))).map((l) => ({ gate: '③印证端点不存在', linkId: l.id }))
  return { links: out, problems }
}

export { normText }
