import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, stat, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openRecords, RECORDS_FILE, SCHEMA_VERSION } from '../lib/records/store.js'

const tmp = () => mkdtemp(join(tmpdir(), 'event-records-'))
const fakeRun = (id, startedAt, extra = {}) => ({ id, status: 'completed', startedAt, finishedAt: null, input: '/in/x', inputName: 'x', outputRoot: '/out', runDir: `/out/_records/runs/${id}`, patients: [], totals: { patients: 2, findings: 5, review: 1 }, ...extra })

test('记录库：缓存跨批次共用，调用流水按批次分开', async () => {
  const dir = await tmp()
  const rec = await openRecords(dir)
  assert.equal(rec.kind, 'sqlite')
  await stat(join(dir, RECORDS_FILE))
  const a = rec.forRun('R1')
  await a.cachePut('k1', 'm', '回复一')
  await a.cachePut('k1', 'm', '不会覆盖')
  await a.logCall({ at: '2026-01-01T00:00:00Z', patient: '病人A', kind: 'type', role: 'suggest', model: 'm', ok: true, ms: 12, usage: { prompt_tokens: 3, completion_tokens: 4 } })
  const b = rec.forRun('R2')
  assert.equal(await b.cacheGet('k1'), '回复一')
  await b.logCall({ patient: '病人A', kind: 'type', role: 'suggest', model: 'm', cached: true })
  const c1 = await rec.calls('R1')
  assert.equal(c1.length, 1)
  assert.deepEqual(c1[0].usage, { prompt_tokens: 3, completion_tokens: 4 })
  assert.equal(c1[0].ok, true)
  const c2 = await rec.calls('R2')
  assert.equal(c2.length, 1)
  assert.equal(c2[0].cached, true)
  rec.close()
  // 关闭后在途写入被忽略，不抛错
  await a.logCall({ kind: 'x' })
  assert.equal(await a.cacheGet('k1'), undefined)

  const again = await openRecords(dir)
  assert.equal(await again.forRun('R3').cacheGet('k1'), '回复一', '重开后缓存仍在')
  again.close()
})

test('记录库：批次存取与列表（新的在前）', async () => {
  const rec = await openRecords(await tmp())
  await rec.saveRun(fakeRun('A', '2026-01-01T00:00:00Z'))
  await rec.saveRun(fakeRun('B', '2026-01-02T00:00:00Z', { status: 'running' }))
  await rec.saveRun(fakeRun('B', '2026-01-02T00:00:00Z', { status: 'review', patients: [{ patient: 'p1' }] }))
  assert.deepEqual((await rec.listRuns()).map((r) => [r.id, r.status]), [['B', 'review'], ['A', 'completed']])
  assert.deepEqual((await rec.listRuns())[0], { id: 'B', status: 'review', startedAt: '2026-01-02T00:00:00Z', finishedAt: null, input: 'x', patients: 2, findings: 5, review: 1 })
  assert.equal((await rec.loadRun('B')).patients[0].patient, 'p1')
  assert.equal(await rec.loadRun('nope'), null)
  rec.close()
})

test('记录库：人工裁定存当前值，改动全部留痕', async () => {
  const rec = await openRecords(await tmp())
  await rec.saveDecision('findings', 'F-1', { decision: '矛盾', note: '一' }, 'R1')
  await rec.saveDecision('findings', 'F-1', { decision: '证据不足', note: '二' }, 'R2')
  await rec.saveDecision('mapping', 'a→b', { decision: '同意' }, 'R2')
  let d = await rec.loadDecisions()
  assert.equal(d.findings['F-1'].decision, '证据不足')
  assert.equal(d.mapping['a→b'].decision, '同意')
  assert.deepEqual(d.concepts, {})
  await rec.saveDecision('findings', 'F-1', null, 'R3')
  d = await rec.loadDecisions()
  assert.equal(d.findings['F-1'], undefined)
  assert.deepEqual((await rec.decisionHistory('findings', 'F-1')).map((x) => [x.action, x.decision, x.runId]), [['set', '矛盾', 'R1'], ['set', '证据不足', 'R2'], ['clear', null, 'R3']])
  rec.close()
})

