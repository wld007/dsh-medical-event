/**
 * 批次报告（Markdown + JSON）。只写类别、数量、编号，不写病历原文。
 */
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—')
const ST = { running: '运行中', completed: '完成', review: '待复核', cancelled: '已取消', failed: '失败' }

export function renderReport(run) {
  const t = run.totals ?? {}
  const lines = [
    `# 病历事件还原报告 · ${run.id}`, '',
    '| 项 | 值 |', '|---|---|',
    `| 状态 | ${ST[run.status] ?? run.status} |`,
    `| 输入 | ${run.input} |`,
    `| 交付 | ${run.output ?? '（未交付：运行中的结果在 _records/runs 的暂存区）'} |`,
    `| 开始 · 结束 | ${run.startedAt} · ${run.finishedAt ?? '—'} |`,
    `| 截至时刻（as-of） | ${run.asOf ?? '不截断'} |`,
    `| 通读方式 | ${run.mode === 'model' ? 'model：只用模型' : 'hybrid：模型通读＋规则对照'}，复查至多 ${run.maxRounds ?? '—'} 轮，核验抽查 ${run.sampleRate == null ? '—' : `${Math.round(run.sampleRate * 100)}%`} 的句子 |`,
    `| 模型 | ${run.model ? `通读 ${run.model.model}${run.model.verifyModel ? `；核验 ${run.model.verifyModel}` : '；未配置核验模型'}` : '未配置'} |`,
    `| 专科规则包 | ${[].concat(run.specialty ?? []).join('、') || '无'} |`,
    `| 数据块 | ${run.shards?.done ?? 0}/${run.shards?.total ?? 0} |`,
    '',
    '## 汇总', '',
    '| 病人 | 完成 | 出错 | 质检未过 | 文书 | 提及 | 事件 | 发现 | 待复核 |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    `| ${t.patients ?? 0} | ${t.done ?? 0} | ${t.failed ?? 0} | ${t.failedGates ?? 0} | ${t.documents ?? 0} | ${t.mentions ?? 0} | ${t.events ?? 0} | ${t.findings ?? 0} | ${t.review ?? 0} |`,
    '',
  ]
  if (run.sourceCheck) lines.push(`源文件检查：${run.sourceCheck.files} 个文件，运行前后${run.sourceCheck.changed ? `有 ${run.sourceCheck.changed} 个变化` : '一致'}。`, '')
  for (const w of run.warnings ?? []) lines.push(`> 注意：${w}`)
  if ((run.gates ?? []).length) {
    lines.push('', '## 质检', '', '| 质检 | 内容 | 结果 | 说明 |', '|---|---|---|---|')
    for (const g of run.gates) lines.push(`| ${g.id} | ${g.label} | ${g.skipped ? '跳过' : g.pass ? '通过' : '未过'} | ${String(g.detail ?? '').replace(/\|/g, '／')} |`)
  }
  if (t.units) {
    const A = t.agreement ?? {}
    lines.push('', '## 通读与核验', '',
      `句子单位 ${t.units}（去重后 ${t.unique}，同一句跨文书、跨病人只问一次）；模型没答出的 ${t.noAnswer ?? 0}；被插件拦下的无效回答 ${t.invalid ?? 0} 条（片段不在原文、类型不在表里）。`, '',
      '| 问题 | 核验条数 | 复查前一致 |', '|---|---:|---:|',
      ...['边界', '分类', '时间'].map((k) => `| ${k} | ${A[k]?.n ?? 0} | ${pct(A[k]?.agree ?? 0, A[k]?.n ?? 0)} |`), '',
      `抽查 ${t.sampled ?? 0} 句；分歧 ${t.disputes ?? 0} 项：复查后一致 ${t.resolved ?? 0}（${(t.resolvedByRound ?? []).map((n, i) => (n ? `第 ${i + 1} 轮 ${n}` : '')).filter(Boolean).join('，') || '—'}），规则第三票 ${t.byRule ?? 0}，转人工 ${t.human ?? 0}。`)
    const rc = t.ruleCompare
    if (rc?.model) lines.push('', `规则对照：模型提及 ${rc.model}、规则提及 ${rc.rule}；位置能对上（重叠 ≥50%）${rc.matched}（${pct(rc.matched, rc.model)}），其中大类一致 ${pct(rc.type, rc.matched)}，发生时间一致 ${pct(rc.time, rc.timeComparable)}。`)
    const cv = t.coverage
    if (cv?.meaningful) lines.push('', `覆盖：有意义的字被提及覆盖 ${pct(cv.covered, cv.meaningful)}${cv.filled ? `；规则补漏 ${cv.filled} 条` : ''}。`)
  }
  if (run.format) {
    lines.push('', '## 输入格式', '')
    if (run.format.kind === 'builtin') lines.push(`内置格式：${run.format.name}。`)
    else {
      lines.push(`自动识别（S00）：${run.format.tables} 张表，采用 ${run.format.adopted}，待确认 ${run.format.held}，跳过 ${run.format.ignored}${run.format.adjudicated ? `，复查后一致 ${run.format.adjudicated}` : ''}。${run.format.dict ? `数据元对照表 ${run.format.dict} 条。` : ''}`, '')
      const FS = { agreed: '自动采用', confirmed: '人工确认', disputed: '有分歧（暂扣）', invalid: '校验未过（暂扣）', pending: '待确认（暂扣）', failed: '模型调用失败（暂扣）', rejected: '跳过' }
      lines.push('| 表 | 行 | 状态 | 类别 | 写成时间 | 依据 |', '|---|---:|---|---|---|---|')
      for (const x of run.recognition?.tables ?? []) lines.push(`| ${x.table} | ${x.rows} | ${FS[x.status] ?? x.status} | ${x.recordType ?? '—'} | ${x.written ?? '—'} | ${[x.reason, ...(x.diffs ?? [])].filter(Boolean).join('；').replace(/\|/g, '／') || '—'} |`)
    }
  }
  lines.push('', '## 各病人', '', '| 病人 | 质检 | 兜底率 | 文书 | 提及 | 事件 | 发现 | 待复核 | 分类一致（复查前） | 用时 |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const p of run.patients ?? []) {
    if (p.status === 'failed') { lines.push(`| ${p.patient} | 出错：${String(p.error ?? '').split('\n')[0].replace(/\|/g, '／').slice(0, 80)} | | | | | | | | |`); continue }
    const a = p.read?.agreement?.分类
    lines.push(`| ${p.patient} | ${p.failedGates?.length ? `未过 ${p.failedGates.join('')}` : '通过'} | ${p.fallbackRate == null ? '—' : `${(p.fallbackRate * 100).toFixed(1)}%`} | ${p.counts?.documents ?? '—'} | ${p.counts?.mentions ?? 0} | ${p.counts?.events ?? 0} | ${p.counts?.findings ?? 0} | ${p.review?.pending ?? 0} | ${a ? pct(a.agree, a.n) : '—'} | ${((p.ms ?? 0) / 1000).toFixed(1)}s |`)
  }
  const verdicts = {}
  for (const p of run.patients ?? []) for (const [k, v] of Object.entries(p.verdicts ?? {})) verdicts[k] = (verdicts[k] ?? 0) + v
  if (Object.keys(verdicts).length) {
    lines.push('', '## 发现（判定·子类）', '', '| 判定·子类 | 条数 |', '|---|---:|')
    for (const [k, v] of Object.entries(verdicts).sort((a, b) => b[1] - a[1])) lines.push(`| ${k} | ${v} |`)
  }
  const by = run.calls?.byModel ?? []
  if (by.length) {
    const RN = { read: '通读', verify: '核验', 'review-read': '复查（通读模型）', 'review-verify': '复查（核验模型）', format: '格式识别', 'format-verify': '格式识别（核验）' }
    lines.push('', '## 模型调用', '', '| 用途 | 模型 | 调用 | 缓存 | 失败 | 输入 token | 输出 token |', '|---|---|---:|---:|---:|---:|---:|')
    for (const r of by) lines.push(`| ${RN[r.role] ?? r.role} | ${r.model} | ${r.calls} | ${r.cached} | ${r.failed} | ${r.prompt_tokens} | ${r.completion_tokens} |`)
  }
  if (run.error) lines.push('', '## 错误', '', '```', run.error, '```')
  return { markdown: lines.join('\n') + '\n', json: { id: run.id, status: run.status, mode: run.mode ?? null, model: run.model ?? null, format: run.format ?? null, recognition: run.recognition ?? null, gates: run.gates ?? [], totals: t, verdicts, calls: run.calls ?? null, patients: (run.patients ?? []).map(({ verdicts: v, types, ...p }) => p) } }
}
