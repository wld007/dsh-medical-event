import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, stat, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFictionalPatient } from './fixtures/fictional.mjs'
import { createService, findPatients } from '../lib/service.js'
import { fakeModels, extractJsonForTest } from './helpers.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitDone(svc, id) {
  for (let i = 0; i < 400; i++) {
    const { run } = await svc.status(id)
    if (run && run.status !== 'running') return run
    await sleep(25)
  }
  throw new Error('timeout')
}
async function cohort(name = 'event-svc-') {
  const base = await realpath(await mkdtemp(join(tmpdir(), name)))
  const input = join(base, 'cohort')
  await writeFictionalPatient(join(input, '病人A'))
  await writeFictionalPatient(join(input, '病人B'))
  return { base, input }
}

test('批次：两位病人、通读＋核验＋复查、交付到 output/<输入名>、源文件只读、报告', async () => {
  const { base, input } = await cohort()
  assert.deepEqual((await findPatients(input)).map((p) => p.split('/').pop()), ['病人A', '病人B'])
  const before = await stat(join(input, '病人A', '人口信息学/病史/190001/p_doc_dwd_psn_rcd.json'))
  const models = fakeModels({ stubborn: true })
  const svc = createService({ config: { outputRoot: join(base, 'out'), xlsx: true, verifySampleRate: 1, shardUnits: 1 }, defaultDirectory: base, stateDir: join(base, 'state'), chatImpl: models })
  const { runId } = await svc.start({ inputDir: input })
  const run = await waitDone(svc, runId)
  assert.equal(run.status, 'review', run.error)
  assert.equal(run.totals.patients, 2)
  assert.equal(run.shards.total, 2)
  assert.equal(run.output, join(base, 'out', 'output', 'cohort'))
  assert.deepEqual((await readdir(run.output)).sort(), ['_cohort', '病人A', '病人B'])
  for (const f of ['patients.csv', 'drug_exposure.csv', 'labs_long.csv', 'findings.csv']) await stat(join(run.output, '_cohort', f))
  const manifest = JSON.parse(await readFile(join(run.output, '病人A', 'manifest.json'), 'utf8'))
  assert.equal(manifest.format, 'event-package/1')
  assert.equal(manifest.read.mode, 'hybrid')
  for (const g of ['①', '②', '③', '④']) assert.equal(manifest.gates[g].pass, true)
  for (const f of ['exports/drug_exposure.csv', 'exports/labs_long.csv', 'exports/结果.xlsx', 'events.jsonl.gz', 'mentions.jsonl.gz', 'findings.jsonl', 'links.jsonl', 'reviews.jsonl']) await stat(join(run.output, '病人A', f))
  assert.equal(run.sourceCheck.changed, 0)
  assert.equal((await stat(join(input, '病人A', '人口信息学/病史/190001/p_doc_dwd_psn_rcd.json'))).mtimeMs, before.mtimeMs)
  // 质检⑤：核验一致率（复查前）
  const g5 = run.gates.find((g) => g.id === '⑤')
  assert.ok(g5 && !g5.skipped)
  assert.ok(run.totals.agreement['分类'].n > 0 && run.totals.disputes > 0)
  assert.ok(run.totals.byRule + run.totals.human > 0)
  assert.match((await svc.report(runId)).markdown, /通读与核验/)
  // 模型调用：按用途统计；第二位病人内容相同，全部命中第一位的缓存（同一句只问一次）
  const c = await svc.calls(runId)
  const roles = Object.fromEntries(c.byModel.map((x) => [x.role, x]))
  assert.ok(roles.read.calls > 0 && roles.verify.calls > 0 && roles['review-read'].calls > 0)
  // 复核单：同一句在两位病人里只列一次
  const q = await svc.reviewQueue(runId, { kind: 'mention', status: 'todo' })
  assert.ok(q.total > 0)
  assert.ok(q.items.every((x) => x.patients.length === 2))
  // 文件页、病人页、逐份核对
  const files = await svc.files(runId)
  assert.equal(files.total, 2); assert.ok(files.items.every((x) => x.status === 'done'))
  const docs = (await svc.documents(runId, '病人A')).documents
  const withTodo = docs.find((d) => d.todo > 0)
  assert.ok(withTodo)
  const view = await svc.fragment(runId, '病人A', withTodo.id)
  assert.ok(view.reviews.length && view.mentions.length)

  // 人工判断 → 更新事件包（不调模型）→ 待判断清零后批次转完成
  const items = (await svc.reviewQueue(runId, { status: 'todo', limit: 1000 })).items
  const callsBefore = JSON.stringify((await svc.calls(runId)).byModel)
  for (const it of items) await svc.decide(runId, { kind: it.kind === 'mention' ? 'review' : it.kind, target: it.id, decision: it.kind === 'mention' ? 'useVerify' : it.kind === 'mapping' ? 'confirm' : '确认' })
  assert.equal((await svc.status(runId)).run.humanReview.dirty, true)
  const applied = await svc.applyDecisions(runId)
  assert.equal(applied.todo, 0)
  assert.equal(applied.status, 'completed')
  assert.equal(JSON.stringify((await svc.calls(runId)).byModel), callsBefore, '更新事件包不调模型')
  const ms = await svc.patientData(runId, '病人A', ['mentions'])
  assert.ok(ms.mentions.some((m) => m.by?.type === '人工'))

  // 重跑：判断按稳定编号沿用，模型全部命中缓存
  const r2 = await waitDone(svc, (await svc.start({ inputDir: input })).runId)
  assert.equal(r2.status, 'completed')
  assert.equal(r2.output, run.output, '同一输入重跑以最新结果替换')
  const c2 = await svc.calls(r2.id)
  assert.ok(c2.byModel.every((x) => x.calls === 0), JSON.stringify(c2.byModel))
  // 新开一个服务（相当于重启 DSH）：从记录库读回批次
  const svc2 = createService({ config: { outputRoot: join(base, 'out') }, defaultDirectory: base, stateDir: join(base, 'state') })
  assert.equal((await svc2.list()).runs.length, 2)
  // 清空批次记录：保留判断和缓存，可选删交付
  const cl = await svc2.clearRuns({ deliverable: true })
  assert.equal(cl.removed, 2); assert.equal(cl.outputsRemoved, 1)
  await assert.rejects(stat(run.output))
  await svc2.dispose(); await svc.dispose()
})

