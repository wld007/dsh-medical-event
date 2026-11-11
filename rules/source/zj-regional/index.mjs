/**
 * 数据源层：区域平台导出（p_doc_* 表，按月分文件）。
 * 换医院／平台时改这一层。只放数据，不放函数。
 *
 * 可见时间（visible）写法：
 *   { first: [字段…], basis }          取第一个有值的字段
 *   { min: [字段…], basis }            取最早
 *   { join: { table, on, field }, fallback: [字段…], basis }   关联另一表
 *   { static: 'YYYY-MM-DD HH:mm', basis }
 * 文书（kind: '文书'）用 fields 把多个字段拼成一篇，或用 splitter 交给引擎的专门切分器。
 */
export default {
  id: 'zj-regional',
  layer: 'source',
  version: '0.1.0',
  basedOn: { '工序1': 'v1.2' },
  timezoneOffsetMinutes: 480,
  // 导出里有 HTML 实体（如出院记录的 &#215; 即 ×）
  decodeEntities: true,
  invalid: { field: 'INVLD_FLG', values: ['1'] },

  tables: [
    {
      id: 'person', file: 'p_doc_dwd_psn_rcd.json', recordType: '基本信息', kind: '结构化',
      key: ['PRM_KEY'], visible: { static: '1900-01-01 00:00', basis: '静态' },
      render: { template: '性别：{GDR_NM}｜出生日期：{BTH_DT:day}' },
      person: { birth: 'BTH_DT', sex: 'GDR_NM' },
    },
    {
      id: 'visit', file: 'p_doc_fact_vst_infmt.json', recordType: '就诊登记', kind: '结构化',
      key: ['PRM_KEY'],
      visible: { first: ['VST_DT_TM', 'ADMN_DT_TM', 'VST_DT'], basis: '就诊/入院时间' },
      occur: ['VST_DT_TM', 'ADMN_DT_TM', 'VST_DT'],
      codes: { VST_TP: { 1: '门诊', 2: '住院', 3: '体检' } },
      render: { template: '{VST_TP}就诊｜{MDC_ORG_NM}｜科室：{VST_DPT_NM|ADMN_DPT_NM}{ADMN_TNTTV_DIAG_DSCPT?｜入院诊断：}' },
      encounter: { outpatient: 'OTPT_EMG_NO', inpatient: 'INHOS_NO', admit: 'ADMN_DT_TM', discharge: 'DSCG_DT_TM', dept: ['VST_DPT_NM', 'ADMN_DPT_NM'] },
    },
    {
      id: 'diagnosis', file: 'p_doc_fact_diag_infmt.json', recordType: '诊断记录', kind: '结构化',
      key: ['PRM_KEY'],
      visible: { first: ['DIAG_DT', 'CRT_TM'], basis: '诊断时间（缺则创建时间）' },
      occur: ['DIAG_DT', 'CRT_TM'],
      codes: { VST_TP: { 1: '门诊', 2: '住院' }, DIAG_CGY_NM: { cbzd: '初步诊断', cyzd: '出院诊断', bczd: '补充诊断' } },
      render: { template: '{DIAG_DSCPT|DIAG_ICD10_NM}｜{VST_TP}{DIAG_CGY_NM?｜}' },
      meta: { name: ['DIAG_DSCPT', 'DIAG_ICD10_NM'], icd: 'DIAG_ICD10_CD', main: 'MAIN_DIAG_FLG', category: 'DIAG_CGY_NM', setting: 'VST_TP', dept: 'DIAG_DPT_NM' },
      encounter: { outpatient: 'OTPT_EMG_NO', inpatient: 'INHOS_NO' },
    },
    {
      id: 'lab', file: 'p_doc_fact_test_rcd.json', recordType: '检验', kind: '结构化',
      key: ['PRM_KEY'],
      visible: { first: ['ADT_TM', 'TEST_DT', 'CRT_TM'], basis: '审核时间' },
      occur: ['TEST_DT'],
      render: { lab: true },
      meta: { item: ['TEST_CHD_ITM_NM', 'STD_TEST_CHD_ITM_NM'], panel: 'TEST_ITM_NM', value: 'TEST_RSLT_VLU', unit: 'TEST_RSLT_VLU_UNT', ref: 'RFRC_VLU', specimen: 'SPCM_NM', report: 'TEST_RPT_NO' },
      encounter: { outpatient: 'OTPT_EMG_NO', inpatient: 'INHOS_NO' },
    },
    {
      id: 'fee', file: 'p_doc_fact_otpt_fee_dtl.json', recordType: '门诊收费', kind: '结构化',
      key: ['PRM_KEY'],
      visible: { first: ['CHRG_DT', 'CRT_TM'], basis: '收费时间' },
      occur: ['CHRG_DT'],
      render: { template: '{CHRG_ITM_NM}｜{FEE_CGY_NM}｜{ITM_QTY}{ITM_UNT}' },
      meta: { item: 'CHRG_ITM_NM', category: 'FEE_CGY_NM', refund: 'CHRG_RTRN_FLG' },
      encounter: { outpatient: 'OTPT_EMG_NO' },
    },
    {
      id: 'surgery', file: 'p_doc_fact_oprt_rcd.json', recordType: '手术记录', kind: '结构化',
      key: ['PRM_KEY'],
      visible: { first: ['CRT_TM', 'OPRT_DT_TM'], basis: '创建时间' },
      occur: ['OPRT_STRT_DT_TM', 'OPRT_DT_TM'],
      render: { template: '{OPRT_NM}｜{OPRT_DPT_NM}{ATHS_WAY_NM?｜麻醉：}' },
      meta: { name: 'OPRT_NM', code: 'OPRT_CD' },
      encounter: { inpatient: 'INHOS_NO' },
    },
    {
      id: 'outpatient', file: 'p_doc_fact_otpt_emg_mdc_htr_rcd.json', recordType: '门诊病历', kind: '文书',
      key: ['PRM_KEY'],
      visible: { join: { table: 'visit', on: 'OTPT_EMG_NO', field: 'VST_DT_TM' }, fallback: ['CRT_TM'], basis: '就诊时间' },
      // 拼成一篇，栏目标题与工序1 门诊病历的识别正则一致（(?m)^主诉：…）
      fields: [
        ['CHF_COMPLNT', '主诉'], ['PRST_ILLNS_HST', '现病史'], ['PAST_HST', '既往史'], ['ALGN_HST', '过敏史'],
        ['PSN_HST', '个人史'], ['PSQ_EXAM', '体格检查'], ['AXLR_EXAM', '辅助检查'], ['HDL_SGST', '处理意见'],
      ],
      encounter: { outpatient: 'OTPT_EMG_NO' },
    },
    {
      id: 'exam', file: 'p_doc_fact_exam_rcd.json', recordType: '检查报告', kind: '文书',
      key: ['PRM_KEY'],
      visible: { first: ['EXAM_RPT_DT', 'EXAM_DT', 'CRT_TM'], basis: '报告时间' },
      occur: ['EXAM_DT'],
      fields: [['EXAM_ITM_NM', '检查项目'], ['EXAM_RPT_RSLT_OBJCT', '所见'], ['EXAM_RPT_RSLT_SBJCT', '结论']],
      meta: { item: 'EXAM_ITM_NM', modality: 'EXAM_ITM_TP_NM' },
      encounter: { outpatient: 'OTPT_EMG_NO', inpatient: 'INHOS_NO' },
    },
    {
      id: 'discharge', file: 'p_doc_fact_dscg_rcd.json', recordType: '出院记录', kind: '文书',
      key: ['PRM_KEY'],
      visible: { min: ['UPD_DT', 'CRT_TM'], basis: 'UPD_DT与CRT_TM取早者' },
      // 每个字段单独成片段（栏目＝字段名）
      split: 'perField',
      fields: [['ADMN_CDT', '入院情况'], ['DSCG_CDT', '出院情况']],
      encounter: { inpatient: 'INHOS_NO' },
    },
    {
      id: 'admission', file: 'p_doc_fact_admn_mdc_htr_rcd.json', recordType: '入院记录', kind: '文书',
      key: ['PRM_KEY'],
      splitter: 'admission',
      textField: 'PST_ILLNS_HST',
      visible: { first: ['CRT_TM'], basis: '创建时间' }, // 正文取文内记录时间，见 admission 设置
      admission: {
        recordTime: /记录时间\s*[:：]\s*(\d{4})年(\d{1,2})月(\d{1,2})日(\d{1,2})时(\d{1,2})分/,
        // 正文之后的签名诊断段：补充诊断、出院诊断……各自带签名日期
        signedBlock: /(?:^|\n)\s*(补充诊断|出院诊断|修正诊断|最后诊断)\s*[:：]/g,
        signDate: /医生签名\s*[:：][^\n]*\n\s*(\d{4}-\d{2}-\d{2})/,
        signDateBasis: '签名日期（当日末）',
        // 同一住院号的第二版入院记录：取创建时间
        secondVersionBasis: '同次住院第2版入院记录，取创建时间',
      },
      encounter: { inpatient: 'INHOS_NO', admit: 'ADMN_DT_TM', discharge: 'DSCG_DT_TM' },
    },
  ],

  // 血液净化中心按月计费周期登记成“住院”，不是真实住院
  pseudoInpatient: { dept: /血液净化|血透/ },

  /*
   * 工序1 栏目与时间策略。键：recordType 或 `recordType/field`。
   * time 策略：
   *   narrative   本句自带 → 时间副词 → 同句继承 → 前句继承（待复核）
   *   outpatient  本句自带 → 时间副词 → 同句继承；新句无时间取就诊当时
   *   selfOnly    只认本句自带，否则无时间（lineInherit：同一行行首日期可继承）
   *   written     无自带时间时取写成当时（label 写明“查体在写成当时”等）
   *   occur       无自带时间时取检查时间（片段 occurAt）
   *   admitDay    无自带时间时取入院日（按住院号对到就诊容器）
   * template: true 按换行、制表符、两个以上空格切（查体模板）
   * lines: true 每行一条（诊断列表）
   */
  sections: {
    '入院记录/正文': {
      skipPreamble: true,
      list: [
        { name: '主诉', re: /主\s*诉\s*[:：]/, time: 'narrative', duration: true },
        { name: '现病史', re: /现病史\s*[:：]/, time: 'narrative' },
        { name: '既往史', re: /既往史\s*[:：]/, time: 'selfOnly' },
        { name: '个人史', re: /个人史\s*[:：]/, time: 'selfOnly' },
        { name: '月经史', re: /月经史\s*[:：]/, time: 'selfOnly' },
        { name: '婚育史', re: /婚育史\s*[:：]/, time: 'selfOnly' },
        { name: '家族史', re: /家族史\s*[:：]/, time: 'selfOnly' },
        { name: '体格检查', re: /\n\s*体格检查\s*\n/, time: 'written', label: '查体在写成当时', template: true },
        { name: '专科情况', re: /补充及专科情况\s*[:：]?/, time: 'written', label: '查体在写成当时' },
        { name: '辅助检查', re: /\n\s*辅助检查\s*[:：]?\s*\n?/, time: 'selfOnly', lineInherit: true },
        { name: '初步诊断', re: /初步诊断\s*[:：]/, time: 'written', label: '诊断在写成当时', lines: true },
      ],
    },
    '入院记录/补充诊断': { whole: '补充诊断', time: 'written', label: '诊断在签名当日', lines: true },
    '入院记录/出院诊断': { whole: '出院诊断', time: 'written', label: '诊断在签名当日', lines: true },
    '入院记录/修正诊断': { whole: '修正诊断', time: 'written', label: '诊断在签名当日', lines: true },
    '入院记录/最后诊断': { whole: '最后诊断', time: 'written', label: '诊断在签名当日', lines: true },
    门诊病历: {
      list: [
        { name: '主诉', re: /(?:^|\n)主诉：/, time: 'outpatient', duration: true },
        { name: '现病史', re: /(?:^|\n)现病史：/, time: 'outpatient' },
        { name: '既往史', re: /(?:^|\n)既往史：/, time: 'selfOnly' },
        { name: '过敏史', re: /(?:^|\n)过敏史：/, time: 'selfOnly' },
        { name: '个人史', re: /(?:^|\n)个人史：/, time: 'selfOnly' },
        { name: '体格检查', re: /(?:^|\n)体格检查：/, time: 'written', label: '查体在就诊当时' },
        { name: '辅助检查', re: /(?:^|\n)辅助检查：/, time: 'selfOnly', lineInherit: true },
        { name: '处理意见', re: /(?:^|\n)处理意见：/, time: 'written', label: '处理在就诊当时' },
      ],
    },
    检查报告: {
      list: [
        { name: '检查项目', re: /(?:^|\n)检查项目：/, time: 'occur', label: '检查时间' },
        { name: '所见', re: /(?:^|\n)所见：/, time: 'occur', label: '检查时间', cells: true, clause: 'semicolon' },
        { name: '结论', re: /(?:^|\n)结论：/, time: 'occur', label: '检查时间' },
      ],
    },
    '出院记录/入院情况': { whole: '入院情况', time: 'admitDay', label: '入院时', lineInherit: true },
    '出院记录/出院情况': { whole: '出院情况', time: 'written', label: '出院时（写成当时）', lineInherit: true },
  },

  // 不算提及的系统残片与签名行（工序1 第5步“过滤”）
  noise: [
    /^\{[^}]*\}?$/, /^\{门/, /^检查\s*[:：]\s*\{[^}]*\}$/, /^健康教育\s*[:：]?$/, /^及?健康指导\s*[:：]?$/,
    /^医生签名\s*[:：]/, /^\d{4}-\d{2}-\d{2}$/, /^门诊$/, /^名\s*称/, /^测量值/, /^(?:补充诊断|出院诊断|修正诊断|最后诊断)\s*[:：]?$/,
  ],
}
