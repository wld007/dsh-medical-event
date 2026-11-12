/**
 * 模型优先的 S02＋S03：模型读懂，规则执行。
 *
 * 模型（甲＝建议模型，乙＝核验模型）负责：把句子切成提及、判类型与属性、找出管这件事的时间短语。
 * 代码负责：切句与去重、在原文里定位（只信原文片段，不信位置）、日期换算、栏目默认时间、
 * 覆盖检查（漏的用规则补）、双模型比对与复议、规则第三票、缓存（可复跑）、验收门。
 *
 * 双模型：
 *   甲抽取（含类型、时间）；乙审核甲的每条提及（合格？边界？），并背靠背地独立给类型与时间，再补甲漏掉的。
 *   一致 → 采纳；分歧 → 交叉复议（两边各看双方答案再选）；仍不一致 → 规则第三票；仍定不了 → 待人工（先按默认取）。
 *
 * 去重：以“句子（叙述栏目再带上一句作上文）＋记录类型＋栏目”为单位，同样的句子跨文书、跨病人只问一次。
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mentionId } from '../engine/ids.js'
import { findTimePhrases, bestPhrase, dayOf, monthRange, makeDay } from '../engine/time.js'
import { sectionConfig, findSections, isNoise, dayInterval, DURATION_CONTEXT } from '../engine/s02-mentions.js'
import { trimSpan, splitBy, SENTENCE } from '../engine/text.js'
import { extractJson } from '../llm.js'
import { taxonomyText, parseCategory, deriveSubclass, ACTIONS, CODES } from './taxonomy.js'
const codeOf = (a) => CODES.find((c) => c.t === a.t && c.sd === a.sd && c.it === a.it)?.code

export const PROMPT_VERSION = 'm5'
const PSEUDO = /(化名|医生|医院|地址|证件|电话|病历|住院|就诊)-[0-9A-F]{6}/
const TR = ['本句', '同句', '上文', '当时', '既往', '无']
const TR_ALIAS = { 写成当时: '当时', 写成时: '当时', 当前: '当时', 现在: '当时', 目前: '当时', 以前: '既往', 过去: '既往', 不详: '无', 无时间: '无', 上句: '上文', 前文: '上文' }
const NARR = new Set(['narrative', 'outpatient', 'admitDay'])
const BATCH_CHARS = 900
const BATCH_UNITS = 14
const SYSTEM = '你是病历结构化标注员。只根据给出的原文作答，不推断原文没有写的事；引用原文必须逐字。只输出一个 JSON 对象，不要输出其他内容。'

/* ------------------------------------------------------------ text utils */

const CANON = { '，': ',', '；': ';', '：': ':', '（': '(', '）': ')', '“': '"', '”': '"', '‘': "'", '’': "'", '*': '＊', '．': '.', '－': '-', '～': '~' }
const canon = (ch) => CANON[ch] ?? ch

/** 去空白、假名→＊、标点归一，并记下每个字对应原文的位置。 */
export function normMap(text) {
  const norm = []; const map = []
  const re = new RegExp(PSEUDO.source, 'y')
  let i = 0
  while (i < text.length) {
    re.lastIndex = i
    const m = re.exec(text)
    if (m) { norm.push('＊'); map.push([i, i + m[0].length]); i += m[0].length; continue }
    const ch = text[i]
    if (!/\s/.test(ch)) { norm.push(canon(ch)); map.push([i, i + 1]) }
    i++
  }
  return { norm: norm.join(''), map }
}
const normStr = (s) => normMap(String(s ?? '')).norm
const display = (s) => String(s).replace(new RegExp(PSEUDO.source, 'g'), '＊').replace(/\s+/g, ' ').trim()
const sha = (...xs) => createHash('sha256').update(xs.map(String).join('\u001f')).digest('hex').slice(0, 24)

/** 在 text 里找模型给的片段；from 之后优先（同一句里重复出现时按顺序）。 */
export function locate(text, q, nm = normMap(text), from = 0) {
  const qn = normStr(q)
  if (!qn) return null
  let idx = nm.norm.indexOf(qn, from)
  if (idx < 0) idx = nm.norm.indexOf(qn)
  if (idx < 0) return null
  return { s: nm.map[idx][0], e: nm.map[idx + qn.length - 1][1], n: idx + qn.length }
}

/* ------------------------------------------------------------------ units */

