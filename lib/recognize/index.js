/**
 * S00 格式识别：输入目录 → 每张表的识别结果 → 数据源层规则包（与病历文书提取插件同一套做法）。
 *
 *   画像（本机，按表抽样）→ 查格式库（同签名复用；同一张表字段略有出入也沿用；也读兄弟插件病历文书提取的格式库，只读）→ 没有的表起草：
 *     数据元对照表（用户提供，确定）把编码列名翻成中文名，写进画像、帮规则草稿认栏目
 *     规则草稿 ＋ 通读模型起草（校验不过修一次）
 *     第二份：核验模型背靠背再起草；没配核验模型时用规则草稿（规则拿不准的项弃权）
 *     两方一致 → agreed（自动采用）；分歧 → 两个模型轮流复查（只重判有分歧的项，至多 maxRounds 轮），
 *     一致即采用；仍不一致 → disputed；校验不过 → invalid；只有规则 → pending（都暂扣，在「格式」页确认）
 *
 * 发给模型的只有画像（字段名、中文名、统计、≤3 个截到 20 字的样例、长文本里的行首标签），假名字段不发样例，不发正文。
 * 本插件要用结构化表的全部角色（检验项目、结果……），所以兄弟插件「只在病历文书提取内采用」（scope）的条目不借。
 */
import { readFile, open } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, extname, relative, sep } from 'node:path'
import { createLlm, extractJson } from '../llm.js'
import { profileField, signatureOf } from './profile.js'
import { tableKeyOf, readDataFile, parseDelimited } from './read.js'
import { adjudicatePrompt, briefOf, ruleDraft, draftPrompt, repairPrompt, normalizeSpec, checkSpec, compareSpecs, mergeAgreed, fixSpec, sectionOfLabel, WHOLE } from './draft.js'
import { ADOPTED, HELD } from './library.js'
import { buildSourcePack } from './build.js'
import { DOCUMENT_TYPES, IGNORE, kindOf } from './canon.js'

export { ADOPTED, HELD }
export const PROMPT_VERSION = 'f1'
const FILES_PER_TABLE = 40
const ROWS_PER_TABLE = 400
const NDJSON_BYTES = 4 << 20

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 24)
const parseCsv = (text, sep) => parseDelimited(text, sep)

async function pool(items, width, fn) {
  let i = 0
  await Promise.all(Array.from({ length: Math.max(1, Math.min(width, items.length)) }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k) }
  }))
}

/** 模型：{ name, chat(messages) }；结果缓存在记录库（同步 cacheGet/cachePut），失败抛错。 */
function asker(llm, name, role, { cache, onCall, signal }) {
  return async (messages, table) => {
    const key = `fmt:${PROMPT_VERSION}:${name}:${hash(JSON.stringify(messages))}`
    const hit = cache?.cacheGet(key)
    if (hit != null) { onCall({ kind: 'format', role, model: name, patient: table, ok: true, cached: true }); return extractJson(hit) }
    const t0 = Date.now()
    try {
      const r = await llm.chat(messages, { signal, maxTokens: 3000 })
      cache?.cachePut(key, name, r.content)
      onCall({ kind: 'format', role, model: name, patient: table, ok: true, ms: r.ms ?? Date.now() - t0, usage: r.usage })
      return extractJson(r.content)
    } catch (error) {
      onCall({ kind: 'format', role, model: name, patient: table, ok: false, ms: Date.now() - t0, error: String(error?.message ?? error) })
      throw error
    }
  }
}

/* ----------------------------------------------------- 数据元对照表 */

/**
 * 读用户提供的数据元对照表：csv／tsv／xlsx／json，两列"编码、名称"（表头可有可无；多出的列忽略）。
 * 返回 Map(编码 → 中文名)。编码比较时忽略大小写与分隔符（WS05.10.133.01 ≈ WS05_10_133_01）。
 */
