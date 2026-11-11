#!/usr/bin/env node
/**
 * 命令行：对一位病人的导出目录跑引擎，结果写到输出目录（不要写进仓库）。
 *
 *   node scripts/run.mjs <病人导出目录> <输出目录> [--until S01|S02|S03|S04|S05] [--as-of "YYYY-MM-DD HH:mm"]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { runPatient } from '../lib/engine/pipeline.js'
import { loadRulepack } from '../lib/rulepack/load.js'

const args = process.argv.slice(2)
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined }
const until = flag('--until') ?? 'S05'
const asOf = flag('--as-of')
const [input, output] = args
if (!input || !output) {
  console.error('usage: node scripts/run.mjs <patientDir> <outDir> [--until S0x] [--as-of "YYYY-MM-DD HH:mm"]')
  process.exit(1)
}
if (resolve(output).startsWith(resolve(new URL('..', import.meta.url).pathname))) {
  console.error('输出目录不能在仓库里（真实病历派生内容不进仓库）')
  process.exit(1)
}

const pack = await loadRulepack()
const t0 = Date.now()
const result = await runPatient(input, pack, { until, asOf })
await mkdir(output, { recursive: true })
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')
for (const [name, rows] of Object.entries(result.tables)) await writeFile(join(output, `${name}.jsonl`), jsonl(rows))
await writeFile(join(output, 'summary.json'), JSON.stringify(result.summary, null, 2))
console.log(JSON.stringify(result.summary, null, 2))
console.log(`用时 ${((Date.now() - t0) / 1000).toFixed(1)}s → ${output}`)
