/**
 * 起草一张表的“识别规格”（spec），三个来源：
 *   rule   规则草稿：表名关键词定类别、取值统计定时间字段、字段中文名／文书栏目标签定栏目；拿不准的项留空（弃权）
 *   model  模型起草：只看画像（字段名、统计、截短样例、栏目标签）
 *   user   页面上人工确认或修改
 *
 * spec 结构（模型与规则都按这个写；字段一律用原字段名）：
 *   { recordType, written: [字段…], occur: [字段…], key: [字段…], patient, invalid: { field, values },
 *     encounter: { outpatient, inpatient, admit, discharge, setting, settingValues: { 取值: '门诊'|'住院'|'急诊'|'体检' } },
 *     roles: { 角色: 字段 | [字段…] }, measures: [[字段, 项目名, 单位]…],
 *     sections: [[字段, 标准栏目]…],        // 文书；嵌入文档或多栏目长文本用“全文”
 *     note }
 */
import { DOCUMENT_TYPES, STRUCTURED_TYPES, IGNORE, RECORD_TYPES, NAME_HINTS, SECTION_ALIASES, COMMON_ROLES, kindOf } from './canon.js'
import { asTime } from './profile.js'

export const WHOLE = '全文'

/* ------------------------------------------------------------- brief */

/** 发给模型的一张表的简介（不含整段文字）。 */
export function briefOf(t) {
  const fields = t.fields.filter((f) => f.kind !== 'empty').map((f) => {
    const o = { 字段: f.name, 填充: `${f.fill}%`, 类型: f.kind }
    if (f.kind === 'pseudonym') o.说明 = `匿名化假名（${f.pseudonym}-…）`
    if (f.kind === 'time') o.范围 = f.range?.map((x) => x.slice(0, 10)).join('～')
    if (f.kind === 'long') { o.平均长度 = f.avgLen; if (f.labels?.length) o.行首标签 = f.labels }
    if (f.kind === 'embedded') { o.说明 = `base64 编码的 XML／HTML 文书（已解码 ${f.decoded}/${f.sampled}）`; if (f.labels?.length) o.文内标签 = f.labels }
    if (f.kind === 'code' && f.values) o.取值 = f.values
    if (f.samples) o.样例 = f.samples
    if (['code', 'text', 'number'].includes(f.kind)) o.不同值 = f.distinct
    return o
  })
  return { 表: t.table, 目录: t.dirs, 行数: t.rows, 文件数: t.files, 空字段数: t.fields.filter((f) => f.kind === 'empty').length, 字段: fields }
}

/* -------------------------------------------------------- rule draft */

const sectionOfLabel = (label) => {
  const l = String(label).replace(/^[一二三四五六七八九十\d]+[、.．)）]\s*/, '').replace(/[：:\s]/g, '')
  for (const [name, res] of Object.entries(SECTION_ALIASES)) if (res.some((re) => re.test(l))) return name
  return null
}
export { sectionOfLabel }

/** 规则草稿：只写有把握的项，其余留空（比较时视为弃权）。 */
export function ruleDraft(t) {
  const hint = NAME_HINTS.find(([re]) => re.test(t.table))
  const recordType = hint ? hint[1][0] : null
  const spec = { recordType, written: [], occur: [], key: [], patient: null, invalid: null, encounter: {}, roles: {}, measures: [], sections: [], note: hint ? `表名含「${t.table.match(hint[0])?.[0] ?? ''}」` : '', accept: hint ? hint[1] : null, origin: 'rule' }
  const times = t.fields.filter((f) => f.kind === 'time' && f.fill >= 50)
  // 只有一个像样的时间字段时才敢定写成时间
  if (times.length === 1) spec.written = [times[0].name]
  // 字段名本身就是中文栏目名（“主诉”“现病史”）
  if (recordType && kindOf(recordType) === '文书') {
    for (const f of t.fields) {
      if (f.kind === 'empty') continue
      const s = sectionOfLabel(f.name)
      if (s && DOCUMENT_TYPES[recordType].sections.some((x) => x.name === s)) spec.sections.push([f.name, s])
      else if (f.kind === 'embedded' || (f.kind === 'long' && (f.labels?.length ?? 0) >= 2)) spec.sections.push([f.name, WHOLE])
    }
  }
  const pseudo = t.fields.filter((f) => f.kind === 'pseudonym' && f.pseudonym === '证件' && f.fill >= 90)
  if (pseudo.length === 1) spec.patient = pseudo[0].name
  return spec
}

