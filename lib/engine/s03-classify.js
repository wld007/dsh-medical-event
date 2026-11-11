/**
 * S03 类型切分（工序2 v2.2）：给每条提及标 类型／子类／细分／细项 与属性，
 * 每条写明命中的规则。
 */
import { dayOf, diffDays } from './time.js'

const HISTORY_SECTIONS = new Set(['既往史', '个人史', '过敏史', '家族史', '月经史', '婚育史'])

function resolveRe(v, vocab) {
  if (v == null) return null
  if (v instanceof RegExp) return v
  if (typeof v === 'string' && v.startsWith('@')) {
    const re = vocab[v.slice(1)]
    if (!re) throw new Error(`规则引用了不存在的词表 ${v}`)
    return re
  }
  throw new Error(`无法解析的条件 ${v}`)
}

/** Compile `when` into a predicate over a mention view. */
export function compileWhen(when, vocab) {
  const tests = []
  for (const k of ['recordType', 'section', 'kind']) {
    if (when[k]) { const set = new Set(when[k]); tests.push((m) => set.has(m[k])) }
  }
  if (when.text) { const re = resolveRe(when.text, vocab); tests.push((m) => re.test(m.text)) }
  if (when.notText) { const re = resolveRe(when.notText, vocab); tests.push((m) => !re.test(m.text)) }
  if (when.context) { const re = resolveRe(when.context, vocab); tests.push((m) => re.test(m.context ?? '')) }
  if (when.negative != null) tests.push((m) => m.negative === when.negative)
  if (when.any) { const subs = when.any.map((w) => compileWhen(w, vocab)); tests.push((m) => subs.some((f) => f(m))) }
  if (when.all) { const subs = when.all.map((w) => compileWhen(w, vocab)); tests.push((m) => subs.every((f) => f(m))) }
  return (m) => tests.every((t) => t(m))
}

const has = (vocab, name, text) => Boolean(vocab[name]?.test(text))

function isNegative(m, vocab) {
  if (m.kind === '结构化') return false
  if (m.scope === '否认' || m.scope === '无') return true
  const stripped = vocab.FALSE_NEG ? m.text.replace(new RegExp(vocab.FALSE_NEG.source, 'g'), '') : m.text
  return Boolean(stripped.trim()) && vocab.NEG.test(stripped)
}

