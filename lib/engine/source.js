/**
 * Read one patient's platform export (a directory tree of monthly JSON files)
 * into `{ tables: { <tableId>: [{ row, file }] }, unknown: [file…] }`.
 * The only file-reading part of the engine besides the package writer.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, basename } from 'node:path'

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('._')) continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) await walk(p, out)
    else if (entry.isFile()) out.push(p)
  }
  return out
}

export async function readPatient(dir, sourcePack) {
  const byFile = new Map(sourcePack.tables.map((t) => [t.file, t]))
  const tables = Object.fromEntries(sourcePack.tables.map((t) => [t.id, []]))
  const unknown = []
  const files = (await walk(dir)).sort()
  for (const file of files) {
    const spec = byFile.get(basename(file))
    const rel = relative(dir, file)
    if (!spec) { if (file.endsWith('.json')) unknown.push(rel); continue }
    const data = JSON.parse(await readFile(file, 'utf8'))
    const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [data]
    for (const row of rows) if (row && typeof row === 'object') tables[spec.id].push({ row, file: rel })
  }
  return { tables, unknown }
}