export async function loadElementDict(path) {
  if (!path) return null
  const ext = extname(path).toLowerCase()
  let rows = []
  if (ext === '.json') {
    const d = JSON.parse(await readFile(path, 'utf8'))
    rows = Array.isArray(d) ? d.map((x) => (Array.isArray(x) ? x : [x.code ?? x.编码 ?? x.id, x.name ?? x.名称 ?? x.label])) : Object.entries(d)
  } else if (ext === '.xlsx' || ext === '.xls') {
    const XLSX = await import('../../vendor/xlsx.mjs')
    const wb = XLSX.read(await readFile(path))
    for (const n of wb.SheetNames) rows.push(...XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false }))
  } else {
    const text = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '')
    const first = text.split('\n', 1)[0]
    rows = parseCsv(text, ext === '.tsv' || first.split('\t').length > first.split(',').length ? '\t' : ',')
  }
  const dict = new Map()
  for (const r of rows) {
    const [code, name] = [String(r[0] ?? '').trim(), String(r[1] ?? '').trim()]
    if (!code || !name || /^(编码|代码|code|标识符)$/i.test(code)) continue
    dict.set(normCode(code), name)
  }
  return dict
}
export const normCode = (s) => String(s).toUpperCase().replace(/[^0-9A-Z]/g, '')
const nameIn = (dict, field) => dict?.get(normCode(field)) ?? null

/* ----------------------------------------------------------- 画像 */

async function sampleRowsOf(file) {
  const ext = extname(file).toLowerCase()
  if (ext === '.ndjson' || ext === '.jsonl') {
    const fh = await open(file, 'r')
    try {
      const size = (await fh.stat()).size
      const buf = Buffer.alloc(Math.min(NDJSON_BYTES, size))
      await fh.read(buf, 0, buf.length, 0)
      const lines = buf.toString('utf8').split('\n'); if (buf.length < size) lines.pop()
      return [{ table: tableKeyOf(file), rows: lines.filter((l) => l.trim()).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter((r) => r && typeof r === 'object') }]
    } finally { await fh.close() }
  }
  return readDataFile(file)
}

/**
 * 按表抽样画像：每张表最多读 FILES_PER_TABLE 个文件（均匀取），共 ROWS_PER_TABLE 行。
 * 返回 [{ table, signature, files, dirs, rows, fields, errors }]（与 profile.js 同结构）。
 */
export async function profileSample(files, root) {
  const byTable = new Map()
  for (const f of files) { const k = tableKeyOf(f); if (!byTable.has(k)) byTable.set(k, []); byTable.get(k).push(f) }
  const out = []
  for (const [table, list] of byTable) {
    const step = Math.max(1, Math.floor(list.length / FILES_PER_TABLE))
    const pick = list.filter((_, i) => i % step === 0).slice(0, FILES_PER_TABLE)
    const t = { table, files: list.length, dirs: new Set(), rows: 0, sample: [], names: new Set(), errors: [] }
    for (const file of pick) {
      for (const { rows, error, plain } of await sampleRowsOf(file)) {
        if (plain) t.plain = true
        if (error) t.errors.push(error)
        t.rows += rows.length
        t.dirs.add(relative(root, dirname(file)).split(sep)[0] || '.')
        for (const r of rows) for (const k of Object.keys(r)) t.names.add(k)
        const room = ROWS_PER_TABLE - t.sample.length
        if (room > 0) t.sample.push(...rows.slice(0, Math.max(10, Math.ceil(room / 4))).slice(0, room))
      }
    }
    out.push({
      table, signature: signatureOf(table, t.names), plain: Boolean(t.plain), files: list.length, dirs: [...t.dirs].slice(0, 5), rows: t.rows, errors: t.errors.slice(0, 3),
      fields: [...t.names].map((name) => profileField(name, t.sample.map((r) => r[name]))),
    })
  }
  return out.sort((a, b) => a.table.localeCompare(b.table))
}

/** 画像简介 ＋ 对照表里的中文名（字段名是编码时最有用）。 */
function briefWithNames(t, dict) {
  const b = briefOf(t)
  if (dict) for (const f of b.字段) { const n = nameIn(dict, f.字段); if (n) f.中文名 = n }
  return b
}