/** 从子类到细分／细项（工序2“从子类到细分”表）。 */
export function subdivide(type, subclass, m, vocab) {
  const t = m.text
  const H = (n) => has(vocab, n, t)
  if (type === '决策') {
    switch (subclass) {
      case '患者选择': return ['患者方决定', /拒绝|不同意/.test(t) ? '拒绝' : '自行']
      case '检查申请': case '检查（已执行）': return ['诊疗流程', '检查检验']
      case '收治入院': return ['诊疗流程', '收治／留观／出院']
      case '执行记录': {
        const cat = m.meta?.category ?? ''
        if (H('FEE_LAB')) return ['诊疗流程', '检查检验']
        if (cat === '治疗费') return ['治疗干预', '手术与操作']
        if (cat === '中成药' || /药/.test(cat)) return ['治疗干预', '药物']
        if (cat === '检查费') return ['诊疗流程', '检查检验']
        if (cat === '床位费' || cat === '护理费') return ['诊疗流程', '收治／留观／出院']
        return ['治疗干预', '手术与操作']
      }
      case '计划与医嘱': {
        if (/告病危|病危/.test(t)) return ['诊疗流程', '病情告知']
        if (H('FLOW_ADMIT')) return ['诊疗流程', '收治／会诊／转诊']
        if (H('FLOW_FOLLOW')) return ['诊疗流程', '复查与随访']
        if (H('PROC_WORDS')) return ['治疗干预', '手术与操作']
        if (H('DIALYSIS')) return ['治疗干预', '透析']
        if (H('DRUG_PLAN')) return ['治疗干预', '药物']
        return ['治疗干预', '生活方式与宣教']
      }
      default: {
        if (H('DIALYSIS')) return ['治疗干预', '透析']
        if (H('PROC') || /术|拆线|换药/.test(t)) return ['治疗干预', '手术与操作']
        if (H('NON_DRUG')) return ['治疗干预', '非药物治疗']
        return ['治疗干预', '药物']
      }
    }
  }
  if (type === '判断') {
    if (H('REASONING')) {
      const item = /评分|风险/.test(t) ? '风险评估' : /不能排除|不除外|可能大/.test(t) ? '鉴别' : /病危|预后/.test(t) ? '预后／病情告知' : '病因归因'
      return ['推理判断', item]
    }
    if (subclass === '检查结论' || /提示/.test(t)) return ['状态判断', '检查结论']
    if (subclass === '既往诊断（转述）') return ['状态判断', '既往诊断（转述）']
    if (/病情|心功能|NYHA|控制/.test(t)) return ['状态判断', '病情评估']
    return ['状态判断', '诊断']
  }
  // 事实
  if (subclass === '表单占位') return ['表单占位', '模板空项']
  if (H('ADH') && !H('LAB')) return ['行为与依从', /服|药/.test(t) ? '服药依从' : /水|饮食/.test(t) ? '饮食与水分' : '就医与治疗依从']
  switch (subclass) {
    case '检测结果': case '检查所见':
      return ['患者状态', H('IMAGING') || has(vocab, 'IMAGING', m.context ?? '') || m.recordType === '检查报告' ? '影像／心电／超声' : '检验指标']
    case '查体所见': case '体征': return ['患者状态', '体征与查体']
    case '症状与经过': case '症状阴性': case '其他（待复核）':
      return H('CARE_EVENT') && !H('CONDITION') ? ['就医经过', '就诊／入院／出院'] : ['患者状态', '症状与病情']
    case '主诉与就诊目的':
      return H('VISIT_PURPOSE') ? ['就医经过', '就诊目的'] : ['患者状态', '症状与病情']
    case '就医经过':
      return ['就医经过', H('OUTSIDE') ? '外院就诊' : /急诊|留观/.test(t) ? '急诊／留观' : '就诊／入院／出院']
    case '病史否认':
      return H('BACKGROUND_NEG') ? ['背景', '过敏与接触史'] : ['患者状态', '既往病史（否认）']
    case '个人与家族史':
      if (m.section === '家族史') return ['背景', '家族史']
      if (m.section === '月经史' || m.section === '婚育史') return ['背景', '月经与婚育']
      if (m.section === '既往史' && !H('HIST_OTHER')) return ['患者状态', '既往病史']
      return ['背景', H('BACKGROUND_NEG') ? '过敏与接触史' : '个人史']
    default: return ['患者状态', '症状与病情']
  }
}

function originOf(m, subclass, vocab) {
  if (m.kind === '结构化') return '结构化记录'
  if (m.recordType === '检查报告') return '检测报告'
  if (subclass === '检测结果') return '检测结果（文书转述）'
  if (has(vocab, 'OUTSIDE', m.text)) return '外院转述'
  if (subclass === '查体所见' || subclass === '体征') return '医生查体'
  if (HISTORY_SECTIONS.has(m.section)) return '病史采集'
  if (m.section === '主诉' || m.section === '现病史') return '患者陈述'
  return '医生记录'
}

function temporalityOf(m, encById, params) {
  if (!m.occurTo && !m.occurFrom) return '无时间'
  const written = dayOf(m.writtenAt)
  const enc = m.encounterId ? encById.get(m.encounterId) : null
  const start = enc?.kind === '住院' && enc.start ? dayOf(enc.start) : written
  const to = m.occurTo ?? m.occurFrom
  if (to < start) return '回顾转述'
  if (diffDays(to, written) > params.lateRecordDays) return '同次补记'
  return '同期'
}

function actionOf(m, vocab) {
  const t = m.text
  if (has(vocab, 'ACT_STOP', t)) return '停止'
  if (has(vocab, 'ACT_ADJUST', t)) return '调整'
  if (m.future) return '计划'
  if (has(vocab, 'ACT_KEEP', t)) return '维持'
  if (has(vocab, 'ACT_START', t)) return '启动／执行'
  return ''
}

function certaintyOf(t, vocab) {
  if (has(vocab, 'CERT_LOW', t)) return '不能排除·待定'
  if (has(vocab, 'CERT_MID', t)) return '考虑·拟诊'
  return '确定'
}

const normKey = (t) => t.replace(/\s+/g, '').replace(/(化名|医生|医院|地址)-[0-9A-F]{6}/g, '＊')

