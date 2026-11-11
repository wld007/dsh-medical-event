/**
 * 模型补充（阶段 3）：只处理规则判不了的四类项，只出建议，不改规则结果。
 *
 *   time     前句继承（待复核）的发生时间
 *   type     落入兜底规则（Z2、Z9）的提及类型
 *   concept  没能归一的症状、手术、用药概念
 *   finding  需人工确认的发现
 *
 * 每条建议必须引用原文：time/type/concept 要给出原文里的片段（quote），finding 要引用该发现
 * 涉及的提及编号；插件回原文核对，对不上的丢弃并计数。配置了核验模型时同一问题再问一遍：
 * 一致 → 规则改进候选（outcome: candidate）；分歧 → 人工复核（outcome: review）。
 * 回复缓存在 _records/runs/<runId>/model-cache.jsonl，继续处理时复用。
 */
import { createHash } from 'node:crypto'
import { appendFile, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createLlm, extractJson } from './llm.js'
import { dayOf } from './engine/time.js'

export const KINDS = ['time', 'type', 'concept', 'finding']
const CHUNK = 12
const TYPES = ['事实', '判断', '决策']
const VERDICTS = ['矛盾', '改判', '调整', '病情变化', '命名不一致', '记录质量', '证据不足']

const SYSTEM = '你是病历质控助手。只根据给出的原文作答，不推断原文没有写的事。必须引用原文。只输出一个 JSON 对象，不要输出其他内容。'

/* ------------------------------------------------------------- candidates */

function sentenceWindow(frag, m, before = 2) {
  // 本句及前 before 句（按句号/换行），给模型看上下文
  const t = frag.text
  let start = m.s
  for (let k = 0; k <= before && start > 0; k++) {
    const i = Math.max(t.lastIndexOf('。', start - 2), t.lastIndexOf('\n', start - 2))
    start = i < 0 ? 0 : i + 1
  }
  const endI = t.slice(m.e).search(/[。\n]/)
  return t.slice(start, endI < 0 ? t.length : m.e + endI + 1)
}

export function selectCandidates(result, { limit = 200 } = {}) {
  const T = result.tables
  const fragById = new Map(T.fragments.map((f) => [f.id, f]))
  const byId = new Map(T.mentions.map((m) => [m.id, m]))
  const out = { time: [], type: [], concept: [], finding: [] }
  for (const m of T.mentions) {
    if (m.timeSource === '前句继承（待复核）') {
      const f = fragById.get(m.fragmentId)
      out.time.push({ id: m.id, text: m.text, context: sentenceWindow(f, m), written: dayOf(m.writtenAt), ruleTime: [m.occurFrom, m.occurTo] })
    }
    if (m.fallback) {
      const f = fragById.get(m.fragmentId)
      out.type.push({ id: m.id, text: m.text, section: m.section, recordType: m.recordType, context: sentenceWindow(f, m, 1), rule: m.rules.classify })
    }
  }
  const seen = new Set()
  for (const e of T.events ?? []) {
    if (!['症状', '手术操作'].includes(e.conceptGroup) || e.normalized) continue
    const m = byId.get(e.firstMention)
    const k = m.text.replace(/\s/g, '')
    if (seen.has(k)) continue
    seen.add(k)
    out.concept.push({ id: e.id, mentionId: m.id, text: m.text, group: e.conceptGroup })
  }
  for (const f of T.findings ?? []) {
    if (f.certainty !== '需人工确认') continue
    const sides = f.sides.map((s) => ({ label: s.label, tier: s.tierName, mentions: s.mentions.slice(0, 6).map((id) => ({ id, text: byId.get(id)?.text, written: dayOf(byId.get(id)?.writtenAt) })) }))
    out.finding.push({ id: f.id, verdict: f.verdict, subclass: f.subclass, why: f.why, sides })
  }
  for (const k of KINDS) out[k] = out[k].slice(0, limit)
  return out
}

