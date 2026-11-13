/**
 * 标准记录类别与栏目：格式识别层（S00）与引擎之间的契约。
 *
 * 任何导出格式的表，都要对到这里的一个记录类别（recordType）上：
 *   - 结构化类别：给出字段角色（roles），引擎据此拼出一行文字并带上元数据；
 *   - 文书类别：给出“字段 → 标准栏目”，引擎按栏目切分、按栏目的时间策略挂发生时间。
 * 规则层（rules/general）里的类型规则按这里的类别名和栏目名写；新增类别时两边一起改。
 *
 * 只放数据，不放函数（与规则包同一约定）。
 */

/** 时间策略（与 S02 一致）：见 rules/source/zj-regional 的说明。 */
export const TIME_STRATEGIES = ['narrative', 'outpatient', 'selfOnly', 'written', 'occur', 'admitDay']

/**
 * 栏目：name 标准栏目名；time 时间策略；label 无自带时间时的说明；
 * 其余开关（template、lines、cells、clause、duration、lineInherit）同 S02。
 */
const S = (name, time, extra = {}) => ({ name, time, ...extra })

const HISTORY = [
  S('既往史', 'selfOnly'), S('个人史', 'selfOnly'), S('过敏史', 'selfOnly'),
  S('月经史', 'selfOnly'), S('婚育史', 'selfOnly'), S('家族史', 'selfOnly'),
]

/**
 * 文书类别。aliases：常见的栏目别名（字段中文名、文书里的标题），规则草稿与页面用来对名。
 */
export const DOCUMENT_TYPES = {
  入院记录: {
    desc: '入院记录、24 小时内入出院记录、入院病历',
    sections: [
      S('主诉', 'narrative', { duration: true }), S('现病史', 'narrative'), ...HISTORY,
      S('体格检查', 'written', { label: '查体在写成当时', template: true }), S('专科情况', 'written', { label: '查体在写成当时' }),
      S('辅助检查', 'selfOnly', { lineInherit: true }), S('初步诊断', 'written', { label: '诊断在写成当时', lines: true }),
      S('诊疗计划', 'written', { label: '计划在写成当时' }),
    ],
  },
  门诊病历: {
    desc: '门（急）诊病历、门诊记录、急诊留观记录',
    sections: [
      S('主诉', 'outpatient', { duration: true }), S('现病史', 'outpatient'), ...HISTORY,
      S('体格检查', 'written', { label: '查体在就诊当时' }), S('辅助检查', 'selfOnly', { lineInherit: true }),
      S('初步诊断', 'written', { label: '诊断在就诊当时', lines: true }), S('处理意见', 'written', { label: '处理在就诊当时' }),
    ],
  },
  出院记录: {
    desc: '出院记录、出院小结、死亡记录',
    sections: [
      S('入院情况', 'admitDay', { label: '入院时', lineInherit: true }), S('入院诊断', 'admitDay', { label: '入院时', lines: true }),
      S('诊疗经过', 'narrative'), S('出院情况', 'written', { label: '出院时（写成当时）', lineInherit: true }),
      S('出院诊断', 'written', { label: '诊断在出院时', lines: true }), S('出院医嘱', 'written', { label: '医嘱在出院时' }),
    ],
  },
  检查报告: {
    desc: '影像、超声、心电、内镜、病理等检查报告',
    sections: [
      S('检查项目', 'occur', { label: '检查时间' }), S('所见', 'occur', { label: '检查时间', cells: true, clause: 'semicolon' }),
      S('结论', 'occur', { label: '检查时间' }),
    ],
  },
  病程记录: {
    desc: '首次病程记录、日常病程、上级医师查房、交接班、阶段小结、术前小结、术后首次病程、抢救记录',
    sections: [
      S('病例特点', 'narrative'), S('病情记录', 'narrative'), S('查房意见', 'written', { label: '查房当时' }),
      S('诊断依据', 'written', { label: '写成当时' }), S('鉴别诊断', 'written', { label: '写成当时' }),
      S('初步诊断', 'written', { label: '诊断在写成当时', lines: true }), S('诊疗计划', 'written', { label: '计划在写成当时' }),
    ],
  },
  会诊记录: {
    desc: '会诊申请与会诊意见',
    sections: [S('病情摘要', 'narrative'), S('会诊目的', 'written', { label: '申请当时' }), S('会诊意见', 'written', { label: '会诊当时' })],
  },
  手术麻醉记录: {
    desc: '手术记录（叙述）、麻醉记录、麻醉术前／术后访视',
    sections: [
      S('术前诊断', 'written', { label: '术前', lines: true }), S('术后诊断', 'written', { label: '术后', lines: true }),
      S('手术名称', 'occur', { label: '手术时间' }), S('麻醉方式', 'occur', { label: '手术时间' }),
      S('手术经过', 'occur', { label: '手术时间' }), S('术后情况', 'written', { label: '写成当时' }),
    ],
  },
  护理记录: {
    desc: '一般护理记录、护理评估、入院评估、出院评估与指导',
    sections: [S('护理观察', 'written', { label: '护理记录当时' }), S('护理措施', 'written', { label: '护理记录当时' }), S('评估', 'written', { label: '评估当时' }), S('健康指导', 'written', { label: '写成当时' })],
  },
  转诊记录: {
    desc: '转诊（院）记录、门诊转诊单',
    sections: [S('病情摘要', 'narrative'), S('转诊原因', 'written', { label: '转诊当时' }), S('初步诊断', 'written', { label: '诊断在写成当时', lines: true }), S('处理意见', 'written', { label: '写成当时' })],
  },
  其他文书: {
    desc: '上面都不像的叙述性记录；栏目名用原文的字段中文名',
    sections: [S('正文', 'written', { label: '写成当时' })],
    freeSections: true,
  },
}

