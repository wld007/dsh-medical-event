import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, stat, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFictionalPatient } from './fixtures/fictional.mjs'
import { createService, findPatients } from '../lib/service.js'
import { validate, extractJsonForTest } from './helpers.mjs'

/** Mock models: answer from the items embedded at the end of the prompt. */
function mockModel(name, { findingVerdict = (it) => it.verdict, badQuote = false } = {}) {
  return {
    model: name,
    async chat(messages) {
      const prompt = messages.at(-1).content
      const items = JSON.parse(prompt.slice(prompt.lastIndexOf('\n[') + 1))
      const answers = items.map((it, i) => {
        if (prompt.includes('暂时沿用了上一句的时间')) return { id: it.id, answer: 'written', reason: 'mock' }
        if (prompt.includes('规则没能定类型')) return { id: it.id, type: '事实', quote: badQuote && i === 0 ? '原文里没有的字' : it.text.slice(0, 2), reason: 'mock' }
        if (prompt.includes('没能归一到词表')) return { id: it.id, concept: '', reason: 'mock' }
        return { id: it.id, verdict: findingVerdict(it), cites: [it.sides[0].mentions[0].id], reason: 'mock' }
      })
      return { content: '```json\n' + JSON.stringify({ items: answers }) + '\n```', ms: 1, usage: null }
    },
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitDone(svc, id) {
  for (let i = 0; i < 200; i++) {
    const { run } = await svc.status(id)
    if (run && run.status !== 'running') return run
    await sleep(25)
  }
  throw new Error('timeout')
}

test('批次：两位病人、交付布局、源文件只读、报告、裁定沿用、模型建议', async () => {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'event-svc-')))
  const input = join(base, 'cohort')
  await writeFictionalPatient(join(input, '病人A'))
  await writeFictionalPatient(join(input, '病人B'))
  assert.deepEqual((await findPatients(input)).map((p) => p.split('/').pop()), ['病人A', '病人B'])
  const before = await stat(join(input, '病人A', '人口信息学/病史/190001/p_doc_dwd_psn_rcd.json'))

  const svc = createService({
    config: { outputRoot: join(base, 'out') }, defaultDirectory: base, stateDir: join(base, 'state'),
    chatImpl: { suggest: mockModel('mock-a', { badQuote: true }), verify: mockModel('mock-b', { findingVerdict: () => '证据不足' }) },
  })
  const { runId } = await svc.start({ inputDir: input })
  const run = await waitDone(svc, runId)
  assert.ok(['completed', 'review'].includes(run.status), run.error)
  assert.equal(run.totals.patients, 2)
  assert.equal(run.output, join(base, 'out', 'cohort'))
  const delivered = await readdir(run.output)
  assert.deepEqual(delivered.sort(), ['病人A', '病人B'])
  const manifest = JSON.parse(await readFile(join(run.output, '病人A', 'manifest.json'), 'utf8'))
  assert.equal(manifest.format, 'event-package/0')
  for (const g of ['①', '②', '③', '④']) assert.equal(manifest.gates[g].pass, true)
  for (const f of ['exports/drug_exposure.csv', 'exports/labs_long.csv', 'exports/extraction_samples.jsonl', 'events.jsonl', 'findings.jsonl']) await stat(join(run.output, '病人A', f))
  assert.equal(run.sourceCheck.changed, 0)
  const after = await stat(join(input, '病人A', '人口信息学/病史/190001/p_doc_dwd_psn_rcd.json'))
  assert.equal(after.mtimeMs, before.mtimeMs)
  assert.match((await svc.report(runId)).markdown, /病历事件还原报告/)

  // 模型建议：核验一致 → 候选；分歧 → 复核；引用核对失败 → 丢弃
  const d = await svc.patientData(runId, '病人A', ['manifest', 'findings', 'suggestions'])
  const sg = d.suggestions
  assert.ok(sg.some((s) => s.kind === 'finding' && s.outcome === 'review'), '两模型判定分歧进复核')
  assert.ok(sg.some((s) => s.kind === 'type' && s.outcome === 'discarded' && /引用不在原文/.test(s.suggestProblem)), '引用核对失败丢弃')
  assert.ok(sg.some((s) => s.kind === 'type' && s.outcome === 'candidate'), '两模型一致成为候选')
  assert.ok(run.totals.modelCalls > 0)

  // 裁定：按稳定编号存，重跑沿用
  const target = d.findings.find((f) => f.certainty === '需人工确认')
  await svc.decide(runId, { id: target.id, decision: '证据不足', note: '测试' })
  const again = await svc.start({ inputDir: input })
  const run2 = await waitDone(svc, again.runId)
  assert.equal(run2.output, join(base, 'out', 'cohort (2)'), '同一输入再跑一次加序号')
  const d2 = await svc.patientData(again.runId, '病人A', ['findings'])
  assert.equal(d2.findings.find((f) => f.id === target.id).review.decision, '证据不足')
  const list = await svc.list()
  assert.equal(list.runs.length, 2)
})

test('输出根目录不能与输入相同或包含输入', async () => {
  const base = await mkdtemp(join(tmpdir(), 'event-guard-'))
  await writeFictionalPatient(join(base, 'in'))
  const svc = createService({ defaultDirectory: base })
  await assert.rejects(svc.start({ inputDir: join(base, 'in'), outputRoot: join(base, 'in') }), /不能与输入相同/)
  await assert.rejects(svc.start({ inputDir: join(base, 'in'), outputRoot: base }), /不能包含输入/)
})

test('模型回答校验', () => {
  const item = { id: 'M-1', text: '予利尿治疗', context: '1周前出现气急。予利尿治疗', written: '2021-06-10' }
  assert.equal(validate('time', item, { id: 'M-1', answer: 'phrase', quote: '1周前', from: '2021-06-03', to: '2021-06-03' }).ok, true)
  assert.equal(validate('time', item, { id: 'M-1', answer: 'phrase', quote: '2周前', from: '2021-05-27', to: '2021-05-27' }).ok, false)
  assert.equal(validate('time', item, { id: 'M-1', answer: 'phrase', quote: '1周前', from: '2021-06-03', to: '2021-06-20' }).ok, false)
  assert.equal(validate('type', item, { id: 'M-1', type: '决策', quote: '予' }).ok, true)
  assert.equal(validate('type', item, { id: 'M-1', type: '诊断', quote: '予' }).ok, false)
  const f = { id: 'F-1', sides: [{ mentions: [{ id: 'M-a' }] }, { mentions: [{ id: 'M-b' }] }] }
  assert.equal(validate('finding', f, { id: 'F-1', verdict: '矛盾', cites: ['M-a'] }).ok, true)
  assert.equal(validate('finding', f, { id: 'F-1', verdict: '矛盾', cites: ['M-z'] }).ok, false)
  assert.deepEqual(extractJsonForTest('<think>x</think>好的```json\n{"items":[1]}\n```'), { items: [1] })
})