/** 规则草稿 ＋ 对照表：中文名能对上标准栏目的长文本字段记为栏目。 */
function ruleDraftWithDict(t, dict) {
  const spec = ruleDraft(t)
  if (!dict || !spec.recordType || kindOf(spec.recordType) !== '文书') return spec
  const def = DOCUMENT_TYPES[spec.recordType]
  const taken = new Set(spec.sections.map(([f]) => f))
  for (const f of t.fields) {
    if (taken.has(f.name) || !['long', 'text', 'embedded'].includes(f.kind)) continue
    const n = nameIn(dict, f.name); if (!n) continue
    const s = sectionOfLabel(n)
    if (s && def.sections.some((x) => x.name === s)) spec.sections.push([f.name, s])
    else if (def.freeSections && f.kind !== 'text') spec.sections.push([f.name, n])
  }
  return spec
}

async function draftWith(ask, t, origin, dict) {
  const brief = briefWithNames(t, dict)
  let [spec, dropped] = fixSpec(normalizeSpec(await ask(draftPrompt(brief), t.table), origin), t)
  let problems = checkSpec(spec, t)
  if (problems.length) {
    ;[spec, dropped] = fixSpec(normalizeSpec(await ask(repairPrompt(brief, spec, problems), t.table), origin), t)
    problems = checkSpec(spec, t)
  }
  if (dropped.length) spec.note = `${spec.note ? `${spec.note}；` : ''}去掉了不存在的${dropped.join('、')}`
  return { spec, problems }
}

/**
 * 复查一张表的格式分歧：两个模型轮流看对方的版本，对照表画像只重判有分歧的项。
 *   每轮：提取模型看核验模型的版本改或坚持 → 比对；仍不一致，核验模型看提取模型的新版本 → 比对。
 *   一致即采用（标复查第 N 轮）；某一轮双方都没改就提前停；至多 maxRounds 轮。
 *   第二份是规则草稿（没配核验模型或它出错）时只复查 1 轮：规则不会改口。
 * 每一轮双方的规格、理由都记下，交人工时给人看。
 */
async function adjudicateSpecs(t, brief, { a, b, rule, suggest, verify, secondName, maxRounds }) {
  const compare = compareSpecs
  const rounds = []
  const lockRecord = (spec, prev) => spec // 类别一致时由提示要求保持，不强改（类别变了栏目、角色都跟着变）
  const revise = async (ask, own, other, diffs, otherLabel) => {
    const raw = await ask(adjudicatePrompt(brief, own, other, diffs, rule, otherLabel ? { otherLabel } : {}), t.table)
    let [spec] = fixSpec(normalizeSpec(raw, own.origin), t)
    let problems = checkSpec(spec, t)
    // 改出来的规格没通过校验：当作坚持原来的
    return { spec: problems.length ? own : lockRecord(spec, own), reason: typeof raw?.reason === 'string' ? raw.reason.slice(0, 120) : '', invalid: problems.length ? problems : null }
  }
  const sameCore = (x, y) => compare(x, y).agree && x.recordType === y.recordType
  let A = a; let B = b
  const limit = secondName === '核验模型' && verify ? Math.max(1, Math.min(6, Number(maxRounds) || 3)) : 1
  for (let r = 1; r <= limit; r++) {
    const d0 = compare(A, B).diffs
    let a2
    try { a2 = await revise(suggest, A, B, d0, secondName === '核验模型' ? null : '规则草稿（只按表名和字段值统计，不一定对）') } catch { break }
    const row = { round: r, diffs: d0, extract: stripSpecForLog(a2.spec), extractReason: a2.reason, extractInvalid: a2.invalid, verify: null, verifyReason: '' }
    rounds.push(row)
    let cmp = compare(a2.spec, B)
    if (cmp.agree) return { agreed: true, round: r, by: 'extract', spec: a2.spec, rounds }
    if (limit === 1 && secondName !== '核验模型') { A = a2.spec; break }
    let b2
    try { b2 = await revise(verify, B, a2.spec, cmp.diffs, '另一位工程师修改后的规格') } catch { A = a2.spec; break }
    row.verify = stripSpecForLog(b2.spec); row.verifyReason = b2.reason; row.verifyInvalid = b2.invalid
    cmp = compare(a2.spec, b2.spec)
    if (cmp.agree) return { agreed: true, round: r, by: 'verify', spec: a2.spec, rounds }
    const stuck = sameCore(a2.spec, A) && sameCore(b2.spec, B)
    A = a2.spec; B = b2.spec
    if (stuck) break
  }
  return { agreed: false, rounds, a: A, b: B, diffs: compare(A, B).diffs }
}
const stripSpecForLog = (spec) => { const { origin, accept, ...rest } = spec ?? {}; return rest }

