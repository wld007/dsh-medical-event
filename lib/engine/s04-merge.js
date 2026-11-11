/**
 * S04 事件归并（工序3 v1.5）：把指向同一件真实事情的提及归到一起。
 * 只回答“是不是同一件事”，不判断对错、不挑版本；冲突照样归入，交 S05。
 *
 * 规则顺序（命中即记该依据，优先级从高到低）：
 *   1 结构化对齐  2 逐字复制  3 一次性概念  4 同概念＋时间相容＋同就诊
 *   5 同句修饰并入  6 状态连续  7 单提及
 */
import { eventId } from './ids.js'
import { dayOf, diffDays, intersect, union as unionIv } from './time.js'

const RULES = ['结构化对齐', '逐字复制', '一次性概念', '同概念时间相容同就诊', '同句修饰并入', '状态连续', '单提及']
const PSEUDO = /(化名|医生|医院|地址|证件|电话|病历|住院|就诊)-[0-9A-F]{6}/g
export const normText = (t) => String(t).replace(PSEUDO, '＊').replace(/[\s“”"'‘’（）()【】\[\]，,。；;：:、?？]/g, '')

/* ------------------------------------------------------------- lexicon */

function buildLexicon(concepts) {
  const byGroup = new Map()
  for (const c of concepts) {
    if (!byGroup.has(c.group)) byGroup.set(c.group, [])
    for (const a of c.aliases) byGroup.get(c.group).push({ alias: a, key: normText(a), concept: c })
  }
  for (const list of byGroup.values()) list.sort((x, y) => y.key.length - x.key.length)
  return {
    /** longest alias contained in text */
    find(group, text) {
      const t = normText(text)
      for (const e of byGroup.get(group) ?? []) if (e.key && t.includes(e.key)) return e
      return null
    },
    /** alias equal to the whole (cleaned) name */
    exact(group, name) {
      const t = normText(name)
      for (const e of byGroup.get(group) ?? []) if (e.key === t) return e
      return null
    },
  }
}

/** “有高血压病史10年余” → “高血压病”；保留“病”字（v1.3）。 */
export function cleanDiagnosis(text) {
  // 引号里的是诊断名：“有“高血压病”史10年余”“当时诊断为“…””
  const q = String(text).match(/[“"]([^”"]{2,})[”"]/)
  let t = (q ? q[1] : String(text)).replace(PSEUDO, '').replace(/[“”"]/g, '').trim()
  t = t.replace(/^(?:\d+[.、．]\s*)/, '')
  t = t.replace(/^(?:患者|既往|有|自诉有|考虑|诊断为|当时诊断为|拟|否认|无)+/, '')
  t = t.replace(/(?:病史|史)?\s*(?:\d+|数|[一二两三四五六七八九十]+)余?(?:年|月|周|天)余?$/, '')
  t = t.replace(/病史$/, '病').replace(/史$/, '').replace(/等$/, '')
  t = t.replace(/(?:于我科住院|入院|收治).*$/, '')
  return t.trim()
}

const VITALS = [['血压', /血压|\d+\/\d+\s*mmHg|BP|Bp/], ['脉搏', /脉搏|\bP\s*[:：]/], ['呼吸', /呼吸/], ['体温', /体温|T\s*[:：]?\s*3\d/], ['心率', /心率|HR/], ['氧饱和度', /氧饱和度|SpO2|SPO2/]]
const EXAM_CATS = [['心电图', /心电/], ['超声', /超声|彩超|B超|心超|心动图/], ['CT', /CT/], ['MR', /MRI|MR/], ['X线', /胸片|X线|DR|正侧位|平片/]]

/** “（2017.11.21本院）生化：尿素氮21.99mmol/L” → { item: 尿素氮, value: 21.99 }：项目是数值前最后一个分隔符之后的标签。 */
export function labParse(text) {
  const t = String(text).replace(/^\s*\d+[.、．]\s*/, '').replace(/^[（(][^）)]*[）)]/, '')
  const m = t.match(/(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const before = t.slice(0, m.index)
  const label = before.split(/[：:，,；;。]/).pop().replace(/示$|为$|\s+$/g, '').replace(/^(?:复查|查|示|提示|血清|血)(?=\S{2})/, '').trim()
  if (!label || /^[\d.\s]*$/.test(label)) return null
  return { item: label, value: m[1] }
}

/* ------------------------------------------------------------ concepts */

function conceptOf(m, frag, lex, vocab) {
  const t = m.text
  const pol = m.negative ? '阴性' : '阳性'
  const base = { polarity: pol }
  if (m.kind === '结构化') {
    switch (m.recordType) {
      case '检验': {
        const item = frag?.meta?.item ?? t
        const hit = lex.exact('检验结果', item)
        return { ...base, group: '检验结果', concept: hit ? hit.concept.name : item.trim(), alias: hit, value: frag?.meta?.value ?? null, unit: frag?.meta?.unit ?? null, sameValueOnly: hit?.concept.sameValueOnly }
      }
      case '诊断记录': {
        const name = cleanDiagnosis(frag?.meta?.name ?? t.split('｜')[0])
        const hit = lex.exact('诊断', name) ?? lex.exact('诊断', name.replace(/病$/, ''))
        return { ...base, group: '诊断', concept: hit ? hit.concept.name : name, alias: hit }
      }
      case '就诊登记': return { ...base, group: '就医经过', concept: /^住院/.test(t) ? '入院' : /^体检/.test(t) ? '体检' : '就诊' }
      case '门诊收费': return { ...base, group: '收费', concept: frag?.meta?.item ?? t }
      case '手术记录': {
        const hit = lex.find('手术操作', t)
        return { ...base, group: '手术操作', concept: hit ? hit.concept.name : t.split('｜')[0], alias: hit, once: hit?.concept.once, repeatable: hit?.concept.repeatable }
      }
      default: return { ...base, group: '其他', concept: null }
    }
  }
  const sd = m.subdivision; const it = m.item
  if (m.type === '事实') {
    if (it === '检验指标') {
      const p = labParse(t)
      if (p) {
        // 检验项目名只按别名全等归一：“血小板平均体积”不能归成“血小板计数”，“糖化血红蛋白”不是“血红蛋白”
        const hit = lex.exact('检验结果', p.item) ?? lex.exact('检验结果', p.item.replace(/^.*[：:]/, ''))
        return { ...base, group: '检验结果', concept: hit ? hit.concept.name : p.item, alias: hit, value: p.value, sameValueOnly: hit?.concept.sameValueOnly }
      }
      return { ...base, group: '其他', concept: null }
    }
    if (it === '体征与查体') {
      const v = VITALS.find(([, re]) => re.test(t))
      if (v && /\d/.test(t)) return { ...base, group: '生命体征', concept: v[0], value: (t.match(/\d+(?:\/\d+)?(?:\.\d+)?/) ?? [null])[0] }
      return { ...base, group: '查体发现', concept: normText(t) }
    }
    if (it === '影像／心电／超声') {
      const ctx = `${m.contextText ?? ''}${t}`
      const cat = EXAM_CATS.find(([, re]) => re.test(ctx))
      return { ...base, group: '检查', concept: cat ? cat[0] : '检查', report: m.recordType === '检查报告' }
    }
    if (it === '症状与病情') {
      const hit = lex.find('症状', t)
      if (hit) return { ...base, group: '症状', concept: hit.concept.name, alias: hit }
      return { ...base, group: '症状', concept: null, unnormalized: true }
    }
    if (it === '既往病史（否认）') {
      const name = cleanDiagnosis(t)
      const hit = lex.find('诊断', name) ?? lex.exact('诊断', name)
      return { ...base, group: '病史否认', concept: hit ? hit.concept.name : name, alias: hit, polarity: '阴性' }
    }
    if (sd === '背景') {
      const hit = lex.find('背景', t)
      if (hit?.concept.once) return { ...base, group: '背景', concept: hit.concept.name, once: true }
      return { ...base, group: '背景', concept: normText(t) }
    }
    if (sd === '就医经过') {
      const c = /急诊|留观|抢救/.test(t) ? '急诊留观' : /出院/.test(t) ? '出院' : /入院|收住|收治|住院/.test(t) ? '入院' : '就诊'
      return { ...base, group: '就医经过', concept: c }
    }
    return { ...base, group: '其他', concept: null }
  }
  if (m.type === '判断') {
    if (it === '检查结论') return { ...base, group: '检查结论', concept: normText(t) }
    if (sd === '状态判断') {
      const name = cleanDiagnosis(t)
      if (!name) return { ...base, group: '其他', concept: null }
      const hit = lex.exact('诊断', name) ?? lex.exact('诊断', name.replace(/病$/, '')) ?? (it === '既往诊断（转述）' ? lex.find('诊断', name) : null)
      return { ...base, group: '诊断', concept: hit ? hit.concept.name : name, alias: hit }
    }
    return { ...base, group: '其他', concept: null }
  }
  // 决策
  // 门诊处理意见里反复出现的宣教/医嘱模板：一份文书里的整段模板算一个事件（同类型同细分内）
  if (m.templated === '宣教/医嘱模板') return { ...base, group: '宣教模板', concept: null }
  if (it === '药物' || (sd === '治疗干预' && lex.find('用药', t))) {
    const hit = lex.find('用药', t)
    if (!hit) return { ...base, group: '其他', concept: null, unnormalized: true }
    const act = (m.action ?? '').replace('（同句沿用）', '')
    const point = act === '停止' || act === '调整' || act === '启动／执行' && m.temporality === '同期' && /^予|^给予|加用|改用|换用/.test(t)
    return { ...base, group: '用药', concept: hit.concept.name, alias: hit, drugPoint: point ? act : null, stop: act === '停止' }
  }
  if (it === '透析') {
    const hit = lex.find('透析', t)
    // 开始维持性透析：仅当原文为“开始…透析”或“于某日行血液透析”（“半天前行血液透析治疗时…”不算）
    if (hit?.concept.once || /于[^，。；]{1,16}行血液透析/.test(t)) {
      return { ...base, group: '透析', concept: '开始维持性透析', once: true }
    }
    if (hit && hit.concept.name === '干体重调整') return { ...base, group: '透析', concept: '干体重调整', point: true }
    return { ...base, group: '透析', concept: '维持性血液透析', state: true }
  }
  if (it === '手术与操作') {
    const hit = lex.find('手术操作', t)
    // “××术后”且无自带时间：是对既往手术的状态性转述，不是一次新手术
    if (hit && m.subclass === '既往手术（转述）' && !/^本句自带/.test(m.timeSource ?? '') && !hit.concept.once) {
      return { ...base, group: '手术操作', concept: hit.concept.name, alias: hit, postOp: true }
    }
    if (hit) return { ...base, group: '手术操作', concept: hit.concept.name, alias: hit, once: hit.concept.once, repeatable: hit.concept.repeatable }
    return { ...base, group: '手术操作', concept: normText(t), unnormalized: true }
  }
  if (it === '生活方式与宣教') return { ...base, group: '宣教模板', concept: null }
  if (sd === '诊疗流程' || sd === '患者方决定' || it === '非药物治疗') return { ...base, group: '诊疗流程', concept: normText(t) }
  return { ...base, group: '其他', concept: null }
}

/* ---------------------------------------------------------- union-find */

class UF {
  constructor(n) { this.p = Array.from({ length: n }, (_, i) => i); this.rule = new Array(n).fill(6) }
  find(x) { while (this.p[x] !== x) { this.p[x] = this.p[this.p[x]]; x = this.p[x] } return x }
  union(a, b, ruleIdx) {
    const ra = this.find(a); const rb = this.find(b)
    const r = Math.min(this.rule[ra], this.rule[rb], ruleIdx)
    if (ra !== rb) this.p[rb] = ra
    this.rule[ra] = r
  }
}

const groupBy = (idx, keyFn) => {
  const g = new Map()
  for (const i of idx) { const k = keyFn(i); if (k == null) continue; if (!g.has(k)) g.set(k, []); g.get(k).push(i) }
  return g
}

const ivOf = (m) => ({ a: m.occurFrom, b: m.occurTo })
const sameKind = (a, b) => a.type === b.type && a.subdivision === b.subdivision

/* ----------------------------------------------------------------- main */

export function mergeEvents({ mentions, fragments, encounters }, pack) {
  const lex = buildLexicon(pack.concepts)
  const P = pack.params
  const fragById = new Map(fragments.map((f) => [f.id, f]))
  const ms = mentions.map((m) => {
    const frag = fragById.get(m.fragmentId)
    const lineStart = frag ? Math.max(frag.text.lastIndexOf('\n', m.s - 1), frag.text.lastIndexOf('。', m.s - 1)) + 1 : m.s
    const view = { ...m, contextText: frag ? frag.text.slice(lineStart, m.s) : '' }
    return { m, c: conceptOf(view, frag, lex, pack.vocab), day: dayOf(m.occurFrom ?? m.occurTo ?? m.writtenAt) }
  })
  const n = ms.length
  const uf = new UF(n)
  const all = [...Array(n).keys()]
  const link = (i, j, r) => { if (sameKind(ms[i].m, ms[j].m)) uf.union(i, j, r) }
  /** 把一组提及按“类型＋细分”分开后各自串起来（只在同类型、同细分内归并）。 */
  const linkAll = (idx, r) => {
    for (const [, part] of groupBy(idx, (i) => `${ms[i].m.type}\u0000${ms[i].m.subdivision}`)) for (let k = 1; k < part.length; k++) uf.union(part[0], part[k], r)
  }
  const isStruct = (i) => ms[i].m.kind === '结构化'
  const G = (name) => all.filter((i) => ms[i].c.group === name)

  // 1 结构化对齐：文书提及 ↔ 结构化记录（同概念、同值、同日；检验 ±2 天）
  {
    const labs = G('检验结果')
    const structLabs = groupBy(labs.filter(isStruct), (i) => `${ms[i].c.concept}\u0000${Number(ms[i].c.value)}`)
    for (const i of labs.filter((x) => !isStruct(x))) {
      const cand = structLabs.get(`${ms[i].c.concept}\u0000${Number(ms[i].c.value)}`) ?? []
      const j = cand.find((k) => ms[i].day && ms[k].day && Math.abs(diffDays(ms[i].day, ms[k].day)) <= P.labDayTolerance)
      if (j != null) link(i, j, 0)
    }
    const visits = G('就医经过')
    const sv = groupBy(visits.filter(isStruct), (i) => `${ms[i].c.concept}\u0000${ms[i].day}`)
    for (const i of visits.filter((x) => !isStruct(x))) {
      const j = (sv.get(`${ms[i].c.concept}\u0000${ms[i].day}`) ?? [])[0]
      if (j != null) link(i, j, 0)
    }
    const surg = G('手术操作')
    for (const i of surg.filter((x) => !isStruct(x))) {
      const j = surg.find((k) => isStruct(k) && ms[k].c.concept === ms[i].c.concept && (ms[i].c.once || intersect(ivOf(ms[i].m), ivOf(ms[k].m))))
      if (j != null) link(i, j, 0)
    }
  }

  // 2 逐字复制：同一句出现在多份文书，且本句自带时间（或属诊断、用药这类状态）
  {
    const docs = all.filter((i) => !isStruct(i) && ms[i].c.group !== '其他' && ms[i].c.group !== '宣教模板' && ms[i].c.group !== '收费')
    // 自带时间：原文日期/年月，或相对时间指向一年以前（“10年前行子宫切除术”）。
    // “胸闷气急3天”入院”被抄进不同住院，各自指不同的发病，不算同一事件。
    const ownTime = (i) => {
      const m = ms[i].m
      if (!/^本句自带/.test(m.timeSource)) return false
      if (/原文日期|原文年月|原文月日/.test(m.timeSource)) return true
      const to = m.occurTo ?? m.occurFrom
      return Boolean(to) && diffDays(to, dayOf(m.writtenAt)) >= 365
    }
    const stateLike = (i) => ms[i].c.group === '诊断' || (ms[i].c.group === '用药' && !ms[i].c.drugPoint)
    for (const [, idx] of groupBy(docs, (i) => `${ms[i].c.group}\u0000${normText(ms[i].m.text)}`)) {
      if (idx.length < 2) continue
      const frags = new Set(idx.map((i) => ms[i].m.fragmentId))
      if (frags.size < 2) continue
      linkAll(idx.filter((i) => ownTime(i) || stateLike(i)), 1)
    }
  }

  // 3 一次性概念：不看时间直接合并
  for (const [, idx] of groupBy(all.filter((i) => ms[i].c.once && ms[i].c.polarity === '阳性'), (i) => `${ms[i].c.group}\u0000${ms[i].c.concept}`)) {
    linkAll(idx, 2)
  }

  // 4 同概念＋时间相容＋同就诊
  {
    // 检验（文书之间）：同概念同值，±2 天
    for (const [, idx] of groupBy(G('检验结果').filter((i) => !isStruct(i)), (i) => `${ms[i].c.concept}\u0000${Number(ms[i].c.value)}`)) {
      idx.sort((a, b) => String(ms[a].day).localeCompare(String(ms[b].day)))
      for (let k = 1; k < idx.length; k++) {
        if (ms[idx[k]].day && ms[idx[k - 1]].day && diffDays(ms[idx[k - 1]].day, ms[idx[k]].day) <= P.labDayTolerance) link(idx[k - 1], idx[k], 3)
      }
    }
    const byKey = (name, keyFn) => {
      for (const [, idx] of groupBy(G(name), keyFn)) linkAll(idx, 3)
    }
    const enc = (i) => ms[i].m.encounterId ?? `D:${ms[i].day}`
    byKey('生命体征', (i) => (isStruct(i) ? null : `${ms[i].c.concept}\u0000${ms[i].c.value}\u0000${enc(i)}\u0000${ms[i].day}`))
    byKey('查体发现', (i) => `${ms[i].c.concept}\u0000${enc(i)}\u0000${ms[i].day}\u0000${ms[i].c.polarity}`)
    byKey('症状', (i) => (ms[i].c.concept ? `${ms[i].c.concept}\u0000${ms[i].c.polarity}\u0000${enc(i)}` : null))
    byKey('就医经过', (i) => (isStruct(i) ? null : `${ms[i].c.concept}\u0000${ms[i].day}`))
    byKey('诊疗流程', (i) => `${ms[i].c.concept}\u0000${enc(i)}\u0000${ms[i].day}`)
    byKey('宣教模板', (i) => ms[i].m.fragmentId)
    byKey('透析', (i) => (ms[i].c.point ? `${ms[i].c.concept}\u0000${enc(i)}\u0000${ms[i].day}` : null))
    byKey('用药', (i) => (ms[i].c.drugPoint ? `${ms[i].c.concept}\u0000${ms[i].c.drugPoint}\u0000${enc(i)}` : null))
    // 手术操作：可重复的按就诊；其余区间相交
    const surg = G('手术操作').filter((i) => !ms[i].c.once && !ms[i].c.unnormalized && !ms[i].c.postOp)
    for (const [, idx] of groupBy(surg, (i) => ms[i].c.concept)) {
      for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
        const i = idx[a]; const j = idx[b]
        if (ms[i].c.repeatable ? enc(i) === enc(j) : intersect(ivOf(ms[i].m), ivOf(ms[j].m))) link(i, j, 3)
      }
    }
    // 检查：文书转述的影像所见并到报告上（同类别、±2 天、原文包含）
    const exams = G('检查')
    const reports = exams.filter((i) => ms[i].c.report)
    for (const i of exams.filter((x) => !ms[x].c.report)) {
      const ti = normText(ms[i].m.text)
      if (ti.length < 4) continue
      const j = reports.find((k) => ms[k].c.concept === ms[i].c.concept && ms[k].day && ms[i].day
        && Math.abs(diffDays(ms[i].day, ms[k].day)) <= P.labDayTolerance
        && (normText(ms[k].m.text).includes(ti) || ti.includes(normText(ms[k].m.text))))
      if (j != null) link(i, j, 3)
    }
  }

  // 5 同句修饰并入：症状后紧跟的、本身不含症状词的描述性分句并入同句的阳性症状
  {
    const sym = G('症状')
    const bySent = groupBy(sym, (i) => `${ms[i].m.fragmentId}\u0000${ms[i].m.sentence}`)
    for (const [, idx] of bySent) {
      idx.sort((a, b) => ms[a].m.s - ms[b].m.s)
      let anchor = null
      for (const i of idx) {
        const c = ms[i].c
        if (c.concept && c.polarity === '阳性') { anchor = i; continue }
        if (!c.concept && anchor != null && c.polarity === '阳性' && !/查|示[:：]/.test(ms[i].m.text)) link(anchor, i, 4)
      }
    }
  }

  // 6 状态连续：诊断、背景、病史否认、维持性透析按概念＋极性；用药在用按 180 天与“停止”断段
  {
    const state = (name, keyFn) => { for (const [, idx] of groupBy(G(name), keyFn)) linkAll(idx, 5) }
    state('诊断', (i) => (ms[i].c.concept ? `${ms[i].c.concept}\u0000${ms[i].c.polarity}` : null))
    state('背景', (i) => (ms[i].c.once ? null : ms[i].c.concept))
    state('病史否认', (i) => ms[i].c.concept)
    state('透析', (i) => (ms[i].c.state ? ms[i].c.concept : null))
    state('手术操作', (i) => (ms[i].c.postOp ? ms[i].c.concept : null))
    // 用药片段：在用声明的时间取写成时的叙述锚点（v1.3）
    const drugs = G('用药')
    const stops = groupBy(drugs.filter((i) => ms[i].c.stop), (i) => ms[i].c.concept)
    for (const [drug, idx] of groupBy(drugs.filter((i) => !ms[i].c.drugPoint), (i) => ms[i].c.concept)) {
      const t = (i) => dayOf(ms[i].m.anchor ?? ms[i].m.writtenAt)
      idx.sort((a, b) => t(a).localeCompare(t(b)))
      const stopDays = (stops.get(drug) ?? []).map((i) => dayOf(ms[i].m.occurFrom ?? ms[i].m.writtenAt)).filter(Boolean)
      for (let k = 1; k < idx.length; k++) {
        const a = t(idx[k - 1]); const b = t(idx[k])
        const stopped = stopDays.some((d) => d >= a && d <= b)
        if (!stopped && diffDays(a, b) <= P.drugGapDays) link(idx[k - 1], idx[k], 5)
      }
    }
  }

  /* ------------------------------------------------------- build events */
  const groups = groupBy(all, (i) => uf.find(i))
  const events = []
  const m2e = new Map()
  const problems = []
  for (const [root, idx] of groups) {
    idx.sort((a, b) => (ms[a].m.writtenAt < ms[b].m.writtenAt ? -1 : ms[a].m.writtenAt > ms[b].m.writtenAt ? 1 : 0))
    const mem = idx.map((i) => ms[i])
    const first = mem[0]
    const c = first.c
    const ids = mem.map((x) => x.m.id)
    // 共识时间只用精确来源（结构化字段、本句自带、行首日期）；继承来的时间是近似，全是近似时才用全部
    // 检验、检查只用最精确的来源；其他事件排除前句继承、栏目默认、时间副词这类近似时间
    const strict = ['检验结果', '检查'].includes(c.group)
    const precise = mem.filter((x) => (strict ? /^结构化|^本句自带|行首日期/ : /^结构化|^本句自带|行首日期|同句继承/).test(x.m.timeSource ?? ''))
    const ivs = (precise.length ? precise : mem).map((x) => ivOf(x.m)).filter((v) => v.a || v.b)
    let consensus = null
    if (ivs.length) {
      let cur = ivs[0]
      for (const v of ivs.slice(1)) { cur = cur && intersect(cur, v); if (!cur) break }
      if (!cur && ['检验结果', '检查'].includes(c.group)) {
        // 检验、检查：±2 天内视为一致
        const u = unionIv(ivs)
        if (u.a && u.b && diffDays(u.a, u.b) <= P.labDayTolerance) cur = u
      }
      consensus = cur ? { consistent: true, a: cur.a, b: cur.b } : { consistent: false, ...unionIv(ivs) }
    }
    const isDrugSegment = c.group === '用药' && !c.drugPoint
    const form = c.once ? '一次性'
      : ['诊断', '背景', '病史否认'].includes(c.group) || (c.group === '透析' && c.state) || c.postOp ? '状态'
        : c.group === '症状' || isDrugSegment ? '片段' : '点'
    const anchors = isDrugSegment ? mem.map((x) => dayOf(x.m.anchor ?? x.m.writtenAt)).sort() : null
    const encs = new Set(mem.map((x) => x.m.encounterId))
    const fragsN = new Set(mem.map((x) => x.m.fragmentId)).size
    const ruleIdx = idx.length === 1 ? 6 : uf.rule[root]
    const aliases = [...new Map(mem.filter((x) => x.c.alias && x.c.alias.alias !== x.c.concept).map((x) => [x.c.alias.alias, { alias: x.c.alias.alias, concept: x.c.alias.concept.name, nature: x.c.alias.concept.nature ?? '' }])).values()]
    const ev = {
      id: eventId(ids),
      form,
      type: first.m.type,
      subdivision: first.m.subdivision,
      item: first.m.item,
      conceptGroup: c.group,
      concept: c.concept ?? null,
      normalized: Boolean(c.concept) && !c.unnormalized,
      polarity: c.polarity,
      value: c.value ?? null,
      consensus,
      segment: anchors ? { from: anchors[0], to: anchors[anchors.length - 1] } : null,
      drugAction: c.drugPoint ?? null,
      encounterId: encs.size === 1 ? [...encs][0] : null,
      mentions: ids,
      mentionCount: ids.length,
      docCount: fragsN,
      firstWritten: first.m.writtenAt,
      lastWritten: mem[mem.length - 1].m.writtenAt,
      firstMention: first.m.id,
      mergeRule: RULES[ruleIdx],
      aliases,
    }
    // 验收门③：事件内类型一致；两条结构化记录不合成一个点事件（除非完全重复）。
    // 状态（诊断表里反复出现的同一诊断）按设计就是合成一个事件。
    if (mem.some((x) => x.m.type !== ev.type)) problems.push({ gate: '③类型不一致', eventId: ev.id })
    const structTexts = mem.filter((x) => x.m.kind === '结构化').map((x) => x.m.text)
    if (form !== '状态' && structTexts.length > 1 && new Set(structTexts).size > 1) problems.push({ gate: '③结构化合并', eventId: ev.id })
    events.push(ev)
    for (const id of ids) m2e.set(id, { eventId: ev.id, mergeRule: ev.mergeRule })
  }
  if (m2e.size !== mentions.length) problems.push({ gate: '③提及未全归属', count: mentions.length - m2e.size })
  events.sort((a, b) => (a.firstWritten < b.firstWritten ? -1 : a.firstWritten > b.firstWritten ? 1 : a.id < b.id ? -1 : 1))
  return { events, m2e, clues: buildClues(events, pack), problems }
}

/* ---------------------------------------------------------------- clues */

function buildClues(events, pack) {
  const clues = []
  for (const e of events) {
    if ((e.form === '一次性' || e.form === '点') && e.mentionCount > 1 && e.consensus && !e.consensus.consistent) {
      clues.push({ kind: '时间不一致', events: [e.id], concept: e.concept, note: `并集 ${e.consensus.a ?? '?'}～${e.consensus.b ?? '?'}` })
    }
  }
  // 互斥用药
  const segs = events.filter((e) => e.conceptGroup === '用药' && e.segment)
  const starts = events.filter((e) => e.conceptGroup === '用药' && e.drugAction === '启动／执行')
  const stopsOf = (drug) => events.filter((e) => e.conceptGroup === '用药' && e.concept === drug && e.drugAction === '停止')
  for (const g of pack.exclusive ?? []) {
    const S = segs.filter((e) => g.drugs.includes(e.concept))
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const a = S[i]; const b = S[j]
      if (a.concept === b.concept) continue
      const ov = intersect({ a: a.segment.from, b: a.segment.to }, { a: b.segment.from, b: b.segment.to })
      if (ov) clues.push({ kind: '互斥用药并存', group: g.name, events: [a.id, b.id], concept: `${a.concept}×${b.concept}`, note: `重叠 ${ov.a}～${ov.b}` })
    }
    // B 启动后无 B 停用记载，之后又出现 A 在用
    for (const bStart of starts.filter((e) => g.drugs.includes(e.concept))) {
      const bDay = dayOf(bStart.firstWritten)
      if (stopsOf(bStart.concept).some((s) => dayOf(s.firstWritten) >= bDay)) continue
      for (const aSeg of S.filter((e) => e.concept !== bStart.concept && e.segment.to > bDay)) {
        clues.push({ kind: '互斥用药先后出现（缺停用记载）', group: g.name, events: [bStart.id, aSeg.id], concept: `${bStart.concept}→${aSeg.concept}` })
      }
    }
  }
  // 候选同义
  const dx = events.filter((e) => e.conceptGroup === '诊断' && e.polarity === '阳性')
  for (const cs of pack.candidateSynonyms ?? []) {
    const hit = dx.filter((e) => cs.members.includes(e.concept))
    if (new Set(hit.map((e) => e.concept)).size >= 2) {
      clues.push({ kind: '候选同义', group: cs.name, events: hit.map((e) => e.id), concept: [...new Set(hit.map((e) => e.concept))].join('／'),
        note: hit.map((e) => `${e.concept} ${dayOf(e.firstWritten)}～${dayOf(e.lastWritten)}`).join('；') })
    }
  }
  // 阴阳并存：同一概念既有阳性诊断又有否认
  const negs = events.filter((e) => e.conceptGroup === '病史否认')
  for (const ng of negs) {
    const pos = dx.filter((e) => e.concept && ng.concept && (e.concept === ng.concept))
    if (pos.length) clues.push({ kind: '阴阳并存', events: [ng.id, ...pos.map((e) => e.id)], concept: ng.concept })
  }
  return clues
}
