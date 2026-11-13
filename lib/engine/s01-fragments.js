/**
 * S01 读入·片段：记录 → 片段（带可见时间与依据）＋ 就诊容器 ＋ 人口信息。
 *
 * Fragment:
 *   { id, table, recordType, kind: '文书'|'结构化', recordKey, field, paragraph,
 *     text, visibleAt, visibleBasis, occurAt, encounterId, meta, file }
 * Text is normalised only for line endings (\r\n, \r → \n); every later
 * offset refers to this text.
 */
import { fragmentId, stableId } from './ids.js'
import { parseInstant, pad } from './time.js'

const present = (v) => v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null'
const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' }
export function decodeEntities(s) {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);?/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}
let DECODE = false
const normText = (s) => {
  const t = String(s).replace(/\r\n?/g, '\n')
  return DECODE ? decodeEntities(t) : t
}

function recordKey(spec, r) {
  // 没有主键字段的表（识别出的格式常见）：用文件内行号
  if (!spec.key?.length) return `#${r.index ?? 0}`
  return spec.key.map((k) => String(r.row[k] ?? '')).join('|')
}

/**
 * The same primary key can appear in two monthly files with different
 * content (e.g. 同次住院第2版入院记录). The first occurrence keeps the bare
 * key; later ones get `@<file>` so fragment ids stay unique and stable.
 */
function uniqueKey(spec, r, seen) {
  const base = recordKey(spec, r)
  const k = `${spec.id}\u0000${base}`
  if (!seen.has(k)) { seen.add(k); return base }
  // 第二次出现：加文件名；同一文件里又重复（主键不唯一）：再加行号
  const withFile = `${base}@${r.file}`
  const k2 = `${spec.id}\u0000${withFile}`
  if (!seen.has(k2)) { seen.add(k2); return withFile }
  return `${withFile}#${r.index ?? 0}`
}

function instant(raw, ctx) {
  return parseInstant(raw, { utcOffsetMinutes: ctx.tz })
}

function firstInstant(row, fields, ctx) {
  for (const f of fields ?? []) {
    const t = present(row[f]) ? instant(row[f], ctx) : null
    if (t) return { at: t, field: f }
  }
  return null
}

function coded(spec, field, value) {
  const map = spec.codes?.[field]
  if (map && present(value) && map[String(value)] != null) return map[String(value)]
  return value
}

function fieldValue(spec, row, expr, ctx) {
  // expr: A|B|C  (first present), optional :day formatter
  const [names, fmt] = expr.split(':')
  for (const name of names.split('|')) {
    const v = row[name]
    if (!present(v)) continue
    if (fmt === 'day') return (instant(v, ctx) ?? String(v)).slice(0, 10)
    return String(coded(spec, name, v)).trim()
  }
  return ''
}

/**
 * Template: `{A|B}` first present value; `{A:day}` as day; `{A?prefix}` prefix+value
 * only when A is present.
 */
export function renderTemplate(spec, row, template, ctx) {
  return template.replace(/\{([^}]+)\}/g, (_, inner) => {
    const q = inner.indexOf('?')
    if (q >= 0) {
      const v = fieldValue(spec, row, inner.slice(0, q), ctx)
      return v ? inner.slice(q + 1) + v : ''
    }
    return fieldValue(spec, row, inner, ctx)
  }).replace(/｜(?=｜|$)/g, '').trim()
}

/** “3.5-5.5”, “3.5～5.5”, “<5”, “≤10”, “>60” → { lo, hi } or null. */
export function parseRange(ref) {
  if (!present(ref)) return null
  const s = String(ref).replace(/\s/g, '')
  let m = s.match(/^(-?\d+(?:\.\d+)?)[-~～—至](-?\d+(?:\.\d+)?)$/)
  if (m) return { lo: +m[1], hi: +m[2] }
  m = s.match(/^[<≤＜](=?)(\d+(?:\.\d+)?)$/)
  if (m) return { lo: null, hi: +m[2] }
  m = s.match(/^[>≥＞](=?)(\d+(?:\.\d+)?)$/)
  if (m) return { lo: +m[2], hi: null }
  return null
}

function labArrow(value, ref) {
  const r = parseRange(ref)
  const v = Number(String(value).trim())
  if (!r || !Number.isFinite(v) || !/^-?\d+(\.\d+)?$/.test(String(value).trim())) return ''
  if (r.hi != null && v > r.hi) return '↑'
  if (r.lo != null && v < r.lo) return '↓'
  return ''
}

