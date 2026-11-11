import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFictionalPatient } from './fixtures/fictional.mjs'
import { runPatient } from '../lib/engine/pipeline.js'
import { loadRulepack } from '../lib/rulepack/load.js'

const pack = await loadRulepack()
const dir = await writeFictionalPatient(await mkdtemp(join(tmpdir(), 'event-fx-')))
const r = await runPatient(dir, pack)
const T = r.tables
const mention = (re) => T.mentions.filter((m) => re.test(m.text))

test('四道验收门全部通过', () => {
  for (const g of ['①', '②', '③', '④']) assert.equal(r.summary.gates[g].pass, true, g)
})

test('S01：作废记录剔除、第二版入院记录、签名诊断段、计费周期、HTML 实体', () => {
  assert.equal(r.summary.droppedInvalid.outpatient, 1)
  const adm = T.fragments.filter((f) => f.table === 'admission')
  assert.equal(adm.filter((f) => f.field === '正文').length, 3)
  const v2 = adm.find((f) => f.version === 2)
  assert.ok(v2, '第二版入院记录')
  assert.equal(v2.visibleBasis.startsWith('同次住院第2版入院记录'), true)
  assert.equal(v2.anchorAt, '2020-01-27 13:53')
  const signed = adm.find((f) => f.field === '补充诊断')
  assert.equal(signed.visibleAt, '2017-11-28 23:59')
  assert.equal(T.encounters.find((e) => e.number === '住院-BILL').kind, '计费周期')
  assert.equal(T.encounters.find((e) => e.number === '住院-A').kind, '住院')
  assert.ok(T.fragments.some((f) => f.text.includes('2.90×10^12/L')))
  assert.equal(new Set(T.fragments.map((f) => f.id)).size, T.fragments.length, '片段编号唯一')
})

test('S02：时间来源与换算', () => {
  const qi = mention(/^3天前无明显诱因下出现气急$/)[0]
  assert.deepEqual([qi.occurFrom, qi.timeSource], ['2017-11-22', '本句自带：相对写成日'])
  const night = mention(/^夜间不能平卧$/)[0]
  assert.equal(night.timeSource, '同句继承')
  const ds = mention(/^于2017\.11\.24行血液透析治疗$/)[0]
  assert.equal(ds.occurFrom, '2017-11-24')
  const freq = mention(/^一周三次$/)[0]
  assert.notEqual(freq.timeSource, '本句自带：病程时长（起点）', '频次不是病程')
  const meno = mention(/岁绝经/)[0]
  assert.deepEqual([meno.occurFrom, meno.occurTo], ['1996-01-20', '1997-01-19'])
  const vit = mention(/^脉搏88次\/分$/)
  assert.equal(vit.length, 1, '查体模板按英文逗号逐项')
  const v2exam = T.mentions.find((m) => m.text === '脉搏80次/分' && m.writtenAt.startsWith('2020-04-18'))
  assert.equal(v2exam.occurFrom, '2020-01-27', '第二版入院记录的查体按文内记录时间')
  assert.ok(T.mentions.some((m) => m.scope === '否认' && m.text.startsWith('冠心病')), '顿号拆分与修饰继承')
})

test('S03：类型', () => {
  assert.equal(mention(/暂停华法林$/)[0].rules.classify, 'K3')
  assert.equal(mention(/暂停华法林$/)[0].action, '停止')
  assert.equal(mention(/^无胸痛$/)[0].subclass, '症状阴性')
  assert.equal(mention(/拟“慢性肾脏病5期”收治入院/)[0].subclass, '收治入院')
  assert.equal(mention(/^脉搏88次\/分$/)[0].item, '体征与查体')
})

test('S04：结构化对齐、一次性、用药片段', () => {
  const ev = (id) => T.events.find((e) => e.id === id)
  const docCr = mention(/肌酐 892μmol\/L/).find((m) => m.kind === '文书')
  assert.equal(ev(docCr.eventId).mergeRule, '结构化对齐')
  const start = T.events.find((e) => e.concept === '开始维持性透析')
  assert.equal(start.form, '一次性')
  assert.ok(start.mentionCount >= 2)
  const dx = T.events.filter((e) => e.concept === '慢性肾脏病5期' && e.form === '状态')
  assert.equal(dx.length, 1)
})

test('S05：时间矛盾、复制漂移、换药、证据不足、转述误差、改判、版本冲突、候选同义', () => {
  const v = (verdict, sub) => T.findings.filter((f) => f.verdict === verdict && f.subclass === sub)
  const startConflict = v('矛盾', '时间矛盾').find((f) => /开始维持性透析/.test(f.why))
  assert.ok(startConflict)
  assert.match(startConflict.adopt, /^2017-11/, '采信同期记载')
  assert.equal(v('记录质量', '复制漂移').length, 1)
  assert.equal(v('调整', '换药').length, 1)
  assert.ok(v('证据不足', '停用后仍记在用').length + v('证据不足', '用药矛盾（待定）').length >= 1)
  assert.equal(v('记录质量', '转述误差').length, 1)
  assert.equal(v('改判', '改判候选').length, 1)
  assert.equal(v('矛盾', '版本冲突').length, 1)
  assert.equal(v('命名不一致', '候选同义').length, 1)
  for (const f of T.findings) assert.ok(f.sides.some((s) => s.mentions.length), '每条发现可回溯')
})

test('稳定编号：重跑结果完全一致', async () => {
  const again = await runPatient(dir, pack)
  assert.deepEqual(again.tables.mentions.map((m) => m.id), T.mentions.map((m) => m.id))
  assert.deepEqual(again.tables.events.map((e) => e.id).sort(), T.events.map((e) => e.id).sort())
  assert.deepEqual(again.tables.findings.map((f) => f.id).sort(), T.findings.map((f) => f.id).sort())
})

test('as-of：截至 2018 年只看得到当时写成的东西，派生结论重算', async () => {
  const cut = '2018-01-01 00:00'
  const early = await runPatient(dir, pack, { asOf: cut })
  assert.ok(early.tables.mentions.length > 0)
  assert.ok(early.tables.mentions.every((m) => m.writtenAt <= cut))
  assert.ok(!early.tables.findings.some((f) => /开始维持性透析/.test(f.why)), '2020 年的转述截至 2018 不可见，没有时间矛盾')
  const unchanged = early.tables.mentions.filter((m) => T.mentions.some((x) => x.id === m.id))
  assert.equal(unchanged.length, early.tables.mentions.length, '截断前写成的提及编号不变')
})
