/**
 * 模型并发闸门：两个模型（通读模型、核验模型）各自的并发上限与计数，放在一块 SharedArrayBuffer 里，
 * 所有工作线程和主线程（格式识别）共用；主线程每 2 秒采样，画模型房子的灯、管子和并发曲线。
 *
 * 槽（slot）＝一个模型服务：提取模型是 0；核验模型和提取模型同端点、同模型时也用 0（共用一个上限），否则是 1。
 * 工序（station）：0 格式识别、1 通读（提取模型）、2 核验、3 复查。
 *
 *   Int32   [s]            槽 s 在途
 *           [2+s]          槽 s 排队
 *           [4+s*4+st]     槽 s、工序 st 在途
 *           [12+s]         槽 s 当前的并发上限（自动调并发时主线程会改，各线程每次取名额时读）
 *   BigInt64（字节 64 起）[s] 槽 s 完成的调用数   [2+s] 槽 s 的 token 数   [4+s] 槽 s 失败的调用数（含重试后仍失败）
 *
 * 线程被强行结束时计数可能不归零——每个批次用新的一块，不影响下一批。
 */
export const GATE_BYTES = 128
export const STATIONS = ['format', 'extract', 'verify', 'adjudicate']
export const STATION_NM = { format: '格式识别', extract: '通读', verify: '核验', adjudicate: '复查' }

const hostOf = (u) => { try { return new URL(u).host } catch { return String(u ?? '') } }

/**
 * 两个模型分到哪个槽、各自的上限。
 * Returns { extract: { slot, max, model, host }, verify: { slot, max, model, host } | null, slots: [{ slot, max, model, host, roles }] }
 */
export function modelSlots(settings = {}, chatImpl = null) {
  const eModel = chatImpl?.extract?.model ?? settings.model
  const eBase = chatImpl?.extract ? 'local' : settings.baseURL
  const extract = { slot: 0, max: Math.max(1, Number(settings.modelConcurrency) || 8), model: eModel, host: chatImpl?.extract ? '测试' : hostOf(eBase), base: chatImpl?.extract ? null : eBase }
  let verify = null
  const vModel = chatImpl?.verify?.model ?? (settings.verifyModel || null)
  if (vModel) {
    const vBase = chatImpl?.verify ? 'local' : settings.verifyBaseURL || settings.baseURL
    const same = vModel === eModel && vBase === eBase
    verify = same ? { ...extract } : { slot: 1, max: Math.max(1, Number(settings.verifyConcurrency) || Number(settings.modelConcurrency) || 8), model: vModel, host: chatImpl?.verify ? '测试' : hostOf(vBase), base: chatImpl?.verify ? null : vBase }
  }
  const slots = [{ ...extract, roles: ['extract'] }]
  if (verify) { if (verify.slot === 0) slots[0].roles.push('verify'); else slots.push({ ...verify, roles: ['verify'] }) }
  return { extract, verify, slots }
}

/** 自动调并发的最高档 */
export const MAX_CONCURRENCY = 64

/** 设定（或改）一个槽的并发上限；调高时叫醒等名额的请求 */
export function setLimit(sab, slot, value) {
  const n = new Int32Array(sab, 0, 16)
  Atomics.store(n, 12 + slot, Math.max(1, Math.min(MAX_CONCURRENCY, Math.round(value))))
  Atomics.notify(n, slot)
}

/** 一个槽、一道工序的限流器：limit(fn)；limit.tally(tokens) 记一次完成的调用。上限从共享内存里读（没设过就用 max） */
export function gateLimiter(sab, { slot, max, station }) {
  const n = new Int32Array(sab, 0, 16)
  const big = new BigInt64Array(sab, 64, 8)
  const st = Math.max(0, STATIONS.indexOf(station))
  Atomics.compareExchange(n, 12 + slot, 0, Math.max(1, max))
  const acquire = async () => {
    Atomics.add(n, 2 + slot, 1)
    for (;;) {
      const cur = Atomics.load(n, slot)
      if (cur < Atomics.load(n, 12 + slot)) { if (Atomics.compareExchange(n, slot, cur, cur + 1) === cur) break; continue }
      const r = Atomics.waitAsync(n, slot, cur, 1000)
      if (r.async) await r.value
    }
    Atomics.sub(n, 2 + slot, 1); Atomics.add(n, 4 + slot * 4 + st, 1)
  }
  const release = () => { Atomics.sub(n, 4 + slot * 4 + st, 1); Atomics.sub(n, slot, 1); Atomics.notify(n, slot, 1) }
  const limit = async (fn) => { await acquire(); try { return await fn() } finally { release() } }
  limit.tally = (tokens) => { Atomics.add(big, slot, 1n); Atomics.add(big, 2 + slot, BigInt(Math.max(0, Math.round(tokens || 0)))) }
  limit.fail = () => { Atomics.add(big, 4 + slot, 1n) }
  return limit
}

