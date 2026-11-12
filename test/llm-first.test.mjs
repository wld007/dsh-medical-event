import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normMap, locate, createCache, judgeUnits } from '../lib/llm/first.js'
import { parseCategory, deriveSubclass } from '../lib/llm/taxonomy.js'
import { writeFictionalPatient } from './fixtures/fictional.mjs'
import { readPatient } from '../lib/engine/source.js'
import { runStages } from '../lib/engine/pipeline.js'
import { loadRulepack } from '../lib/rulepack/load.js'

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

/** 规则式的假模型：甲按逗号切；乙同意切分，但把含“无”的判成症状、甲判成查体 → 分歧，复议时两边都选乙。 */
function fakeModels() {
  const ext = (prompt) => {
    const blocks = prompt.split(/\n\n(?=\[\d+\])/).filter((b) => /^\[\d+\]/.test(b))
    return { s: blocks.map((b) => { const i = Number(b.match(/^\[(\d+)\]/)[1]); const sent = b.match(/句：(.*)/)[1]; return { i, m: sent.split(/[，,。；]/).map((q) => q.trim()).filter((q) => q.length > 1).map((q) => ({ q, c: /无/.test(q) ? 'F03' : 'F02', neg: /无/.test(q) ? 1 : 0, tr: '当时' })) } }) }
  }
  const a = { model: 'fake-a', chat: async (msgs) => {
    const p = msgs.at(-1).content
    if (p.startsWith('两位标注者')) return { content: JSON.stringify({ d: [...p.matchAll(/^\{(\d+)\}/gm)].map((m) => ({ d: Number(m[1]), pick: '乙' })) }), ms: 1 }
    return { content: JSON.stringify(ext(p)), ms: 1 }
  } }
  const b = { model: 'fake-b', chat: async (msgs) => {
    const p = msgs.at(-1).content
    if (p.startsWith('两位标注者')) return { content: JSON.stringify({ d: [...p.matchAll(/^\{(\d+)\}/gm)].map((m) => ({ d: Number(m[1]), pick: '乙' })) }), ms: 1 }
    const e = ext(p)
    return { content: JSON.stringify({ s: e.s.map((x) => ({ i: x.i, r: x.m.map((m, j) => ({ j: j + 1, ok: 1, ...m, c: /无/.test(m.q) ? 'F02' : m.c })), miss: [] })) }), ms: 1 }
  } }
  return { a, b }
}

test('模型优先流程：一致采纳、分歧复议、缓存可复跑、验收门通过', async () => {
  const pack = await loadRulepack()
  const dir = await writeFictionalPatient(await mkdtemp(join(tmpdir(), 'llm-fx-')))
  const raw = await readPatient(dir, pack.source)
  const cacheDir = await mkdtemp(join(tmpdir(), 'llm-cache-'))
  let calls = 0
  const llm = { models: fakeModels(), cache: createCache(cacheDir), width: 2, onCall: () => { calls++ } }
  const r = await runStages(raw, pack, { llm })
  for (const g of ['①', '②', '③', '④']) assert.equal(r.summary.gates[g].pass, true, g)
  const docs = r.tables.mentions.filter((m) => m.kind === '文书' && m.rules.extract === 'LLM')
  assert.ok(docs.length > 50)
  const neg = docs.find((m) => m.text === '无胸痛')
  assert.equal(neg.by.type, '经复议')
  assert.equal(neg.subdivision, '患者状态')
  assert.equal(neg.item, '症状与病情')
  assert.equal(neg.subclass, '症状阴性')
  assert.ok(r.summary.llm.tally['分类']['双模型一致'] > 0)
  assert.ok(r.baseline.length > 0, '规则基线保留')
  // 重跑：全部命中缓存，结果一致
  const before = calls
  const r2 = await runStages(raw, pack, { llm: { ...llm, cache: createCache(cacheDir) } })
  assert.equal(calls, before, '重跑不再调用模型')
  assert.deepEqual(r2.tables.mentions.map((m) => m.id), r.tables.mentions.map((m) => m.id))
})

test('同一句跨文书只问一次', async () => {
  const mk = (id, text) => ({ fragment: { id, recordType: '门诊病历', text }, sec: { name: '现病史', cfg: { time: 'outpatient' } }, s: 0, e: text.length, text, prev: null, sentence: 1, key: `k-${text}` })
  const units = [mk('G1', '无胸痛，咳嗽'), mk('G2', '无胸痛，咳嗽'), mk('G3', '发热')]
  const r = await judgeUnits(units, fakeModels(), { cache: createCache(null), width: 2 })
  assert.equal(r.stats.unique, 2)
  assert.equal(r.stats.calls.a, 1)
})
