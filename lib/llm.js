/**
 * OpenAI-compatible chat client (same contract as dsh-medical-anonymizer).
 * Patient text only goes to the endpoint configured by the user.
 */
export class LlmError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status }
}

export function createLlm({ baseURL, model, apiKey = '', timeoutMs = 120000, temperature = 0, disableThinking = true }) {
  const base = String(baseURL ?? '').replace(/\/+$/, '')
  async function chat(messages, { signal, maxTokens = 2000 } = {}) {
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