function pick(row, fields) {
  for (const f of [].concat(fields ?? [])) if (present(row[f])) return String(row[f]).trim()
  return ''
}

function renderLab(spec, row) {
  const m = spec.meta
  const item = pick(row, m.item)
  const value = pick(row, m.value)
  const unit = pick(row, m.unit)
  const ref = pick(row, m.ref)
  const arrow = labArrow(value, ref)
  const text = `${item} ${value}${unit ? ' ' + unit : ''}${ref ? '（' + ref + '）' : ''}${arrow}`
  return { text, meta: { item, value, unit, ref, flag: arrow, panel: pick(row, m.panel), specimen: pick(row, m.specimen), report: pick(row, m.report) } }
}

function meta(spec, row) {
  if (!spec.meta) return undefined
  const out = {}
  for (const [k, f] of Object.entries(spec.meta)) {
    const v = pick(row, f)
    if (v) out[k] = String(coded(spec, [].concat(f)[0], v))
  }
  return out
}

function visibleOf(spec, row, ctx) {
  const v = spec.visible
  if (v.static) return { at: v.static, basis: v.basis }
  if (v.min) {
    const ts = v.min.map((f) => (present(row[f]) ? instant(row[f], ctx) : null)).filter(Boolean).sort()
    return ts.length ? { at: ts[0], basis: v.basis } : null
  }
  if (v.join) {
    const key = row[v.join.on]
    const hit = present(key) ? ctx.joinIndex(v.join.table, v.join.on, key, v.join.field) : null
    if (hit) return { at: hit, basis: v.basis }
    const fb = firstInstant(row, v.fallback, ctx)
    return fb ? { at: fb.at, basis: `${v.basis}（缺，取${fb.field}）` } : null
  }
  const f = firstInstant(row, v.first, ctx)
  if (!f) return null
  return { at: f.at, basis: f.field === v.first[0] ? v.basis : `${v.basis}（缺，取${f.field}）` }
}

/* ------------------------------------------------------------ encounters */

function buildEncounters(tables, pack, ctx) {
  const enc = new Map() // key `I:<no>` / `O:<no>` → encounter
  const get = (k, init) => { if (!enc.has(k)) enc.set(k, { id: stableId('V', k), ...init, sources: [] }); return enc.get(k) }
  const pseudo = pack.pseudoInpatient?.dept
  for (const t of pack.tables) {
    if (!t.encounter) continue
    for (const { row } of tables[t.id] ?? []) {
      const e = t.encounter
      const inNo = e.inpatient && present(row[e.inpatient]) ? String(row[e.inpatient]) : null
      const outNo = e.outpatient && present(row[e.outpatient]) ? String(row[e.outpatient]) : null
      const role = e.role ?? (t.id === 'admission' ? 'admission' : t.id === 'visit' ? 'visit' : null)
      if (role === 'admission' && inNo) {
        const x = get(`I:${inNo}`, { kind: '住院', number: inNo })
        x.kind = '住院'; x.hasAdmissionRecord = true
        const a = present(row[e.admit]) ? instant(row[e.admit], ctx) : null
        const d = present(row[e.discharge]) ? instant(row[e.discharge], ctx) : null
        if (a && (!x.start || a < x.start)) x.start = a
        if (d && (!x.end || d > x.end)) x.end = d
        x.sources.push(t.id)
      } else if (role === 'visit') {
        const dept = pick(row, e.dept)
        const settingField = e.setting ?? 'VST_TP'
        const raw = row[settingField]
        // 没有门诊／住院类别字段时：有住院号算住院
        const type = present(raw) ? coded(t, settingField, raw) : inNo ? '住院' : '门诊'
        if (type === '住院' && inNo) {
          const x = get(`I:${inNo}`, { kind: '住院', number: inNo })
          if (!x.hasAdmissionRecord && pseudo && pseudo.test(dept)) x.kind = '计费周期'
          const a = present(row[e.admit]) ? instant(row[e.admit], ctx) : null
          const d = present(row[e.discharge]) ? instant(row[e.discharge], ctx) : null
          if (a && (!x.start || a < x.start)) x.start = a
          if (d && (!x.end || d > x.end)) x.end = d
          x.dept ||= dept
          x.sources.push(t.id)
        } else if (outNo || (inNo && type !== '住院')) {
          const no = outNo ?? inNo
          const x = get(`O:${no}`, { kind: type === '体检' ? '体检' : '门诊', number: no })
          const at = firstInstant(row, t.occur, ctx)?.at
          if (at && (!x.start || at < x.start)) { x.start = at; x.end = at }
          x.dept ||= dept
          x.sources.push(t.id)
        }
      }
    }
  }
  // An inpatient number seen only on a visit row with a pseudo dept stays 计费周期;
  // one with an admission record is a real stay.
  return [...enc.values()].map((x) => ({ ...x, sources: [...new Set(x.sources)] }))
}

