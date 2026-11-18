/**
 * OpenAI-compatible chat client (same contract as dsh-medical-anonymizer).
 * Patient text only goes to the endpoint configured by the user.
 */
export class LlmError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status }
}

const RETRY_DELAYS = [1000, 4000, 12000]
const retryable = (e) => e instanceof LlmError && (e.code === 'network' || e.code === 'timeout' || (e.code === 'http-error' && (e.status === 429 || e.status >= 500)))
const sleep = (ms, signal) => new Promise((resolve) => { const t = setTimeout(resolve, ms); signal?.addEventListener?.('abort', () => { clearTimeout(t); resolve() }, { once: true }) })

export function createLlm({ baseURL, model, apiKey = '', timeoutMs = 120000, temperature = 0, disableThinking = true, retries = RETRY_DELAYS }) {
  const base = String(baseURL ?? '').replace(/\/+$/, '')
  /** 连接断开、超时、429／5xx：退避后重试（最多 3 次）；其余错误直接抛出。 */
  async function chat(messages, opts = {}) {
    for (let i = 0; ; i++) {
      try { return { ...(await chatOnce(messages, opts)), retries: i } } catch (e) {
        if (i >= retries.length || !retryable(e) || opts.signal?.aborted) { if (e && typeof e === 'object') e.retries = i; throw e }
        await sleep(retries[i], opts.signal)
      }
    }
  }
  async function chatOnce(messages, { signal, maxTokens = 2000 } = {}) {
    if (!base) throw new LlmError('未配置模型端点（baseURL）', 'no-base-url')
    if (!model) throw new LlmError('未配置模型名称（model）', 'no-model')
    const body = { model, messages, temperature, max_tokens: maxTokens, stream: false }
    if (disableThinking) body.chat_template_kwargs = { enable_thinking: false }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const t0 = Date.now()
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.any([controller.signal, signal].filter(Boolean)),
      })
      const text = await res.text()
      let data = null
      try { data = JSON.parse(text) } catch { /* raw */ }
      if (!res.ok) throw new LlmError(`模型端点返回 ${res.status}: ${data?.error?.message ?? text.slice(0, 300)}`, 'http-error', res.status)
      const content = data?.choices?.[0]?.message?.content ?? ''
      return { content: String(content), usage: data?.usage ?? null, ms: Date.now() - t0 }
    } catch (error) {
      if (error instanceof LlmError) throw error
      if (signal?.aborted) throw new LlmError('模型请求已取消', 'aborted')
      if (controller.signal.aborted) throw new LlmError(`模型请求超时（${Math.round(timeoutMs / 1000)} 秒）`, 'timeout')
      throw new LlmError(`无法连接模型端点: ${error?.message ?? error}`, 'network')
    } finally {
      clearTimeout(timer)
    }
  }
  return { chat, model }
}

/** 模型列表（GET /models）：只给设置页的模型下拉用，不发病历内容。 */
export async function listModels({ baseURL, apiKey = '', timeoutMs = 10000 }) {
  const base = String(baseURL ?? '').trim().replace(/\/+$/, '')
  if (!base) return { ok: false, models: [], error: '先填写模型端点' }
  try {
    const res = await fetch(`${base}/models`, { headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {}, signal: AbortSignal.timeout(timeoutMs) })
    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch { /* raw */ }
    if (!res.ok) return { ok: false, models: [], error: `端点返回 ${res.status}${res.status === 404 ? '（该地址没有 /models，请检查端点是否以 /v1 结尾）' : res.status === 401 || res.status === 403 ? '（API Key 不对或没填）' : ''}` }
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : []
    return { ok: true, models: [...new Set(list.map((m) => (typeof m === 'string' ? m : m?.id ?? m?.name)).filter(Boolean).map(String))].sort() }
  } catch (e) {
    return { ok: false, models: [], error: e?.name === 'TimeoutError' ? `连接超时（${Math.round(timeoutMs / 1000)} 秒）` : `无法连接：${e?.cause?.code ?? e?.message ?? e}` }
  }
}

/** First JSON object/array in a reply (tolerates ```json fences and thinking text). */
export function extractJson(text) {
  const s = String(text).replace(/<think>[\s\S]*?<\/think>/g, '')
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1] : s
  const start = body.search(/[[{]/)
  if (start < 0) return null
  for (let end = body.length; end > start; end--) {
    const ch = body[end - 1]
    if (ch !== '}' && ch !== ']') continue
    try { return JSON.parse(body.slice(start, end)) } catch { /* shorter */ }
  }
  return null
}
