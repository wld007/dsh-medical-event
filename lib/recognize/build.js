/**
 * 识别规格 → 数据源层规则包（与 rules/source/zj-regional 同一结构），交给引擎。
 */
import { DOCUMENT_TYPES, STRUCTURED_TYPES, IGNORE, SECTION_ALIASES, kindOf } from './canon.js'
import { WHOLE } from './draft.js'

const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).filter(Boolean)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NUM = '(?:[一二三四五六七八九十\\d]+[、.．)）][ \\t]*)?'

/** 标准栏目 → 识别它的标题正则（名称或别名，后跟冒号，或【】包起来）。 */
function headingRe(names) {
  const alt = names.join('|')
  return new RegExp(`(?:^|\\n)[ \\t]*${NUM}(?:【(?:${alt})】[ \\t]*[:：]?|(?:${alt})[ \\t]*[:：])`)
}
function aliasSources(name) {
  return [esc(name), ...(SECTION_ALIASES[name] ?? []).map((re) => re.source.replace(/^\^/, '').replace(/\$$/, ''))]
}

/** 文书表头里常见的非病情字段：作为“跳过”栏目，不抽提及。 */
const HEADER = ['科室', '日期', '时间', '病案号', '病历号', '门诊号', '住院号', '床号', '电话', '姓名', '性别', '年龄', '职业', '地址', '发病日期', '医生签名', '签名', '记录者', '记录人', '审核者', '是否有自费项目', '去向', '备注']

function sectionsFor(recordType, freeNames = []) {
  const def = DOCUMENT_TYPES[recordType]
  const list = def.sections.map((s) => ({ ...s, re: headingRe(aliasSources(s.name)) }))
  for (const name of freeNames) if (!list.some((s) => s.name === name)) list.push({ name, time: 'written', label: '写成当时', re: headingRe([esc(name)]) })
  list.push({ name: '（表头）', time: 'written', skip: true, re: headingRe(HEADER.map(esc)) })
  return { list, multi: true }
}

function renderTemplateOf(recordType, roles) {
  const def = STRUCTURED_TYPES[recordType]
  if (recordType === '其他结构化') return arr(roles.text).map((f) => `{${f}}`).join('｜')
  // {role} → {field1|field2}
  return def.render.replace(/\{(\w+)((?::\w+)?)((?:\?[^}]*)?)\}/g, (_, role, fmt, cond) => {
    const fs = arr(roles[role])
    if (!fs.length) return ''
    return `{${fs.join('|')}${fmt}${cond}}`
  })
}

const SETTING_DEFAULT = { 1: '门诊', 2: '住院', 3: '体检', 门诊: '门诊', 住院: '住院', 急诊: '门诊', 体检: '体检' }

/**
 * entries: [{ signature, table, spec }]（已采用的），返回规则包。
 */
export function buildSourcePack(entries, { id = 'recognized', name = '自动识别', profileId = null } = {}) {
  const tables = []
  const freeDoc = new Set()
  const docTypes = new Set()
  for (const e of entries) {
    const s = e.spec
    if (!s?.recordType || s.recordType === IGNORE) continue
    const kind = kindOf(s.recordType)
    const t = {
      id: `t${e.signature.slice(0, 10)}`,
      match: { table: e.table },
      sourceTable: e.table,
      recordType: s.recordType,
      kind,
      key: arr(s.key),
      visible: { first: arr(s.written), basis: `写成时间（${arr(s.written)[0]}）` },
      occur: arr(s.occur),
      origin: s.origin,
    }
    if (s.invalid?.field) t.invalid = { field: s.invalid.field, values: s.invalid.values.map(String) }
    const enc = s.encounter ?? {}
    if (enc.outpatient || enc.inpatient) {
      t.encounter = { outpatient: enc.outpatient ?? null, inpatient: enc.inpatient ?? null, admit: enc.admit ?? null, discharge: enc.discharge ?? null, dept: arr(s.roles?.dept) }
      if (s.recordType === '就诊登记') t.encounter.role = 'visit'
      if (s.recordType === '入院记录') t.encounter.role = 'admission'
      if (enc.setting) { t.encounter.setting = enc.setting; t.codes = { [enc.setting]: { ...SETTING_DEFAULT, ...(enc.settingValues ?? {}) } } }
    }
    if (s.roles?.birth || s.roles?.sex) t.person = { birth: arr(s.roles.birth)[0] ?? null, sex: arr(s.roles.sex)[0] ?? null }
    if (kind === '结构化') {
      const def = STRUCTURED_TYPES[s.recordType]
      t.meta = Object.fromEntries(Object.entries(s.roles ?? {}).filter(([r]) => def.roles[r] && r !== 'text').map(([r, f]) => [r, arr(f)]))
      if (def.lab) t.render = { lab: true }
      else if (s.recordType === '生命体征' && s.measures?.length) t.measures = s.measures
      else t.render = { template: renderTemplateOf(s.recordType, s.roles ?? {}) }
    } else {
      docTypes.add(s.recordType)
      const whole = s.sections.filter(([, n]) => n === WHOLE).map(([f]) => f)
      const parts = s.sections.filter(([, n]) => n !== WHOLE)
      t.fields = parts.map(([f, n]) => [f, n])
      if (whole.length) t.wholeFields = whole
      t.decode = s.sections.map(([f]) => f)
      if (DOCUMENT_TYPES[s.recordType].freeSections) for (const [, n] of parts) freeDoc.add(n)
    }
    tables.push(t)
  }
  const sections = {}
  for (const rt of docTypes) sections[rt] = sectionsFor(rt, rt === '其他文书' ? [...freeDoc] : [])
  return {
    id, layer: 'source', version: profileId ?? '0', name,
    timezoneOffsetMinutes: 480,
    decodeEntities: true,
    tables,
    sections,
    noise: [/^\{[^}]*\}?$/, /^医生签名\s*[:：]/, /^\d{4}-\d{2}-\d{2}$/, /^(?:签名|记录者|审核者)\s*[:：]/],
  }
}