test('取消后继续：沿用已完成的数据块，只处理剩下的', async () => {
  const { base, input } = await cohort('event-resume-')
  const slow = fakeModels()
  const a = { model: slow.a.model, chat: async (m, o) => { await sleep(5); return slow.a.chat(m, o) } }
  const svc = createService({ config: { outputRoot: join(base, 'out'), shardUnits: 1, verifySampleRate: 0 }, defaultDirectory: base, stateDir: join(base, 'state'), chatImpl: { a, b: null } })
  const { runId } = await svc.start({ inputDir: input })
  for (let i = 0; i < 400 && (await svc.status(runId)).run.shards.done < 1; i++) await sleep(10)
  svc.cancel(runId)
  const r1 = await waitDone(svc, runId)
  assert.equal(r1.status, 'cancelled')
  assert.equal(r1.output, null)
  const r2 = await waitDone(svc, (await svc.start({ resumeFrom: runId })).runId)
  assert.equal(r2.status === 'completed' || r2.status === 'review', true, r2.error)
  assert.equal(r2.resumedFrom, runId)
  assert.equal(r2.patients.length, 2)
  assert.ok(r2.gates.find((g) => g.id === '⑤').skipped)
  await stat(join(r2.output, '病人A', 'manifest.json'))
  await svc.dispose()
})

test('输出根目录不能与输入相同或包含输入；没配模型不能开始', async () => {
  const base = await mkdtemp(join(tmpdir(), 'event-guard-'))
  await writeFictionalPatient(join(base, 'in'))
  const svc = createService({ defaultDirectory: base, chatImpl: fakeModels() })
  await assert.rejects(svc.start({ inputDir: join(base, 'in'), outputRoot: join(base, 'in') }), /不能与输入相同/)
  await assert.rejects(svc.start({ inputDir: join(base, 'in'), outputRoot: base }), /不能包含输入/)
  await assert.rejects(createService({ defaultDirectory: base }).start({ inputDir: join(base, 'in') }), /没有配置通读模型/)
})

test('模型回复里取 JSON', () => {
  assert.deepEqual(extractJsonForTest('<think>x</think>好的```json\n{"items":[1]}\n```'), { items: [1] })
})