/**
 * 结构化类别。roles：字段角色（required 必填）；render：拼成文字的模板（{角色}，同 S01 的模板写法）。
 */
export const STRUCTURED_TYPES = {
  基本信息: { desc: '人口学：出生日期、性别', roles: { birth: '出生日期', sex: '性别' }, required: [], render: '性别：{sex}｜出生日期：{birth:day}' },
  就诊登记: {
    desc: '挂号、就诊登记、入出院登记',
    roles: { setting: '门诊／住院／急诊／体检（类别字段）', dept: '科室', org: '机构', reason: '就诊原因或入院诊断' },
    required: [], render: '{setting}就诊｜{org}｜科室：{dept}{reason?｜}',
  },
  诊断记录: { desc: '诊断明细（门诊、住院、病案首页诊断）', roles: { name: '诊断名称', icd: '诊断编码', category: '诊断类别（初步、出院、补充…）', main: '主要诊断标志' }, required: ['name'], render: '{name}{category?｜}' },
  检验: { desc: '检验结果明细（一行一个项目）', roles: { item: '检验项目', value: '结果', unit: '单位', ref: '参考范围', flag: '异常提示', panel: '检验组合／报告名', specimen: '标本', report: '报告号' }, required: ['item', 'value'], lab: true },
  生命体征: {
    desc: '体温、脉搏、呼吸、血压、体重等测量（长表：一行一项；宽表：一行多项用 measures）',
    roles: { item: '项目名', value: '测量值', unit: '单位' }, required: [], render: '{item} {value}{unit? }',
  },
  医嘱: { desc: '住院医嘱（长期／临时；药品、检查、护理等）', roles: { item: '医嘱内容或药名', dose: '剂量', unit: '剂量单位', route: '途径', frequency: '频次', orderType: '长期／临时', category: '医嘱类别', stop: '停止时间' }, required: ['item'], render: '{orderType? }{item} {dose}{unit} {route} {frequency}' },
  处方: { desc: '门诊处方明细', roles: { item: '药名', dose: '剂量', unit: '单位', route: '途径', frequency: '频次', days: '天数', quantity: '数量' }, required: ['item'], render: '{item} {dose}{unit} {route} {frequency}{days?｜天数 }' },
  用药记录: { desc: '用药执行、输液、输血等执行记录', roles: { item: '药品或血制品', dose: '剂量', unit: '单位', route: '途径' }, required: ['item'], render: '{item} {dose}{unit} {route}' },
  治疗记录: { desc: '治疗、处置、操作的执行记录（非药品）', roles: { item: '治疗项目', result: '结果或说明' }, required: ['item'], render: '{item}{result?｜}' },
  申请单: { desc: '检验申请、检查申请（开单，不含结果）', roles: { item: '申请项目', reason: '申请目的或临床诊断' }, required: ['item'], render: '申请：{item}{reason?｜目的：}' },
  手术记录: { desc: '手术或操作明细（名称、编码）', roles: { name: '手术名称', code: '手术编码', anesthesia: '麻醉方式' }, required: ['name'], render: '{name}{anesthesia?｜麻醉：}' },
  收费: { desc: '费用明细（门诊、住院）', roles: { item: '收费项目', category: '费用类别', quantity: '数量', unit: '单位', refund: '退费标志' }, required: ['item'], render: '{item}｜{category}｜{quantity}{unit}' },
  其他结构化: { desc: '上面都不像、但值得留下的结构化行；用 roles.text 指定要拼进文字的字段（最多 6 个）', roles: { text: '要显示的字段（数组）' }, required: ['text'] },
}

