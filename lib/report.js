/**
 * 批次报告（Markdown + JSON）。只写类别、数量、编号，不写病历原文。
 */
export function renderReport(run) {
  const t = run.totals
  const lines = [
    `# 病历事件还原报告 · ${run.id}`, '',
    `- 状态：${run.status}`,
    `- 输入：${run.input}`,
    `- 交付：${run.output ?? '（未交付，见 _records/runs 暂存区）'}`,
    `- 开始 ${run.startedAt} · 结束 ${run.finishedAt ?? '—'}`,
    `- 截至时刻（as-of）：${run.asOf ?? '不截断'}`,
    `- 专科规则包：${[].concat(run.specialty ?? []).join('、') || '无'}`,
    `- 模型：${run.model ? `${run.model.model}${run.model.verifyModel ? ` ＋ 核验 ${run.model.verifyModel}` : ''}（调用 ${t.modelCalls} 次）` : '未配置，仅规则'}`,
    '',
    '## 汇总', '',
    '| 病人 | 完成 | 验收门未过 | 提及 | 事件 | 发现 | 待人工确认 | 模型建议 |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|',
    `| ${t.patients} | ${t.done} | ${t.failedGates} | ${t.mentions} | ${t.events} | ${t.findings} | ${t.review} | ${t.suggestions} |`,
    '',
  ]
  if (run.sourceCheck) lines.push(`源文件检查：${run.sourceCheck.files} 个文件，运行前后${run.sourceCheck.changed ? `有 ${run.sourceCheck.changed} 个变化` : '一致'}。`, '')
  for (const w of run.warnings ?? []) lines.push(`> 注意：${w}`)
  if (run.format) {
    lines.push('', '## 输入格式', '')
    if (run.format.kind === 'builtin') lines.push(`内置格式：${run.format.name}。`)
    else {
      lines.push(`自动识别（S00）：${run.format.tables} 张表，采用 ${run.format.adopted}，待确认 ${run.format.held}，跳过 ${run.format.ignored}。数据源层 ${run.format.id}@${run.format.version}。`, '')
      const ST = { agreed: '自动采用', confirmed: '人工确认', disputed: '有分歧（暂扣）', invalid: '校验未过（暂扣）', pending: '待确认（暂扣）', failed: '模型调用失败（暂扣）', rejected: '跳过' }
      lines.push('| 表 | 行 | 状态 | 类别 | 写成时间 | 依据 |', '|---|---:|---|---|---|---|')
      for (const t of run.recognition?.tables ?? []) lines.push(`| ${t.table} | ${t.rows} | ${ST[t.status] ?? t.status} | ${t.recordType ?? '—'} | ${t.written ?? '—'} | ${[t.reason, ...(t.diffs ?? [])].filter(Boolean).join('；').replace(/\|/g, '／') || '—'} |`)
    }
    lines.push('')
  }
  lines.push('## 各病人', '', '| 病人 | 验收门 | 兜底率 | 提及 | 事件 | 发现 | 待确认 | 前句继承待复核 | 用时 |', '|---|---|---:|---:|---:|---:|---:|---:|---:|')
  for (const p of run.patients) {
    lines.push(`| ${p.patient} | ${p.failedGates.length ? `未过 ${p.failedGates.join('')}` : '通过'} | ${p.fallbackRate == null ? '—' : `${(p.fallbackRate * 100).toFixed(1)}%`} | ${p.counts.mentions} | ${p.counts.events} | ${p.counts.findings} | ${p.review.findings} | ${p.review.pendingTime} | ${(p.ms / 1000).toFixed(1)}s |`)
  }
  const verdicts = {}
  for (const p of run.patients) for (const [k, v] of Object.entries(p.verdicts ?? {})) verdicts[k] = (verdicts[k] ?? 0) + v
  if (Object.keys(verdicts).length) {
    lines.push('', '## 发现（判定·子类）', '', '| 判定·子类 | 条数 |', '|---|---:|')
    for (const [k, v] of Object.entries(verdicts).sort((a, b) => b[1] - a[1])) lines.push(`| ${k} | ${v} |`)
  }
  if (run.error) lines.push('', '## 错误', '', '```', run.error, '```')
  return { markdown: lines.join('\n') + '\n', json: { id: run.id, status: run.status, format: run.format ?? null, recognition: run.recognition ?? null, totals: t, verdicts, patients: run.patients.map(({ summary, ...p }) => p) } }
}
