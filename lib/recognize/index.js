/**
 * S00 格式识别：输入目录 → 每张表的识别结果 → 数据源层规则包。
 *
 *   画像（本机）→ 查格式库（同签名直接复用）→ 没有的表起草：
 *     规则草稿 ＋ 建议模型起草（校验不过修一次）
 *     第二票：配了核验模型时由核验模型背靠背再起草一份；只有一个模型时用规则草稿（规则拿不准的项弃权）
 *     两方一致 → agreed（自动采用）；分歧 → disputed；校验不过 → invalid；都暂扣，等页面上确认
 *   没配模型：只有规则草稿 → pending（暂扣，等确认）
 *
 * 发给模型的只有画像简介（briefOf），不含整段病历。
 */
import { createHash } from 'node:crypto'
import { createLlm, extractJson } from '../llm.js'
import { profileTables } from './profile.js'
import { briefOf, ruleDraft, draftPrompt, repairPrompt, normalizeSpec, checkSpec, compareSpecs, mergeAgreed, fixSpec } from './draft.js'
import { ADOPTED, HELD } from './library.js'
import { buildSourcePack } from './build.js'
import { IGNORE, kindOf } from './canon.js'

export { ADOPTED, HELD }
export const PROMPT_VERSION = 'f1'

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 24)

async function pool(items, width, fn) {
  let i = 0
  await Promise.all(Array.from({ length: Math.max(1, Math.min(width, items.length)) }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k) }
  }))
}

/** 模型：{ name, chat(messages) }；结果缓存在记录库，失败抛错。 */
function asker(llm, name, role, { cache, onCall, signal }) {
  return async (messages, table) => {
    const key = `fmt:${PROMPT_VERSION}:${name}:${hash(JSON.stringify(messages))}`
    const hit = await cache?.cacheGet(key)
    if (hit != null) { onCall({ kind: 'format', role, model: name, patient: table, ok: true, cached: true }); return extractJson(hit) }
    const t0 = Date.now()
    try {
      const r = await llm.chat(messages, { signal, maxTokens: 3000 })
      await cache?.cachePut(key, name, r.content)
      onCall({ kind: 'format', role, model: name, patient: table, ok: true, ms: r.ms ?? Date.now() - t0, usage: r.usage })
      return extractJson(r.content)
    } catch (error) {
      onCall({ kind: 'format', role, model: name, patient: table, ok: false, ms: Date.now() - t0, error: String(error?.message ?? error) })
      throw error
    }
  }
}

