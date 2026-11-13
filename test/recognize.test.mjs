import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, realpath, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { gunzipSync as gz } from 'node:zlib'
import { readFileSync } from 'node:fs'
const gunzipSyncLines = (f) => gz(readFileSync(f)).toString('utf8').trim().split('\n').map((l) => JSON.parse(l))
import { join } from 'node:path'
import { createService } from '../lib/service.js'
import { decodeEmbedded, tableKeyOf, parseDelimited } from '../lib/recognize/read.js'
import { profileTables, walkData, groupPatients } from '../lib/recognize/profile.js'
import { ruleDraft, checkSpec, compareSpecs, normalizeSpec, briefOf } from '../lib/recognize/draft.js'

/*
 * 虚构的“另一种导出格式”：字段名是编码，入院记录一栏一个字段，门诊病历是 base64 编码的 XML 文书。
 * 全部是编造的数据。
 */
const xmlNote = (cc, hpi) => Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><document><panels>
<panel name="主诉：" text=""/><struct name="cc" text="${cc}"/>
<panel name="现病史：" text=""/><struct name="hpi" text="${hpi}"/>
<panel name="初步诊断：" text=""/><struct name="dx" text="高血压病"/>
</panels><ElementText>科室：内科
姓名：化名-1A2B3C
主诉：${cc}
现病史：${hpi}
初步诊断：高血压病
处理：阿司匹林肠溶片 100mg 口服 每日一次</ElementText></document>`).toString('base64')

async function writeFormatB(dir, n) {
  await mkdir(join(dir, '登记'), { recursive: true })
  await mkdir(join(dir, '病历'), { recursive: true })
  await mkdir(join(dir, '检验'), { recursive: true })
  await mkdir(join(dir, '医嘱'), { recursive: true })
  await writeFile(join(dir, '登记', 'R01_挂号登记.csv'), [
    'XH,F_VNO,F_INNO,F_TP,F_DT,F_DEPT',
    `1,MZ${n}01,,1,2023-03-01 09:10:00,心内科`,
    `2,,ZY${n}01,2,2023-04-02 10:00:00,心内科`,
  ].join('\n'))
  await writeFile(join(dir, '病历', 'R02_住院入院记录.json'), JSON.stringify([
    { XH: 'A1', F_INNO: `ZY${n}01`, F_RECTM: '2023-04-02 15:30:00', F_CC: '反复胸闷3年，加重2天', F_HPI: '患者3年前出现胸闷，活动后明显，休息可缓解，未予重视。2天前胸闷加重，伴气促，夜间不能平卧，为进一步诊治入院。', F_PH: '否认糖尿病史。', F_DX: '冠状动脉粥样硬化性心脏病', F_PID: '证件-ABC123' },
  ]))
  await writeFile(join(dir, '病历', 'R03_门诊病历记录.json'), JSON.stringify([
    { XH: 'M1', F_VNO: `MZ${n}01`, F_VTM: '2023-03-01 09:30:00', F_DOC: xmlNote('头晕1周', '1周前无诱因出现头晕。'), F_PID: '证件-ABC123' },
  ]))
  await writeFile(join(dir, '检验', 'R04_检验结果明细.ndjson'), [
    { F_ITEM: '血红蛋白', F_VAL: '98', F_UNIT: 'g/L', F_REF: '115-150', F_RPTTM: '2023-04-03 08:00:00', F_INNO: `ZY${n}01` },
    { F_ITEM: '肌酐', F_VAL: '88', F_UNIT: 'umol/L', F_REF: '45-84', F_RPTTM: '2023-04-03 08:00:00', F_INNO: `ZY${n}01` },
  ].map((x) => JSON.stringify(x)).join('\n'))
  await writeFile(join(dir, '医嘱', 'R05_住院医嘱记录.json'), JSON.stringify([
    { XH: 'O1', F_INNO: `ZY${n}01`, F_ORDER: '阿司匹林肠溶片', F_DOSE: '100', F_UNITS: 'mg', F_ROUTE: '口服', F_FREQ: 'qd', F_STM: '2023-04-02 16:00:00' },
    { XH: 'O2', F_INNO: `ZY${n}01`, F_ORDER: '阿司匹林肠溶片', F_DOSE: '200', F_UNITS: 'mg', F_ROUTE: '口服', F_FREQ: 'qd', F_STM: '2023-04-05 08:00:00' },
    // 主键不唯一（同一文件里重复）：片段编号也不能撞
    { XH: 'O2', F_INNO: `ZY${n}01`, F_ORDER: '氯化钾缓释片', F_DOSE: '0.5', F_UNITS: 'g', F_ROUTE: '口服', F_FREQ: 'tid', F_STM: '2023-04-05 08:00:00' },
  ]))
  await writeFile(join(dir, '登记', 'R06_费用结算.csv'), 'F_AMT,F_DT\n100,2023-03-01\n')
  // 同一台手术记在两张表里（手术记录＋病案首页手术信息）：是同一事件，不是验收门③的“两条结构化记录合成一个”
  await mkdir(join(dir, '手术'), { recursive: true })
  await writeFile(join(dir, '手术', 'R07_住院手术明细.json'), JSON.stringify([{ XH: 'S1', F_INNO: `ZY${n}01`, F_OPNAME: '左前臂动静脉内瘘成形术', F_OPTM: '2023-04-03 09:00:00' }]))
  await writeFile(join(dir, '手术', 'R08_病案首页手术信息.json'), JSON.stringify([{ XH: 'S1', F_INNO: `ZY${n}01`, F_OPNAME: '动静脉内瘘成形术', F_OPCODE: '39.2701', F_OPTM: '2023-04-03 00:00:00' }]))
}

/** 假模型：按表名给出规格（相当于一个“答对了”的模型）。 */
const SPECS = {
  R01_挂号登记: { recordType: '就诊登记', written: ['F_DT'], key: ['XH'], encounter: { outpatient: 'F_VNO', inpatient: 'F_INNO', setting: 'F_TP', settingValues: { 1: '门诊', 2: '住院' }, admit: 'F_DT' }, roles: { dept: 'F_DEPT' }, sections: [] },
  R02_住院入院记录: { recordType: '入院记录', written: ['F_RECTM'], key: ['XH'], patient: 'F_PID', encounter: { inpatient: 'F_INNO' }, sections: [['F_CC', '主诉'], ['F_HPI', '现病史'], ['F_PH', '既往史'], ['F_DX', '初步诊断']] },
  R03_门诊病历记录: { recordType: '门诊病历', written: ['F_VTM'], key: ['XH'], encounter: { outpatient: 'F_VNO' }, sections: [['F_DOC', '全文']] },
  R04_检验结果明细: { recordType: '检验', written: ['F_RPTTM'], encounter: { inpatient: 'F_INNO' }, roles: { item: 'F_ITEM', value: 'F_VAL', unit: 'F_UNIT', ref: 'F_REF' } },
  R05_住院医嘱记录: { recordType: '医嘱', written: ['F_STM'], key: ['XH'], encounter: { inpatient: 'F_INNO' }, roles: { item: 'F_ORDER', dose: 'F_DOSE', unit: 'F_UNITS', route: 'F_ROUTE', frequency: 'F_FREQ' } },
  R06_费用结算: { recordType: '忽略', written: [] },
  R07_住院手术明细: { recordType: '手术记录', written: ['F_OPTM'], occur: ['F_OPTM'], key: ['XH'], encounter: { inpatient: 'F_INNO' }, roles: { name: 'F_OPNAME' } },
  R08_病案首页手术信息: { recordType: '手术记录', written: ['F_OPTM'], occur: ['F_OPTM'], key: ['XH'], encounter: { inpatient: 'F_INNO' }, roles: { name: 'F_OPNAME', code: 'F_OPCODE' } },
}
function mockFormatModel(name, { wrong = {} } = {}) {
  const asked = []
  return {
    model: name, asked,
    async chat(messages) {
      const user = messages.find((m) => m.role === 'user').content
      const brief = JSON.parse(user.slice(user.lastIndexOf('\n{') + 1))
      asked.push(brief.表)
      // 校验：发出去的简介里不能有整段文字或假名
      assert.ok(!/患者3年前出现胸闷/.test(user), '长文本不该发给模型')
      assert.ok(!/证件-ABC123/.test(user), '假名不该发给模型')
      const spec = { ...SPECS[brief.表], ...(wrong[brief.表] ?? {}) }
      return { content: '```json\n' + JSON.stringify(spec) + '\n```', ms: 1, usage: null }
    },
  }
}

test('读入：表名、CSV、嵌入文档解码', () => {
  assert.equal(tableKeyOf('/x/p_doc_fact_test_rcd_202301.json'), 'p_doc_fact_test_rcd')
  assert.equal(tableKeyOf('/x/门诊病历(1).csv'), '门诊病历')
  assert.deepEqual(parseDelimited('a,b\n"1,2","x""y"\n', ','), [{ a: '1,2', b: 'x"y' }])
  const d = decodeEmbedded(xmlNote('头晕1周', '1周前无诱因出现头晕。'))
  assert.ok(d)
  assert.match(d.text, /^科室：内科/m)
  assert.match(d.text, /^主诉：头晕1周$/m)
  assert.match(d.text, /^现病史：1周前无诱因出现头晕。$/m)
  assert.equal(decodeEmbedded('UEsDBBQAAAAIAAAAIQB' + 'A'.repeat(80)), null) // zip，不是文书
})

test('画像与规则草稿：不发长文本和假名；病人按子目录分组', async () => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'event-rec-')))
  await writeFormatB(join(base, 'cohort', '证件-AAA111'), 1)
  await writeFormatB(join(base, 'cohort', '证件-BBB222'), 2)
  const input = join(base, 'cohort')
  const files = await walkData(input)
  assert.deepEqual((await groupPatients(input, files)).map((p) => p.split('/').pop()), ['证件-AAA111', '证件-BBB222'])
  const single = join(input, '证件-AAA111')
  assert.deepEqual(await groupPatients(single, files.filter((f) => f.startsWith(single))), [single])
  const tables = await profileTables(files, input)
  assert.equal(tables.length, 8)
  const adm = tables.find((t) => t.table === 'R02_住院入院记录')
  const brief = JSON.stringify(briefOf(adm))
  assert.ok(!brief.includes('证件-ABC123'))
  const note = tables.find((t) => t.table === 'R03_门诊病历记录')
  const doc = note.fields.find((f) => f.name === 'F_DOC')
  assert.equal(doc.kind, 'embedded')
  assert.ok(doc.labels.includes('主诉') && doc.labels.includes('现病史'))
  assert.ok(!JSON.stringify(briefOf(note)).includes('头晕'))
  const r = ruleDraft(adm)
  assert.equal(r.recordType, '入院记录')
  // 规格校验与比较
  const good = normalizeSpec(SPECS.R04_检验结果明细, 'model')
  assert.deepEqual(checkSpec(good, tables.find((t) => t.table === 'R04_检验结果明细')), [])
  const bad = normalizeSpec({ ...SPECS.R04_检验结果明细, written: ['F_ITEM'] }, 'model')
  assert.ok(checkSpec(bad, tables.find((t) => t.table === 'R04_检验结果明细')).some((p) => /不是时间/.test(p)))
  assert.equal(compareSpecs(normalizeSpec(SPECS.R02_住院入院记录, 'model'), ruleDraft(adm)).agree, true)
  assert.equal(compareSpecs(normalizeSpec({ ...SPECS.R02_住院入院记录, recordType: '检验' }, 'model'), ruleDraft(adm)).agree, false)
})

async function waitDone(svc, id) {
  for (let i = 0; i < 400; i++) {
    const { run } = await svc.status(id)
    if (run && run.status !== 'running') return run
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error('timeout')
}

test('批次：识别新格式（两模型一致自动采用）→ 事件包；格式库复用；分歧暂扣与人工确认', async () => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'event-rec-')))
  const input = join(base, 'cohort')
  await writeFormatB(join(input, '证件-AAA111'), 1)
  await writeFormatB(join(input, '证件-BBB222'), 2)
  // 兄弟插件写在输入里的输出目录：不能当病人、不能当表
  await mkdir(join(input, '_medical-hl7', 'bulk'), { recursive: true })
  await writeFile(join(input, '_medical-hl7', 'bulk', 'Patient.ndjson'), JSON.stringify({ resourceType: 'Patient', id: 'p1' }) + '\n')
  await writeFile(join(input, '_medical-hl7', 'bulk', 'Encounter.ndjson'), JSON.stringify({ resourceType: 'Encounter', id: 'e1' }) + '\n')
  await writeFile(join(input, '_medical-hl7', 'bulk', 'Observation.ndjson'), JSON.stringify({ resourceType: 'Observation', id: 'o1' }) + '\n')
  const a = mockFormatModel('fmt-a'); const b = mockFormatModel('fmt-b', { wrong: { R05_住院医嘱记录: { recordType: '处方', roles: { item: 'F_ORDER' } } } })
  const svc = createService({
    config: { outputRoot: join(base, 'out') }, defaultDirectory: base, stateDir: join(base, 'state'),
    chatImpl: { format: { suggest: a, verify: b } },
  })
  const { runId } = await svc.start({ inputDir: input })
  const run = await waitDone(svc, runId)
  assert.ok(['completed', 'review'].includes(run.status), run.error)
  assert.equal(run.format.kind, 'recognized')
  const st = Object.fromEntries(run.recognition.tables.map((t) => [t.table, t.status]))
  assert.equal(st.R01_挂号登记, 'agreed')
  assert.equal(st.R02_住院入院记录, 'agreed')
  assert.equal(st.R05_住院医嘱记录, 'disputed') // 两模型对类别有分歧：暂扣
  assert.equal(st.R06_费用结算, 'agreed')
  assert.ok(run.warnings.some((w) => /1 张表待确认/.test(w)))
  assert.equal(run.totals.patients, 2)
  assert.ok(!run.recognition.tables.some((t) => /Patient|Encounter|Observation/.test(t.table)), '兄弟插件的输出不当输入')
  assert.ok(run.totals.mentions > 0 && run.totals.events > 0)
  const p = run.patients.find((x) => x.patient === '证件-AAA111')
  assert.deepEqual(p.failedGates, [])  // 同一药品两条医嘱（不同日期）合成一段用药暴露，不算“两条结构化记录合成一个事件”
  const frs = gunzipSyncLines(join(run.output, '证件-AAA111', 'fragments.jsonl.gz'))
  assert.equal(new Set(frs.map((f) => f.id)).size, frs.length, '片段编号唯一')
  // 交付的事件包：入院记录栏目、门诊嵌入文书、检验
  const pkg = join(run.output, '证件-AAA111')
  const manifest = JSON.parse(await readFile(join(pkg, 'manifest.json'), 'utf8'))
  assert.equal(manifest.format, 'event-package/0')
  assert.ok(manifest.rulepacks.some((r) => r.id === 'recognized'))
  const { gunzipSync } = await import('node:zlib')
  const mentions = gunzipSync(await readFile(join(pkg, 'mentions.jsonl.gz'))).toString('utf8').trim().split('\n').map((l) => JSON.parse(l))
  const sec = (rt) => new Set(mentions.filter((m) => m.recordType === rt).map((m) => m.section))
  assert.ok(sec('入院记录').has('主诉') && sec('入院记录').has('现病史') && sec('入院记录').has('初步诊断'))
  assert.ok(sec('门诊病历').has('主诉') && sec('门诊病历').has('现病史'))
  const leaked = mentions.filter((m) => m.kind === '文书' && /化名-1A2B3C|^内科$/.test(m.text))
  assert.deepEqual(leaked.map((m) => `${m.section}:${m.text}`), [], '文书表头（科室、姓名）不抽提及')
  const cc = mentions.find((m) => m.recordType === '入院记录' && m.section === '主诉' && /胸闷3年/.test(m.text))
  assert.match(cc?.occurFrom ?? '', /^20(19|20)-/, '主诉时长换算到发病时间')
  assert.ok(mentions.some((m) => m.recordType === '检验' && /血红蛋白 98/.test(m.text)))
  // 第二次：同签名直接复用，不再问模型
  const asked = a.asked.length
  const r2 = await waitDone(svc, (await svc.start({ inputDir: input })).runId)
  assert.equal(a.asked.length, asked)
  assert.equal(r2.recognition.tables.find((t) => t.table === 'R05_住院医嘱记录').status, 'disputed')
  // 人工确认分歧表（采用建议模型的草稿）→ 再跑：医嘱进入用药
  const f = await svc.formats(r2.id)
  const order = f.entries.find((e) => e.table === 'R05_住院医嘱记录')
  assert.ok(order.drafts.model && order.drafts.verify)
  await assert.rejects(svc.decideFormat({ signature: order.signature, action: 'confirm', spec: { ...SPECS.R05_住院医嘱记录, written: ['F_ORDER'] } }), /不是时间/)
  await svc.decideFormat({ signature: order.signature, action: 'confirm', use: 'model' })
  const r3 = await waitDone(svc, (await svc.start({ inputDir: input })).runId)
  assert.equal(r3.recognition.tables.find((t) => t.table === 'R05_住院医嘱记录').status, 'confirmed')
  assert.ok(!r3.warnings.some((w) => /待确认/.test(w)))
  for (const x of r3.patients) assert.deepEqual(x.failedGates, [], `${x.patient} 验收门`)
  const drug = (await readFile(join(r3.output, '证件-AAA111', 'exports', 'drug_exposure.csv'), 'utf8'))
  assert.match(drug, /阿司匹林/)
})

test('没配模型：只有规则草稿，全部暂扣、不交付；输入不是数据文件时开批次就报错', async () => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'event-rec-')))
  const input = join(base, 'one')
  await writeFormatB(input, 1)
  const svc = createService({ config: { outputRoot: join(base, 'out') }, defaultDirectory: base, stateDir: join(base, 'state') })
  const run = await waitDone(svc, (await svc.start({ inputDir: input })).runId)
  assert.equal(run.status, 'review')
  assert.equal(run.output, undefined)
  assert.ok(run.recognition.tables.every((t) => t.status === 'pending'))
  assert.equal(run.patients.length, 0)
  const empty = join(base, 'empty'); await mkdir(empty); await writeFile(join(empty, 'readme.pdf'), 'x')
  await assert.rejects(svc.start({ inputDir: empty }), /没有能读的数据文件/)
  assert.deepEqual((await readdir(join(base, 'out'))).filter((x) => x !== '_records'), [])
})

test('栏目默认时间晚于写成（如检查日期晚于报告日期）：按写成日封顶并写明，不让验收门①失败', async () => {
  const { extractMentions, checkGate1 } = await import('../lib/engine/s02-mentions.js')
  const { buildSourcePack } = await import('../lib/recognize/build.js')
  const pack = buildSourcePack([{ signature: 'abcdef0123456789', table: 'X', spec: { recordType: '检查报告', written: ['W'], occur: ['O'], key: [], roles: {}, sections: [['F', '所见']], origin: 'model' } }])
  const f = { id: 'f1', recordType: '检查报告', kind: '文书', field: '全文', text: '所见：双肺纹理增多。', visibleAt: '2023-05-01 10:00', occurAt: '2023-05-02 09:00', encounterId: null }
  const { mentions } = extractMentions({ fragments: [f], encounters: [], person: {} }, pack, {})
  assert.ok(mentions.length)
  assert.equal(mentions[0].occurTo, '2023-05-01')
  assert.match(mentions[0].timeSource, /晚于写成，按写成日/)
  assert.deepEqual(checkGate1(mentions, [f]), [])
})

test('换一批病人（同一张表字段略有出入）：沿用识别结果与人工裁定，不重问模型', async () => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'event-rec-')))
  const input = join(base, 'cohort')
  await writeFormatB(join(input, '证件-AAA111'), 1)
  await writeFormatB(join(input, '证件-BBB222'), 2)
  // 第二位病人的入院记录多一个（空的）字段：两人一起时表的字段集合与只看第一人时不同
  const f2 = join(input, '证件-BBB222', '病历', 'R02_住院入院记录.json')
  const rows = JSON.parse(await readFile(f2, 'utf8')); rows[0].F_EXTRA = ''; await writeFile(f2, JSON.stringify(rows))
  const a = mockFormatModel('fmt-a'); const b = mockFormatModel('fmt-b', { wrong: { R05_住院医嘱记录: { recordType: '处方', roles: { item: 'F_ORDER' } } } })
  const svc = createService({ config: { outputRoot: join(base, 'out') }, defaultDirectory: base, stateDir: join(base, 'state'), chatImpl: { format: { suggest: a, verify: b } } })
  const r1 = await waitDone(svc, (await svc.start({ inputDir: join(input, '证件-AAA111') })).runId)
  const order1 = (await svc.formats(r1.id)).entries.find((e) => e.table === 'R05_住院医嘱记录')
  assert.equal(order1.status, 'disputed')
  await svc.decideFormat({ signature: order1.signature, action: 'confirm', use: 'model' })
  const asked = a.asked.length
  const r2 = await waitDone(svc, (await svc.start({ inputDir: input })).runId)
  const adm = r2.recognition.tables.find((t) => t.table === 'R02_住院入院记录')
  const adm1 = r1.recognition.tables.find((t) => t.table === 'R02_住院入院记录')
  assert.notEqual(adm.signature, adm1.signature, '字段集合不同，签名不同')
  assert.equal(adm.status, 'agreed')
  assert.equal(r2.recognition.tables.find((t) => t.table === 'R05_住院医嘱记录').status, 'confirmed', '人工裁定沿用')
  assert.equal(a.asked.length, asked, '没有重问模型')
  const f = await svc.formats(r2.id)
  assert.equal(f.entries.length, r2.recognition.tables.length, '页面上每张表都查得到格式库条目')
})
