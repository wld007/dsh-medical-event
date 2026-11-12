/**
 * S02 提及抽取（工序1 v1.2）：片段 → 提及。
 * 栏目 → 句 → 分句 → 顿号拆分与修饰继承 → 过滤 → 挂发生时间 → 校验。
 */
import { mentionId } from './ids.js'
import { findTimePhrases, bestPhrase, resolveAdverb, dayOf } from './time.js'
import { trimSpan, splitBy, splitTemplate, splitDun, splitCells, splitQuoteTail, SENTENCE, CLAUSE } from './text.js'

const SCOPE = /^(否认|无|予|有|口服)/
export const DURATION_CONTEXT = /史|病程|血透|透析|尿毒症/

export const PHRASE_LABEL = {
  日期区间: '本句自带：原文日期', 日期: '本句自带：原文日期', 年月: '本句自带：原文年月',
  月日: '本句自带：原文月日（年份取写成年）', 相对: '本句自带：相对写成日', 起病: '本句自带：相对写成日（N天来／N天无诱因…）',
  昨今: '本句自带：昨／今', 时长: '本句自带：病程时长（起点）', 年龄: '年龄换算：出生日期＋岁数',
}
export const ADVERB_LABEL = {
  目前: '时间副词：目前／现：写成当时', 期间: '时间副词：期间：从上文时间起至写成日', 之后: '时间副词：之后：从上文时间结束起至写成日',
  自发病以来: '时间副词：自发病以来：至写成日', 既往: '时间副词：既往／平素／近期：早于写成日，无具体时间', 起初: '时间副词：起初：同上文起点',
}

export function sectionConfig(sections, f) {
  return sections[`${f.recordType}/${f.field}`] ?? sections[f.recordType] ?? null
}

/** → [{ name, cfg, s, e }] content spans (headings excluded). */
export function findSections(text, cfg) {
  if (cfg.whole) {
    const m = text.match(new RegExp(`^\\s*${cfg.whole}\\s*[:：]?`))
    return [{ name: cfg.whole, cfg, s: m ? m[0].length : 0, e: text.length }]
  }
  const heads = []
  for (const sec of cfg.list) {
    const re = new RegExp(sec.re.source, sec.re.flags.replace('g', ''))
    const m = re.exec(text)
    if (m) heads.push({ name: sec.name, cfg: sec, at: m.index, s: m.index + m[0].length })
  }
  heads.sort((a, b) => a.at - b.at)
  const out = []
  if (!cfg.skipPreamble && heads.length && heads[0].at > 0 && text.slice(0, heads[0].at).trim()) {
    out.push({ name: '', cfg: { time: 'selfOnly' }, s: 0, e: heads[0].at })
  }
  heads.forEach((h, i) => out.push({ name: h.name, cfg: h.cfg, s: h.s, e: i + 1 < heads.length ? heads[i + 1].at : text.length }))
  if (!heads.length && !cfg.skipPreamble) out.push({ name: '', cfg: { time: 'selfOnly' }, s: 0, e: text.length })
  return out
}

/** Sentences of a section → [[clause spans…]…] with 顿号 pieces and scope. */
function clausesOf(text, sec) {
  const sentences = []
  if (sec.cfg.lines) {
    for (const [a, b] of splitBy(text, sec.s, sec.e, /\n/g)) sentences.push([[a, b]])
  } else if (sec.cfg.template) {
    // 查体模板：只按换行、制表符、多空格（及句号）切，不再按逗号切（工序1 切分细则）
    // 但英文逗号、分号仍切（“意识清醒,脉搏84次/分,呼吸20次/分”逐项成提及；“左0.3cm，右0.3cm”不拆）
    for (const [a, b] of splitTemplate(text, sec.s, sec.e)) sentences.push(splitBy(text, a, b, /,(?!\d)|[;；]/g))
  } else {
    for (const [a, b] of splitBy(text, sec.s, sec.e, SENTENCE)) {
      const cells = sec.cfg.cells ? splitCells(text, a, b) : null
      sentences.push(cells ?? splitBy(text, a, b, sec.cfg.clause === 'semicolon' ? /[；;]/g : CLAUSE).flatMap(([x, y]) => splitQuoteTail(text, x, y)))
    }
  }
  return sentences.map((clauses) => {
    const pieces = []
    for (const [a0, b0] of clauses) {
      const [a, b] = trimSpan(text, a0, b0)
      if (b <= a) continue
      const head = text.slice(a, b).match(SCOPE)
      const dun = sec.cfg.lines ? [[a, b]] : splitDun(text, a, b)
      for (const [x0, y0] of dun) {
        const [x, y] = trimSpan(text, x0, y0)
        if (y > x) pieces.push({ s: x, e: y, scope: head && dun.length > 1 ? head[1] : '', clauseStart: a })
      }
    }
    return pieces
  }).filter((p) => p.length)
}

