/**
 * 工作线程：执行数据块任务，完成后回报结果。每个线程自己开记录库连接（WAL）。
 *
 *   → { type: 'task', task } / { type: 'cancel' }
 *   ← { type: 'ready' } / { type: 'progress', patients } / { type: 'patient', patient, stage } / { type: 'done', id, result } / { type: 'error', id, error }
 */
import { parentPort, workerData } from 'node:worker_threads'
import { openRecords } from '../records/store.js'
import { processShard } from './shard.js'

let cancelled = false
let store = null

parentPort.on('message', async (msg) => {
  if (msg.type === 'cancel') { cancelled = true; return }
  if (msg.type !== 'task') return
  const { task } = msg
  try {
    store ??= await openRecords(workerData.recordsDir, { legacy: false })
    const result = await processShard(task, {
      store, modelGate: workerData.modelGate, isCancelled: () => cancelled,
      onProgress: (n) => parentPort.postMessage({ type: 'progress', patients: n }),
      onPatient: (patient, stage) => parentPort.postMessage({ type: 'patient', shard: task.shard, patient, stage }),
    })
    parentPort.postMessage({ type: 'done', id: task.id, result })
  } catch (error) {
    parentPort.postMessage({ type: 'error', id: task.id, error: String(error?.stack ?? error) })
  }
})
parentPort.postMessage({ type: 'ready' })
