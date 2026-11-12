/**
 * 虚构病人（平台导出格式，按月分文件）。内容全部编造，用来覆盖设计文档里的写法与
 * 真实数据里遇到的陷阱：毫秒时间戳、第二版入院记录、签名诊断段、HTML 实体、
 * 计费周期“住院”、换药、复制漂移、模板化否认、检验转述误差。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** '2024-03-04 14:22' (东八区) → 毫秒字符串 */
export const ts = (s) => String(Date.parse(`${s.replace(' ', 'T')}:00+08:00`))

let seq = 0
const key = (p) => `${p}-${String(++seq).padStart(6, '0')}`

function admission({ no, admit, record, chief, hpi, past, exam, aux, dx, extra = '' }) {
  return [
    '', '入院记录', '姓    名:化名-000001      性     别:女', `入院时间 :${record.replace(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/, '$1年$2月$3日$4时$5分')}`,
    `病史陈述者:患者本人      记录时间 :${record.replace(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/, '$1年$2月$3日$4时$5分')}`,
    `主  诉：${chief}`, `现病史：${hpi}`, `既往史：${past}`,
    '个人史：生于地址-000002，久居本地。否认烟酒嗜好。', '月经史：   45    岁绝经，月经规则。', '婚育史：22岁结婚。', '家族史：父亡故，母健在。',
    '', '体格检查', exam, '', '辅助检查', aux, '初步诊断:', ...dx.map((d) => `  ${d}`), '医生签名：医生-000003', `          ${record.slice(0, 10)}`, extra, '',
  ].join('\n')
}