/** 文书片段 → 句子单位。 */
export function buildUnits({ fragments }, sourcePack) {
  const sections = sourcePack.sections ?? {}
  const noise = sourcePack.noise ?? []
  const units = []
  const skipped = []
  for (const f of fragments) {
    if (f.kind !== '文书') continue
    const cfg = sectionConfig(sections, f)
    if (!cfg) { skipped.push(f.id); continue }
    let idx = 0
    for (const sec of findSections(f.text, cfg)) {
      let prev = null
      const parts = sec.cfg.lines || sec.cfg.template ? splitBy(f.text, sec.s, sec.e, /\n/g) : splitBy(f.text, sec.s, sec.e, SENTENCE)
      for (const [a0, b0] of parts) {
        const [a, b] = trimSpan(f.text, a0, b0)
        if (b <= a) continue
        const text = f.text.slice(a, b)
        if (isNoise(text, noise, f.text[b]) || !/[\u4e00-\u9fa5A-Za-z0-9]/.test(text)) continue
        idx++
        const narrative = NARR.has(sec.cfg.time)
        const u = { fragment: f, sec, s: a, e: b, text, prev: narrative ? prev : null, sentence: idx }
        u.key = sha(PROMPT_VERSION, f.recordType, sec.name, normStr(u.prev ?? ''), normStr(text))
        units.push(u)
        prev = text
      }
    }
  }
  // 宣教/医嘱模板：同一记录类型、同一栏目里，同一句出现在多份文书 → 标〔宣教〕（与病种无关的去模板信号）
  const count = new Map()
  for (const u of units) { const k = `${u.fragment.recordType}\u0000${u.sec.name}\u0000${normStr(u.text)}`; count.set(k, (count.get(k) ?? new Set()).add(u.fragment.id)) }
  for (const u of units) {
    const n = count.get(`${u.fragment.recordType}\u0000${u.sec.name}\u0000${normStr(u.text)}`).size
    if (n >= (sourcePack.eduRepeatDocs ?? 5) && /处理|医嘱|指导|建议|宣教|注意/.test(u.sec.name + (u.sec.cfg.label ?? ''))) { u.edu = true; u.key = sha(u.key, 'edu') }
  }
  return { units, skipped }
}

/* ---------------------------------------------------------------- prompts */

const DEFS = `提及＝一件可以单独成立的临床事情：一个症状、一个体征或查体所见、一项检验结果、一项检查、一个诊断或判断、一个处理或决定、一次就诊、一条个人或家族背景。
1. q 必须逐字抄原句里连续的一段，不改字、不补字；“＊”照抄。栏目标签、纯标点、无意义残片不算提及。
2. 并列的诊断、症状、否认项按顿号拆开，每项一条；前面的修饰词（否认、无、予、有、口服）写进 sc。例：“否认高血压、糖尿病” → q=高血压 sc=否认；q=糖尿病 sc=否认。
3. 不要拆碎：数值连同单位、同一检查的左右（“左0.3cm，右0.3cm”）、症状连同部位，算一条。
4. 分类 c：只填下表里的一个代码（如 F03）：
${taxonomyText()}
   易混的几类：既往患过的病（“既往高血压病”“冠心病史”）选 J02，F06 只用于既往手术、外伤、输血等经历；
   “收住入院”“拟…收入”“予出院”是决策 D08，就诊、入院本身的经过（“遂至我院急诊”）才是 F07；
   检查报告或转述里的所见（“右上肢动脉CTA：…吻合术后”）选 F04，带结论措辞的（“考虑…”“提示…”）选 J03；
   “血透2年余”“规律服用某药”是治疗在用，选 D02／D01（act=维持），不是症状。
   按栏目的约定：主诉里的“配药、复诊、开药、复查”等来意选 F08；检查报告“结论／诊断／印象”栏选 J03，“所见／描述”栏选 F04；
   “诊断／初步诊断／补充诊断／出院诊断”栏选 J01；既往史里被否认的病（“否认…”“无…病史”）选 F05、neg=1；
   “未予系统诊治”“未规律服药”“自行停药”选行为与依从（F15／F16），不是治疗。
   一行开头写了日期或来源（“（2021-07-23本院）血常规：…”），这一行里每一项的时间都是那个日期：tr=同句，tq 抄那个日期。
   单独的日期或来源（“（2023-09-11我院）”）、栏目标签不是提及，它们是相邻提及的时间或出处。
   健康宣教、注意事项、疾病科普（句前标〔宣教〕的，或写给病人看的“出现…时及时就诊”“糖尿病的典型症状是…”）里提到的症状、并发症、检查，是教育内容，不是本病人的情况：整句只作一条 D05，不要拆出症状或检验。
5. neg：否定表述（无、未见、否认、阴性、未及）为 1，否则 0；“无明显诱因”“未见好转”“不能排除”不算否定。
6. 决策另给 act（${ACTIONS.join('｜')}，看不出为空）和 past（说的是以前做过的、转述的为 1）。
7. 时间 tr，说的是这件事发生在什么时候：
   时间短语包括日期、“3天前”“1周余”“2年余”“病史9年”“10年前”“同年5月”“入院后第2天”这类时长与相对说法；“每周3次”“一天一次”是频次，不是时间。
   句子里只要有说这件事的时间短语，就不能选“既往”或“无”。
   本句＝q 里自己有时间短语；同句＝时间短语在本句别处；上文＝时间短语在“上文”里；这三种把时间短语逐字抄进 tq；
   当时＝写这份记录的时候（目前、现、今日、查体所见、当次处理）；既往＝以前，没写具体时间；无＝看不出。
   tr 只能是：本句｜同句｜上文｜当时｜既往｜无。
   只抄时间短语，不要换算日期。若短语要结合上下文才知道年份（如“同年5月”），另给 tn：{"k":"年月","v":"YYYY-MM"} 或 {"k":"日期","v":"YYYY-MM-DD"}。`