/** 一位起草者：起草 → 校验 → 不过修一次。返回 { spec, problems }。 */
async function draftWith(ask, t, origin) {
  const brief = briefOf(t)
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
 * 识别一张表（不查库）。返回格式库条目（未写入）。
 */
export async function recognizeTable(t, { suggest, verify }) {
  const rule = ruleDraft(t)
  // fields：只存字段名、种类、填充率（人工修改规格时校验用），不存样例
  const base = { signature: t.signature, table: t.table, rows: t.rows, files: t.files, fields: t.fields.map((f) => ({ name: f.name, kind: f.kind, fill: f.fill })), drafts: { rule } }
  if (!suggest) {
    const problems = checkSpec(rule, t)
    return { ...base, status: 'pending', spec: rule, problems, diffs: [], reason: '没有配置模型：只有规则草稿，需要人工确认' }
  }
  let a
  try { a = await draftWith(suggest, t, 'model') } catch (error) {
    return { ...base, status: 'failed', spec: rule, problems: [`模型调用失败：${String(error?.message ?? error).slice(0, 200)}`], diffs: [], reason: '模型调用失败，下次运行时重试' }
  }
  base.drafts.model = a.spec
  // 文书类表却没有任何叙述字段（只有表头：编号、代码、时间）：正文不在这份导出里，自动跳过并写明
  const hasProse = t.fields.some((f) => (f.kind === 'long' || f.kind === 'embedded') || (f.kind === 'text' && (f.avgLen ?? 0) >= 12 && !/^_|_id$|SOURCE/i.test(f.name)))
  if (a.problems.length && rule.recordType && kindOf(rule.recordType) === '文书' && !hasProse) {
    const spec = { ...rule, recordType: IGNORE, note: `表名像「${rule.recordType}」，但没有任何叙述字段（只有编号、代码、时间），正文不在这份导出里` }
    return { ...base, status: 'agreed', spec, problems: [], diffs: [], reason: '文书表没有正文字段（模型也没给出可用的规格）：自动跳过', secondBy: '规则' }
  }
  if (a.problems.length) return { ...base, status: 'invalid', spec: a.spec, problems: a.problems, diffs: [], reason: '模型起草的规格没通过插件校验' }
  let second = rule; let secondName = '规则草稿'
  if (verify) {
    try {
      const b = await draftWith(verify, t, 'verify')
      base.drafts.verify = b.spec
      if (!b.problems.length) { second = b.spec; secondName = '核验模型' }
    } catch { /* 核验模型不可用：退回规则草稿作第二票 */ }
  }
  const cmp = compareSpecs(a.spec, second)
  if (!cmp.agree) return { ...base, status: 'disputed', spec: a.spec, problems: [], diffs: cmp.diffs, reason: `模型起草与${secondName}有分歧` }
  return { ...base, status: 'agreed', spec: mergeAgreed(a.spec, rule), problems: [], diffs: [], reason: `模型起草与${secondName}一致`, secondBy: secondName }
}

/**
 * 识别整个输入。
 *   files: 数据文件列表；root: 输入目录
 *   library: openLibrary(...)；settings: 插件设置；chatImpl：测试用的假模型 { suggest, verify }
 *   cache：记录库的批次句柄（cacheGet/cachePut）；onCall(entry)；onProgress({ done, total, table })
 * 返回 { tables: [条目＋画像小结], pack, adopted, held, ignored }
 */
export async function recognize({ files, root, library, settings = {}, chatImpl = null, cache = null, onCall = () => {}, onProgress = () => {}, signal, isCancelled = () => false }) {
  const profiles = await profileTables(files, root)
  const mk = (cfg, role) => (cfg.model ? { name: cfg.model, llm: createLlm({ baseURL: cfg.baseURL, model: cfg.model, apiKey: settings.apiKey, timeoutMs: settings.timeoutMs, disableThinking: settings.disableThinking }) } : null)
  const enabled = settings.modelEnabled !== false
  const suggestCfg = chatImpl?.suggest ? { name: chatImpl.suggest.model ?? 'mock-suggest', llm: chatImpl.suggest } : enabled && settings.baseURL ? mk({ baseURL: settings.baseURL, model: settings.model }, 'suggest') : null
  const verifyCfg = chatImpl?.verify ? { name: chatImpl.verify.model ?? 'mock-verify', llm: chatImpl.verify } : enabled && settings.verifyModel ? mk({ baseURL: settings.verifyBaseURL || settings.baseURL, model: settings.verifyModel }, 'verify') : null
  const opts = { cache, onCall, signal }
  const suggest = suggestCfg ? asker(suggestCfg.llm, suggestCfg.name, 'suggest', opts) : null
  const verify = verifyCfg ? asker(verifyCfg.llm, verifyCfg.name, 'verify', opts) : null

  const out = new Array(profiles.length)
  let done = 0
  await pool(profiles, Math.max(1, Number(settings.modelConcurrency) || 4), async (t, i) => {
    if (isCancelled()) return
    let entry = await library.get(t.signature)
    if (entry && !ADOPTED.has(entry.status) && entry.decidedBy !== 'user') {
      // 这份还没定，但同一张表的另一份（换过一批病人）已经人工裁定过：以人工裁定为准
      const compat = await library.findCompatible(t.table, t.fields.map((f) => f.name))
      if (compat && compat.signature !== entry.signature && compat.decidedBy === 'user') entry = null
    }
    if (!entry) {
      // 同一张表、字段略有出入（换了一批病人）：沿用已有的识别结果和人工裁定，存一份到新签名下
      const all = (await library.all()).filter((e) => e.table === t.table)
      const compat = (await library.findCompatible(t.table, t.fields.map((f) => f.name)))
      const userCompat = all.find((e) => e.decidedBy === 'user' && compat && e.signature === compat.signature) ?? compat
      if (userCompat) {
        const { history, updatedAt, ...rest } = userCompat
        entry = await library.put({ ...rest, signature: t.signature, rows: t.rows, files: t.files, fields: t.fields.map((f) => ({ name: f.name, kind: f.kind, fill: f.fill })), reusedFrom: userCompat.signature })
      }
    }
    // 复用：已采用、已驳回、分歧待定的都不重问；失败的、只有规则草稿而现在有模型的重做
    const redo = !entry || entry.status === 'failed' || (entry.status === 'pending' && suggest)
    if (redo) {
      entry = await recognizeTable(t, { suggest, verify })
      entry = await library.put(entry)
    }
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

/** 给页面和报告用的小结（不含画像样例）。 */
export function summarizeRecognition(r) {
  return {
    tables: r.tables.map((e) => ({
      signature: e.signature, table: e.table, status: e.status, recordType: e.spec?.recordType ?? null, origin: e.spec?.origin ?? null,
      written: e.spec?.written?.[0] ?? null, sections: e.spec?.sections?.length ?? 0, roles: Object.keys(e.spec?.roles ?? {}),
      rows: e.profile?.rows ?? e.rows ?? 0, files: e.profile?.files ?? e.files ?? 0, reason: e.reason ?? '', diffs: e.diffs ?? [], problems: e.problems ?? [],
      note: e.spec?.note ?? '', decidedBy: e.decidedBy ?? null,
    })),
    adopted: r.adopted.length, held: r.held.length, ignored: r.ignored.length, pack: { id: r.pack.id, version: r.pack.version, tables: r.pack.tables.length },
  }
}