/* ---------------------------------------------------------------- prompts */

export function promptFor(kind, items, lexicon) {
  switch (kind) {
    case 'time': return `下面每条是病历里一个分句（text）及其上下文（context），写成日期为 written。规则没找到它本句的时间，暂时沿用了上一句的时间（ruleTime）。
请判断这个分句所说的事发生在什么时候：
- 若确实与上一句同时，answer 为 "same"；
- 若发生在写成当时（如入院后、目前），answer 为 "written"；
- 若 context 里有更合适的时间短语，answer 为 "phrase"，并在 quote 里逐字抄出那个时间短语，from/to 给出 YYYY-MM-DD；
- 判断不了，answer 为 "unknown"。
输出 {"items":[{"id":"…","answer":"same|written|phrase|unknown","quote":"…","from":"YYYY-MM-DD","to":"YYYY-MM-DD","reason":"一句话"}]}
${JSON.stringify(items)}`
    case 'type': return `下面每条是病历里一个分句，规则没能定类型。类型只能是：事实（观察到的、测到的、病人或家属说的）、判断（医生或检查对是什么/为什么/会怎样的结论）、决策（做了或打算做什么：治疗、检查、收治、病人自己的选择）。
quote 逐字抄出决定类型的关键词（必须是 text 的一部分）。
输出 {"items":[{"id":"…","type":"事实|判断|决策","quote":"…","reason":"一句话"}]}
${JSON.stringify(items)}`
    case 'concept': return `下面每条是病历里没能归一到词表的${items[0]?.group ?? ''}说法。已有的归一概念：${lexicon.join('、')}。
如果它就是某个已有概念的写法变体或同义说法，concept 填那个已有概念；如果是新概念，concept 填一个简短的规范名并设 isNew 为 true；不是${items[0]?.group ?? ''}，concept 为空。
quote 逐字抄出 text 中表示该概念的词。
输出 {"items":[{"id":"…","concept":"…","isNew":false,"quote":"…","reason":"一句话"}]}
${JSON.stringify(items)}`
    case 'finding': return `下面每条是规则判出的、需要人工确认的病历记录冲突（verdict 为规则判定）。各方（sides）给出了原文提及（id、text、written）。
判定只能是：${VERDICTS.join('、')}。矛盾＝同一时点同一对象两条记录不可能同时成立；改判＝判断随后来证据改变；调整＝方案变化且原文记载了变化；病情变化＝不同时点状态本来就会变；命名不一致＝相关但不同名；记录质量＝冲突来自模板、复制、补写；证据不足＝材料不足以判断。
cites 只能填 sides 里出现过的提及 id。
输出 {"items":[{"id":"…","verdict":"…","agree":true,"cites":["…"],"reason":"一句话"}]}
${JSON.stringify(items)}`
    default: throw new Error(kind)
  }
}

/* -------------------------------------------------------------- validation */