/* ------------------------------------------------------------ prompt */

const TYPES_TEXT = [
  '结构化类别（一行一条记录，给出 roles）：',
  ...Object.entries(STRUCTURED_TYPES).map(([k, v]) => `  ${k}：${v.desc}。角色：${Object.entries(v.roles).map(([r, d]) => `${r}=${d}`).join('，')}${v.required.length ? `（必填 ${v.required.join('、')}）` : ''}`),
  '文书类别（给出 sections：[字段, 标准栏目]）：',
  ...Object.entries(DOCUMENT_TYPES).map(([k, v]) => `  ${k}：${v.desc}。标准栏目：${v.sections.map((s) => s.name).join('、')}${v.freeSections ? '（可用原文的中文栏目名）' : ''}`),
  `  一个字段里是整篇文书（嵌入文档，或带多个行首标签的长文本）时，写 [字段, "${WHOLE}"]，插件按文内标签切栏目。`,
  `${IGNORE}：结算汇总、纯代码表、与病情无关的表。`,
].join('\n')

export function draftPrompt(brief) {
  return [
    { role: 'system', content: '你是医疗数据集成工程师，负责识别医院导出数据的表结构。只根据给出的字段名、统计和截短样例判断，不要臆造字段。只输出 JSON。' },
    {
      role: 'user',
      content: [
        '下面是一张导出表的画像。请判断它属于哪个标准记录类别，并指出各字段的角色。',
        '',
        TYPES_TEXT,
        '',
        '公共角色（所有类别都可填，字段不存在就写 null 或空数组）：',
        ...Object.entries(COMMON_ROLES).map(([k, v]) => `  ${k}：${v}`),
        '  encounter.setting：区分门诊／住院的字段；settingValues：该字段取值 → "门诊"|"住院"|"急诊"|"体检"',
        '  生命体征若是宽表（一行有体温、脉搏、血压等多列），用 measures：[[字段, 项目名, 单位]…]',
        '',
        '要求：',
        '- written 必须是时间类字段，按“记录写成／审核／报告时间”优先、其次创建时间的顺序；没有就给发生时间。',
        '- 字段名可能是数据元编码（如 WS02_10_071_01、DE04.01.119.00），请结合卫生信息数据元标准（WS 363、WS 445）和样例判断。',
        '- 拿不准的角色不要填；文书只列能对上标准栏目的字段。',
        '- 检验：只有“一行一个项目、带结果值”的表才是「检验」；只有报告头（报告名、审核时间，没有结果值）的表用「其他结构化」或「忽略」。',
        '- patient、key、encounter 里的每一项只写一个字段名（key 可以是数组）。',
        '- note 用一句话说明判断依据。',
        '',
        '输出格式：',
        '```json',
        '{"recordType":"…","written":["…"],"occur":[],"key":[],"patient":null,"invalid":null,"encounter":{"outpatient":null,"inpatient":null,"admit":null,"discharge":null,"setting":null,"settingValues":{}},"roles":{},"measures":[],"sections":[],"note":"…"}',
        '```',
        '',
        '表画像：',
        JSON.stringify(brief),
      ].join('\n'),
    },
  ]
}

export function repairPrompt(brief, previous, problems) {
  const [sys, user] = draftPrompt(brief)
  return [sys, user, { role: 'assistant', content: '```json\n' + JSON.stringify(previous) + '\n```' }, { role: 'user', content: `插件校验没通过：\n- ${problems.join('\n- ')}\n请改正后重新输出完整 JSON。` }]
}

/* -------------------------------------------------------- normalise */

// 模型常把多个字段写成一个“A,B”串：拆开
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).flatMap((x) => (typeof x === 'string' ? x.split(/\s*[,，、]\s*/) : [x])).filter((x) => x != null && x !== '')