const unitLine = (u, i) => `[${i}]〔${u.fragment.recordType}｜${u.sec.name || '—'}${u.edu ? '｜宣教' : ''}〕${u.prev ? `\n上文：${display(u.prev)}` : ''}\n句：${display(u.text)}`

export function extractPrompt(batch) {
  return `把下面每句病历拆成提及。
${DEFS}
输出一个 JSON 对象：{"s":[{"i":1,"m":[{"q":"…","c":"F03","neg":0,"sc":"","tr":"当时","tq":"","act":"","past":0}]}]}；没有提及的句子给 "m":[]。

${batch.map((u, i) => unitLine(u, i + 1)).join('\n\n')}`
}

export function reviewPrompt(batch, answers) {
  return `另一位标注者已经把下面每句病历拆成了提及（只给出原文片段 q，编号 j）。请你：
1. 逐条审：ok=1 表示它是合格的提及、边界合适；ok=0 表示不是提及或边界不对，fix 写你认为正确的逐字片段（根本不是提及则 fix 为空）。
2. 不管 ok 与否，独立地给每条标 c/neg/sc/tr/tq/act/past（不要猜对方怎么标）。
3. 把对方漏掉的提及列进 miss，同样带 q 和全部字段。
定义：
${DEFS}
输出一个 JSON 对象：{"s":[{"i":1,"r":[{"j":1,"ok":1,"fix":"","c":"F03","neg":0,"sc":"","tr":"当时","tq":"","act":"","past":0}],"miss":[]}]}

${batch.map((u, i) => `${unitLine(u, i + 1)}\n对方的提及：${answers[i].map((m, j) => `(${j + 1})${m.q}`).join('  ') || '（无）'}`).join('\n\n')}`
}

const showAns = (x) => {
  if (!x) return '不是提及（不需要单独成条）'
  const parts = []
  if (x.q != null) parts.push(`片段「${x.q}」`)
  if (x.t) parts.push(`${x.t}›${x.sd}›${x.it}${x.neg ? '·否定' : ''}`)
  if (x.tr) parts.push(`时间：${x.tr}${x.tq ? `「${x.tq}」` : ''}`)
  return parts.join('；')
}

export function adjudicatePrompt(items) {
  return `两位标注者对下面这些病历提及的意见不一致。请看原句和双方的意见，逐项选出你认为对的一方（甲或乙）。
问题类型：边界＝这一条该怎么切、是不是提及；遗漏＝这一段是否该单独成为一条提及；分类＝类型与否定；时间＝这件事的时间短语。
分类表：
${taxonomyText()}
输出一个 JSON 对象：{"d":[{"d":1,"pick":"甲"}]}（pick 只能是 甲 或 乙）

${items.map((x, k) => `{${k + 1}} 问题：${x.kind}\n句：${display(x.unit.text)}${x.unit.prev ? `\n上文：${display(x.unit.prev)}` : ''}\n甲：${showAns(x.a)}\n乙：${showAns(x.b)}`).join('\n\n')}`
}

/* --------------------------------------------------------------- parsing */

function cleanMention(m, unit) {
  if (!m || typeof m !== 'object' || !m.q) return null
  const nm = unit.nm ??= normMap(unit.text)
  if (!locate(unit.text, m.q, nm)) return { invalid: '片段不在原文中', q: m.q }
  const ty = parseCategory(m.c, m.it, m.sd, m.t)
  if (!ty) return { invalid: '分类不在类型表中', q: m.q }
  const tr0 = String(m.tr ?? '').trim()
  const tr = TR.includes(tr0) ? tr0 : TR_ALIAS[tr0] ?? '无'
  let tq = m.tq ? String(m.tq) : ''
  if (['本句', '同句', '上文'].includes(tr)) {
    const src = tr === '上文' ? (unit.prev ?? '') : unit.text
    if (!tq || !normStr(src).includes(normStr(tq))) tq = '' // 时间短语不在原文里：不采信
  } else tq = ''
  let tn = null
  if (m.tn && typeof m.tn === 'object' && ['年月', '日期'].includes(m.tn.k) && /^\d{4}-\d{2}(-\d{2})?$/.test(String(m.tn.v))) tn = { k: m.tn.k, v: String(m.tn.v) }
  return {
    q: String(m.q), t: ty.t, sd: ty.sd, it: ty.it, neg: m.neg ? 1 : 0, sc: ['否认', '无', '予', '有', '口服'].includes(m.sc) ? m.sc : '',
    tr: tq || !['本句', '同句', '上文'].includes(tr) ? tr : '无', tq, tn,
    act: ACTIONS.includes(m.act) ? m.act : '', past: m.past ? 1 : 0,
  }
}