/** 不处理的表（费用结算、申请单的附表、纯编码表…）用这个类别，原样跳过。 */
export const IGNORE = '忽略'

export const RECORD_TYPES = [...Object.keys(STRUCTURED_TYPES), ...Object.keys(DOCUMENT_TYPES), IGNORE]
export const kindOf = (recordType) => (DOCUMENT_TYPES[recordType] ? '文书' : STRUCTURED_TYPES[recordType] ? '结构化' : null)

/** 所有表都可以有的公共角色。 */
export const COMMON_ROLES = {
  written: '写成（可见）时间：记录写成、审核或报告的时间，按优先顺序给出多个',
  occur: '发生时间：检查、检验、手术、给药等实际发生的时间（可空）',
  key: '记录主键字段（可多个；空则用行号）',
  patient: '病人标识字段（如证件号、病人编号；匿名化后的假名也算）',
  outpatient: '门（急）诊号',
  inpatient: '住院号',
  admit: '入院时间', discharge: '出院时间',
  invalid: '作废标志字段与表示作废的取值',
}

/**
 * 文件名／表名里的关键词 → 可接受的类别（规则草稿用；顺序即优先级）。
 * 第一个是规则草稿的取值；整组是规则这一票“认可”的范围——模型选了组内任一个都不算分歧，
 * 这样规则只拦明显的错（把入院记录认成检验），不和模型抢细分。
 */
export const NAME_HINTS = [
  [/作废|删除|日志|log/i, [IGNORE]],
  [/基本信息|人口|患者信息|病人信息|psn|patient(?!_?id)/i, ['基本信息', '就诊登记']],
  [/检验.*(申请|开单)|检查.*(申请|开单)|申请单/, ['申请单', IGNORE]],
  [/药敏|细菌|检验.*(结果|明细|常规)|化验|lab|test_?rs?lt|lis/i, ['检验', '其他结构化']],
  [/检验.*报告/, ['检验', '检查报告', '其他结构化', IGNORE]],
  [/检查报告|影像|超声|心电|内镜|病理|放射|exam|pacs|ris/i, ['检查报告']],
  [/生命体征|体征|体温单|体格检查|vital/i, ['生命体征', '其他结构化', '门诊病历']],
  [/处方/, ['处方', '医嘱', IGNORE]],
  [/医嘱|order/i, ['医嘱']],
  [/用药|输液|输血|给药/, ['用药记录', '医嘱']],
  [/治疗记录|治疗明细|处置/, ['治疗记录', '用药记录', '其他结构化', '其他文书']],
  [/费用结算|结算/, [IGNORE, '收费']],
  [/病案首页.*(费用|评估)/, [IGNORE, '收费', '其他结构化']],
  [/费用|收费|fee|charge/i, ['收费', IGNORE]],
  [/手术信息|手术明细|手术操作/, ['手术记录']],
  [/诊断/, ['诊断记录']],
  [/挂号|就诊登记|入出院登记|就诊记录|visit|vst/i, ['就诊登记']],
  [/入院记录|入院病历|24小时内入出院/, ['入院记录', '出院记录']],
  [/出院记录|出院小结|死亡记录/, ['出院记录']],
  [/门.*诊.*病历|门诊记录|留观/, ['门诊病历']],
  [/病程|查房|交接班|术前小结|阶段小结|抢救/, ['病程记录', '手术麻醉记录']],
  [/会诊/, ['会诊记录']],
  [/麻醉|手术记录/, ['手术麻醉记录', '手术记录']],
  [/护理|评估|出入量/, ['护理记录', '生命体征', '其他文书', '其他结构化']],
  [/转诊|转院/, ['转诊记录']],
]

