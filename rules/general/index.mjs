/**
 * 通用医学层：工序2 类型切分的词表与规则（v2.2），工序3/4 的通用参数。
 * 专科词（透析、本队列药名、内瘘手术）放 rules/specialty/。
 */
export default {
  id: 'general',
  layer: 'general',
  version: '0.1.0',
  basedOn: { '工序2': 'v2.2', '工序3': 'v1.5', '工序4': 'v1.0' },

  vocab: {
    NEG: /^(?:患者)?(?:无|否认|未|没有|不伴|不能)|阴性|未见|未及|未闻及|未触及|无明显|无殊|无(?:肿大|充血|畸形|红肿|渗血|渗液)|[内周天]无|[一-龥]无\s*$|[一-龥]无\s+[一-龥]|(?:左|右)无$/,
    // 假阴性（v1.1）：这些不是否定表述
    FALSE_NEG: /无明显诱因|无诱因|未见好转|未见明显好转|无尿(?![频急痛少量色])|不能排除|不能平卧|未予系统诊治|未重视|未按|未遗留/,
    LAB: /\d[\d.]*\s*(?:mmol\/L|umol\/L|μmol\/L|umo\/l|g\/L|g\/l|mg\/L|ng\/L|ng\/ml|ng\/mL|pg\/mL|pg\/ml|μg\/L|ug\/L|U\/L|IU\/L|ratio|个\/μL|个\/uL|\/HP|Kpa|kpa|fL|mIU\/L|nmol\/L|ml\/min)|×10\^|\*10\^|eGFR|PT-INR\s*\d|INR\s*\d|尿蛋白|潜血|弱阳性|[↑↓]/,
    VITAL: /脉搏|呼吸\s*[:：]?\s*\d|血压\s*[:：]?\s*\d|\d+\/\d+\s*mmHg|体温|BP|Bp|T\s*[:：]?\s*3\d|\bP\s*[:：]|HR\s*\d|SPO2|SpO2|心率\s*[:：]?\s*\d|氧饱和度/,
    EXAM: /神清|神志|意识|精神|病容|面容|紫绀|发绀|贫血貌|颈静脉|呼吸音|罗音|啰音|哮鸣音|心律|律不齐|律绝对不齐|绝对不齐|律齐|端坐呼吸|心音|杂音|腹(?:平)?软|压痛|反跳痛|肝脾|移动性浊音|叩痛|叩击痛|浮肿|水肿|巴氏征|Babinski|震颤|搏动|舌淡|苔|脉细|咽|扁桃体|瞳孔|对光反射|巩膜|淋巴结|肌力|肌张力|反射|皮疹|黏膜|甲状腺|气管|胸廓|心界|NS\(-\)|心肺|伤口|创口|红肿|结痂|分泌物|愈合/,
    JUDGE: /考虑|诊断为|诊断“|拟“|拟"|提示|示[:：]|可能|不除外|不能排除|评分|心功能\S*级|NYHA|分期|\d期|属于|符合|病情(?:稳定|好转|加重|危重)|病前稳定|告病危|下病危|病危|病重|较前(?:吸收|新增)|控制不详|控制尚可|控制在/,
    HISTDX: /\S{2,10}病史$|^既往(?!口服|服用|有无)\S+|有“[^”]+”\s*病?史|有[^，。；]{1,12}病史|病史\s*\d|史\d|既往有|自诉有|^患者尿毒症|尿毒症\s*\d+年|既往尿毒症|^有“|病史如上述|有“[^”]+”$/,
    PATIENT: /拒绝|不同意|自行(?:服|停|购|用)|家属要求|要求出院/,
    PLAN: /^\s*(?:\d+[.、．]\s*)?(?:建议|拟行|拟|待|定期|门诊随诊|随诊|随访|复诊|复查|监测|注意|避免|控制|保持|忌|如有|若有|不适|低盐|低脂|低钾|低磷|优质|保护血管|休息|多饮水|饮食|按时服药|按医嘱|健康教育|及健康指导|每\d|\d+(?:天|日|周|月)(?:内|后)?(?:门诊)?复|稳定后)/,
    ORDER: /^检查\s*[:：]|^\d+\s*[:：]|PT-INR\(华法林监测\)|^\d+:\S/,
    ADJUST: /暂停|停用|已停|停\S{1,4}(?:片|针)|^停|减量|加量|改为|改用|换用|加用|调整|下调|上调/,
    PROC: /行\S{0,14}术|手术|穿刺|置管|拔除|拆线|换药|清创|球囊|支架|胸腔穿刺|引流/,
    PROC_RESULT: /出现|顺利|恢复/,
    TREAT: /^予|^给予|^予以|使用|口服|服用|治疗|输注|注射|抗感染|利尿|扩冠|降压|升压|纠正|护肾|抗凝|抗血小板|改善|营养|控制血压|控制心室率|降尿酸|降磷|降PTH|降甲状旁腺|补充|雾化|吸氧|平喘|止咳|#\s*q[d]|\bqd\b|\bbid\b|\btid\b|qn|1#|片|针|胶囊|颗粒|mg/,
    DRUG: /地平|洛尔|沙坦|他汀|沙星|头孢|西林|霉素|唑仑|替丁|拉唑|胰岛素|二甲双胍|阿司匹林|氯吡格雷|华法林|呋塞米|托拉塞米|碳酸氢钠|骨化三醇/,
    CARE: /收治|收住|入院|住院治疗|住院时间|入住|来院|就诊|急诊|门诊拟|转入|出院|留观|抢救室|随诊|进一步(?:系统)?诊治|为求进一步|进一步治疗/,
    OUTSIDE: /外院|当地|他院|医院-[0-9A-F]{6}/,
    FORM: /\[有无\]|（有无）|\[无|有\]|其他：\s*$|^有无/,
    ADH: /规律服用|规律口服|不规律|自行(?:服|停|购|用)|依从|控制不佳|未重视|未予系统诊治|未按|漏服|擅自/,
    VISIT_GOAL: /要求(?:配药|检验|检查|拆线)|^配药/,
    ADMIT: /收治|收住|拟.{0,30}(?:收|入院)/,
    PLAN_NARR: /^(?:建议|拟行|复查|随访)/,
    POSSIBLE: /不能排除|不除外|可能大/,
    IMAGING: /CT|MRI|MR|彩超|B超|心超|心电图|胸片|X线|超声|DR|心动图|正侧位|平扫|造影/,
    POST_OP: /术后$/,
    HIST_OTHER: /体质|预防接种|疫苗|接种|健康状况/,
    HIST_POSTOP: /术中顺利|术后恢复/,
    SURGERY_WORD: /术|手术/,
    // 细分映射用的词
    CARE_EVENT: /就诊|入院|出院|住院|门诊|急诊|留观/,
    CONDITION: /肌酐|黑便|升高|下降|浮肿|水肿|气急|胸闷|发热|咳嗽|乏力|纳差|疼痛|加重|好转/,
    VISIT_PURPOSE: /配药|要求|复诊|复查|检查|评估|换药|拆线/,
    BACKGROUND_NEG: /疫区|接触|过敏|输血|外伤|手术史|烟|酒|毒物|放射|冶游|遗传|出国|旅居/,
    REASONING: /评分|风险|不能排除|不除外|可能大|所致|引起|继发于|病危|预后/,
    FLOW_ADMIT: /留观|住院|出院|转诊|会诊|建议\S{0,6}科|[^\d\s，,]{1,4}科(?:门诊)?(?:随诊|复诊|就诊)|至\S{1,4}科/,
    FLOW_FOLLOW: /复查|监测|随诊|复诊|就诊|定期|检查|血常规|生化|CRP|心超|BNP|血气|肝功能|肾功能|电解质|凝血|INR|心电图|胸片|CT|B超|彩超|超声|PTH|甲状旁腺|铁蛋白|尿常规|血脂|血糖/,
    PROC_WORDS: /手术|切开|引流|换药|拆线|术/,
    DRUG_PLAN: /华法林|剂量|服药|药物|透析|mg|片|针/,
    NON_DRUG: /吸氧|雾化/,
    FEE_LAB: /采血|采血器|注射器/,
    CERT_LOW: /不能排除|不除外|待排|待查|[？?]/,
    CERT_MID: /考虑|拟诊|^拟|可能|疑似|倾向/,
    ACT_STOP: /暂停|停用|^停|已停|停\S{1,4}(?:片|针)/,
    ACT_ADJUST: /减量|加量|改为|改用|换用|调整|下调|上调|加用/,
    ACT_KEEP: /继续|维持|规律|长期|一直|仍|坚持/,
    ACT_START: /^予|^给予|^予以|^行|开始|启用|^加用/,
  },

  params: {
    templateNegationDocs: 3,  // 同一否认在 ≥3 份同类文书重复 → 模板化否认
    templateOrderDocs: 5,     // 门诊处理意见在 ≥5 份重复 → 宣教/医嘱模板
    verbatimReuseDocs: 3,     // 同一句在 ≥3 份同类文书出现且不是首次 → 逐字复用
    lateRecordDays: 14,       // 写成晚于事件 14 天以上 → 同次补记
    fallbackAlarm: 0.03,      // 兜底（Z2、Z9）命中率阈值
  },

  /*
   * 工序2 规则（有序，命中即停）。when 条件：
   *   recordType / section / kind: 数组（任一）
   *   text / notText: '@词表' 或正则
   *   negative: true|false（已计算的阴性属性）
   *   context: '@词表' 或正则，测本条之前同一行（同一段）的文字，如“入院查体：…”
   *   any / all: 子条件数组
   */
  classify: [
    { id: 'S1', name: '结构化：检验', type: '事实', subclass: '检测结果', when: { recordType: ['检验'] } },
    { id: 'S2', name: '结构化：诊断记录', type: '判断', subclass: '诊断', when: { recordType: ['诊断记录'] } },
    { id: 'S3', name: '结构化：就诊登记', type: '事实', subclass: '就医经过', when: { recordType: ['就诊登记'] } },
    { id: 'S4', name: '结构化：手术记录', type: '决策', subclass: '手术操作', when: { recordType: ['手术记录'] } },
    { id: 'S5', name: '结构化：收费项目', type: '决策', subclass: '执行记录', when: { recordType: ['门诊收费'] } },
    { id: 'D1', name: '诊断栏目', type: '判断', subclass: '诊断', when: { recordType: ['入院记录'], section: ['初步诊断', '补充诊断', '出院诊断', '修正诊断', '最后诊断'] } },
    { id: 'D2', name: '检查报告·结论', type: '判断', subclass: '检查结论', when: { recordType: ['检查报告'], section: ['结论'] } },
    { id: 'D3', name: '检查报告·所见', type: '事实', subclass: '检查所见', when: { recordType: ['检查报告'], section: ['所见'] } },
    { id: 'D3b', name: '检查报告·项目名', type: '决策', subclass: '检查（已执行）', when: { recordType: ['检查报告'], section: ['检查项目'] } },
    { id: 'D4', name: '入院记录查体模板', type: '事实', subclass: '查体所见', when: { recordType: ['入院记录'], section: ['体格检查'] } },
    { id: 'F1', name: '表单占位符', type: '事实', subclass: '表单占位', when: { text: '@FORM' } },
    { id: 'A1', name: '辅助检查·结论性措辞', type: '判断', subclass: '检查结论', when: { section: ['辅助检查'], text: /提示|考虑|建议/ } },
    { id: 'A2', name: '辅助检查·检查所见与数值', type: '事实', subclass: '检测结果', when: { section: ['辅助检查'] } },
    { id: 'K1', name: '开检查', type: '决策', subclass: '检查申请', when: { text: '@ORDER' } },
    { id: 'K2b', name: '就诊目的：要求配药/检查', type: '事实', subclass: '主诉与就诊目的', when: { text: '@VISIT_GOAL' } },
    { id: 'K2', name: '患者拒绝/自行', type: '决策', subclass: '患者选择', when: { text: '@PATIENT' } },
    { id: 'K3', name: '停用/调整/改用', type: '决策', subclass: '方案调整', when: { text: '@ADJUST', notText: /生活方式/ } },
    { id: 'K4a', name: '收治入院', type: '决策', subclass: '收治入院', when: { text: '@ADMIT' } },
    { id: 'K4', name: '计划/医嘱/宣教', type: '决策', subclass: '计划与医嘱', when: { recordType: ['门诊病历'], section: ['处理意见'] } },
    { id: 'K4b', name: '叙述中的建议/计划', type: '决策', subclass: '计划与医嘱', when: { text: '@PLAN_NARR' } },
    { id: 'J3', name: '拟诊', type: '判断', subclass: '诊断与评估', when: { text: /^拟[“"]/ } },
    { id: 'K5', name: '检验数值/结果', type: '事实', subclass: '检测结果', when: { text: '@LAB' } },
    { id: 'K6', name: '生命体征', type: '事实', subclass: '体征', when: { text: '@VITAL' } },
    { id: 'H5', name: '家族史', type: '事实', subclass: '个人与家族史', when: { section: ['家族史'] } },
    { id: 'H6', name: '月经史/婚育史', type: '事实', subclass: '个人与家族史', when: { section: ['月经史', '婚育史'] } },
    { id: 'H4', name: '病史栏目·其他', type: '事实', subclass: '个人与家族史', when: { any: [{ recordType: ['入院记录'], section: ['个人史'], negative: false }, { section: ['既往史', '个人史', '过敏史'], text: '@HIST_OTHER' }] } },
    { id: 'H7', name: '病史栏目·术后情况', type: '事实', subclass: '症状与经过', when: { section: ['既往史', '个人史'], text: '@HIST_POSTOP' } },
    { id: 'H1', name: '病史栏目·否认', type: '事实', subclass: '病史否认', when: { section: ['既往史', '个人史', '过敏史'], negative: true } },
    { id: 'H2', name: '病史栏目·手术', type: '决策', subclass: '既往手术（转述）', when: { section: ['既往史', '个人史'], text: '@SURGERY_WORD' } },
    { id: 'H3', name: '病史栏目·既往病', type: '判断', subclass: '既往诊断（转述）', when: { section: ['既往史', '个人史'] } },
    { id: 'J4', name: '不能排除/可能', type: '判断', subclass: '诊断与评估', when: { text: '@POSSIBLE' } },
    { id: 'N1', name: '阴性查体', type: '事实', subclass: '查体所见', when: { negative: true, any: [{ section: ['体格检查', '专科情况'] }, { context: /查体/ }, { section: ['入院情况', '出院情况'], text: '@EXAM' }] } },
    { id: 'N2', name: '阴性症状/经过', type: '事实', subclass: '症状阴性', when: { negative: true } },
    { id: 'J1', name: '既往病史表述', type: '判断', subclass: '既往诊断（转述）', when: { text: '@HISTDX' } },
    { id: 'P2', name: '『××术后』状态表述', type: '决策', subclass: '既往手术（转述）', when: { text: '@POST_OP' } },
    { id: 'P1', name: '手术/操作/透析启动', type: '决策', subclass: '手术操作', when: { text: '@PROC', notText: '@PROC_RESULT' } },
    { id: 'J2', name: '考虑/诊断/提示/评分/病情评价', type: '判断', subclass: '诊断与评估', when: { text: '@JUDGE' } },
    { id: 'C1', name: '就诊/入院/出院/随诊经过', type: '事实', subclass: '就医经过', when: { text: '@CARE', notText: /予|服用|口服/ } },
    { id: 'T1', name: '治疗/用药/透析方案', type: '决策', subclass: '治疗用药', when: { any: [{ text: '@TREAT' }, { text: '@DRUG' }] } },
    { id: 'E1', name: '查体栏目/查体段落', type: '事实', subclass: '查体所见', when: { text: '@EXAM', any: [{ section: ['体格检查', '专科情况', '入院情况', '出院情况'] }, { context: /查体/ }] } },
    { id: 'Z1', name: '主诉', type: '事实', subclass: '主诉与就诊目的', when: { section: ['主诉'] } },
    { id: 'A3', name: '叙述中的影像/心电所见', type: '事实', subclass: '检测结果', when: { any: [{ text: '@IMAGING' }, { context: '@IMAGING' }] } },
    { id: 'Z2', name: '叙述栏目默认：症状/经过（待复核）', type: '事实', subclass: '症状与经过', fallback: true, when: { section: ['现病史', '入院情况', '出院情况'] } },
    { id: 'Z9', name: '未命中任何规则', type: '事实', subclass: '其他（待复核）', fallback: true, when: {} },
  ],
}