/** 模型的 JSON 外形不一：{s:[…]}、[{s:[…]}]、[{i,m}]… 统一成句子数组。 */
function sentencesOf(json, key = 's') {
  if (!json) return []
  if (Array.isArray(json)) return json.flatMap((x) => (x && Array.isArray(x[key]) ? x[key] : x && x.i != null ? [x] : []))
  if (Array.isArray(json[key])) return json[key]
  return []
}

const sameType = (a, b) => a && b && a.t === b.t && a.sd === b.sd && a.it === b.it && Boolean(a.neg) === Boolean(b.neg)
const sameTime = (a, b) => a && b && a.tr === b.tr && normStr(a.tq) === normStr(b.tq) && JSON.stringify(a.tn) === JSON.stringify(b.tn)

/* ----------------------------------------------------------------- cache */

export function createCache(dir) {
  const mem = new Map()
  let loaded = false
  const file = dir ? join(dir, `llm-first-${PROMPT_VERSION}.jsonl`) : null
  return {
    async load() {
      if (loaded || !file) return
      loaded = true
      try { for (const l of (await readFile(file, 'utf8')).split('\n')) if (l) { const x = JSON.parse(l); mem.set(x.k, x.v) } } catch { /* none */ }
    },
    get: (k) => mem.get(k),
    has: (k) => mem.has(k),
    async set(k, v) {
      mem.set(k, v)
      if (file) { await mkdir(dir, { recursive: true }); await appendFile(file, JSON.stringify({ k, v }) + '\n') }
    },
    size: () => mem.size,
  }
}

/* ---------------------------------------------------------------- runner */

async function pool(items, width, fn) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i) }
  }))
}

function batches(units) {
  const out = []
  let cur = []; let chars = 0
  const sorted = [...units].sort((a, b) => (a.fragment.recordType + a.sec.name).localeCompare(b.fragment.recordType + b.sec.name))
  for (const u of sorted) {
    const len = u.text.length + (u.prev?.length ?? 0)
    if (cur.length && (chars + len > BATCH_CHARS || cur.length >= BATCH_UNITS)) { out.push(cur); cur = []; chars = 0 }
    cur.push(u); chars += len
  }
  if (cur.length) out.push(cur)
  return out
}

/**
 * models: { a: { chat, model }, b: { chat, model } }
 * 返回 Map<unitKey, { mentions: [{ q, …attrs, by }], stats }>
 */