/* ------------------------------------------------------------- splitter */

function splitAdmission(spec, rows, ctx, out) {
  const cfg = spec.admission
  // second versions: same inpatient number, later creation time
  const byStay = new Map()
  for (const r of rows) {
    const no = String(r.row[spec.encounter.inpatient] ?? '')
    if (!byStay.has(no)) byStay.set(no, [])
    byStay.get(no).push(r)
  }
  for (const [, group] of byStay) {
    group.sort((a, b) => String(instant(a.row.CRT_TM, ctx)).localeCompare(String(instant(b.row.CRT_TM, ctx))))
    group.forEach((r, version) => {
      const row = r.row
      const text = normText(row[spec.textField] ?? '')
      if (!text.trim()) return
      const key = uniqueKey(spec, r, ctx.seenKeys)
      const blocks = []
      cfg.signedBlock.lastIndex = 0
      for (let m; (m = cfg.signedBlock.exec(text));) blocks.push({ name: m[1], start: m.index + (m[0].startsWith('\n') ? 1 : 0) })
      const bodyEnd = blocks.length ? blocks[0].start : text.length
      const tm = text.match(cfg.recordTime)
      const textTime = tm ? `${tm[1]}-${pad(tm[2])}-${pad(tm[3])} ${pad(tm[4])}:${pad(tm[5])}` : null
      const created = instant(row.CRT_TM, ctx)
      let visibleAt; let basis
      if (version > 0) { visibleAt = created; basis = `${cfg.secondVersionBasis}（文内记录时间${textTime ?? '缺'}）` }
      else if (textTime) { visibleAt = textTime; basis = '文内记录时间' }
      else { visibleAt = created; basis = '创建时间（缺文内记录时间）' }
      const body = frag(spec, key, '正文', 0, text.slice(0, bodyEnd), visibleAt, basis, null, r, ctx)
      // 叙述锚点：相对时间以文内记录时间为起点（第二版入院记录也一样）
      body.anchorAt = textTime ?? visibleAt
      if (version > 0) body.version = version + 1
      out.push(body)
      const counts = {}
      blocks.forEach((b, i) => {
        const end = i + 1 < blocks.length ? blocks[i + 1].start : text.length
        const body = text.slice(b.start, end)
        const sd = body.match(cfg.signDate)
        counts[b.name] = (counts[b.name] ?? 0) + 1
        const at = sd ? `${sd[1]} 23:59` : visibleAt
        out.push(frag(spec, key, b.name, counts[b.name], body, at, sd ? cfg.signDateBasis : `${basis}（段内无签名日期）`, null, r, ctx))
      })
    })
  }
}

function frag(spec, key, field, paragraph, text, visibleAt, visibleBasis, occurAt, r, ctx, extra) {
  const row = r.row
  const e = spec.encounter ?? {}
  const inNo = e.inpatient && present(row[e.inpatient]) ? String(row[e.inpatient]) : null
  const outNo = e.outpatient && present(row[e.outpatient]) ? String(row[e.outpatient]) : null
  return {
    id: fragmentId(spec.id, key, field, paragraph),
    table: spec.id,
    recordType: spec.recordType,
    kind: spec.kind,
    recordKey: key,
    field,
    paragraph,
    text,
    visibleAt,
    visibleBasis,
    occurAt: occurAt ?? null,
    encounterKey: inNo ? `I:${inNo}` : outNo ? `O:${outNo}` : null,
    meta: extra ?? meta(spec, row),
    file: r.file,
  }
}

/* ----------------------------------------------------------------- main */