/** Check one model answer against the source; returns { ok, value, problem }. */
export function validate(kind, item, ans, ctx) {
  if (!ans || ans.id !== item.id) return { ok: false, problem: '缺少回答' }
  switch (kind) {
    case 'time': {
      if (!['same', 'written', 'phrase', 'unknown'].includes(ans.answer)) return { ok: false, problem: '答案不在选项内' }
      if (ans.answer === 'phrase') {
        if (!ans.quote || !item.context.includes(ans.quote)) return { ok: false, problem: '引用的时间短语不在原文中' }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ans.from ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(ans.to ?? '')) return { ok: false, problem: '日期格式不对' }
        if (ans.from > ans.to || ans.to > item.written) return { ok: false, problem: '区间倒置或晚于写成日' }
        return { ok: true, value: { answer: 'phrase', from: ans.from, to: ans.to, quote: ans.quote } }
      }
      if (ans.answer === 'written') return { ok: true, value: { answer: 'written', from: item.written, to: item.written } }
      return { ok: true, value: { answer: ans.answer } }
    }
    case 'type': {
      if (!TYPES.includes(ans.type)) return { ok: false, problem: '类型不在选项内' }
      if (!ans.quote || !item.text.includes(ans.quote)) return { ok: false, problem: '引用不在原文中' }
      return { ok: true, value: { type: ans.type, quote: ans.quote } }
    }
    case 'concept': {
      if (!ans.concept) return { ok: true, value: { concept: null } }
      if (!ans.isNew && !ctx.lexicon.includes(ans.concept)) return { ok: false, problem: '声称已有概念但词表里没有' }
      if (!ans.quote || !item.text.includes(ans.quote)) return { ok: false, problem: '引用不在原文中' }
      return { ok: true, value: { concept: ans.concept, isNew: Boolean(ans.isNew), quote: ans.quote } }
    }
    case 'finding': {
      if (!VERDICTS.includes(ans.verdict)) return { ok: false, problem: '判定不在选项内' }
      const allowed = new Set(item.sides.flatMap((s) => s.mentions.map((m) => m.id)))
      const cites = Array.isArray(ans.cites) ? ans.cites : []
      if (!cites.length || cites.some((c) => !allowed.has(c))) return { ok: false, problem: '引用的提及编号不属于该发现' }
      return { ok: true, value: { verdict: ans.verdict, cites } }
    }
    default: return { ok: false, problem: 'unknown kind' }
  }
}

const sameValue = (kind, a, b) => {
  if (!a || !b) return false
  switch (kind) {
    // 同一个时间短语、区间相交即视为一致（“4月前”一个给点、一个给区间）
    case 'time': return a.answer === b.answer && (a.answer !== 'phrase' || (a.quote === b.quote && a.from <= b.to && b.from <= a.to))
    case 'type': return a.type === b.type
    case 'concept': return a.concept === b.concept
    case 'finding': return a.verdict === b.verdict
    default: return false
  }
}

/* ------------------------------------------------------------------ runner */

/**
 * settings: plugin settings (baseURL, model, verifyBaseURL, verifyModel, …)
 * opts: { runDir, onCall(entry), chatImpl? (tests) }
 */
