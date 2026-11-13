/**
 * Read one patient's export into `{ tables: { <tableId>: [{ row, file, index }] }, unknown: [file…] }`.
 * The only file-reading part of the engine besides the package writer.
 *
 * Two ways a table spec finds its files:
 *   file: 'p_doc_x.json'          exact file name (hand-written source packs, e.g. zj-regional)
 *   match: { table: '<tableKey>' }  recognised formats: any data file whose table key matches
 *                                   (json / ndjson / csv / tsv / xlsx; see recognize/read.js)
 * Fields listed in `decode` are embedded documents (base64 XML/HTML): they are
 * decoded to text here, so every later offset refers to the decoded text.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, basename } from 'node:path'
import { DATA_EXT, readDataFile, tableKeyOf, decodeEmbedded, looksBase64 } from '../recognize/read.js'

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('._') || entry.name.startsWith('~$')) continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) await walk(p, out)
    else if (entry.isFile()) out.push(p)
  }
  return out
}

function decodeRow(row, fields) {
  let out = row
  for (const f of fields) {
    const v = row[f]
    if (typeof v !== 'string' || !(looksBase64(v) || /^\s*</.test(v))) continue
    const d = decodeEmbedded(v)
    out = out === row ? { ...row } : out
    out[f] = d ? d.text : '' // 解不开的二进制内容（压缩包、PDF…）不当文字
  }
  return out
}

export async function readPatient(dir, sourcePack) {
  const byFile = new Map(sourcePack.tables.filter((t) => t.file).map((t) => [t.file, t]))
  const byTable = new Map(sourcePack.tables.filter((t) => t.match?.table).map((t) => [t.match.table, t]))
  const tables = Object.fromEntries(sourcePack.tables.map((t) => [t.id, []]))
  const unknown = []
  const files = (await walk(dir)).sort()
  for (const file of files) {
    const rel = relative(dir, file)
    const spec = byFile.get(basename(file))
    if (spec) {
      const data = JSON.parse(await readFile(file, 'utf8'))
      const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [data]
      rows.forEach((row, index) => { if (row && typeof row === 'object') tables[spec.id].push({ row, file: rel, index }) })
      continue
    }
    if (!byTable.size || !DATA_EXT.test(file) || !byTable.has(tableKeyOf(file)) && !/\.xlsx?$/i.test(file)) {
      if (file.endsWith('.json')) unknown.push(rel)
      continue
    }
    for (const { table, rows } of await readDataFile(file)) {
      const t = byTable.get(table)
      if (!t) continue
      rows.forEach((row, index) => { if (row && typeof row === 'object') tables[t.id].push({ row: t.decode?.length ? decodeRow(row, t.decode) : row, file: rel, index }) })
    }
  }
  return { tables, unknown }
}