export async function judgeUnits(units, models, { cache, width = 8, onCall = () => {}, ruleOf = () => null, isCancelled = () => false } = {}) {
  await cache.load()
  const uniq = new Map()
  for (const u of units) if (!uniq.has(u.key)) uniq.set(u.key, u)
  const list = [...uniq.values()]
  const stats = { units: units.length, unique: list.length, calls: { a: 0, b: 0, adjA: 0, adjB: 0 }, cached: { a: 0, b: 0, adj: 0 }, failed: 0, invalid: {}, ms: 0, tokens: { in: 0, out: 0 } }
  const t0 = Date.now()

  async function call(llm, role, prompt) {
    stats.calls[role]++
    try {
      const r = await llm.chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], { maxTokens: 6000 })
      stats.tokens.in += r.usage?.prompt_tokens ?? 0; stats.tokens.out += r.usage?.completion_tokens ?? 0
      onCall({ role, model: llm.model, ok: true, ms: r.ms, usage: r.usage })
      return extractJson(r.content)
    } catch (error) {
      stats.failed++
      onCall({ role, model: llm.model, ok: false, error: String(error?.message ?? error) })
      return null
    }
  }
  stats.invalidSamples = []
  const bad = (why, q, u) => { stats.invalid[why] = (stats.invalid[why] ?? 0) + 1; if (stats.invalidSamples.length < 30) stats.invalidSamples.push({ why, q, text: u?.text?.slice(0, 80) }) }

  /** 跑一轮：need 里每个单位得到一个结果；失败的拆小重试一次。 */
  async function round(need, llm, role, makePrompt, parse, keyOf) {
    const todo = need.filter((u) => { if (cache.has(keyOf(u))) { stats.cached[role === 'a' || role === 'b' ? role : 'adj']++; return false } return true })
    let pending = batches(todo)
    for (let attempt = 0; attempt < 2 && pending.length && !isCancelled(); attempt++) {
      const retry = []
      await pool(pending, width, async (batch) => {
        if (isCancelled()) return
        const json = await call(llm, role, makePrompt(batch))
        const got = parse(json, batch)
        for (let i = 0; i < batch.length; i++) {
          if (got[i] === undefined) retry.push(batch[i])
          else await cache.set(keyOf(batch[i]), got[i])
        }
      })
      pending = attempt === 0 ? retry.reduce((acc, u, i) => { if (i % Math.ceil(BATCH_UNITS / 2) === 0) acc.push([]); acc.at(-1).push(u); return acc }, []) : []
    }
  }

  // 1 甲抽取
  const keyA = (u) => `A|${models.a.model}|${u.key}`
  await round(list, models.a, 'a', extractPrompt, (json, batch) => {
    const out = new Array(batch.length)
    for (const s of sentencesOf(json)) {
      const i = Number(s?.i) - 1
      if (!(i >= 0 && i < batch.length) || !Array.isArray(s.m)) continue
      const ms = []
      for (const m of s.m) { const c = cleanMention(m, batch[i]); if (c?.invalid) bad(`甲：${c.invalid}`, c.q, batch[i]); else if (c) ms.push(c) }
      out[i] = ms
    }
    return out
  }, keyA)

  // 2 乙审核＋背靠背分类＋补漏
  const keyB = (u) => `B|${models.b.model}|${u.key}|${sha(JSON.stringify(cache.get(keyA(u)) ?? []))}`
  const withA = list.filter((u) => cache.has(keyA(u)))
  await round(withA, models.b, 'b', (batch) => reviewPrompt(batch, batch.map((u) => cache.get(keyA(u)))), (json, batch) => {
    const out = new Array(batch.length)
    for (const s of sentencesOf(json)) {
      const i = Number(s?.i) - 1
      if (!(i >= 0 && i < batch.length)) continue
      const u = batch[i]; const A = cache.get(keyA(u))
      const r = []
      for (const x of Array.isArray(s.r) ? s.r : []) {
        const j = Number(x?.j) - 1
        if (!(j >= 0 && j < A.length)) continue
        const fixQ = x.ok ? '' : String(x.fix ?? '')
        const c = cleanMention({ ...x, q: fixQ || A[j].q }, u)
        if (c?.invalid) { bad(`乙：${c.invalid}`, c.q, u); r[j] = { ok: x.ok ? 1 : 0, fix: '', ans: null }; continue }
        r[j] = { ok: x.ok ? 1 : 0, fix: fixQ && !c?.invalid ? fixQ : '', ans: c }
      }
      const miss = []
      for (const m of Array.isArray(s.miss) ? s.miss : []) { const c = cleanMention(m, u); if (c?.invalid) bad(`乙补漏：${c.invalid}`, c.q, u); else if (c) miss.push(c) }
      out[i] = { r, miss }
    }
    return out
  }, keyB)

  // 3 比对，列出分歧
  const disputesOf = new Map()
  for (const u of list) {
    const A = cache.get(keyA(u)); const B = cache.get(keyB(u))
    if (!A) continue
    const ds = []
    const nm = u.nm ??= normMap(u.text)
    A.forEach((a, j) => {
      const r = B?.r?.[j]
      if (!r) return
      if (!r.ok) ds.push({ kind: '边界', j, a, b: r.fix ? r.ans : null })
      else if (r.ans) {
        if (!sameType(a, r.ans)) ds.push({ kind: '分类', j, a, b: r.ans })
        if (!sameTime(a, r.ans)) ds.push({ kind: '时间', j, a, b: r.ans })
      }
    })
    const spans = A.map((a) => locate(u.text, a.q, nm)).filter(Boolean)
    for (const m of B?.miss ?? []) {
      const loc = locate(u.text, m.q, nm)
      if (!loc || spans.some((sp) => overlap(sp, loc) >= 0.5)) continue
      ds.push({ kind: '遗漏', a: null, b: m })
    }
    if (ds.length) disputesOf.set(u.key, ds.map((d, k) => ({ ...d, k, unit: u })))
  }

  // 4 交叉复议（两个模型各选一次）
  const disputed = list.filter((u) => disputesOf.has(u.key))
  const adjKey = (who, u) => `J|${who.model}|${u.key}|${sha(JSON.stringify(disputesOf.get(u.key).map(({ unit, ...d }) => d)))}`
  for (const [who, role] of [[models.a, 'adjA'], [models.b, 'adjB']]) {
    await round(disputed, who, role, (batch) => adjudicatePrompt(batch.flatMap((u) => disputesOf.get(u.key))), (json, batch) => {
      const flat = batch.flatMap((u) => disputesOf.get(u.key).map((d) => [u, d]))
      const picks = new Map()
      for (const x of sentencesOf(json, 'd')) { const k = Number(x?.d) - 1; if (k >= 0 && k < flat.length && (x.pick === '甲' || x.pick === '乙')) picks.set(k, x.pick) }
      const out = new Array(batch.length)
      let k = 0
      batch.forEach((u, i) => {
        const n = disputesOf.get(u.key).length
        const arr = []
        for (let t = 0; t < n; t++, k++) arr.push(picks.get(k) ?? null)
        out[i] = arr.every((p) => p === null) ? undefined : arr
      })
      return out
    }, (u) => adjKey(who, u))
  }

  // 5 定案
  const result = new Map()
  const tally = { 边界: {}, 分类: {}, 时间: {}, 遗漏: {}, 采纳: 0 }
  const bump = (kind, by) => { tally[kind][by] = (tally[kind][by] ?? 0) + 1 }
  for (const u of list) {
    const A = cache.get(keyA(u))
    if (!A) { result.set(u.key, null); continue }
    const B = cache.get(keyB(u))
    const ds = disputesOf.get(u.key) ?? []
    const pa = ds.length ? cache.get(adjKey(models.a, u)) : null
    const pb = ds.length ? cache.get(adjKey(models.b, u)) : null
    const decide = (d) => {
      const x = pa?.[d.k]; const y = pb?.[d.k]
      if (x && x === y) return { pick: x, by: '经复议' }
      const rv = ruleVote(d, u, ruleOf)
      if (rv) return { pick: rv, by: '二比一' }
      return { pick: d.kind === '遗漏' ? '乙' : '甲', by: '待人工' }
    }
    const out = []
    A.forEach((a, j) => {
      const r = B?.r?.[j]
      const mine = ds.filter((d) => d.j === j)
      const by = { span: r ? '双模型一致' : '单模型', type: r ? '双模型一致' : '单模型', time: r ? '双模型一致' : '单模型' }
      let cur = { ...a }
      const span = mine.find((d) => d.kind === '边界')
      if (span) {
        const dec = decide(span); bump('边界', dec.by)
        by.span = dec.by
        if (dec.pick === '乙') { if (!span.b) return; cur = { ...span.b }; by.type = by.time = '单模型' }
      } else if (r) bump('边界', '双模型一致')
      const ty = mine.find((d) => d.kind === '分类')
      if (ty) { const dec = decide(ty); bump('分类', dec.by); by.type = dec.by; if (dec.pick === '乙') Object.assign(cur, { t: ty.b.t, sd: ty.b.sd, it: ty.b.it, neg: ty.b.neg, sc: ty.b.sc, act: ty.b.act, past: ty.b.past }) } else if (r && !span) bump('分类', '双模型一致')
      const tm = mine.find((d) => d.kind === '时间')
      if (tm) { const dec = decide(tm); bump('时间', dec.by); by.time = dec.by; if (dec.pick === '乙') Object.assign(cur, { tr: tm.b.tr, tq: tm.b.tq, tn: tm.b.tn }) } else if (r && !span) bump('时间', '双模型一致')
      out.push({ ...cur, by })
    })
    for (const d of ds.filter((x) => x.kind === '遗漏')) {
      const dec = decide(d); bump('遗漏', dec.by)
      if (dec.pick === '乙') out.push({ ...d.b, by: { span: dec.by, type: '单模型', time: '单模型' } })
    }
    result.set(u.key, out)
  }
  stats.ms = Date.now() - t0
  stats.tally = tally
  stats.cacheSize = cache.size()
  return { result, stats }
}