export function isNoise(str, noise, nextChar) {
  if (!str || /^[\s\p{P}\p{S}]*$/u.test(str)) return true
  // 只有栏目标签（“一般情况:”；冒号可能已被修剪掉，看后一个字符）
  const label = /[:：]$/.test(str) ? str : /[:：]/.test(nextChar ?? '') ? str + '：' : null
  if (label && /^[\u4e00-\u9fa5A-Za-z\s()（）·]{1,12}[:：]$/.test(label)) return true
  return noise.some((re) => re.test(str))
}

export function dayInterval(instant) {
  const d = dayOf(instant)
  return d ? { a: d, b: d, prec: '日' } : null
}

export function extractMentions({ fragments, encounters, person }, sourcePack, vocab = {}) {
  const sections = sourcePack.sections ?? {}
  const noise = sourcePack.noise ?? []
  const encStart = new Map(encounters.map((e) => [e.id, e.start]))
  const mentions = []
  const failures = []

  for (const f of fragments) {
    if (f.recordType === '基本信息') continue
    const written = dayOf(f.visibleAt)
    const base = {
      fragmentId: f.id, recordType: f.recordType, kind: f.kind, writtenAt: f.visibleAt,
      encounterId: f.encounterId ?? null,
    }
    if (f.kind === '结构化') {
      const t = dayInterval(f.occurAt ?? f.visibleAt)
      mentions.push({
        id: mentionId(f.id, 0, f.text.length), ...base, section: f.recordType, sentence: 0, s: 0, e: f.text.length,
        text: f.text, scope: '', anchor: written, timePhrase: '', timeSource: `结构化字段：${f.occurAt ? '发生时间' : f.visibleBasis}`,
        occurFrom: t?.a ?? null, occurTo: t?.b ?? null, precision: t?.prec ?? '无', rules: { extract: 'STRUCT' },
      })
      continue
    }
    const cfg = sectionConfig(sections, f)
    if (!cfg) { failures.push({ gate: 'S02', fragmentId: f.id, problem: `没有栏目配置：${f.recordType}/${f.field}` }); continue }
    const anchor = dayOf(f.anchorAt ?? f.visibleAt)
    const text = f.text
    let sentenceNo = 0
    for (const sec of findSections(text, cfg)) {
      const strat = sec.cfg.time
      // 出院记录“入院情况”：叙述锚点是入院日（“气急2天”入院 → 入院前 2 天）
      const admit = strat === 'admitDay' && f.encounterId ? dayOf(encStart.get(f.encounterId)) : null
      const secAnchor = admit ?? anchor
      const narrative = strat === 'narrative' || strat === 'outpatient'
      let prevInterval = null // last resolved time in the section (for adverbs)
      let prevSentenceTime = null
      for (const pieces of clausesOf(text, sec)) {
        sentenceNo++
        let sentenceTime = null
        let lineDate = null // 行首日期（“（2017-08-02本院）血常规：…”），供同行继承
        let lastSubject = null // 查体主语（“右上肢内瘘血管震颤弱，杂音弱”的“右上肢内瘘血管”）
        const sentenceStr = text.slice(pieces[0].clauseStart, pieces[pieces.length - 1].e)
        const durationEnabled = Boolean(sec.cfg.duration) || DURATION_CONTEXT.test(sentenceStr)
        for (let i = 0; i < pieces.length; i++) {
          const p = pieces[i]
          const str = text.slice(p.s, p.e)
          if (isNoise(str, noise, text[p.e])) continue
          const ctx = { anchor: secAnchor, written, birth: person?.birth ?? null, durationEnabled }
          const phrase = bestPhrase(findTimePhrases(str, ctx))
          let t = null; let src; let phraseText = ''
          if (phrase) { t = phrase; src = PHRASE_LABEL[phrase.kind]; phraseText = phrase.phrase }
          if (!t && narrative) {
            const adv = resolveAdverb(str, { written: secAnchor, prev: prevInterval })
            if (adv) { t = adv; src = ADVERB_LABEL[adv.kind]; phraseText = adv.phrase }
          }
          if (t) {
            sentenceTime = t
            if (i === 0 && phrase && /日期|年月/.test(phrase.kind) && phrase.start <= 12) lineDate = t
          } else if (sentenceTime && narrative) {
            t = sentenceTime; src = '同句继承'
          } else if (lineDate && sec.cfg.lineInherit) {
            t = lineDate; src = '同行继承：行首日期'
          } else if (strat === 'narrative' && prevSentenceTime) {
            t = prevSentenceTime; src = '前句继承（待复核）'
          } else if (strat === 'outpatient') {
            t = dayInterval(f.visibleAt); src = '栏目默认：门诊现病史新句取就诊当时'
          } else if (strat === 'written') {
            // 写成当时取叙述锚点：第二版入院记录的查体仍在文内记录时间
            t = dayInterval(f.anchorAt ?? f.visibleAt); src = `栏目默认：${sec.cfg.label ?? '写成当时'}`
          } else if (strat === 'occur') {
            t = dayInterval(f.occurAt ?? f.visibleAt); src = `栏目默认：${sec.cfg.label ?? '检查时间'}`
          } else if (strat === 'admitDay') {
            t = admit ? { a: admit, b: admit, prec: '日' } : dayInterval(f.visibleAt)
            src = admit ? `栏目默认：${sec.cfg.label ?? '入院时'}` : '栏目默认：入院时（缺入院时间，取写成当时）'
          } else src = '无时间'
          if (t && (t.a || t.b)) prevInterval = t
          // 主语继承：查体发现词前面的部位作主语；只有发现词、没有部位的分句沿用同句上一个主语
          let subject = null
          if (vocab.EXAM_FINDING) {
            const fm = str.match(vocab.EXAM_FINDING)
            if (fm && fm.index > 0) lastSubject = str.slice(0, fm.index).replace(/^.*[：:]/, '').replace(/^(?:入院|出院)?查体/, '') || lastSubject
            else if (fm && fm.index === 0 && lastSubject) subject = lastSubject
            else if (!fm) lastSubject = null
          }
          const m = {
            id: mentionId(f.id, p.s, p.e), ...base, section: sec.name, sentence: sentenceNo, s: p.s, e: p.e, text: str,
            ...(subject ? { subject } : {}),
            scope: p.scope, timePhrase: phraseText, timeSource: src,
            occurFrom: t?.a ?? null, occurTo: t?.b ?? null, precision: t ? t.prec : '无',
            anchor: secAnchor, rules: { extract: `S02/${strat}` },
          }
          mentions.push(m)
        }
        if (sentenceTime) prevSentenceTime = sentenceTime
      }
    }
  }
  return { mentions, failures: [...failures, ...checkGate1(mentions, fragments)] }
}

/** 验收门①：逐字一致；区间不倒置；文书提及发生时间不晚于写成时间。 */
export function checkGate1(mentions, fragments) {
  const byId = new Map(fragments.map((f) => [f.id, f]))
  const out = []
  for (const m of mentions) {
    const f = byId.get(m.fragmentId)
    if (!f || f.text.slice(m.s, m.e) !== m.text) out.push({ gate: '①逐字', mentionId: m.id })
    if (m.occurFrom && m.occurTo && m.occurFrom > m.occurTo) out.push({ gate: '①区间倒置', mentionId: m.id })
    if (m.kind === '文书' && m.occurTo && m.occurTo > dayOf(m.writtenAt)) out.push({ gate: '①晚于写成', mentionId: m.id, occurTo: m.occurTo, written: dayOf(m.writtenAt) })
  }
  return out
}
