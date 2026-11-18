import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normMap, locate, memoryStore, judgeUnits, sampled, SYSTEM } from '../lib/engine/read.js'
import { parseCategory, deriveSubclass } from '../lib/engine/taxonomy.js'
import { writeFictionalPatient } from './fixtures/fictional.mjs'
import { readPatient } from '../lib/engine/source.js'
import { runStages } from '../lib/engine/pipeline.js'
import { loadRulepack } from '../lib/rulepack/load.js'
import { fakeModels } from './helpers.mjs'

test('定位：空白、假名、全半角标点都容忍，位置回到原文', () => {
  const text = '家住地址-ABCDEF，  脉搏74次/分,血压172/81mmHg（入院时）'
  const nm = normMap(text)
  const a = locate(text, '家住＊', nm)
  assert.equal(text.slice(a.s, a.e), '家住地址-ABCDEF')
  const b = locate(text, '脉搏74次/分，血压172/81mmHg', nm)
  assert.equal(text.slice(b.s, b.e), '脉搏74次/分,血压172/81mmHg')
  assert.equal(locate(text, '心率80次/分', nm), null)
})

test('分类：代码、细项名、斜杠括号差异都能认；推出子类', () => {
  assert.equal(parseCategory('J02').it, '既往诊断（转述）')
  assert.equal(parseCategory('既往诊断(转述)').code, 'J02')
  assert.equal(parseCategory('影像/心电/超声').code, 'F04')
  assert.equal(parseCategory('胡说'), null)
  assert.equal(deriveSubclass({ t: '事实', sd: '患者状态', it: '体征与查体' }, { text: '血压172/81mmHg' }), '体征')
  assert.equal(deriveSubclass({ t: '事实', sd: '患者状态', it: '症状与病情', neg: 1 }), '症状阴性')
  assert.equal(deriveSubclass({ t: '决策', sd: '治疗干预', it: '药物', act: '停止' }), '方案调整')
})

const askOf = (counter) => async (role, llm, prompt) => {
  counter[role] = (counter[role] ?? 0) + 1
  const r = await llm.chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }])
  return r.content
}

async function patient() {
  const pack = await loadRulepack()
  const dir = await writeFictionalPatient(await mkdtemp(join(tmpdir(), 'read-fx-')))
  return { pack, raw: await readPatient(dir, pack.source) }
}

test('通读：一致采用、分歧复查（甲改口）、缓存可复跑、质检通过', async () => {
  const { pack, raw } = await patient()
  const store = memoryStore()
  const calls = {}
  const llm = { models: fakeModels(), ask: askOf(calls), store, sampleRate: 1, maxRounds: 3, width: 2 }
  const r = await runStages(raw, pack, { llm })
  for (const g of ['①', '②', '③', '④']) assert.equal(r.summary.gates[g].pass, true, g)
  const docs = r.tables.mentions.filter((m) => m.kind === '文书' && m.rules.extract === 'model')
  assert.ok(docs.length > 50)
  const neg = docs.find((m) => m.text === '无胸痛')
  assert.equal(neg.by.type, '复查第1轮')
  assert.equal(neg.subdivision, '患者状态')
  assert.equal(neg.item, '症状与病情')
  assert.equal(neg.subclass, '症状阴性')
  assert.ok(r.summary.read.tally['分类']['双模型一致'] > 0)
  assert.ok(r.summary.read.agreement['分类'].n > r.summary.read.agreement['分类'].agree, '复查前一致率按分歧算')
  assert.ok(r.reviews.some((x) => x.resolved?.by === '复查第1轮'))
  assert.ok(r.reviews.every((x) => x.occurrences.length > 0))
  assert.ok(r.baseline.length > 0, '规则基线保留')
  assert.ok(r.summary.read.ruleCompare.matched > 0)
  // 重跑：全部命中缓存，结果一致
  const before = JSON.stringify(calls)
  const r2 = await runStages(raw, pack, { llm: { ...llm, ask: askOf(calls) } })
  assert.equal(JSON.stringify(calls), before, '重跑不再调用模型')
  assert.deepEqual(r2.tables.mentions.map((m) => m.id), r.tables.mentions.map((m) => m.id))
})

