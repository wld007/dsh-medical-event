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
}