/**
 * 纯文本文书（一个 txt／md 文件一份文书）：读法是确定的，不问模型——类别看文件名，写成时间是插件从正文里取的日期，
 * 正文整篇按「全文」切栏目（“主诉：…”这类行首标签）。文件名认不出类别的记为「其他文书」。
 */
function plainTextEntry(t, base) {
  const rule = ruleDraft(t)
  const recordType = rule.recordType && kindOf(rule.recordType) === '文书' ? rule.recordType : '其他文书'
  const spec = { recordType, written: ['写成时间'], occur: [], key: ['文件'], patient: null, invalid: null, encounter: {}, roles: {}, measures: [], sections: [['正文', WHOLE]],
    note: `纯文本文书：一个文件一份文书；类别${rule.recordType && kindOf(rule.recordType) === '文书' ? `按文件名「${t.table}」` : '认不出，记为其他文书'}；写成时间取正文里带标签的日期`, origin: 'rule' }
  const problems = checkSpec(spec, t)
  if (problems.length) return { ...base, status: 'invalid', spec, problems, diffs: [], reason: '纯文本文书：正文里没找到日期，定不了写成时间；在「格式」页确认（可改读法）' }
  return { ...base, status: 'agreed', spec, problems: [], diffs: [], reason: '纯文本文书（一个文件一份文书），按文件名定类别，不需模型起草', secondBy: '规则' }
}

/** 识别一张表（不查库）。返回格式库条目（未写入）。 */
export async function recognizeTable(t, { suggest, verify, dict = null, maxRounds = 3 }) {
  if (t.plain) return plainTextEntry(t, { signature: t.signature, table: t.table, rows: t.rows, files: t.files, fields: t.fields.map((f) => ({ name: f.name, kind: f.kind, fill: f.fill })), drafts: {} })
  const rule = ruleDraftWithDict(t, dict)
  // fields：只存字段名、种类、填充率、中文名（人工修改读法时校验用），不存样例
  const base = { signature: t.signature, table: t.table, rows: t.rows, files: t.files, fields: t.fields.map((f) => ({ name: f.name, kind: f.kind, fill: f.fill, ...(nameIn(dict, f.name) ? { label: nameIn(dict, f.name) } : {}) })), drafts: { rule } }
  if (!suggest) {
    const problems = checkSpec(rule, t)
    return { ...base, status: 'pending', spec: rule, problems, diffs: [], reason: '没有配置模型：只有规则方案，需要人工确认' }
  }
  let a
  try { a = await draftWith(suggest, t, 'model', dict) } catch (error) {
    return { ...base, status: 'failed', spec: rule, problems: [`模型调用失败：${String(error?.message ?? error).slice(0, 200)}`], diffs: [], reason: '模型调用失败，下次运行时重试' }
  }
  base.drafts.model = a.spec
  // 文书类表却没有任何叙述字段（只有表头：编号、代码、时间）：正文不在这份导出里，自动跳过并写明
  const hasProse = t.fields.some((f) => (f.kind === 'long' || f.kind === 'embedded') || (f.kind === 'text' && (f.avgLen ?? 0) >= 12 && !/^_|_id$|SOURCE/i.test(f.name)))
  if (a.problems.length && rule.recordType && kindOf(rule.recordType) === '文书' && !hasProse) {
    const spec = { ...rule, recordType: IGNORE, note: `表名像「${rule.recordType}」，但没有任何叙述字段（只有编号、代码、时间），正文不在这份导出里` }
    return { ...base, status: 'agreed', spec, problems: [], diffs: [], reason: '文书表没有正文字段：自动跳过', secondBy: '规则' }
  }
  if (a.problems.length) return { ...base, status: 'invalid', spec: a.spec, problems: a.problems, diffs: [], reason: '模型起草的读法没通过插件校验' }
  let second = rule; let secondName = '规则草稿'
  if (verify) {
    try {
      const b = await draftWith(verify, t, 'verify', dict)
      base.drafts.verify = b.spec
      if (!b.problems.length) { second = b.spec; secondName = '核验模型' }
    } catch { /* 核验模型不可用：退回规则方案 */ }
  }
  const cmp = compareSpecs(a.spec, second)
  if (cmp.agree) return { ...base, status: 'agreed', spec: mergeAgreed(a.spec, rule), problems: [], diffs: [], reason: `通读模型与${secondName}一致`, secondBy: secondName }
  const adj = await adjudicateSpecs(t, briefWithNames(t, dict), { a: a.spec, b: second, rule, suggest, verify, secondName, maxRounds })
  if (adj.agreed) return { ...base, status: 'agreed', spec: mergeAgreed({ ...adj.spec, origin: 'model' }, rule), problems: [], diffs: [], firstDiffs: cmp.diffs, rounds: adj.rounds, adjudicated: adj.round, reason: `通读模型与${secondName}起初有分歧，复查第 ${adj.round} 轮一致`, secondBy: secondName }
  return { ...base, status: 'disputed', spec: adj.a, problems: [], diffs: adj.diffs, firstDiffs: cmp.diffs, rounds: adj.rounds, reason: adj.rounds.length ? `通读模型与${secondName}有分歧，复查 ${adj.rounds.length} 轮仍不一致` : `通读模型与${secondName}有分歧` }
}