test('记录库：第一次打开时并入旧布局文件，原文件不动', async () => {
  const dir = await tmp()
  const runDir = join(dir, 'runs', 'OLD')
  await mkdir(runDir, { recursive: true })
  await writeFile(join(runDir, 'run.json'), JSON.stringify(fakeRun('OLD', '2025-12-01T00:00:00Z')))
  await writeFile(join(runDir, 'model-cache.jsonl'), `${JSON.stringify({ key: 'old', content: '旧回复' })}\n`)
  await writeFile(join(runDir, 'calls.jsonl'), `${JSON.stringify({ kind: 'type', role: 'suggest', model: 'm', ok: true })}\n`)
  const decisionsText = JSON.stringify({ findings: { 'F-9': { decision: '矛盾', note: '旧', by: 'user', at: '2025-12-02T00:00:00Z' } }, mentions: {}, concepts: {} })
  await writeFile(join(dir, 'decisions.json'), decisionsText)

  const rec = await openRecords(dir)
  assert.equal((await rec.loadRun('OLD')).id, 'OLD')
  assert.deepEqual((await rec.listRuns()).map((r) => r.id), ['OLD'])
  assert.equal(await rec.forRun('NEW').cacheGet('old'), '旧回复')
  assert.equal((await rec.calls('OLD')).length, 1)
  assert.equal((await rec.loadDecisions()).findings['F-9'].decision, '矛盾')
  assert.equal((await rec.decisionHistory('findings', 'F-9'))[0].action, 'import')
  // 新裁定只进库，旧文件保持原样
  await rec.saveDecision('findings', 'F-9', { decision: '证据不足' })
  assert.equal(await readFile(join(dir, 'decisions.json'), 'utf8'), decisionsText)
  rec.close()

  // 只并入一次：重开不重复导入
  const again = await openRecords(dir)
  assert.equal((await again.calls('OLD')).length, 1)
  assert.equal((await again.loadDecisions()).findings['F-9'].decision, '证据不足')
  again.close()
})

test('记录库：库版本比插件新时拒绝打开', async () => {
  const dir = await tmp()
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(join(dir, RECORDS_FILE))
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`)
  db.close()
  await assert.rejects(openRecords(dir), /比本插件新/)
})

test('记录库：只读打开时不重建已删除的目录', async () => {
  const dir = join(await tmp(), 'gone', '_records')
  assert.equal(await openRecords(dir, { create: false }), null)
  await assert.rejects(stat(dir))
})

test('记录库：没有 node:sqlite 时退回旧布局文件', async () => {
  const dir = await tmp()
  const rec = await openRecords(dir, { sqlite: false })
  assert.equal(rec.kind, 'jsonl')
  const r = rec.forRun('R1')
  await r.cachePut('k', 'm', 'v')
  await r.logCall({ kind: 'type', ok: true })
  await r.logCall({ kind: 'type', cached: true })
  await stat(join(dir, 'runs', 'R1', 'model-cache.jsonl'))
  assert.equal((await rec.calls('R1')).length, 1)
  assert.equal(await rec.forRun('R1').cacheGet('k'), 'v')
  await rec.saveRun(fakeRun('R1', '2026-01-01T00:00:00Z'))
  await stat(join(dir, 'runs', 'R1', 'run.json'))
  assert.deepEqual((await rec.listRuns()).map((x) => x.id), ['R1'])
  await rec.saveDecision('findings', 'F-1', { decision: '矛盾' })
  assert.equal(JSON.parse(await readFile(join(dir, 'decisions.json'), 'utf8')).findings['F-1'].decision, '矛盾')
  assert.equal((await rec.loadDecisions()).findings['F-1'].decision, '矛盾')
})