/** 模型回答 → 规范化的 spec（不做校验）。 */
export function normalizeSpec(raw, origin) {
  const x = raw && typeof raw === 'object' ? raw : {}
  const enc = x.encounter && typeof x.encounter === 'object' ? x.encounter : {}
  const roles = {}
  for (const [k, v] of Object.entries(x.roles ?? {})) if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) roles[k] = v
  return {
    recordType: typeof x.recordType === 'string' ? x.recordType.trim() : null,
    written: arr(x.written), occur: arr(x.occur), key: arr(x.key),
    patient: arr(x.patient)[0] ?? null,
    invalid: x.invalid?.field ? { field: x.invalid.field, values: arr(x.invalid.values).map(String) } : null,
    encounter: Object.fromEntries(['outpatient', 'inpatient', 'admit', 'discharge', 'setting'].filter((k) => arr(enc[k]).length).map((k) => [k, arr(enc[k])[0]]).concat(enc.settingValues && Object.keys(enc.settingValues).length ? [['settingValues', enc.settingValues]] : [])),
    roles,
    measures: arr(x.measures).filter((m) => Array.isArray(m) && m[0] && m[1]).map((m) => [m[0], String(m[1]), m[2] ? String(m[2]) : '']),
    sections: arr(x.sections).filter((s) => Array.isArray(s) && s[0] && s[1]).map((s) => [s[0], String(s[1]).replace(/[：:\s]/g, '')]),
    note: typeof x.note === 'string' ? x.note.slice(0, 200) : '',
    origin,
  }
}

/* --------------------------------------------------------- validate */

/** 去掉不存在的辅助字段（主键、病人、就诊号、入出院时间）；返回 [spec, 丢掉的说明]。 */
export function fixSpec(spec, t) {
  const has = new Set(t.fields.map((f) => f.name))
  const dropped = []
  const keep = (f, what) => { if (f && !has.has(f)) { dropped.push(`${what}「${f}」`); return false } return Boolean(f) }
  const out = { ...spec, key: spec.key.filter((f) => keep(f, '主键')), patient: keep(spec.patient, '病人标识') ? spec.patient : null, encounter: {} }
  for (const [k, f] of Object.entries(spec.encounter ?? {})) if (k === 'settingValues' || keep(f, `就诊（${k}）`)) out.encounter[k] = f
  return [out, dropped]
}

/** 插件校验：字段存在、时间可解析、文书字段是文字、必填角色、栏目名合法。返回问题列表。 */
export function checkSpec(spec, t) {
  const problems = []
  if (!spec.recordType || !RECORD_TYPES.includes(spec.recordType)) return [`recordType「${spec.recordType ?? ''}」不在标准类别里`]
  if (spec.recordType === IGNORE) return []
  const byName = new Map(t.fields.map((f) => [f.name, f]))
  const need = (f, what) => { if (!byName.has(f)) problems.push(`${what}字段「${f}」不存在`); return byName.get(f) }
  if (!spec.written.length) problems.push('缺写成时间（written）')
  for (const f of spec.written) { const p = need(f, '写成时间'); if (p && p.kind !== 'time') problems.push(`写成时间字段「${f}」不是时间（${p.kind}）`) }
  for (const f of spec.occur) { const p = need(f, '发生时间'); if (p && p.kind !== 'time') problems.push(`发生时间字段「${f}」不是时间（${p.kind}）`) }
  // 标识类字段（主键、病人、就诊号）只是辅助：字段不存在时在 fixSpec 里丢掉，不拦整张表
  if (spec.invalid) need(spec.invalid.field, '作废标志')
  for (const k of ['admit', 'discharge']) {
    const f = spec.encounter?.[k]
    const p = f ? byName.get(f) : null
    if (p && p.kind !== 'time') problems.push(`就诊（${k}）字段「${f}」不是时间`)
  }
  const kind = kindOf(spec.recordType)
  if (kind === '结构化') {
    const def = STRUCTURED_TYPES[spec.recordType]
    for (const [role, f] of Object.entries(spec.roles)) {
      if (!def.roles[role]) { problems.push(`类别「${spec.recordType}」没有角色「${role}」`); continue }
      for (const one of arr(f)) need(one, `角色 ${role} 的`)
    }
    const hasMeasures = spec.recordType === '生命体征' && spec.measures.length
    for (const r of def.required) if (!spec.roles[r] && !hasMeasures) problems.push(`缺必填角色「${r}」`)
    if (spec.recordType === '生命体征' && !spec.roles.item && !spec.measures.length) problems.push('生命体征要么给 item/value，要么给 measures')
    for (const [f] of spec.measures) need(f, '测量')
    if (spec.recordType === '其他结构化' && arr(spec.roles.text).length > 6) problems.push('其他结构化最多 6 个显示字段')
  } else {
    if (!spec.sections.length) problems.push('文书至少要有一个栏目字段（sections）')
    const def = DOCUMENT_TYPES[spec.recordType]
    for (const [f, name] of spec.sections) {
      const p = need(f, '栏目')
      if (p && ['time', 'number', 'pseudonym', 'empty'].includes(p.kind)) problems.push(`栏目字段「${f}」不是文字（${p.kind}）`)
      if (name !== WHOLE && !def.freeSections && !def.sections.some((s) => s.name === name)) problems.push(`栏目「${name}」不是「${spec.recordType}」的标准栏目`)
      if (name === WHOLE && p && !['embedded', 'long', 'text'].includes(p.kind)) problems.push(`「${WHOLE}」字段「${f}」不是长文本或嵌入文档`)
    }
  }
  return problems
}