/** 跨文书统计：同类文书中出现的份数（模板化、逐字复用）。 */
function reuseStats(mentions) {
  const docs = new Map() // recordType\u0000text → [{ fragmentId, writtenAt }]
  for (const m of mentions) {
    if (m.kind !== '文书') continue
    const k = `${m.recordType}\u0000${normKey(m.text)}`
    if (!docs.has(k)) docs.set(k, new Map())
    const fm = docs.get(k)
    if (!fm.has(m.fragmentId) || m.writtenAt < fm.get(m.fragmentId)) fm.set(m.fragmentId, m.writtenAt)
  }
  const out = new Map()
  for (const [k, fm] of docs) {
    const first = [...fm.entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1))[0][0]
    out.set(k, { count: fm.size, first })
  }
  return out
}

export function classifyMentions({ mentions, encounters, fragments }, pack) {
  const vocab = pack.vocab
  const params = pack.params
  const rules = pack.classify.map((r) => ({ ...r, test: compileWhen(r.when ?? {}, vocab) }))
  const encById = new Map(encounters.map((e) => [e.id, e]))
  const fragById = new Map(fragments.map((f) => [f.id, f]))
  const reuse = reuseStats(mentions)
  const out = []
  const hits = {}
  let prev = null
  for (const m0 of mentions) {
    const frag = fragById.get(m0.fragmentId)
    const meta = frag?.meta
    // 语境：本条之前、同一句里的文字（“入院查体：…，律绝对不齐”）
    const lineStart = frag ? Math.max(frag.text.lastIndexOf('\n', m0.s - 1), frag.text.lastIndexOf('。', m0.s - 1)) + 1 : m0.s
    const view = { ...m0, meta, context: frag ? frag.text.slice(lineStart, m0.s) : '' }
    view.negative = isNegative(view, vocab)
    const rule = rules.find((r) => r.test(view))
    hits[rule.id] = (hits[rule.id] ?? 0) + 1
    const { type, subclass } = rule
    const [subdivision, item] = subdivide(type, subclass, view, vocab)

    // 模板化
    let templated = ''
    if (subclass === '表单占位') templated = '表单占位'
    else if (m0.recordType === '入院记录' && m0.section === '体格检查') templated = '查体模板'
    else if (m0.kind === '文书') {
      const st = reuse.get(`${m0.recordType}\u0000${normKey(m0.text)}`)
      if (st) {
        if (view.negative && st.count >= params.templateNegationDocs) templated = '模板化否认'
        else if (m0.section === '处理意见' && st.count >= params.templateOrderDocs) templated = '宣教/医嘱模板'
        else if (st.count >= params.verbatimReuseDocs && st.first !== m0.fragmentId) templated = '逐字复用'
      }
    }

    const future = type === '决策' && (has(vocab, 'PLAN', m0.text) || subclass === '计划与医嘱' || subclass === '检查申请')
    const temporality = temporalityOf(m0, encById, params)
    let action = ''
    let execStatus = ''
    if (type === '决策') {
      action = actionOf({ ...view, future }, vocab)
      // 同句沿用：不传“停止”（v2.2）和“调整”（v2.1）
      if (!action && prev && prev.fragmentId === m0.fragmentId && prev.sentence === m0.sentence && prev.action
        && !['停止', '调整'].includes(prev.action.replace('（同句沿用）', ''))) {
        action = `${prev.action.replace('（同句沿用）', '')}（同句沿用）`
      }
      execStatus = future ? '计划中' : temporality === '回顾转述' ? '转述' : /维持/.test(action) ? '在用' : '已执行·当次'
    }
    let alsoContains = ''
    if (type === '决策' && /拟[“"]|考虑|诊断/.test(m0.text)) alsoContains = '判断'
    else if (type === '判断' && (has(vocab, 'TREAT', m0.text) && /^予|^给予|治疗/.test(m0.text))) alsoContains = '决策'

    const adh = vocab.ADH ? m0.text.match(vocab.ADH) : null
    const m = {
      ...m0,
      type, subclass, subdivision, item,
      origin: originOf(view, subclass, vocab),
      negative: view.negative,
      templated,
      temporality,
      future,
      alsoContains,
      action,
      execStatus,
      certainty: type === '判断' ? certaintyOf(m0.text, vocab) : '',
      adherence: adh ? adh[0] : '',
      rules: { ...m0.rules, classify: rule.id },
      fallback: Boolean(rule.fallback),
    }
    out.push(m)
    prev = m
  }
  const fallbackCount = out.filter((m) => m.fallback).length
  const docCount = out.filter((m) => m.kind === '文书').length
  return {
    mentions: out,
    hits,
    gate: { fallback: fallbackCount, documentMentions: docCount, rate: docCount ? fallbackCount / docCount : 0, threshold: params.fallbackAlarm },
  }
}