/** 把一个模型客户端包上限流（格式识别在主线程里用） */
export function gated(llm, limit) {
  return { ...llm, model: llm.model, chat: (m, o) => limit(async () => { try { const r = await llm.chat(m, o); limit.tally((r.usage?.prompt_tokens ?? 0) + (r.usage?.completion_tokens ?? 0)); return r } catch (e) { limit.fail(); throw e } }) }
}

/** 读一块计数（主线程采样用） */
export function readGate(sab) {
  const n = new Int32Array(sab, 0, 16); const big = new BigInt64Array(sab, 64, 8)
  const L = (i) => Atomics.load(n, i)
  return {
    inflight: [L(0), L(1)], waiting: [L(2), L(3)],
    done: [Number(Atomics.load(big, 0)), Number(Atomics.load(big, 1))], tokens: [Number(Atomics.load(big, 2)), Number(Atomics.load(big, 3))],
    byStation: [[L(4), L(5), L(6), L(7)], [L(8), L(9), L(10), L(11)]],
    failed: [Number(Atomics.load(big, 4)), Number(Atomics.load(big, 5))],
    limits: [L(12), L(13)],
  }
}

/**
 * 推理服务器的负载（vLLM 风格的 Prometheus 端点 `<服务器>/metrics`）：服务器上在跑、排队的请求数，KV 缓存占用，
 * 服务器的生成速率（含其他客户端）。只读，不发任何病历内容和 Key；连续 3 次读不到就记为不可用，页面只看插件自己的数字。
 */
export function createServerProbe(entry, baseURL, model) {
  const url = `${String(baseURL).replace(/\/+$/, '').replace(/\/v1$/, '')}/metrics`
  let failures = 0; let busy = false; let lastGen = null
  Object.assign(entry, { available: null, samples: [], peakRunning: 0, peakWaiting: 0, peakKv: 0 })
  return async () => {
    if (busy || failures >= 3) return
    busy = true
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3000)
      let text
      try {
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        text = await res.text()
      } finally { clearTimeout(timer) }
      const read = parseServerMetrics(text, model)
      if (!read) throw new Error('no vllm metrics')
      const at = Date.now()
      let genRate = null
      if (lastGen && read.generated != null && read.generated >= lastGen.value && at > lastGen.at) genRate = ((read.generated - lastGen.value) / (at - lastGen.at)) * 1000
      if (read.generated != null) lastGen = { value: read.generated, at }
      failures = 0
      Object.assign(entry, { available: true, running: read.running, waiting: read.waiting, kv: read.kv, genRate, at })
      entry.peakRunning = Math.max(entry.peakRunning, read.running); entry.peakWaiting = Math.max(entry.peakWaiting, read.waiting); entry.peakKv = Math.max(entry.peakKv, read.kv ?? 0)
      entry.samples.push([read.running, read.waiting, read.kv ?? 0, genRate == null ? null : Math.round(genRate)])
      if (entry.samples.length > 24) entry.samples.shift()
    } catch {
      failures++
      if (failures >= 3 && entry.available !== true) entry.available = false
    } finally { busy = false }
  }
}

/** vLLM 的几个指标（多个引擎相加）；没有时 null */
export function parseServerMetrics(text, model) {
  const v = { running: 0, waiting: 0, kv: null, generated: null }
  let seen = false
  for (const line of String(text ?? '').split('\n')) {
    const m = /^vllm:(num_requests_running|num_requests_waiting|kv_cache_usage_perc|gpu_cache_usage_perc|generation_tokens_total)(\{[^}]*\})?\s+([0-9.eE+-]+)/.exec(line)
    if (!m) continue
    const name = /model_name="([^"]*)"/.exec(m[2] ?? '')?.[1]
    if (model && name && name !== model) continue
    const x = Number(m[3]); if (!Number.isFinite(x)) continue
    seen = true
    if (m[1] === 'num_requests_running') v.running += x
    else if (m[1] === 'num_requests_waiting') v.waiting += x
    else if (m[1] === 'generation_tokens_total') v.generated = (v.generated ?? 0) + x
    else v.kv = Math.max(v.kv ?? 0, x)
  }
  return seen ? v : null
}