function overlap(x, y) {
  const inter = Math.max(0, Math.min(x.e, y.e) - Math.max(x.s, y.s))
  const uni = Math.max(x.e, y.e) - Math.min(x.s, y.s)
  return uni ? inter / uni : 0
}

/** 规则第三票：规则在同一处的结论和哪一方一致，就投给哪一方；规则没结论返回 null。 */
function ruleVote(d, u, ruleOf) {
  const nm = u.nm ??= normMap(u.text)
  const locA = d.a ? locate(u.text, d.a.q, nm) : null
  const locB = d.b ? locate(u.text, d.b.q, nm) : null
  const rA = locA ? ruleOf(u, locA) : null
  const rB = locB ? ruleOf(u, locB) : null
  switch (d.kind) {
    case '边界':
      if (!d.b) return rA && overlap(rA, locA) >= 0.5 ? '甲' : rA === null && locA ? '乙' : null
      if (rA && overlap(rA, locA) >= 0.9) return '甲'
      if (rB && overlap(rB, locB) >= 0.9) return '乙'
      return null
    case '遗漏':
      return rB && overlap(rB, locB) >= 0.5 ? '乙' : null
    case '分类': {
      if (!rA) return null
      const sa = rA.type === d.a.t && rA.subdivision === d.a.sd
      const sb = rA.type === d.b.t && rA.subdivision === d.b.sd
      return sa && !sb ? '甲' : sb && !sa ? '乙' : null
    }
    case '时间': {
      // 比时间短语本身（日期由代码按各自锚点换算）
      if (!rA) return null
      const rp = normStr(rA.timePhrase ?? '')
      const fromPhrase = /^本句自带|^同句|^同行|^上文/.test(rA.timeSource ?? '')
      const has = (x) => ['本句', '同句', '上文'].includes(x.tr) && x.tq
      if (rp) {
        const ma = has(d.a) && normStr(d.a.tq) === rp; const mb = has(d.b) && normStr(d.b.tq) === rp
        if (ma && !mb) return '甲'
        if (mb && !ma) return '乙'
      }
      if (fromPhrase && has(d.a) !== has(d.b)) return has(d.a) ? '甲' : '乙'
      if (/^栏目默认|写成/.test(rA.timeSource ?? '') && !has(d.a) && !has(d.b)) return null
      return null
    }
    default: return null
  }
}