/**
 * 识别整个输入。
 *   files：数据文件；root：输入目录；library：本机格式库；siblings：只读的兄弟格式库（已采用、且没有 scope 的条目直接借用）
 *   settings：插件设置；chatImpl：测试用 { a, b }；cache：记录库（cacheGet/cachePut）；dict：数据元对照表
 *   wrap(role, llm)：并发闸门（格式识别和通读、核验共用各模型的上限）
 * 返回 { tables: [条目＋画像小结], pack, adopted, held, ignored }
 */
export async function recognize({ files, root, library, siblings = [], settings = {}, chatImpl = null, cache = null, dict = null, onCall = () => {}, onProgress = () => {}, signal, isCancelled = () => false, wrap = (role, llm) => llm }) {
  const profiles = await profileSample(files, root)
  const mk = (baseURL, model) => ({ name: model, llm: createLlm({ baseURL, model, apiKey: settings.apiKey, timeoutMs: settings.timeoutMs, disableThinking: settings.disableThinking }) })
  const sCfg = chatImpl?.a ? { name: chatImpl.a.model ?? 'mock-a', llm: chatImpl.a } : settings.baseURL && settings.model ? mk(settings.baseURL, settings.model) : null
  const vCfg = !sCfg ? null : chatImpl ? (chatImpl.b ? { name: chatImpl.b.model ?? 'mock-b', llm: chatImpl.b } : null) : settings.verifyModel ? mk(settings.verifyBaseURL || settings.baseURL, settings.verifyModel) : null
  const opts = { cache, onCall, signal }
  const suggest = sCfg ? asker(wrap('read', sCfg.llm), sCfg.name, 'format', opts) : null
  const verify = vCfg ? asker(wrap('verify', vCfg.llm), vCfg.name, 'format-verify', opts) : null

  const out = new Array(profiles.length)
  let done = 0
  await pool(profiles, Math.max(1, Number(settings.modelConcurrency) || 4), async (t, i) => {
    if (isCancelled()) return
    let entry = await library.get(t.signature)
    const names = t.fields.map((f) => f.name)
    if (t.plain && entry && entry.decidedBy !== 'user' && entry.status !== 'agreed') entry = null
    if (entry && !ADOPTED.has(entry.status) && entry.decidedBy !== 'user') {
      // 这份还没定，但同一张表的另一份（换过一批病人）已经人工确认过：以人工确认为准
      const compat = await library.findCompatible(t.table, names)
      if (compat && compat.signature !== entry.signature && compat.decidedBy === 'user') entry = null
    }
    if (!entry && !t.plain) {
      // 同一张表、字段略有出入（换了一批病人）：沿用已有的识别结果和人工确认，存一份到新签名下
      const compat = await library.findCompatible(t.table, names)
      if (compat) { const { history, updatedAt, ...rest } = compat; entry = await library.put({ ...rest, signature: t.signature, rows: t.rows, files: t.files, fields: t.fields.map((f) => ({ name: f.name, kind: f.kind, fill: f.fill })), reusedFrom: compat.signature }) }
    }
    if (!entry && !t.plain) {
      // 兄弟插件（病历文书提取）已经识别并采用过同一张表：借用（类别与栏目体系相同）
      for (const lib of siblings) {
        const e = (await lib.get(t.signature)) ?? (await lib.findCompatible(t.table, names))
        if (e && !e.scope && (ADOPTED.has(e.status) || e.status === 'rejected')) {
          const { history, updatedAt, ...rest } = e
          entry = await library.put({ ...rest, signature: t.signature, rows: t.rows, files: t.files, borrowedFrom: lib.label ?? 'sibling', reason: `沿用${lib.label ?? '兄弟插件'}的识别结果（${e.reason ?? e.status}）` })
          break
        }
      }
    }
    // 以前的分歧（没复查过、也没人工确认）：重新走一遍，起草命中缓存，只多复查的调用
    const redo = !entry || entry.status === 'failed' || (entry.status === 'pending' && suggest) || (entry.status === 'disputed' && !entry.rounds && !entry.decidedBy && suggest)
    if (redo) entry = await library.put(await recognizeTable(t, { suggest, verify, dict, maxRounds: settings.maxRounds }))
    out[i] = { ...entry, profile: { rows: t.rows, files: t.files, dirs: t.dirs, fields: t.fields.length, empty: t.fields.filter((f) => f.kind === 'empty').length, errors: t.errors } }
    onProgress({ done: ++done, total: profiles.length, table: t.table })
  })
  const tables = out.filter(Boolean)
  const adopted = tables.filter((e) => ADOPTED.has(e.status) && e.spec?.recordType !== IGNORE)
  const ignored = tables.filter((e) => e.status === 'rejected' || (ADOPTED.has(e.status) && e.spec?.recordType === IGNORE))
  const held = tables.filter((e) => !ADOPTED.has(e.status) && e.status !== 'rejected')
  const pack = buildSourcePack(adopted, { profileId: hash(adopted.map((e) => `${e.signature}:${e.updatedAt}`).sort().join('|')).slice(0, 12) })
  return { tables, pack, adopted, held, ignored, profiles }
}

export function summarizeRecognition(r) {
  return {
    tables: r.tables.map((e) => ({
      signature: e.signature, table: e.table, status: e.status, recordType: e.spec?.recordType ?? null, origin: e.spec?.origin ?? null,
      written: e.spec?.written?.[0] ?? null, sections: e.spec?.sections?.length ?? 0, roles: Object.keys(e.spec?.roles ?? {}),
      rows: e.profile?.rows ?? e.rows ?? 0, files: e.profile?.files ?? e.files ?? 0, reason: e.reason ?? '', diffs: e.diffs ?? [], problems: e.problems ?? [],
      note: e.spec?.note ?? '', decidedBy: e.decidedBy ?? null, borrowedFrom: e.borrowedFrom ?? null, adjudicated: e.adjudicated ?? null, rounds: e.rounds?.length ?? 0,
      labels: (e.fields ?? []).filter((f) => f.label).length,
    })),
    adopted: r.adopted.length, held: r.held.length, ignored: r.ignored.length,
    adjudicated: r.tables.filter((e) => e.adjudicated).length, adjDisputed: r.tables.filter((e) => e.status === 'disputed' && e.rounds?.length).length, pack: { id: r.pack.id, version: r.pack.version, tables: r.pack.tables.length },
  }
}
