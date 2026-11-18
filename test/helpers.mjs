export { extractJson as extractJsonForTest } from '../lib/llm.js'

/**
 * 规则式的假模型（不发任何网络请求）：
 *   甲按逗号切；乙同意切分，但把含“无”的判成症状（甲判成查体）→ 分类分歧。
 *   复查时甲改口用对方的（stubborn: 两边都坚持）。
 */
export function fakeModels({ stubborn = false } = {}) {
  const ext = (prompt) => {
    const blocks = prompt.split(/\n\n(?=\[\d+\])/).filter((b) => /^\[\d+\]/.test(b))
    return { s: blocks.map((b) => { const i = Number(b.match(/^\[(\d+)\]/)[1]); const sent = b.match(/句：(.*)/)[1]; return { i, m: sent.split(/[，,。；]/).map((q) => q.trim()).filter((q) => q.length > 1).map((q) => ({ q, c: /无/.test(q) ? 'F03' : 'F02', neg: /无/.test(q) ? 1 : 0, tr: '当时' })) } }) }
  }
  const review = (p, pick) => ({ content: JSON.stringify({ d: [...p.matchAll(/^\{(\d+)\}/gm)].map((m) => ({ d: Number(m[1]), pick, reason: 'mock' })) }), ms: 1, usage: { prompt_tokens: 10, completion_tokens: 5 } })
  const a = { model: 'fake-a', chat: async (msgs) => {
    const p = msgs.at(-1).content
    if (p.startsWith('下面这些病历提及')) return review(p, stubborn ? '我的' : '对方')
    if (p.startsWith('另一位标注者')) throw new Error('甲不做审核')
    return { content: JSON.stringify(ext(p)), ms: 1, usage: { prompt_tokens: 100, completion_tokens: 50 } }
  } }
  const b = { model: 'fake-b', chat: async (msgs) => {
    const p = msgs.at(-1).content
    if (p.startsWith('下面这些病历提及')) return review(p, '我的')
    const e = ext(p)
    return { content: JSON.stringify({ s: e.s.map((x) => ({ i: x.i, r: x.m.map((m, j) => ({ j: j + 1, ok: 1, ...m, c: /无/.test(m.q) ? 'F02' : m.c })), miss: [] })) }), ms: 1, usage: { prompt_tokens: 100, completion_tokens: 50 } }
  } }
  return { a, b }
}

/** 通读用假模型＋格式识别用假模型合成一对（按系统提示分流：通读的系统提示是标注员） */
export function withFormat(fmtA, fmtB, opts = {}) {
  const read = fakeModels(opts)
  const route = (fmt, rd) => (fmt ? { model: fmt.model, asked: fmt.asked, chat: (msgs, o) => (/病历结构化标注员/.test(msgs[0]?.content ?? '') ? rd.chat(msgs, o) : fmt.chat(msgs, o)) } : null)
  return { a: route(fmtA, read.a), b: route(fmtB, read.b) }
}
