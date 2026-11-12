/**
 * 类型体系（工序2：三类 → 十个细分 → 细项）。与病种无关，模型只能从这里选。
 * 子类（subclass）是下游 S04/S05 用的细一级口径，由代码从模型的判断推出。
 */
export const TAXONOMY = {
  事实: {
    患者状态: ['检验指标', '症状与病情', '体征与查体', '影像／心电／超声', '既往病史（否认）', '既往病史'],
    就医经过: ['就诊／入院／出院', '就诊目的', '外院就诊', '急诊／留观'],
    背景: ['月经与婚育', '家族史', '过敏与接触史', '个人史'],
    行为与依从: ['就医与治疗依从', '服药依从', '饮食与水分'],
    表单占位: ['模板空项'],
  },
  判断: {
    状态判断: ['诊断', '既往诊断（转述）', '检查结论', '病情评估'],
    推理判断: ['风险评估', '鉴别', '预后／病情告知', '病因归因'],
  },
  决策: {
    治疗干预: ['药物', '透析', '手术与操作', '非药物治疗', '生活方式与宣教'],
    诊疗流程: ['检查检验', '复查与随访', '收治／留观／出院', '收治／会诊／转诊', '病情告知'],
    患者方决定: ['拒绝', '自行'],
  },
}

export const ACTIONS = ['启动', '维持', '调整', '停止', '计划']

/** 每个细项一个代码（细项名在整张表里唯一），模型只选代码，类型与细分由代码推出。 */
export const CODES = (() => {
  const out = []
  const prefix = { 事实: 'F', 判断: 'J', 决策: 'D' }
  for (const [t, sds] of Object.entries(TAXONOMY)) {
    let n = 0
    for (const [sd, its] of Object.entries(sds)) for (const it of its) out.push({ code: `${prefix[t]}${String(++n).padStart(2, '0')}`, t, sd, it })
  }
  return out
})()

export function taxonomyText() {
  const lines = []
  for (const t of Object.keys(TAXONOMY)) {
    for (const sd of Object.keys(TAXONOMY[t])) lines.push(`${t}·${sd}：${CODES.filter((c) => c.t === t && c.sd === sd).map((c) => `${c.code} ${c.it}`).join('，')}`)
  }
  return lines.join('\n')
}

const squash = (x) => String(x ?? '').replace(/[\s/／()（）]/g, '').replace(/转述$/, '')

/** 模型给的分类 → { t, sd, it, code }；接受代码、细项名（容忍斜杠、括号差异），或在 t/sd/it 任一字段里给出细项名。 */
export function parseCategory(...fields) {
  for (const f of fields) {
    if (!f) continue
    const v = String(f).trim()
    const byCode = CODES.find((c) => v.toUpperCase().startsWith(c.code))
    if (byCode) return byCode
    const k = squash(v)
    const exact = CODES.find((c) => squash(c.it) === k)
    if (exact) return exact
  }
  return null
}

/** 兼容旧接口 */
export function checkType(t, sd, it) {
  const c = parseCategory(it, sd, t)
  return c ? { t: c.t, sd: c.sd, it: c.it } : null
}

const VITAL = /\d+\s*(?:次\/分|mmHg|℃|bpm|%)|^(?:T|P|R|BP)\s*[:：]?\s*\d/i

/** 从模型判断推出下游用的子类。 */
export function deriveSubclass({ t, sd, it, neg, past, act, fut }, { text = '', recordType = '', section = '' } = {}) {
  if (t === '事实') {
    switch (it) {
      case '检验指标': return '检测结果'
      case '影像／心电／超声': return recordType === '检查报告' ? '检查所见' : '检测结果'
      case '体征与查体': return VITAL.test(text) ? '体征' : '查体所见'
      case '症状与病情': return neg ? '症状阴性' : section === '主诉' ? '主诉与就诊目的' : '症状与经过'
      case '既往病史（否认）': return '病史否认'
      case '既往病史': return '个人与家族史'
      case '就诊目的': return '主诉与就诊目的'
      case '模板空项': return '表单占位'
      default:
        if (sd === '就医经过') return '就医经过'
        if (sd === '背景') return '个人与家族史'
        return '症状与经过'
    }
  }
  if (t === '判断') {
    if (it === '诊断') return '诊断'
    if (it === '既往诊断（转述）') return '既往诊断（转述）'
    if (it === '检查结论') return '检查结论'
    return '诊断与评估'
  }
  // 决策
  if (sd === '患者方决定') return '患者选择'
  if (sd === '诊疗流程') {
    if (it === '检查检验') return recordType === '检查报告' ? '检查（已执行）' : '检查申请'
    if (it === '收治／留观／出院') return '收治入院'
    return '计划与医嘱'
  }
  if (it === '手术与操作') return past ? '既往手术（转述）' : '手术操作'
  if (it === '生活方式与宣教') return '计划与医嘱'
  if (act === '停止' || act === '调整') return '方案调整'
  if (fut || act === '计划') return '计划与医嘱'
  return '治疗用药'
}