/* ---------------------------------------------------------- compare */

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * 两份草稿是否一致。只比核心项；一方为空（弃权）的项不算分歧。
 * 返回 { agree, diffs: [说明…] }
 */
export function compareSpecs(a, b) {
  const diffs = []
  const ok = (x, y) => x.recordType === y.recordType || (y.accept ?? []).includes(x.recordType) || (x.accept ?? []).includes(y.recordType)
  if (a.recordType && b.recordType && !ok(a, b)) diffs.push(`类别：${a.recordType} ／ ${b.accept?.join('、') ?? b.recordType}`)
  // 类别在认可范围内但不同：后面的细项不再比（规则草稿是按它自己猜的类别写的）
  if (a.recordType !== b.recordType) return { agree: diffs.length === 0, diffs }
  if (a.recordType === IGNORE && b.recordType === IGNORE) return { agree: true, diffs }
  if (a.written[0] && b.written[0] && a.written[0] !== b.written[0]) diffs.push(`写成时间：${a.written[0]} ／ ${b.written[0]}`)
  const kind = kindOf(a.recordType ?? b.recordType)
  if (kind === '结构化') {
    const def = STRUCTURED_TYPES[a.recordType ?? b.recordType]
    for (const r of def?.required ?? []) {
      if (a.roles[r] && b.roles[r] && !same(arr(a.roles[r]), arr(b.roles[r]))) diffs.push(`角色 ${r}：${arr(a.roles[r]).join('+')} ／ ${arr(b.roles[r]).join('+')}`)
    }
  } else if (kind === '文书' && a.sections.length && b.sections.length) {
    const ma = new Map(a.sections); const mb = new Map(b.sections)
    const shared = [...ma.keys()].filter((f) => mb.has(f))
    // 一方写「全文」（按文内标题切）、另一方指定了栏目：不算分歧
    const conflict = shared.filter((f) => ma.get(f) !== mb.get(f) && ma.get(f) !== WHOLE && mb.get(f) !== WHOLE)
    if (conflict.length) diffs.push(`栏目：${conflict.map((f) => `${f}=${ma.get(f)}／${mb.get(f)}`).join('，')}`)
  }
  return { agree: diffs.length === 0, diffs }
}

/** 合并两份一致的草稿：以模型起草（更完整）为主，规则草稿只补空。 */
export function mergeAgreed(primary, secondary) {
  const out = { ...primary }
  if (!out.written.length) out.written = secondary.written
  if (!out.patient) out.patient = secondary.patient
  if (out.recordType && kindOf(out.recordType) === '文书' && !out.sections.length) out.sections = secondary.sections
  return out
}

/** 时间字段是否真的有值（画像里的覆盖率）——给页面看的小结。 */
export function coverageOf(spec, t) {
  const f = t.fields.find((x) => x.name === spec.written?.[0])
  return f ? f.fill : 0
}

export { asTime }