export function createModelRunner(settings, { runDir, onCall = () => {}, chatImpl = null } = {}) {
  const suggestLlm = chatImpl?.suggest ?? createLlm({ baseURL: settings.baseURL, model: settings.model, apiKey: settings.apiKey, timeoutMs: settings.timeoutMs, disableThinking: settings.disableThinking })
  const verifyLlm = chatImpl?.verify ?? (settings.verifyModel
    ? createLlm({ baseURL: settings.verifyBaseURL || settings.baseURL, model: settings.verifyModel, apiKey: settings.apiKey, timeoutMs: settings.timeoutMs, disableThinking: settings.disableThinking })
    : null)
  const cachePath = runDir ? join(runDir, 'model-cache.jsonl') : null
  let cache = null
  const callsPath = runDir ? join(runDir, 'calls.jsonl') : null

  async function loadCache() {
    if (cache) return cache
    cache = new Map()
    if (cachePath) {
      try {
        for (const l of (await readFile(cachePath, 'utf8')).split('\n')) {
          if (!l) continue
          const x = JSON.parse(l)
          cache.set(x.key, x.content)
        }
      } catch { /* none */ }
    }
    return cache
  }

  async function ask(llm, role, kind, patient, prompt, signal) {
    const c = await loadCache()
    const key = createHash('sha256').update(`${llm.model}\u0000${prompt}`).digest('hex')
    const entry = { at: new Date().toISOString(), patient, kind, role, model: llm.model }
    if (c.has(key)) { onCall({ ...entry, cached: true }); return c.get(key) }
    let content = null
    try {
      const r = await llm.chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], { signal, maxTokens: 3000 })
      content = r.content
      Object.assign(entry, { ms: r.ms, usage: r.usage, ok: true })
    } catch (error) {
      Object.assign(entry, { ok: false, error: String(error?.message ?? error) })
    }
    onCall(entry)
    if (callsPath) { await mkdir(runDir, { recursive: true }); await appendFile(callsPath, JSON.stringify(entry) + '\n') }
    if (content != null) {
      c.set(key, content)
      if (cachePath) { await mkdir(runDir, { recursive: true }); await appendFile(cachePath, JSON.stringify({ key, content }) + '\n') }
    }
    return content
  }

  /** Returns suggestions for one patient (pure data; never changes `result`). */
  async function suggest(patient, result, { isCancelled = () => false, signal, limit = settings.modelLimit ?? 200, lexicon = null } = {}) {
    const cands = selectCandidates(result, { limit })
    const out = []
    const lex = lexicon ?? {}
    // 先列出所有提示，再按并发上限并行发出（每个模型同时 modelConcurrency 个请求）
    const jobs = []
    for (const kind of KINDS) {
      const items = cands[kind]
      for (let i = 0; i < items.length; i += CHUNK) {
        const chunk = items.slice(i, i + CHUNK)
        const groups = kind === 'concept' ? [...new Set(chunk.map((x) => x.group))].map((g) => chunk.filter((x) => x.group === g)) : [chunk]
        for (const part of groups) jobs.push({ kind, part, lexList: kind === 'concept' ? (lex[part[0].group] ?? []) : [] })
      }
    }
    const results = new Array(jobs.length)
    let next = 0
    const width = Math.max(1, Number(settings.modelConcurrency ?? 4))
    await Promise.all(Array.from({ length: Math.min(width, jobs.length) }, async () => {
      while (next < jobs.length && !isCancelled()) {
        const j = next++
        const { kind, part, lexList } = jobs[j]
        const prompt = promptFor(kind, part, lexList)
        results[j] = await Promise.all([
          ask(suggestLlm, 'suggest', kind, patient, prompt, signal),
          verifyLlm ? ask(verifyLlm, 'verify', kind, patient, prompt, signal) : null,
        ])
      }
    }))
    jobs.forEach(({ kind, part, lexList }, j) => {
      if (!results[j]) return
      const [a, b] = results[j]
      {
          const A = new Map((extractJson(a)?.items ?? []).map((x) => [x?.id, x]))
          const B = b == null ? null : new Map((extractJson(b)?.items ?? []).map((x) => [x?.id, x]))
          for (const item of part) {
            const va = validate(kind, item, A.get(item.id), { lexicon: lexList })
            const vb = B ? validate(kind, item, B.get(item.id), { lexicon: lexList }) : null
            const s = {
              kind, target: item.id, mentionId: item.mentionId ?? (kind === 'finding' ? null : item.id), text: item.text ?? item.why,
              suggest: va.ok ? { ...va.value, reason: A.get(item.id)?.reason ?? '' } : null,
              suggestProblem: va.ok ? null : va.problem,
              verify: vb ? (vb.ok ? { ...vb.value, reason: B.get(item.id)?.reason ?? '' } : null) : undefined,
              verifyProblem: vb && !vb.ok ? vb.problem : null,
            }
            if (!va.ok) s.outcome = 'discarded'
            else if (!vb) s.outcome = 'review'
            else if (vb.ok && sameValue(kind, va.value, vb.value)) s.outcome = 'candidate'
            else s.outcome = 'review'
            if (s.outcome !== 'discarded' && ((kind === 'time' && va.value.answer === 'same') || (kind === 'finding' && va.value.verdict === item.verdict))) s.agreesWithRule = true
            out.push(s)
          }
      }
    })
    return out
  }

  return { suggest }
}

/** 已有概念名（给 concept 提示用）。 */
export function lexiconOf(pack) {
  const out = {}
  for (const c of pack.concepts) (out[c.group] ??= []).push(c.name)
  return out
}