export function fictionalTables() {
  seq = 0
  const files = {}
  const put = (dir, month, file, rows) => { const p = `${dir}/${month}/${file}`; files[p] = [...(files[p] ?? []), ...rows] }

  put('人口信息学/病史', '190001', 'p_doc_dwd_psn_rcd.json', [{ PRM_KEY: key('病历'), BTH_DT: '19510120', GDR_NM: '女性' }])

  // 就诊：门诊、真实住院、血液净化中心按月计费的“住院”
  const visits = [
    ['O1', '2022-07-01 09:00', '1', '肾病内科'], ['O2', '2022-07-04 09:00', '1', '肾病内科'], ['O3', '2022-08-01 09:00', '1', '肾病内科'],
    ['O4', '2023-03-21 09:00', '1', '肾病内科'], ['O5', '2023-05-10 09:00', '1', '肾病内科'],
  ].map(([no, t, tp, dept]) => ({ PRM_KEY: key('病历'), VST_TP: tp, VST_DT: ts(t), VST_DT_TM: ts(t), OTPT_EMG_NO: `就诊-${no}`, VST_DPT_NM: dept, MDC_ORG_NM: '医院-000009' }))
  visits.push({ PRM_KEY: key('病历'), VST_TP: '2', VST_DT: ts('2022-09-01 08:00'), ADMN_DT_TM: ts('2022-09-01 08:00'), INHOS_NO: '住院-BILL', ADMN_DPT_NM: '血液净化中心(技)', MDC_ORG_NM: '医院-000009' })
  visits.push({ PRM_KEY: key('病历'), VST_TP: '2', VST_DT: ts('2017-11-25 10:00'), ADMN_DT_TM: ts('2017-11-25 10:00'), DSCG_DT_TM: ts('2017-12-05 10:00'), INHOS_NO: '住院-A', ADMN_DPT_NM: '肾脏内科', MDC_ORG_NM: '医院-000009' })
  put('就诊/就诊记录', '202207', 'p_doc_fact_vst_infmt.json', visits)

  // 入院记录：2017 首次（开始透析），2020 再次（转述“2017.10开始血透”，与同期 11.24 冲突；子宫切除复制漂移）
  const adm2017 = admission({
    no: '住院-A', record: '2017-11-25 13:53', chief: '反复浮肿8年余，气急3天。',
    hpi: '患者8年余前出现双下肢浮肿，按之呈凹陷性，未予系统诊治。3天前无明显诱因下出现气急，夜间不能平卧，无胸痛，遂至我院急诊，查肌酐 892μmol/L，拟“慢性肾脏病5期”收治入院。于2017.11.24行血液透析治疗，过程顺利。',
    past: '有“高血压病”史10年余，口服硝苯地平控释片。否认“糖尿病、冠心病、脑血管病”史。10年前行子宫切除术，术后恢复可。否认药物过敏史。',
    exam: '一般情况:  意识清醒,脉搏88次/分,呼吸20次/分,血压162/94mmHg,体温36.8℃\n双下肢中度凹陷性水肿', aux: '（2017-11-24本院）血常规：血红蛋白 82g/L，肌酐 892μmol/L', dx: ['慢性肾脏病5期', '肾性贫血', '高血压病'],
    extra: '补充诊断：\n  心房颤动\n医生签名:医生-000003\n         2017-11-28',
  })
  const adm2020 = admission({
    no: '住院-B', record: '2020-01-27 13:53', chief: '血透2年余，胸闷3天。',
    hpi: '患者2年余前（2017.10）在我院开始血透治疗，一周三次，出院后一直门诊规律透析。3天前出现胸闷，无发热。',
    past: '有“高血压病”史10年余。否认“糖尿病、冠心病”史。10年前行子宫切除术，术后恢复可。',
    exam: '一般情况:  意识清醒,脉搏80次/分,呼吸18次/分,血压140/80mmHg,体温36.6℃', aux: '（2020-01-26本院）钾 5.36mmol/L', dx: ['慢性肾脏病5期', '高血压病'],
  })
  put('病历记录/住院病历', '201711', 'p_doc_fact_admn_mdc_htr_rcd.json', [{ PRM_KEY: key('病历'), INHOS_NO: '住院-A', ADMN_DT_TM: ts('2017-11-25 10:00'), DSCG_DT_TM: ts('2017-12-05 10:00'), RCD_DT_TM: ts('2017-11-25 13:53'), CRT_TM: ts('2017-11-25 13:53'), CHF_COMPLNT: '反复浮肿8年余，气急3天。', PST_ILLNS_HST: adm2017 }])
  const k2020 = key('病历')
  put('病历记录/住院病历', '202001', 'p_doc_fact_admn_mdc_htr_rcd.json', [{ PRM_KEY: k2020, INHOS_NO: '住院-B', ADMN_DT_TM: ts('2020-01-27 10:00'), RCD_DT_TM: ts('2020-01-27 13:53'), CRT_TM: ts('2020-01-27 13:53'), CHF_COMPLNT: '血透2年余，胸闷3天。', PST_ILLNS_HST: adm2020 }])
  // 第二版入院记录：同主键、三个月后补写，既往史改为“有冠心病”
  put('病历记录/住院病历', '202004', 'p_doc_fact_admn_mdc_htr_rcd.json', [{ PRM_KEY: k2020, INHOS_NO: '住院-B', ADMN_DT_TM: ts('2020-01-27 10:00'), CRT_TM: ts('2020-04-18 18:35'), CHF_COMPLNT: '血透2年余，胸闷3天。', PST_ILLNS_HST: adm2020.replace('否认“糖尿病、冠心病”史。', '有“冠心病”史5年。') }])

  // 出院记录（含 HTML 实体）
  put('病历记录/出院记录', '201712', 'p_doc_fact_dscg_rcd.json', [{ PRM_KEY: key('病历'), INHOS_NO: '住院-A', CRT_TM: ts('2017-12-05 16:00'), UPD_DT: '2017-12-05 15:00:00',
    ADMN_CDT: '此次因“反复浮肿8年余，气急3天”入院。入院查体：血压162/94mmHg，双下肢水肿。（2017-11-24本院）血常规：红细胞计数 2.90&#215;10^12/L',
    DSCG_CDT: '患者气急好转，予出院。' }])

  // 门诊：停华法林 → 改利伐沙班；之后又记华法林在用（证据不足）
  const otpt = (no, t, fields) => ({ PRM_KEY: key('病历'), OTPT_EMG_NO: `就诊-${no}`, CRT_TM: ts(t), INVLD_FLG: '0', ...fields })
  put('病历记录/门急诊病历', '202207', 'p_doc_fact_otpt_emg_mdc_htr_rcd.json', [
    otpt('O1', '2022-07-01 09:30', { CHF_COMPLNT: '复诊', PRST_ILLNS_HST: '近期口服华法林0.33#qd，INR偏高。', HDL_SGST: '1、低盐饮食\n2、暂停华法林\n3、不适随诊' }),
    otpt('O3', '2022-08-01 09:30', { CHF_COMPLNT: '复诊', PRST_ILLNS_HST: '规律血透中。停华法林，予利伐沙班抗凝。', HDL_SGST: '1、低盐饮食\n2、不适随诊' }),
    otpt('O4', '2023-03-21 09:30', { CHF_COMPLNT: '配药', PRST_ILLNS_HST: '目前口服华法林0.25#qd。', PSQ_EXAM: '神清，双肺呼吸音清。', HDL_SGST: '1、低盐饮食\n2、不适随诊' }),
    otpt('O5', '2023-05-10 09:30', { CHF_COMPLNT: '配药', PRST_ILLNS_HST: '目前口服华法林0.25#qd。', HDL_SGST: '1、低盐饮食\n2、不适随诊' }),
    otpt('O2', '2022-07-04 09:30', { CHF_COMPLNT: '复诊', PRST_ILLNS_HST: '无殊。', HDL_SGST: '1、低盐饮食\n2、不适随诊', INVLD_FLG: '1' }),
  ])

  // 检验：与入院记录转述对齐；钾 5.36 在检验表是 01-25，01-26 为 5.7 → 转述误差
  const lab = (t, item, v, unit, ref, inhos) => ({ PRM_KEY: key('检验'), TEST_DT: ts(t), ADT_TM: ts(t), CRT_TM: ts(t), TEST_CHD_ITM_NM: item, TEST_RSLT_VLU: v, TEST_RSLT_VLU_UNT: unit, RFRC_VLU: ref, INHOS_NO: inhos })
  put('检验/检验记录', '201711', 'p_doc_fact_test_rcd.json', [
    lab('2017-11-24 10:00', '血红蛋白', '82', 'g/L', '115-150', '住院-A'), lab('2017-11-24 10:00', '肌酐', '892', 'μmol/L', '45-84', '住院-A'),
  ])
  put('检验/检验记录', '202001', 'p_doc_fact_test_rcd.json', [
    lab('2020-01-25 08:00', '钾', '5.36', 'mmol/L', '3.5-5.3', null), lab('2020-01-26 08:00', '钾', '5.7', 'mmol/L', '3.5-5.3', null),
  ])

  // 诊断记录：结构化，反复记录 → 状态
  const diag = (t, name, tp) => ({ PRM_KEY: key('诊断'), DIAG_DT: ts(t), CRT_TM: ts(t), DIAG_DSCPT: name, VST_TP: tp })
  put('诊断/诊断记录', '202207', 'p_doc_fact_diag_infmt.json', [
    diag('2022-07-01 09:30', '慢性肾脏病5期', '1'), diag('2022-08-01 09:30', '慢性肾脏病5期', '1'), diag('2022-08-01 09:30', '尿毒症', '1'),
    diag('2022-08-01 09:30', '冠心病', '1'), diag('2017-01-11 09:30', '慢性肾脏病4期', '1'),
  ])
  // 收费、检查
  put('费用/门诊费用', '202207', 'p_doc_fact_otpt_fee_dtl.json', [{ PRM_KEY: key('收费'), CHRG_DT: ts('2022-07-01 10:00'), CHRG_ITM_NM: '血常规', FEE_CGY_NM: '检查费', ITM_QTY: '1', OTPT_EMG_NO: '就诊-O1', CHRG_RTRN_FLG: '1' }])
  put('检查/检查记录', '202207', 'p_doc_fact_exam_rcd.json', [
    { PRM_KEY: key('检查'), EXAM_DT: '2022-07-20 10:00:00', EXAM_RPT_DT: '2022-07-20 18:12:00', CRT_TM: '2022-07-20 18:12:00', EXAM_ITM_NM: '胸部CT平扫', EXAM_RPT_RSLT_OBJCT: '两肺纹理增多。', EXAM_RPT_RSLT_SBJCT: '1、两侧肺动脉区致密影，请结合临床。' },
    { PRM_KEY: key('检查'), EXAM_DT: '2025-11-04 10:00:00', EXAM_RPT_DT: '2025-11-04 16:00:00', CRT_TM: '2025-11-04 16:00:00', EXAM_ITM_NM: '胸部CT平扫', EXAM_RPT_RSLT_OBJCT: '两侧肺动脉边缘可见条片状钙化影。', EXAM_RPT_RSLT_SBJCT: '1、两侧肺动脉钙化。' },
  ])
  // 血管通路：2017-05-08 手术记录（结构化）＋收费；之后门诊“内瘘成形术后”；2023-09 因内瘘流量下降入院，
  // 出院记录转述 CTA，检查报告表里有同日 CTA 报告原件
  put('一般治疗处置/手术记录', '201705', 'p_doc_fact_oprt_rcd.json', [{ PRM_KEY: key('手术'), INHOS_NO: '住院-AVF', OPRT_NM: '右上肢动静脉内瘘成形术', OPRT_DT_TM: ts('2017-05-08 10:00'), OPRT_STRT_DT_TM: ts('2017-05-08 09:00'), CRT_TM: ts('2017-05-08 12:00'), OPRT_DPT_NM: '肾脏内科' }])
  put('费用/门诊费用', '201705', 'p_doc_fact_otpt_fee_dtl.json', [{ PRM_KEY: key('收费'), CHRG_DT: ts('2017-05-10 10:00'), CHRG_ITM_NM: '动静脉内瘘成形术', FEE_CGY_NM: '治疗费', ITM_QTY: '1', OTPT_EMG_NO: '就诊-O9', CHRG_RTRN_FLG: '1' }])
  put('病历记录/门急诊病历', '201801', 'p_doc_fact_otpt_emg_mdc_htr_rcd.json', [
    otpt('O9', '2018-01-15 09:30', { CHF_COMPLNT: '配药', PRST_ILLNS_HST: '动静脉内瘘成形术后，规律血透。', HDL_SGST: '1、低盐饮食\n2、不适随诊' }),
  ])
  visits.push({ PRM_KEY: key('病历'), VST_TP: '2', VST_DT: ts('2023-09-12 09:00'), ADMN_DT_TM: ts('2023-09-12 09:00'), DSCG_DT_TM: ts('2023-09-20 10:00'), INHOS_NO: '住院-C', ADMN_DPT_NM: '肾脏内科', MDC_ORG_NM: '医院-000009' })
  put('病历记录/出院记录', '202309', 'p_doc_fact_dscg_rcd.json', [{ PRM_KEY: key('病历'), INHOS_NO: '住院-C', CRT_TM: ts('2023-09-20 15:00'), UPD_DT: '2023-09-20 15:00:00',
    ADMN_CDT: '患者，男，80岁，家住地址-000077，既往高血压病、冠心病病史。因"血透2年余，内瘘流量下降1周余"收住入院。入院查体：脉搏74次/分,血压172/81mmHg。双下肢无浮肿。右上肢内瘘血管震颤弱，杂音弱。辅助检查：（2023-09-11我院）右上肢动脉CTA：右上肢桡动脉与桡侧头静脉吻合术后。',
    DSCG_CDT: '患者内瘘流量较前好转，予出院。' }])
  put('检查/检查记录', '202309', 'p_doc_fact_exam_rcd.json', [
    { PRM_KEY: key('检查'), EXAM_DT: '2023-09-11 10:00:00', EXAM_RPT_DT: '2023-09-11 16:00:00', CRT_TM: '2023-09-11 16:00:00', EXAM_ITM_NM: '右上肢动脉CTA', EXAM_RPT_RSLT_OBJCT: '右上肢桡动脉与桡侧头静脉吻合术后，吻合口远端静脉局限性狭窄。', EXAM_RPT_RSLT_SBJCT: '1、右上肢桡动脉与桡侧头静脉吻合术后，吻合口远端静脉狭窄。' },
  ])
  // visits 已经 put 过，重新写一次
  files['就诊/就诊记录/202207/p_doc_fact_vst_infmt.json'] = visits
  return files
}

export async function writeFictionalPatient(dir) {
  const files = fictionalTables()
  for (const [rel, rows] of Object.entries(files)) {
    const p = join(dir, rel)
    await mkdir(join(p, '..'), { recursive: true })
    await writeFile(p, JSON.stringify(rows))
  }
  return dir
}