/** 栏目名的常见写法 → 标准栏目（规则草稿与文书内标题识别用）。 */
export const SECTION_ALIASES = {
  主诉: [/^主\s*诉$/], 现病史: [/^现病史$/], 既往史: [/^既往史$/, /^既往病史$/], 个人史: [/^个人史$/], 过敏史: [/^过敏史$/, /^药物过敏/],
  月经史: [/^月经史$/], 婚育史: [/^婚育史$/, /^婚姻史$/, /^生育史$/], 家族史: [/^家族史$/],
  体格检查: [/^体格检查$/, /^查体$/, /^体检$/, /^专科体检$/, /^一般检查$/], 专科情况: [/^专科(情况|检查)$/],
  辅助检查: [/^辅助检查$/, /^实验室检查$/, /^检查结果$/], 初步诊断: [/^初步诊断$/, /^诊断$/, /^门诊诊断$/, /^入院诊断$/, /^临床诊断$/],
  处理意见: [/^处理(意见)?$/, /^处置$/, /^处方$/, /^治疗意见$/, /^注意事项/, /^嘱托/],
  诊疗计划: [/^诊疗计划$/, /^治疗计划$/, /^计划$/],
  入院情况: [/^入院情况$/, /^入院时情况$/], 入院诊断: [/^入院诊断$/], 诊疗经过: [/^诊疗经过$/, /^住院经过$/, /^治疗经过$/],
  出院情况: [/^出院情况$/, /^出院时情况$/], 出院诊断: [/^出院诊断$/], 出院医嘱: [/^出院医嘱$/, /^出院带药$/, /^出院指导$/],
  检查项目: [/^检查(项目|名称|部位)$/], 所见: [/^(检查)?所见$/, /^影像(学)?表现$/, /^描述$/], 结论: [/^(检查)?结论$/, /^印象$/, /^诊断意见$/, /^提示$/],
  病例特点: [/^病例特点$/], 病情记录: [/^病情(记录|变化)?$/, /^病程$/, /^记录内容$/], 查房意见: [/^查房(意见|记录)$/, /^上级医师意见$/],
  诊断依据: [/^诊断依据$/], 鉴别诊断: [/^鉴别诊断$/],
  病情摘要: [/^病情摘要$/, /^简要病情$/, /^病史摘要$/], 会诊目的: [/^会诊(目的|理由|原因)$/], 会诊意见: [/^会诊意见$/],
  术前诊断: [/^术前诊断$/], 术后诊断: [/^术后诊断$/], 手术名称: [/^手术(名称|方式)$/], 麻醉方式: [/^麻醉方式$/], 手术经过: [/^手术经过$/, /^手术步骤$/], 术后情况: [/^术后(情况|处理)$/],
  护理观察: [/^病情观察$/, /^护理观察$/], 护理措施: [/^护理措施$/, /^护理记录$/], 评估: [/评估/], 健康指导: [/^健康(指导|教育)$/],
  转诊原因: [/^转(诊|院)(原因|目的)$/],
}