/**
 * 自动调并发（同匿名化插件）：一个模型服务找吞吐最高的并发。吞吐＝窗口内完成调用的输入＋输出 token／秒。
 * 名额没跑满的窗口量到的是活的供给、不是并发，不下结论。每个窗口（默认 30 秒）：
 *  - 失败 ≥ 5%：降四分之一，旧档记为上限 10 分钟；
 *  - 刚加过：吞吐涨不到 5% 就退回，那一档记为上限；刚降过：吞吐掉超过 5% 就回升，否则留在低档；
 *  - 服务器排队或 KV 将满（vLLM /metrics）：不再加，试降一档，吞吐不变才保留；
 *  - 名额全满且有排队：加一半。不超过 MAX_CONCURRENCY；活太少时等着。
 * read() → { active, queued, limit, done, tokens, failed }；set(n) 改上限；server() → 服务器条目
 */
export function createTuner({ state, read, set, server = () => null, windowMs = 30000, now = () => Date.now(), max = MAX_CONCURRENCY }) {
  let samples = 0; let full = 0; let busy = 0; let last = null; let pending = null; let ceilingUntil = 0; let windowStart = now()
  const change = (to, reason, thr) => {
    const from = state.limit
    to = Math.max(1, Math.min(max, Math.round(to)))
    if (to === from) return false
    state.limit = to; set(to)
    state.history.push({ at: new Date(now()).toISOString(), from, to, reason, thr: Math.round(thr) })
    if (state.history.length > 60) state.history.shift()
    return true
  }
  const cap = (t) => { state.ceiling = state.limit; ceilingUntil = t + 10 * 60000 }
  return function tick() {
    const g = read()
    samples++
    if (g.active >= g.limit) { full++; if (g.queued > 0) busy++ }
    const t = now()
    if (t - windowStart < windowMs) return
    const seconds = (t - windowStart) / 1000
    const base = last ?? { done: 0, tokens: 0, failed: 0 }
    const ok = g.done - base.done; const fails = g.failed - base.failed
    const thr = g.tokens > base.tokens ? (g.tokens - base.tokens) / seconds : (ok / seconds) * 1000
    const fullShare = samples ? full / samples : 0; const busyShare = samples ? busy / samples : 0
    last = { done: g.done, tokens: g.tokens, failed: g.failed }; windowStart = t; samples = 0; full = 0; busy = 0
    state.thr = Math.round(thr)
    if (state.ceiling && t > ceilingUntil) state.ceiling = null
    if (fails > 0 && fails / Math.max(1, ok + fails) >= 0.05) { cap(t); pending = null; change(Math.floor(state.limit * 0.75), 'errors', thr); return }
    if (ok < 3) return
    const saturated = fullShare >= 0.6
    if (pending) {
      if (!saturated) { pending.waited++; if (pending.waited >= 3) pending = null; return }
      const step = pending; pending = null
      if (step.kind === 'up' && thr < step.thr * 1.05) { cap(t); change(step.from, 'flat', thr); return }
      if (step.kind === 'down' && thr < step.thr * 0.95) { change(step.from, 'back', thr); return }
      if (step.kind === 'down') return
    }
    const sv = server()
    const recent = sv?.available ? sv.samples.slice(-6) : []
    const waiting = recent.length ? recent.reduce((a, row) => a + (row[1] ?? 0), 0) / recent.length : 0
    const kv = recent.length ? Math.max(...recent.map((row) => row[2] ?? 0)) : 0
    if (waiting >= 1 || kv >= 0.92) {
      cap(t)
      if (saturated && state.limit > 1) { pending = { kind: 'down', from: state.limit, thr, waited: 0 }; change(state.limit - Math.max(1, Math.round(state.limit * 0.15)), 'server', thr) }
      return
    }
    const top = Math.min(max, state.ceiling ? state.ceiling - 1 : max)
    if (saturated && busyShare >= 0.6 && state.limit < top) { pending = { kind: 'up', from: state.limit, thr, waited: 0 }; change(Math.min(top, state.limit + Math.max(1, Math.round(state.limit * 0.5))), 'up', thr) }
  }
}
