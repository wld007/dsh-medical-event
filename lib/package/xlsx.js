/**
 * 每位病人一份“结果.xlsx”（与原工序结果表同口径）：汇总、提及明细、事件表、提及映射、发现表、各方提及、病情变化。
 * 可再生视图；事件包里的 jsonl 才是交接格式。
 */
import * as XLSX from '../../vendor/xlsx.mjs'

const sheet = (header, rows) => {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = header.map((h) => ({ wch: Math.min(60, Math.max(8, String(h).length * 2 + 2)) }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) }
  return ws
}
const v = (x) => (x == null ? '' : Array.isArray(x) ? x.join('、') : typeof x === 'object' ? JSON.stringify(x) : x)

export function buildWorkbook(patient, tables, summary) {
  const wb = XLSX.utils.book_new()
  const S = summary
  const sumRows = [
    ['病人', patient], ['规则包', (S.rulepack ?? []).map((l) => `${l.id} v${l.version}`).join('；')], ['截至时刻', S.asOf ?? '不截断'],
    ['片段', S.fragments], ['提及', S.mentions], ['事件', S.events], ['多提及事件', S.multiMentionEvents], ['发现', S.findings],
    ...Object.entries(S.gates ?? {}).map(([k, g]) => [`验收门${k}`, g.pass ? '通过' : `未过 ${JSON.stringify(g.failures ?? g.problems ?? {})}`]),
    ['兜底命中率', S.gates?.['②']?.fallbackRate != null ? `${(S.gates['②'].fallbackRate * 100).toFixed(1)}%` : ''],
    ...Object.entries(S.types ?? {}).map(([k, n]) => [`类型·${k}`, n]),
    ...Object.entries(S.timeSources ?? {}).map(([k, n]) => [`时间来源·${k}`, n]),
    ...Object.entries(S.ruleHits ?? {}).map(([k, n]) => [`命中规则·${k}`, n]),
    ...Object.entries(S.mergeRules ?? {}).map(([k, n]) => [`归并依据·${k}`, n]),
    ...Object.entries(S.verdicts ?? {}).map(([k, n]) => [`发现·${k}`, n]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['项', '值'], ...sumRows]), '汇总')
  const M = tables.mentions ?? []
  XLSX.utils.book_append_sheet(wb, sheet(
    ['提及', '记录类型', '写成时间', '栏目', '句', 's', 'e', '原文', '修饰继承', '时间短语', '时间来源', '发生最早', '发生最晚', '精度', '类型', '细分', '细项', '子类', '来源', '阴性', '模板化', '时间性质', '指向未来', '兼含', '动作', '执行状态', '确定程度', '依从描述', '命中规则', '事件', '归并依据', '片段'],
    M.map((m) => [m.id, m.recordType, m.writtenAt, m.section, m.sentence, m.s, m.e, m.text, m.scope, m.timePhrase, m.timeSource, m.occurFrom, m.occurTo, m.precision, m.type, m.subdivision, m.item, m.subclass, m.origin, m.negative ? '是' : '', m.templated, m.temporality, m.future ? '是' : '', m.alsoContains, m.action, m.execStatus, m.certainty, m.adherence, m.rules?.classify ?? m.rules?.extract, m.eventId, m.mergeRule, m.fragmentId])), '提及明细')
  const E = tables.events ?? []
  XLSX.utils.book_append_sheet(wb, sheet(
    ['事件', '形态', '类型', '细分', '细项', '概念组', '归一概念', '已归一', '极性', '数值', '共识最早', '共识最晚', '时间一致', '在用片段起', '在用片段止', '用药动作', '所属就诊', '提及数', '文书数', '首次写成', '末次写成', '首见提及', '归并依据', '别名'],
    E.map((e) => [e.id, e.form, e.type, e.subdivision, e.item, e.conceptGroup, e.concept, e.normalized ? '是' : '', e.polarity, e.value, e.consensus?.a, e.consensus?.b, e.consensus ? (e.consensus.consistent ? '是' : '否') : '', e.segment?.from, e.segment?.to, e.drugAction, e.encounterId, e.mentionCount, e.docCount, e.firstWritten, e.lastWritten, e.firstMention, e.mergeRule, e.aliases.map((a) => `${a.alias}→${a.concept}（${a.nature}）`).join('；')])), '事件表')
  const F = tables.findings ?? []
  XLSX.utils.book_append_sheet(wb, sheet(
    ['发现', '判定', '子类', '命中规则', '说明', '记录质量解释', '涉及事件', '方数', '建议采信', '建议理由', '确定程度', '时间关系', '影响', '评测三分类', '人工裁定'],
    F.map((f) => [f.id, f.verdict, f.subclass, f.rule, f.why, f.qualityNote, v(f.events), f.sides.length, f.adopt, f.adoptReason, f.certainty, f.timeRelation, v(f.impact), f.evalClass, f.review?.decision ?? ''])), '发现表')
  const byId = new Map(M.map((m) => [m.id, m]))
  const sideRows = []
  for (const f of F) for (const s of f.sides) for (const id of s.mentions) {
    const m = byId.get(id)
    sideRows.push([f.id, s.label, s.tier, s.tierName, id, m?.writtenAt, m?.recordType, m?.section, m?.text, m?.occurFrom, m?.occurTo, m?.temporality])
  }
  XLSX.utils.book_append_sheet(wb, sheet(['发现', '一方', '来源等级', '等级名', '提及', '写成时间', '记录类型', '栏目', '原文', '发生最早', '发生最晚', '时间性质'], sideRows), '各方提及')
  const stage = (tables.stageChanges ?? []).flatMap((x) => x.seq.map((s) => [x.pattern, s.stage, s.from, s.to, s.n, v(s.events)]))
  XLSX.utils.book_append_sheet(wb, sheet(['项目', '状态', '首见', '末见', '提及数', '事件'], stage), '病情变化')
  const evById = new Map(E.map((e) => [e.id, e]))
  XLSX.utils.book_append_sheet(wb, sheet(['关系', '规则', '从事件', '从概念', '到事件', '到概念', '到时间', '依据提及', '说明'],
    (tables.links ?? []).map((l) => [l.relation, l.rule, l.from, evById.get(l.from)?.concept ?? '', l.to ?? '（无法印证）', l.to ? evById.get(l.to)?.concept ?? '' : '', l.to ? evById.get(l.to)?.consensus?.a ?? '' : '', v(l.mentions), l.note ?? ''])), '印证关系')
  XLSX.utils.book_append_sheet(wb, sheet(['线索', '概念', '相关事件', '说明'], (tables.clues ?? []).map((c) => [c.kind, c.concept, v(c.events), c.note ?? ''])), '交矛盾判断线索')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true })
}
