import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openRecords, SCHEMA_VERSION } from '../lib/records/store.js'

const fresh = async () => join(await mkdtemp(join(tmpdir(), 'event-rec-db-')), '_records')

test('记录库：缓存跨批次共用；调用统计按批次累计，失败调用另记原因', async () => {
  const r = await openRecords(await fresh())
  r.cachePut('k1', 'm', 'v1', 'run-a')
  assert.equal(r.cacheGet('k1'), 'v1')
  assert.equal(r.cacheGet('nope'), null)
  r.logCall('run-a', { role: 'read', model: 'm', ok: true, ms: 10, usage: { prompt_tokens: 5, completion_tokens: 2 } })
  r.logCall('run-a', { role: 'read', model: 'm', cached: true })
  r.logCall('run-a', { role: 'verify', model: 'n', ok: false, error: 'boom' })
  r.logCall('run-b', { role: 'read', model: 'm', ok: true, ms: 1 })
  r.flushStats()
  const a = Object.fromEntries(r.callStats('run-a').map((x) => [x.role, x]))
  assert.equal(a.read.calls, 1); assert.equal(a.read.cached, 1); assert.equal(a.read.prompt_tokens, 5)
  assert.equal(a.verify.failed, 1)
  assert.equal(r.callErrors('run-a')[0].error, 'boom')
  assert.equal(r.callStats('run-b').length, 1)
  r.close()
})

test('记录库：批次、数据块存取；删批次不动判断与缓存', async () => {
  const r = await openRecords(await fresh())
  r.putRun({ id: 'b', status: 'running', startedAt: '2026-01-02', inputName: 'x', totals: { patients: 2 } })
  r.putRun({ id: 'a', status: 'completed', startedAt: '2026-01-01', inputName: 'x', totals: {} })
  assert.deepEqual(r.listRuns().map((x) => x.id), ['b', 'a'])
  r.putShard('b', { shard: 0, status: 'done', patients: 2, stats: { patients: [{ patient: 'p1' }] } })
  assert.equal(r.shards('b')[0].stats.patients[0].patient, 'p1')
  r.decide({ kind: 'review', target: 'R-1', decision: 'confirm', runId: 'b' })
  r.cachePut('k', 'm', 'v')
  r.deleteRun('b')
  assert.equal(r.getRun('b'), null)
  assert.equal(r.shards('b').length, 0)
  assert.equal(r.decisions().size, 1)
  assert.equal(r.cacheGet('k'), 'v')
  r.close()
})

test('记录库：人工判断存当前值（带值），改动全部留痕', async () => {
  const r = await openRecords(await fresh())
  r.decide({ kind: 'mention', target: 'M-1', decision: 'correct', value: { code: 'F03' }, note: '改类型' })
  r.decide({ kind: 'mention', target: 'M-1', decision: 'reject' })
  assert.equal(r.decisions().get('mention\u0000M-1').decision, 'reject')
  r.decide({ kind: 'mention', target: 'M-1', decision: 'clear' })
  assert.equal(r.decisions().size, 0)
  const h = r.decisionHistory('mention', 'M-1')
  assert.deepEqual(h.map((x) => x.action), ['set', 'set', 'clear'])
  assert.deepEqual(h[0].value, { code: 'F03' })
  r.close()
})

test('记录库：第一次打开时并入旧布局文件，原文件不动', async () => {
  const dir = await fresh()
  await mkdir(join(dir, 'runs', 'old1'), { recursive: true })
  await writeFile(join(dir, 'runs', 'old1', 'run.json'), JSON.stringify({ id: 'old1', status: 'completed', startedAt: '2025-01-01', inputName: 'x', totals: { patients: 1 } }))
  await writeFile(join(dir, 'runs', 'old1', 'model-cache.jsonl'), JSON.stringify({ key: 'ck', content: 'cv' }) + '\n')
  await writeFile(join(dir, 'runs', 'old1', 'calls.jsonl'), JSON.stringify({ role: 'suggest', model: 'm', ok: true, ms: 3 }) + '\n')
  await writeFile(join(dir, 'decisions.json'), JSON.stringify({ findings: { 'F-1': { decision: '确认', at: '2025-01-02' } } }))
  const before = await readFile(join(dir, 'decisions.json'), 'utf8')
  const r = await openRecords(dir)
  assert.equal(r.getRun('old1').status, 'completed')
  assert.equal(r.cacheGet('ck'), 'cv')
  assert.equal(r.callStats('old1')[0].calls, 1, '旧批次的逐条流水汇总成统计')
  assert.equal(r.decisions().get('findings\u0000F-1').decision, '确认')
  assert.equal(await readFile(join(dir, 'decisions.json'), 'utf8'), before)
  r.close()
})

test('记录库：库版本比插件新时拒绝打开', async () => {
  const dir = await fresh()
  const r = await openRecords(dir)
  r.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`)
  r.close()
  await assert.rejects(openRecords(dir), /比本插件新/)
})

test('记录库：只读打开时不重建已删除的目录', async () => {
  const dir = await fresh()
  assert.equal(await openRecords(dir, { create: false }), null)
  await assert.rejects(stat(dir))
  await rm(dir, { recursive: true, force: true })
})