/* ------------------------------------------------- answers → mentions */

/**
 * 把单位的定案结果变成 S02 提及（含 decided，供 S03 直接采用）。
 * ctx: { encStart: Map, person, ruleMentionsByFragment: Map<fragId, mention[]> }
 */
export function toMentions(units, result, { encStart, person, ruleMentionsByFragment }) {
  const out = []
  const coverage = { meaningful: 0, covered: 0, filled: 0, gaps: 0, noAnswer: 0 }
  const meaningful = /[\u4e00-\u9fa5A-Za-z0-9]/
  // 按片段、栏目顺序处理（叙述栏目要沿用上一句时间）
  const byFrag = new Map()
  for (const u of units) { if (!byFrag.has(u.fragment.id)) byFrag.set(u.fragment.id, []); byFrag.get(u.fragment.id).push(u) }
  for (const [, us] of byFrag) {
    us.sort((a, b) => a.s - b.s)
    let lastSec = null; let lastTime = null
    for (const u of us) {
      const f = u.fragment
      if (u.sec !== lastSec) { lastSec = u.sec; lastTime = null }
      const strat = u.sec.cfg.time
      const written = dayOf(f.visibleAt)
      const anchor = dayOf(f.anchorAt ?? f.visibleAt)
      const admit = strat === 'admitDay' && f.encounterId ? dayOf(encStart.get(f.encounterId)) : null
      const secAnchor = admit ?? anchor
      // 模型指认的时间短语照单换算；代码自己“纠正”时，时长只在叙述病程的栏目或句子里当时间
      const ctx = { anchor: secAnchor, written, birth: person?.birth ?? null, durationEnabled: true }
      const ctxFix = { ...ctx, durationEnabled: Boolean(u.sec.cfg.duration) || DURATION_CONTEXT.test(u.text) }
      const sectionDefault = () => {
        if (strat === 'written') return { ...dayInterval(f.anchorAt ?? f.visibleAt), src: `栏目默认：${u.sec.cfg.label ?? '写成当时'}` }
        if (strat === 'occur') return { ...dayInterval(f.occurAt ?? f.visibleAt), src: `栏目默认：${u.sec.cfg.label ?? '检查时间'}` }
        if (strat === 'admitDay') return admit ? { a: admit, b: admit, prec: '日', src: `栏目默认：${u.sec.cfg.label ?? '入院时'}` } : { ...dayInterval(f.visibleAt), src: '栏目默认：入院时（缺入院时间，取写成当时）' }
        if (strat === 'outpatient') return { ...dayInterval(f.visibleAt), src: '栏目默认：门诊现病史新句取就诊当时' }
        if (strat === 'narrative' && lastTime) return { ...lastTime, src: '前句继承（待复核）' }
        return null
      }
      const resolve = (ans) => {
        // 计划、复查随访：时间短语说的是“以后”（“1月复诊”），发生时间不往前推，取作出决定的时间
        if (ans.act === '计划' || ['D06', 'D07'].includes(codeOf(ans)) && /复诊|复查|随诊|随访|后/.test(ans.q)) {
          return { ...dayInterval(f.anchorAt ?? f.visibleAt), src: '计划：取作出决定的时间' }
        }
        // 规则纠正：提及自己的原文里就有时间短语，模型却说“既往／当时／无” → 以原文时间短语为准
        if (!['本句', '同句', '上文'].includes(ans.tr)) {
          const own = bestPhrase(findTimePhrases(ans.q, ctxFix))
          if (own) { ans = { ...ans, tr: '本句', tq: own.phrase }; ans.by = { ...ans.by, time: '规则纠正' } }
        }
        let t = null
        if (['本句', '同句', '上文'].includes(ans.tr) && ans.tq) {
          const ph = bestPhrase(findTimePhrases(ans.tq, ctx))
          if (ph) t = { a: ph.a, b: ph.b, prec: ph.prec, src: `${ans.tr === '本句' ? '本句自带' : ans.tr === '同句' ? '同句' : '上文'}：${ph.kind}（${ans.by?.time === '规则纠正' ? '规则纠正' : '模型'}）`, phrase: ans.tq }
          else if (ans.tn?.k === '年月') { const [y, m] = ans.tn.v.split('-').map(Number); const [a, b] = monthRange(y, m); t = { a, b, prec: '月', src: `${ans.tr}：年月（模型读出）`, phrase: ans.tq } }
          else if (ans.tn?.k === '日期') { const d = makeDay(...ans.tn.v.split('-').map(Number)); if (d) t = { a: d, b: d, prec: '日', src: `${ans.tr}：日期（模型读出）`, phrase: ans.tq } }
        } else if (ans.tr === '当时') {
          t = strat === 'admitDay' && admit ? { a: admit, b: admit, prec: '日', src: '写成当时（模型）：入院时' }
            : strat === 'occur' ? { ...dayInterval(f.occurAt ?? f.visibleAt), src: '写成当时（模型）：检查时间' }
              : { ...dayInterval(f.anchorAt ?? f.visibleAt), src: '写成当时（模型）' }
        } else if (ans.tr === '既往') t = { a: null, b: written, prec: '无具体', src: '既往（模型）：早于写成日' }
        // 验收门①：区间不倒置、不晚于写成
        if (t && t.a && t.b && t.a > t.b) [t.a, t.b] = [t.b, t.a]
        if (t && t.b && t.b > written) t = null
        return t ?? sectionDefault() ?? { a: null, b: null, prec: '无', src: '无时间' }
      }
      const answers = result.get(u.key)
      const nm = u.nm ??= normMap(u.text)
      const spans = []
      if (answers === null || answers === undefined) coverage.noAnswer++
      let from = 0
      for (let ans of answers ?? []) {
        const loc = locate(u.text, ans.q, nm, from)
        if (!loc) continue
        from = loc.n
        const s = u.s + loc.s; const e = u.s + loc.e
        if (spans.some((x) => x.s === s && x.e === e)) continue
        spans.push({ s, e })
        const t = resolve(ans)
        if (!['本句', '同句', '上文'].includes(ans.tr) && t.src?.startsWith('本句自带')) ans = { ...ans, by: { ...ans.by, time: '规则纠正' } }
        if (t.a || t.b) { if (['本句', '同句', '上文'].includes(ans.tr)) lastTime = { a: t.a, b: t.b, prec: t.prec } }
        const text = f.text.slice(s, e)
        const fut = ans.act === '计划'
        out.push({
          id: mentionId(f.id, s, e), fragmentId: f.id, recordType: f.recordType, kind: '文书', writtenAt: f.visibleAt, encounterId: f.encounterId ?? null,
          section: u.sec.name, sentence: u.sentence, s, e, text, scope: ans.sc, timePhrase: t.phrase ?? '', timeSource: t.src,
          occurFrom: t.a ?? null, occurTo: t.b ?? null, precision: t.prec ?? '无', anchor: secAnchor,
          rules: { extract: 'LLM' }, by: ans.by,
          decided: {
            type: ans.t, subdivision: ans.sd, item: ans.it, negative: Boolean(ans.neg), future: ans.t === '决策' && fut, action: ans.t === '决策' ? ({ 启动: '启动／执行', 计划: '计划' }[ans.act] ?? ans.act) : '',
            subclass: deriveSubclass({ ...ans, fut }, { text, recordType: f.recordType, section: u.sec.name }),
            past: Boolean(ans.past),
          },
        })
      }
      // 覆盖检查：有意义的字没被任何提及覆盖 → 用规则在这里抽的提及补上
      const covered = new Uint8Array(u.e - u.s)
      for (const sp of spans) covered.fill(1, sp.s - u.s, sp.e - u.s)
      let mean = 0; let cov = 0
      for (let i = 0; i < covered.length; i++) if (meaningful.test(f.text[u.s + i])) { mean++; if (covered[i]) cov++ }
      coverage.meaningful += mean; coverage.covered += cov
      for (const rm of ruleMentionsByFragment.get(f.id) ?? []) {
        if (rm.s < u.s || rm.e > u.e) continue
        let gap = 0; let len = 0
        for (let i = rm.s; i < rm.e; i++) if (meaningful.test(f.text[i])) { len++; if (!covered[i - u.s]) gap++ }
        if (len && gap / len >= 0.6 && gap >= 2) {
          coverage.filled++; coverage.covered += gap
          out.push({ ...rm, by: { span: '规则补漏', type: '规则补漏', time: '规则补漏' }, rules: { ...rm.rules, extract: '规则补漏' } })
          covered.fill(1, rm.s - u.s, rm.e - u.s)
        }
      }
      let run = 0
      for (let i = 0; i <= covered.length; i++) {
        if (i < covered.length && !covered[i] && meaningful.test(f.text[u.s + i])) run++
        else { if (run >= 3) coverage.gaps++; run = 0 }
      }
    }
  }
  return { mentions: out, coverage }
}