export function buildFragments({ tables }, pack) {
  const ctx = { tz: pack.timezoneOffsetMinutes ?? 480, seenKeys: new Set() }
  DECODE = Boolean(pack.decodeEntities)
  const invalid = pack.invalid
  const isInvalid = (row, t) => {
    const inv = t.invalid ?? invalid
    return Boolean(inv) && present(row[inv.field]) && inv.values.includes(String(row[inv.field]))
  }
  const kept = {}
  const dropped = {}
  for (const t of pack.tables) {
    kept[t.id] = []
    for (const r of tables[t.id] ?? []) {
      if (isInvalid(r.row, t)) { dropped[t.id] = (dropped[t.id] ?? 0) + 1; continue }
      kept[t.id].push(r)
    }
  }
  // join index: table → on → value → earliest instant of field
  const joinCache = new Map()
  ctx.joinIndex = (tableId, on, value, field) => {
    const k = `${tableId}\u0000${on}\u0000${field}`
    if (!joinCache.has(k)) {
      const m = new Map()
      for (const { row } of kept[tableId] ?? []) {
        if (!present(row[on])) continue
        const t = present(row[field]) ? instant(row[field], ctx) : null
        const key = String(row[on])
        if (t && (!m.has(key) || t < m.get(key))) m.set(key, t)
      }
      joinCache.set(k, m)
    }
    return joinCache.get(k).get(String(value)) ?? null
  }

  const fragments = []
  const problems = []
  for (const spec of pack.tables) {
    const rows = kept[spec.id]
    if (spec.splitter === 'admission') { splitAdmission(spec, rows, ctx, fragments); continue }
    for (const r of rows) {
      const row = r.row
      const key = uniqueKey(spec, r, ctx.seenKeys)
      const vis = visibleOf(spec, row, ctx)
      if (!vis) { problems.push({ table: spec.id, recordKey: key, problem: '无可见时间' }); continue }
      const occur = firstInstant(row, spec.occur, ctx)?.at ?? null
      if (spec.kind === '结构化' && spec.measures) {
        // 宽表（一行多项测量，如生命体征）：每项一个片段
        for (const [f, label, unit] of spec.measures) {
          if (!present(row[f])) continue
          const v = String(row[f]).trim()
          fragments.push(frag(spec, key, label, 0, normText(`${label} ${v}${unit ? ' ' + unit : ''}`), vis.at, vis.basis, occur, r, ctx, { item: label, value: v, unit: unit ?? '' }))
        }
      } else if (spec.kind === '结构化') {
        let text; let m
        if (spec.render?.lab) ({ text, meta: m } = renderLab(spec, row))
        else text = renderTemplate(spec, row, spec.render.template, ctx)
        if (!text.trim()) continue
        const field = spec.render?.lab ? (m?.item || '检验') : spec.recordType
        fragments.push(frag(spec, key, field, 0, normText(text), vis.at, vis.basis, occur, r, ctx, m))
      } else if (spec.split === 'perField') {
        for (const [f, label] of spec.fields) {
          if (!present(row[f])) continue
          fragments.push(frag(spec, key, label, 0, normText(row[f]), vis.at, vis.basis, occur, r, ctx))
        }
      } else {
        const parts = (spec.fields ?? []).filter(([f]) => present(row[f])).map(([f, label]) => `${label}：${normText(row[f]).trim()}`)
        // 整篇文书字段（嵌入文档、带栏目标题的长文本）：原样接在后面，靠文内标题切栏目
        for (const f of spec.wholeFields ?? []) if (present(row[f])) parts.push(normText(row[f]).trim())
        if (!parts.length) continue
        fragments.push(frag(spec, key, '全文', 0, parts.join('\n'), vis.at, vis.basis, occur, r, ctx))
      }
    }
  }

  // person
  const personSpec = pack.tables.find((t) => t.person)
  const prow = personSpec ? kept[personSpec.id]?.[0]?.row : null
  const person = prow ? {
    birth: present(prow[personSpec.person.birth]) ? instant(prow[personSpec.person.birth], ctx)?.slice(0, 10) ?? null : null,
    sex: present(prow[personSpec.person.sex]) ? String(prow[personSpec.person.sex]) : null,
  } : { birth: null, sex: null }

  const encounters = buildEncounters(kept, pack, ctx)
  const encByKey = new Map(encounters.map((e) => [e.id, e]))
  for (const f of fragments) {
    f.encounterId = f.encounterKey ? stableId('V', f.encounterKey) : null
    if (f.encounterId && !encByKey.has(f.encounterId)) f.encounterId = null
    delete f.encounterKey
  }
  fragments.sort((a, b) => (a.visibleAt < b.visibleAt ? -1 : a.visibleAt > b.visibleAt ? 1 : a.id < b.id ? -1 : 1))
  return { fragments, encounters, person, dropped, problems }
}