test('复查仍不一致：model 模式转人工；人工判断按稳定编号沿用', async () => {
  const { pack, raw } = await patient()
  const store = memoryStore()
  const llm = { models: fakeModels({ stubborn: true }), ask: askOf({}), store, sampleRate: 1, maxRounds: 2, width: 2, mode: 'model' }
  const r = await runStages(raw, pack, { llm })
  const open = r.reviews.filter((x) => !x.resolved)
  assert.ok(open.length > 0)
  assert.equal(open[0].rounds.length, 2, '两轮都没改口')
  const neg = r.tables.mentions.find((m) => m.text === '无胸痛')
  assert.equal(neg.by.type, '待人工')
  assert.equal(neg.item, '体征与查体', '待人工时先按甲')
  const item = open.find((x) => x.dispute === '分类' && /无胸痛/.test(x.aText))
  const decisions = new Map([[`review\u0000${item.id}`, { decision: 'useVerify' }]])
  const r2 = await runStages(raw, pack, { llm, decisions })
  const neg2 = r2.tables.mentions.find((m) => m.text === '无胸痛')
  assert.equal(neg2.by.type, '人工')
  assert.equal(neg2.item, '症状与病情')
})

test('抽样核验按句子内容稳定；同一句跨文书只问一次', async () => {
  assert.equal(sampled('abc', 1), true)
  assert.equal(sampled('abc', 0), false)
  assert.equal(sampled('abc', 0.3), sampled('abc', 0.3))
  const mk = (id, text) => ({ fragment: { id, recordType: '门诊病历', text }, sec: { name: '现病史', cfg: { time: 'outpatient' } }, s: 0, e: text.length, text, prev: null, sentence: 1, key: `k-${text}` })
  const units = [mk('G1', '无胸痛，咳嗽'), mk('G2', '无胸痛，咳嗽'), mk('G3', '发热')]
  const calls = {}
  const r = await judgeUnits(units, { models: { a: fakeModels().a, b: null }, ask: askOf(calls), store: memoryStore(), width: 2 })
  assert.equal(r.stats.unique, 2)
  assert.equal(calls.a, 1)
  assert.equal(r.stats.sampled, 0)
})

test('人工：去掉、改类型、补漏提', async () => {
  const { pack, raw } = await patient()
  const llm = { models: fakeModels(), ask: askOf({}), store: memoryStore(), sampleRate: 0, width: 2 }
  const r = await runStages(raw, pack, { llm })
  const m = r.tables.mentions.find((x) => x.text === '无胸痛')
  const other = r.tables.mentions.find((x) => x.kind === '文书' && x.text !== '无胸痛' && x.rules.extract === 'model')
  const f = r.tables.fragments.find((x) => x.id === m.fragmentId)
  const decisions = new Map([
    [`mention\u0000${m.id}`, { decision: 'reject' }],
    [`mention\u0000${other.id}`, { decision: 'correct', value: { code: 'J01', neg: 0 } }],
    ['add\u0000X', { decision: 'add', value: { fragmentId: f.id, s: m.s, e: m.s + 2, text: f.text.slice(m.s, m.s + 2), code: 'F03', neg: 1 } }],
  ])
  const r2 = await runStages(raw, pack, { llm, decisions })
  assert.equal(r2.tables.mentions.some((x) => x.id === m.id), false)
  const o2 = r2.tables.mentions.find((x) => x.id === other.id)
  assert.equal(o2.type, '判断'); assert.equal(o2.by.type, '人工')
  assert.ok(r2.tables.mentions.some((x) => x.rules.extract === 'manual'))
  assert.equal(r2.summary.read.manual.added, 1)
})
