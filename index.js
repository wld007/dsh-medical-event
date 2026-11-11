/**
 * Host half of the 病历事件还原 bundle.
 *
 * Registers agent tools, the /event command and one authenticated browser RPC
 * channel. Every caller shares the same service.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createService } from './lib/service.js'

export const name = 'medical-event'
export const inject = ['tools']

const CHANNEL = '/medical-event'
const ENTRY_ID = 'medical-event'

const DATA_BOUNDARY = '病历内容只发往用户在插件设置中配置的模型端点（通常为本机或内网）；未配置模型时只在本机用规则处理。'

export function apply(ctx, config = {}) {
  const workingDirectory = ctx.get('workingDirectory')
  const defaultDirectory = workingDirectory?.defaultDirectory ?? process.cwd()
  const stateDir = process.env.DSH_PROFILE_DIR
    ? join(process.env.DSH_PROFILE_DIR, 'plugin-data', 'medical-event')
    : join(homedir(), '.dsh', 'plugin-data', 'medical-event')
  const service = createService({ config, defaultDirectory, stateDir })
  if (typeof ctx.effect === 'function') ctx.effect(() => () => service.dispose(), 'medical-event: cancel running batch')

  ctx.tools.register(tool({
    name: 'event_start',
    description: `dsh-medical-event 插件（病历事件还原）：把区域平台导出的病历（p_doc_*.json，按月分文件；通常是 dsh-medical-anonymizer 的交付目录）还原成可计算的事件：每处提及记一条并挂写成时间与发生时间、标事实／判断／决策类型、把同一件事归并成事件、登记记录之间的冲突，四道验收门不通过不往下游交。按病人分组处理，每位病人交付一个事件包（manifest、提及、事件、发现，及用药暴露区间、检验长表等导出）；报告与人工裁定放在输出根目录的 _records。绝不修改源文件。${DATA_BOUNDARY}立即返回批次 id。`,
    parameters: {
      inputDir: { type: 'string', description: '病人导出目录（一位病人，或包含多位病人的上级目录）的绝对路径或相对工作区的路径。' },
      outputRoot: { type: 'string', description: '输出根目录，不能与输入相同或包含输入；省略时用设置里的默认值，再缺省为输入旁的 _medical-event。' },
      asOf: { type: 'string', description: '截至时刻 "YYYY-MM-DD HH:mm"：只用此刻以前写成的记录还原（评测截断用）；省略则不截断。' },
      resumeFrom: { type: 'string', description: '继续处理一个已取消或失败的批次（填它的批次 id）；已完成的病人和模型调用直接复用。' },
    },
    execute: async (args, exec) => service.start({
      inputDir: args.inputDir, outputRoot: args.outputRoot, asOf: args.asOf, resumeFrom: args.resumeFrom,
      source: { kind: 'agent', sessionId: sessionIdOf(exec?.agent) },
    }),
    render: (args, value) => [{ type: 'text', text: `已启动批次 ${value.runId}（${value.modelConfigured ? `模型 ${value.model}` : '未配置模型，仅规则'}）。用 event_status 查看进度。` }],
  }))

  ctx.tools.register(tool({
    name: 'event_cancel',
    description: '取消正在运行的病历事件还原批次。已完成的病人保留在 _records/runs/<批次>/output，报告记为已取消；可用 event_start 的 resumeFrom 继续。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取消当前批次。' } },
    execute: async (args) => service.cancel(args.runId),
    render: (args, v) => [{ type: 'text', text: v.cancelled ? `已请求取消批次 ${v.runId}。` : `没有取消：${v.reason}` }],
  }))

  ctx.tools.register(tool({
    name: 'event_status',
    description: '查看病历事件还原批次的状态、进度、各病人验收门、发现与待复核数。省略 runId 时查看最近一批。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取最近一批。' } },
    execute: async (args) => service.status(args.runId),
    render: (args, value) => {
      const run = value.run
      if (!run) return [{ type: 'text', text: '还没有病历事件还原批次。' }]
      const t = run.totals
      const lines = [
        `批次 ${run.id}: ${run.status}${run.current ? `（${run.current.patient} · ${run.current.step}）` : ''}`,
        `病人 ${t.done}/${t.patients}，验收门未过 ${t.failedGates}；提及 ${t.mentions}，事件 ${t.events}，发现 ${t.findings}，待人工确认 ${t.review}；模型调用 ${t.modelCalls}`,
      ]
      for (const p of run.patients.slice(0, 50)) lines.push(`- ${p.patient}: ${p.failedGates.length ? `验收门未过 ${p.failedGates.join('')}` : '通过'}，发现 ${p.counts.findings}，待确认 ${p.review.findings}`)
      if (run.patients.length > 50) lines.push(`…另有 ${run.patients.length - 50} 位`)
      if (run.output) lines.push(`交付：${run.output}`)
      if (run.error) lines.push(`错误：${run.error.split('\n')[0]}`)
      return [{ type: 'text', text: lines.join('\n') }]
    },
  }))

  ctx.tools.register(tool({
    name: 'event_report',
    description: '读取病历事件还原批次的 Markdown 报告（汇总、各病人验收门、发现分类）。报告不含病历原文。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取最近一批。' } },
    execute: async (args) => service.report(args.runId),
    render: (args, v) => [{ type: 'text', text: v.markdown.length > 6000 ? `${v.markdown.slice(0, 6000)}\n…（完整内容见 ${v.path}）` : v.markdown }],
  }))

  ctx.tools.register(tool({
    name: 'event_runs',
    description: '列出最近的病历事件还原批次（时间、状态、病人数、发现数、待复核数）。',
    parameters: {},
    execute: async () => service.list(),
    render: (args, v) => [{ type: 'text', text: v.runs.length ? v.runs.slice(0, 20).map((r) => `${r.id}  ${r.status}  病人 ${r.patients}  发现 ${r.findings}  待复核 ${r.review}  ${r.input}`).join('\n') : '还没有批次。' }],
  }))

  ctx.inject(['commands'], (cmdCtx) => {
    const usage = '用法：/event <病人导出目录> [--out 输出根目录] [--as-of "YYYY-MM-DD HH:mm"]（路径含空格时用引号括起来）'
    const dispose = cmdCtx.commands.register({
      name: 'event',
      description: '病历事件还原：/event <病人导出目录> [--out 输出根目录] [--as-of "YYYY-MM-DD HH:mm"]',
      input: { hint: '病人导出目录 [--out 输出根目录] [--as-of "YYYY-MM-DD HH:mm"]' },
      handler: async (invocation) => {
        const args = String(invocation.rawInput ?? '').match(/"[^"]*"|'[^']*'|\S+/g)?.map((x) => x.replace(/^["']|["']$/g, '')) ?? []
        const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : undefined }
        const outputRoot = flag('--out'); const asOf = flag('--as-of')
        if (!args[0]) return { kind: 'error', text: usage }
        try {
          const v = await service.start({ inputDir: args[0], outputRoot, asOf, source: { kind: 'command', sessionId: sessionIdOf(invocation.agent) } })
          return { kind: 'success', text: `已启动批次 ${v.runId}（${v.modelConfigured ? `模型 ${v.model}` : '仅规则'}），输出到 ${v.outputRoot}。用 event_status 或左侧栏「病历事件还原」查看进度。` }
        } catch (error) {
          return { kind: 'error', text: String(error?.message ?? error) }
        }
      },
    })
    cmdCtx.effect(() => dispose, 'medical-event: /event command')
  })

  ctx.inject(['connection', 'webServer'], (rpcCtx) => {
    const route = {
      kind: 'prefix',
      path: CHANNEL,
      handler: async (req, res) => {
        const admission = rpcCtx.connection.admit(req)
        if ('rejection' in admission) { res.writeHead(admission.rejection); res.end(admission.rejection === 401 ? 'unauthorized' : 'forbidden'); return }
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const endpoint = new URL(req.url ?? '/', 'http://x').pathname.slice(CHANNEL.length + 1)
        if (!endpoint) { res.writeHead(404); res.end(); return }
        if (req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') { res.writeHead(415); res.end(); return }
        let body
        try {
          const chunks = []; let size = 0
          for await (const chunk of req) { size += chunk.length; if (size > 1_000_000) throw new Error('request body too large'); chunks.push(chunk) }
          body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        } catch (error) {
          res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(error?.message ?? error) })); return
        }
        const rpcId = typeof body?.rpcId === 'string' ? body.rpcId : 'invalid-request'
        if (body?.type !== 'client-request' || body?.method !== endpoint) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ type: 'server-response', rpcId, result: { ok: false, error: { code: 'bad-request', message: 'invalid client-request envelope', details: {} } } }))
          return
        }
        const result = await dispatch(endpoint, body.payload)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ type: 'server-response', rpcId, result }))
      },
    }
    rpcCtx.effect(() => rpcCtx.webServer.register(route), 'medical-event: rpc route')
  })

  /** User-only (page): persists settings into the profile's patch layer. */
  async function saveDefaults(patch) {
    if (service.isRunning()) throw new Error('有批次在运行，保存设置会重新加载插件并中断批次；请等它结束')
    const editor = ctx.get('configEditor')
    if (!editor?.edit || !editor?.entries) throw new Error('当前 DSH 不支持从页面保存配置；请在 profile 的 cordis.patch.yml 中修改 medical-event 的 config')
    const entries = editor.entries()
    let entry
    try { entry = entries.find((item) => item.fiber === ctx.fiber) } catch { /* fall back */ }
    entry ??= entries.find((item) => item.options?.id === ENTRY_ID)
    if (!entry) throw new Error(`找不到插件配置行 ${ENTRY_ID}`)
    const allowed = ['outputRoot', 'specialty', 'baseURL', 'model', 'apiKey', 'verifyBaseURL', 'verifyModel', 'disableThinking', 'timeoutMs', 'modelConcurrency', 'modelEnabled', 'modelLimit', 'showSidebarEntry']
    const clean = Object.fromEntries(Object.entries(patch ?? {}).filter(([k]) => allowed.includes(k)))
    await editor.edit(entry, (current) => ({ ...current, ...clean }))
    return { saved: true }
  }

  async function dispatch(endpoint, payload) {
    try {
      const r = payload && typeof payload === 'object' ? payload : {}
      const value = await (async () => {
        switch (endpoint) {
          case 'config': return service.configInfo()
          case 'list': return service.list()
          case 'status': return service.status(r.runId)
          case 'report': return service.report(r.runId)
          case 'start': return service.start({ inputDir: r.inputDir, outputRoot: r.outputRoot, asOf: r.asOf || undefined, resumeFrom: r.resumeFrom, source: { kind: 'panel' } })
          case 'cancel': return service.cancel(r.runId)
          case 'patient': return service.patientData(r.runId, r.patient, Array.isArray(r.parts) ? r.parts : undefined)
          case 'documents': return service.documents(r.runId, r.patient)
          case 'fragment': return service.fragment(r.runId, r.patient, r.fragmentId)
          case 'decide': return service.decide(r.runId, r)
          case 'rulepack': return service.rulepack(r.specialty)
          case 'calls': return service.calls(r.runId)
          case 'timeline': return service.timeline(r.runId, r.patient)
          case 'event': return service.eventDetail(r.runId, r.patient, r.eventId)
          case 'finding': return service.findingDetail(r.runId, r.patient, r.findingId)
          case 'reviewQueue': return service.reviewQueue(r.runId)
          case 'pickFolder': {
            const ws = ctx.get('uiWorkspace')
            return { path: ws?.pickDirectory ? await ws.pickDirectory() : null }
          }
          case 'saveDefaults': return saveDefaults(r)
          default: throw Object.assign(new Error(`未知方法: ${endpoint}`), { code: 'unknown-endpoint' })
        }
      })()
      return { ok: true, value }
    } catch (error) {
      return { ok: false, error: { code: error?.code ?? 'medical-event', message: String(error?.message ?? error), details: {} } }
    }
  }
}

function sessionIdOf(agent) {
  try { const id = agent?.session?.id; return typeof id === 'string' ? id : undefined } catch { return undefined }
}

function tool(def) {
  const properties = {}; const required = []
  for (const [key, spec] of Object.entries(def.parameters ?? {})) {
    properties[key] = { type: spec.type, ...(spec.description ? { description: spec.description } : {}), ...(spec.type === 'array' ? { items: { type: 'string' } } : {}) }
    if (spec.required) required.push(key)
  }
  return {
    name: def.name,
    description: def.description,
    parameters: { type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render: def.render ?? ((args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]) },
    execute: def.execute,
  }
}
