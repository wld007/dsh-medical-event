window.__ModuleLoader__.load({
  id: 'dsh-medical-event',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef, useCallback } = React
    const CHANNEL = '/medical-event'
    const PANEL_ID = 'medical-event'
    const services = { ctx: null }

    /* ------------------------------------------------------------------ rpc */
    function call(endpoint, payload, signal) {
      const connection = services.ctx?.get('connection')
      if (!connection?.rpc) return Promise.reject(new Error('connection unavailable'))
      return connection.rpc.call(CHANNEL, endpoint, payload ?? {}, signal).then((r) => {
        if (!r || r.ok !== true) throw new Error(r?.error?.message ?? 'RPC failed')
        return r.value
      })
    }
    const msg = (e) => String(e?.message ?? e)

    function useAsync(fn, deps) {
      const [state, setState] = useState({ loading: true, value: null, error: null })
      const [tick, setTick] = useState(0)
      useEffect(() => {
        let alive = true
        setState((s) => ({ ...s, loading: true }))
        Promise.resolve().then(fn).then((value) => alive && setState({ loading: false, value, error: null }), (error) => alive && setState({ loading: false, value: null, error: msg(error) }))
        return () => { alive = false }
      }, [...deps, tick])
      return { ...state, reload: () => setTick((n) => n + 1) }
    }

    /* ---------------------------------------------------------------- style */
    const CSS = `
.me{--bg:#081116;--panel:#0d1a20;--panel2:#112128;--panel3:#16282f;--line:#1a2c34;--line2:#26404a;--ink:#e2eef0;--ink2:#8ba5ad;--ink3:#58717a;--teal:#22c7c0;--teal2:#7fe9e2;--tealdim:rgba(34,199,192,.14);--ok:#46d17f;--warn:#f5a524;--bad:#f05252;--vio:#a58bff;--fact:#4fb3ff;--judge:#c48bff;--decide:#2fd6a0;--mono:"SF Mono","JetBrains Mono",Menlo,monospace;
  height:100%;box-sizing:border-box;background:var(--bg);color:var(--ink);font:12.5px -apple-system,"PingFang SC","Helvetica Neue",sans-serif;display:flex;flex-direction:column;gap:8px;padding:8px 10px 10px;color-scheme:dark;overflow:hidden}
.me *{box-sizing:border-box}
.me-frame{border:1px solid var(--line);background:var(--panel);border-radius:6px}
.me-top{display:flex;align-items:center;gap:14px;padding:8px 14px;background:linear-gradient(90deg,#0f2329,var(--panel) 40%)}
.me-logo{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#2fd6cd,#138a96);display:grid;place-items:center;flex:none}
.me-brand b{display:block;font-size:14px;letter-spacing:2px}.me-brand span{font-family:var(--mono);font-size:9.5px;color:var(--ink2);letter-spacing:1px}
.me-runbox{border:1px solid var(--line2);border-radius:6px;padding:3px 10px;line-height:1.35;min-width:220px}
.me-runbox b{font-size:12px}.me-runbox .me-num{font-size:11px;color:var(--ink2)}
.me-sp{flex:1}
.me-btn{border:1px solid var(--line2);border-radius:5px;padding:4px 11px;color:var(--ink);background:var(--panel2);font-size:12px;cursor:pointer;white-space:nowrap}
.me-btn:hover{border-color:var(--teal)}.me-btn:disabled{opacity:.45;cursor:default}
.me-btn.pri{border-color:var(--teal);color:var(--teal2);background:var(--tealdim)}
.me-btn.sm{padding:1px 7px;font-size:11px}
.me-btn.on{border-color:var(--teal);color:var(--teal2)}
.me-tabs{display:flex;gap:2px;padding:0 8px;flex:none;overflow-x:auto}
.me-tab{display:flex;align-items:center;padding:8px 12px;color:var(--ink2);font-size:13px;border:0;border-bottom:2px solid transparent;background:none;cursor:pointer;white-space:nowrap}
.me-tab.on{color:var(--ink);border-bottom-color:var(--teal);font-weight:600}
.me-tab i{font-style:normal;font-family:var(--mono);font-size:11px;margin-left:5px;color:var(--warn)}
.me-body{flex:1;min-height:0;display:flex;gap:8px}
.me-col{display:flex;flex-direction:column;gap:8px;min-height:0}
.me-scroll{overflow:auto;min-height:0}
.me-pad{padding:12px 14px}
.me-h{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}.me-h b{font-size:13px;letter-spacing:1px}
.me-cap{font-family:var(--mono);font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink3)}
.me-num{font-family:var(--mono)}
.me-muted{color:var(--ink2)}.me-faint{color:var(--ink3)}.me-ok{color:var(--ok)}.me-warn{color:var(--warn)}.me-bad{color:var(--bad)}.me-tl{color:var(--teal)}
.me-chip{display:inline-block;border-radius:3px;padding:0 6px;font-size:10.5px;line-height:17px;border:1px solid var(--line2);color:var(--ink2);white-space:nowrap;margin-right:4px}
.me-chip.f{color:var(--fact);border-color:rgba(79,179,255,.45);background:rgba(79,179,255,.08)}
.me-chip.j{color:var(--judge);border-color:rgba(196,139,255,.45);background:rgba(196,139,255,.08)}
.me-chip.d{color:var(--decide);border-color:rgba(47,214,160,.45);background:rgba(47,214,160,.08)}
.me-chip.w{color:var(--warn);border-color:rgba(245,165,36,.5);background:rgba(245,165,36,.08)}
.me-chip.b{color:#ff8a8a;border-color:rgba(240,82,82,.5);background:rgba(240,82,82,.08)}
.me-chip.ok{color:var(--ok);border-color:rgba(70,209,127,.45);background:rgba(70,209,127,.08)}
.me-chip.v{color:var(--vio);border-color:rgba(165,139,255,.45);background:rgba(165,139,255,.08)}
.me-sec{border-left:3px solid var(--teal);background:linear-gradient(90deg,rgba(34,199,192,.16),transparent 70%);padding:4px 10px;margin:10px 0 8px;display:flex;gap:8px;align-items:baseline}
.me-sec b{font-size:12.5px}
.me table{border-collapse:collapse;width:100%}
.me td,.me th{padding:5px 8px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
.me th{font-weight:500;color:var(--ink3);font-size:11px;position:sticky;top:0;background:var(--panel)}
.me tr.click{cursor:pointer}.me tr.click:hover td{background:var(--panel2)}
.me tr.sel td{background:var(--panel3)}
.me-input{background:var(--panel2);border:1px solid var(--line2);border-radius:5px;color:var(--ink);padding:5px 8px;font-size:12px;min-width:0}
.me-input:focus{outline:none;border-color:var(--teal)}
.me-field{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--ink2)}
.me-err{color:#ff9a9a;border:1px solid rgba(240,82,82,.4);background:rgba(240,82,82,.08);padding:6px 10px;border-radius:5px}
.me-empty{color:var(--ink3);padding:30px;text-align:center}
.me-st{position:relative;flex:1;min-width:120px;border:1px solid var(--line2);border-radius:8px;background:linear-gradient(180deg,#13262d,#0c191e);padding:10px;min-height:128px}
.me-st .no{font-family:var(--mono);font-size:9.5px;color:var(--ink3);letter-spacing:1px}.me-st .nm{font-size:14px;font-weight:700;margin:2px 0}
.me-st .sub{font-size:10.5px;color:var(--ink3);line-height:14px;min-height:28px}.me-st .big{font-family:var(--mono);font-size:19px;font-weight:700;margin-top:6px}
.me-st .big small{font-size:10px;color:var(--ink3);font-weight:400;margin-left:3px}
.me-st .gate{display:flex;justify-content:space-between;font-size:10.5px;margin-top:6px}
.me-st .bar{position:absolute;left:0;right:0;top:-1px;height:3px;border-radius:8px 8px 0 0;background:var(--line2);overflow:hidden}.me-st .bar span{display:block;height:100%;background:var(--ok)}
.me-st.run{border-color:var(--teal);box-shadow:0 0 0 1px rgba(34,199,192,.25),0 0 24px rgba(34,199,192,.2)}.me-st.run .bar span{background:var(--teal)}
.me-st.hold{border-color:rgba(245,165,36,.7)}.me-st.hold .bar span{background:var(--warn)}
.me-st.idle{opacity:.55}
.me-arrow{align-self:center;color:#3a5e69}
.me-cells{display:grid;grid-template-columns:repeat(auto-fill,minmax(12px,1fr));gap:2px}
.me-cells i{height:10px;border-radius:1.5px;background:var(--line2);cursor:pointer}
.me-cells i.o{background:#2f9e62}.me-cells i.r{background:var(--teal)}.me-cells i.w{background:var(--warn)}.me-cells i.x{background:var(--bad)}
.me-bigs{display:flex;gap:22px;margin:4px 0 8px;flex-wrap:wrap}.me-bigs div small{display:block;color:var(--ink3);font-size:11px}.me-bigs div .me-num{font-size:24px;font-weight:700}
.me-stack{display:flex;height:9px;border-radius:3px;overflow:hidden;margin:6px 0 4px;background:var(--line2)}.me-stack span{display:block;height:100%}
.me-pi{padding:6px 8px;border-radius:5px;cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:1px 6px}
.me-pi:hover{background:var(--panel2)}.me-pi.on{background:var(--panel3);box-shadow:inset 3px 0 0 var(--teal)}
.me-pi b{font-family:var(--mono);font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.me-pi span{font-size:10.5px;color:var(--ink3)}
.me-doc{font-size:13.5px;line-height:2.3;white-space:pre-wrap;word-break:break-all}
.me-m{border-bottom:2px solid;padding:1px 1px;border-radius:2px;cursor:pointer}
.me-m.f{border-color:var(--fact);background:rgba(79,179,255,.10)}.me-m.j{border-color:var(--judge);background:rgba(196,139,255,.11)}.me-m.d{border-color:var(--decide);background:rgba(47,214,160,.11)}
.me-m.n{border-bottom-style:dashed}.me-m.t{opacity:.55}.me-m.sel{outline:1.5px solid #e2eef0;outline-offset:1px}
.me-tm{font-family:var(--mono);font-size:9.5px;color:var(--warn);border:1px solid rgba(245,165,36,.4);border-radius:3px;padding:0 3px;margin:0 2px;vertical-align:1px}
.me-tm.inh{color:var(--ink3);border-color:var(--line2)}.me-tm.q{color:#ff9a9a;border-color:rgba(240,82,82,.5)}
.me-kv{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:11.5px}
.me-mrow{border-top:1px solid var(--line);padding:6px 0;font-size:11.5px}
.me-opt{border:1px solid var(--line2);border-radius:6px;padding:6px 10px;margin-bottom:5px;cursor:pointer;display:flex;gap:8px;align-items:center}
.me-opt.on{border-color:var(--teal);background:var(--tealdim)}
.me-mo{border:1px solid rgba(165,139,255,.35);background:rgba(165,139,255,.05);border-radius:6px;padding:7px 10px;font-size:11.5px;line-height:1.6;margin-bottom:6px}
.me-md{white-space:pre-wrap;font-family:var(--mono);font-size:12px;line-height:1.6}
.me-settings{max-width:820px;display:flex;flex-direction:column;gap:12px;color:var(--dsw-alias-label-primary)}
.me-settings .me-input{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.me-settings .me-btn{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.me-settings .me-field{color:var(--dsw-alias-label-secondary)}
.me-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
`

    /* -------------------------------------------------------------- helpers */
    const TYPE_CLS = { 事实: 'f', 判断: 'j', 决策: 'd' }
    const VERDICT_CLS = { 矛盾: 'b', 记录质量: 'w', 改判: 'v', 病情变化: 'v', 调整: 'ok', 命名不一致: '', 证据不足: '' }
    const VERDICT_COLOR = { 矛盾: '#f05252', 记录质量: '#f5a524', 改判: '#a58bff', 病情变化: '#a58bff', 调整: '#46d17f', 命名不一致: '#8ba5ad', 证据不足: '#58717a' }
    const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString())
    const fmtTime = (s) => { if (!s) return '—'; try { return new Date(s).toLocaleString() } catch { return String(s) } }
    const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
    const statusChip = (s) => h('span', { className: `me-chip ${s === 'completed' ? 'ok' : s === 'running' ? '' : s === 'review' ? 'w' : 'b'}` }, { completed: '完成', running: '运行中', review: '待复核', failed: '失败', cancelled: '已取消' }[s] ?? s)
    const kindLabel = { finding: '发现', time: '待定时间', type: '兜底类型', concept: '未归一概念', mapping: '药名映射' }

    function Icon({ size = 16 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 4 }), h('path', { d: 'M6 12h3l2-5 3 10 2-5h2' }))
    }

    /* ================================================================ page */
    function Page() {
      const [tab, setTab] = useState('line')
      const [runs, setRuns] = useState([])
      const [activeId, setActiveId] = useState(null)
      const [runId, setRunId] = useState(null)
      const [run, setRun] = useState(null)
      const [patient, setPatient] = useState(null)
      const [focus, setFocus] = useState(null) // { kind:'finding'|'event'|'fragment', id }
      const [error, setError] = useState('')
      const [showNew, setShowNew] = useState(false)

      const refreshList = useCallback(async () => {
        try {
          const v = await call('list')
          setRuns(v.runs); setActiveId(v.active)
          setRunId((cur) => cur ?? v.active ?? v.runs[0]?.id ?? null)
          if (!v.runs.length) setShowNew(true)
        } catch (e) { setError(msg(e)) }
      }, [])
      useEffect(() => { refreshList() }, [])

      useEffect(() => {
        if (!runId) return undefined
        let alive = true; let timer = null
        const load = async () => {
          try {
            const v = await call('status', { runId })
            if (!alive) return
            setRun(v.run); setActiveId(v.active)
            setPatient((p) => p ?? v.run?.patients?.[0]?.patient ?? null)
            if (v.run?.status === 'running') timer = setTimeout(load, 2000)
            else if (v.active === null) refreshList()
          } catch (e) { if (alive) setError(msg(e)) }
        }
        load()
        return () => { alive = false; clearTimeout(timer) }
      }, [runId])

      const openPatient = (p, next = 'timeline', f = null) => { setPatient(p); setFocus(f); setTab(next) }
      const review = run?.totals?.review ?? 0
      const tabs = [['line', '◈ 产线'], ['patients', '患者', run?.totals?.patients], ['timeline', '时间线'], ['source', '原文标注'], ['review', '复核', review], ['improve', '规则改进'], ['calls', '模型调用'], ['rules', '规则包'], ['report', '报告']]
      return h('div', { className: 'me' },
        h('style', {}, CSS),
        h('div', { className: 'me-frame me-top' },
          h('div', { className: 'me-logo' }, h('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: '#04201f', strokeWidth: 2.4, strokeLinecap: 'round' }, h('path', { d: 'M3 12h4l2-6 4 12 2-6h6' }))),
          h('div', { className: 'me-brand' }, h('b', {}, '病历事件还原'), h('span', {}, 'MEDICAL EVENT RECONSTRUCTION')),
          run ? h('div', { className: 'me-runbox' },
            h('b', {}, statusChip(run.status), run.current ? `${run.current.patient} · ${run.current.step}` : `${run.totals.done}/${run.totals.patients} 位病人`),
            h('div', { className: 'me-num' }, `${run.id}${run.asOf ? ` · 截至 ${run.asOf}` : ''}`)) : null,
          h('div', { className: 'me-sp' }),
          run?.status === 'running' ? h('button', { className: 'me-btn', onClick: () => call('cancel', { runId: run.id }).catch((e) => setError(msg(e))) }, '取消批次') : null,
          h('button', { className: 'me-btn pri', onClick: () => setShowNew((x) => !x) }, '＋ 新批次'),
          h('select', { className: 'me-input', value: runId ?? '', onChange: (e) => { setRunId(e.target.value); setRun(null); setPatient(null) } },
            runs.map((r) => h('option', { key: r.id, value: r.id }, `${r.id} · ${r.input} · ${r.status}`)))),
        h('div', { className: 'me-frame me-tabs' }, tabs.map(([k, label, n]) => h('button', { key: k, className: `me-tab${tab === k ? ' on' : ''}`, onClick: () => setTab(k) }, label, n ? h('i', {}, String(n)) : null))),
        error ? h('div', { className: 'me-err', onClick: () => setError('') }, error) : null,
        showNew ? h(NewRun, { onStarted: (id) => { setShowNew(false); setRunId(id); setRun(null); setPatient(null); refreshList(); setTab('line') }, onError: setError }) : null,
        h('div', { className: 'me-body' },
          !run ? h('div', { className: 'me-frame me-empty', style: { flex: 1 } }, runs.length ? '加载中…' : '还没有批次。点右上角「＋ 新批次」选择病人导出目录开始。')
            : tab === 'line' ? h(Pipeline, { run, openPatient })
              : tab === 'patients' ? h(Patients, { run, openPatient })
                : tab === 'timeline' ? h(Timeline, { run, patient, setPatient, focus, setFocus, gotoSource: (fragmentId) => { setFocus({ kind: 'fragment', id: fragmentId }); setTab('source') }, gotoReview: (fid) => { setFocus({ kind: 'finding', id: fid }); setTab('review') } })
                  : tab === 'source' ? h(Source, { run, patient, setPatient, focus })
                    : tab === 'review' ? h(Review, { run, focus, gotoSource: (p, fragmentId) => { setPatient(p); setFocus({ kind: 'fragment', id: fragmentId }); setTab('source') } })
                      : tab === 'improve' ? h(Improve, { run })
                        : tab === 'calls' ? h(Calls, { run })
                          : tab === 'rules' ? h(Rules, { run })
                            : h(Report, { run })))
    }

    /* --------------------------------------------------------------- new run */
    function NewRun({ onStarted, onError }) {
      const [inputDir, setInput] = useState('')
      const [outputRoot, setOut] = useState('')
      const [asOf, setAsOf] = useState('')
      const [busy, setBusy] = useState(false)
      const pick = async () => { try { const v = await call('pickFolder'); if (v.path) setInput(v.path) } catch (e) { onError(msg(e)) } }
      const start = async () => {
        setBusy(true)
        try { const v = await call('start', { inputDir, outputRoot: outputRoot || undefined, asOf: asOf || undefined }); onStarted(v.runId) } catch (e) { onError(msg(e)) } finally { setBusy(false) }
      }
      return h('div', { className: 'me-frame me-pad', style: { display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' } },
        h('label', { className: 'me-field', style: { flex: 3, minWidth: 280 } }, '病人导出目录（一位病人，或包含多位病人的上级目录；通常是匿名化插件的交付目录）',
          h('div', { style: { display: 'flex', gap: 6 } }, h('input', { className: 'me-input', style: { flex: 1 }, value: inputDir, onChange: (e) => setInput(e.target.value), placeholder: '/path/to/_medical-anonymizer/…' }), h('button', { className: 'me-btn', onClick: pick }, '选择…'))),
        h('label', { className: 'me-field', style: { flex: 2, minWidth: 200 } }, '输出根目录（可空：输入旁的 _medical-event）', h('input', { className: 'me-input', value: outputRoot, onChange: (e) => setOut(e.target.value) })),
        h('label', { className: 'me-field', style: { width: 180 } }, '截至时刻（可空）', h('input', { className: 'me-input', value: asOf, onChange: (e) => setAsOf(e.target.value), placeholder: 'YYYY-MM-DD HH:mm' })),
        h('button', { className: 'me-btn pri', disabled: !inputDir || busy, onClick: start }, busy ? '启动中…' : '开始'))
    }

    /* --------------------------------------------------------------- pipeline */
    function Pipeline({ run, openPatient }) {
      const P = run.patients
      const t = run.totals
      const gatePass = (g) => P.filter((p) => !p.failedGates.includes(g)).length
      const sum = (f) => P.reduce((s, p) => s + (f(p) ?? 0), 0)
      const running = run.status === 'running'
      const doneFrac = t.patients ? t.done / t.patients : 0
      const fb = P.length ? sum((p) => p.fallbackRate ?? 0) / P.length : null
      const st = (no, nm, sub, big, unit, gate, state, frac) => h('div', { className: `me-st ${state}` },
        h('div', { className: 'bar' }, h('span', { style: { width: `${Math.round((frac ?? doneFrac) * 100)}%` } })),
        h('div', { className: 'no' }, no), h('div', { className: 'nm' }, nm), h('div', { className: 'sub' }, sub),
        h('div', { className: 'big' }, big, h('small', {}, unit)), h('div', { className: 'gate' }, gate))
      const stState = running ? 'run' : 'done'
      const reviewN = t.review
      const verdicts = {}
      for (const p of P) for (const [k, v] of Object.entries(p.verdicts ?? {})) { const vk = k.split('·')[0]; verdicts[vk] = (verdicts[vk] ?? 0) + v }
      const types = {}
      for (const p of P) for (const [k, v] of Object.entries(p.types ?? p.summary?.types ?? {})) types[k] = (types[k] ?? 0) + v
      const typeTotal = Object.values(types).reduce((a, b) => a + b, 0)
      const gateCell = (label, n, total) => h('tr', {}, h('td', {}, label), h('td', { className: `me-num ${n === total ? 'me-ok' : 'me-warn'}` }, n === total ? '全部通过' : `${total - n} 人未过`))
      return h('div', { className: 'me-col', style: { flex: 1 } },
        h('div', { className: 'me-frame me-pad' },
          h('div', { className: 'me-h' }, h('b', {}, '处理流程'), h('span', { className: 'me-cap' }, 'PIPELINE'), h('span', { className: 'me-sp' }), h('span', { className: 'me-faint' }, `${run.input}`)),
          h('div', { style: { display: 'flex', gap: 6 } },
            st('S01', '读入·片段', '切片段、挂可见时间、剔除作废记录', fmt(sum((p) => p.counts.fragments)), '片段', [h('span', { key: 1, className: 'me-faint' }, `${t.done}/${t.patients}`)], stState),
            h('span', { className: 'me-arrow' }, '→'),
            st('S02 · 工序1', '提及抽取', '栏目→句→分句→顿号；两个时间', fmt(t.mentions), '提及', [h('span', { key: 1, className: 'me-faint' }, '验收①'), h('span', { key: 2, className: gatePass('①') === P.length ? 'me-ok' : 'me-warn' }, `${gatePass('①')}/${P.length}`)], stState),
            h('span', { className: 'me-arrow' }, '→'),
            st('S03 · 工序2', '类型切分', '事实／判断／决策 → 细分 → 细项', typeTotal ? `${Math.round((types['事实'] ?? 0) / typeTotal * 100)}%` : '—', '事实', [h('span', { key: 1, className: 'me-faint' }, `兜底 ${pct(fb)}`), h('span', { key: 2, className: 'me-ok' }, '②')], stState),
            h('span', { className: 'me-arrow' }, '→'),
            st('S04 · 工序3', '事件归并', '同概念＋时间相容＋同就诊', fmt(t.events), '事件', [h('span', { key: 1, className: 'me-faint' }, '验收③'), h('span', { key: 2, className: gatePass('③') === P.length ? 'me-ok' : 'me-warn' }, `${gatePass('③')}/${P.length}`)], stState),
            h('span', { className: 'me-arrow' }, '→'),
            st('S05 · 工序4', '矛盾判断', 'R1–R10；七类判定、建议采信', fmt(t.findings), '发现', [h('span', { key: 1, className: 'me-faint' }, '验收④'), h('span', { key: 2, className: gatePass('④') === P.length ? 'me-ok' : 'me-warn' }, `${gatePass('④')}/${P.length}`)], stState),
            h('span', { className: 'me-arrow' }, '→'),
            st('S06', '人工复核', '需人工确认的发现、药名映射、模型分歧', fmt(reviewN), '项待办', [h('span', { key: 1, className: 'me-faint' }, `模型建议 ${fmt(t.suggestions)}`)], reviewN ? 'hold' : stState, 1),
            h('span', { className: 'me-arrow' }, '→'),
            st('S07', '交付', '每人一个事件包＋导出', run.output ? '✓' : '—', '', [h('span', { key: 1, className: 'me-faint' }, run.output ? '已交付' : '未交付')], run.output ? 'done' : 'idle', run.output ? 1 : 0)),
          h('div', { className: 'me-mo', style: { marginTop: 10 } }, h('b', { style: { color: 'var(--vio)' } }, '◇ 模型旁路 '),
            run.model ? `${run.model.model}${run.model.verifyModel ? ` ＋ 核验 ${run.model.verifyModel}` : ''} · 调用 ${fmt(t.modelCalls)} 次 · 建议 ${fmt(t.suggestions)} 条。只处理规则判不了的项（待定时间、兜底类型、未归一概念、需人工确认的发现），结论须引用原文并通过核对，只出建议，不改规则结果。` : '未配置模型：只跑规则。可在 设置 → 病历事件还原 配置本机或内网模型。')),
        h('div', { style: { display: 'flex', gap: 8, minHeight: 0, flex: 1 } },
          h('div', { className: 'me-frame me-pad', style: { flex: 1.2 } },
            h('div', { className: 'me-h' }, h('b', {}, '患者带'), h('span', { className: 'me-cap' }, 'PATIENTS'), h('span', { className: 'me-faint' }, '每格 1 位，点开看时间线')),
            h('div', { className: 'me-cells' }, P.map((p) => h('i', { key: p.patient, title: `${p.patient}：发现 ${p.counts.findings}，待确认 ${p.review.findings}`, className: p.failedGates.length ? 'x' : p.review.findings ? 'w' : 'o', onClick: () => openPatient(p.patient) })),
              running ? Array.from({ length: Math.max(0, t.patients - P.length) }, (_, i) => h('i', { key: `p${i}`, className: i === 0 ? 'r' : '' })) : null),
            h('div', { className: 'me-bigs', style: { marginTop: 14 } },
              h('div', {}, h('small', {}, '完成'), h('span', { className: 'me-num' }, `${Math.round(doneFrac * 100)}%`)),
              h('div', {}, h('small', {}, '提及'), h('span', { className: 'me-num' }, fmt(t.mentions))),
              h('div', {}, h('small', {}, '事件'), h('span', { className: 'me-num' }, fmt(t.events))),
              h('div', {}, h('small', {}, '发现'), h('span', { className: 'me-num me-warn' }, fmt(t.findings)))),
            typeTotal ? h('div', {}, h('div', { className: 'me-faint', style: { fontSize: 11 } }, '提及类型'),
              h('div', { className: 'me-stack' }, ['事实', '判断', '决策'].map((k) => h('span', { key: k, style: { width: `${(types[k] ?? 0) / typeTotal * 100}%`, background: `var(--${{ 事实: 'fact', 判断: 'judge', 决策: 'decide' }[k]})` } }))),
              h('div', { className: 'me-muted', style: { fontSize: 11 } }, ['事实', '判断', '决策'].map((k) => `${k} ${Math.round((types[k] ?? 0) / typeTotal * 100)}%`).join(' · '))) : null),
          h('div', { className: 'me-frame me-pad', style: { flex: 1 } },
            h('div', { className: 'me-h' }, h('b', {}, '验收门'), h('span', { className: 'me-cap' }, 'GATES')),
            h('table', {}, h('tbody', {},
              gateCell('① 原文逐字一致 · 区间不倒置 · 不晚于写成', gatePass('①'), P.length),
              h('tr', {}, h('td', {}, '② 兜底命中率（供抽样核对）'), h('td', { className: 'me-num' }, pct(fb))),
              gateCell('③ 每条提及恰属一个事件 · 事件内类型一致', gatePass('③'), P.length),
              gateCell('④ 每条发现可回溯原始提及', gatePass('④'), P.length),
              h('tr', {}, h('td', {}, '源文件只读核对'), h('td', { className: run.sourceCheck ? (run.sourceCheck.changed ? 'me-warn' : 'me-ok') : 'me-faint' }, run.sourceCheck ? (run.sourceCheck.changed ? `${run.sourceCheck.changed} 个变化` : '一致') : '—')))),
            h('div', { className: 'me-sec' }, h('b', {}, '发现'), h('span', { className: 'me-cap' }, 'FINDINGS')),
            Object.keys(verdicts).length ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } }, Object.entries(verdicts).sort((a, b) => b[1] - a[1]).map(([k, v]) => h('span', { key: k, className: `me-chip ${VERDICT_CLS[k] ?? ''}` }, `${k} ${v}`))) : h('div', { className: 'me-faint' }, '—'),
            (run.warnings ?? []).map((w, i) => h('div', { key: i, className: 'me-warn', style: { marginTop: 6 } }, `⚠ ${w}`)),
            run.error ? h('div', { className: 'me-err', style: { marginTop: 8 } }, run.error.split('\n')[0]) : null)))
    }

    /* --------------------------------------------------------------- patients */
    function Patients({ run, openPatient }) {
      const [sort, setSort] = useState('findings')
      const rows = [...run.patients].sort((a, b) => sort === 'name' ? a.patient.localeCompare(b.patient) : (b.counts[sort] ?? b.review[sort] ?? 0) - (a.counts[sort] ?? a.review[sort] ?? 0))
      const th = (k, label) => h('th', { style: { cursor: 'pointer', color: sort === k ? 'var(--teal)' : undefined }, onClick: () => setSort(k) }, label)
      return h('div', { className: 'me-frame me-scroll', style: { flex: 1 } },
        h('table', {}, h('thead', {}, h('tr', {}, th('name', '病人'), h('th', {}, '验收门'), h('th', {}, '兜底率'), th('mentions', '提及'), th('events', '事件'), th('findings', '发现'), th('pendingTime', '前句继承待复核'), h('th', {}, '待确认'), h('th', {}, '模型建议'), h('th', {}, '用时'))),
          h('tbody', {}, rows.map((p) => h('tr', { key: p.patient, className: 'click', onClick: () => openPatient(p.patient) },
            h('td', { className: 'me-num' }, p.patient),
            h('td', {}, p.failedGates.length ? h('span', { className: 'me-chip b' }, `未过 ${p.failedGates.join('')}`) : h('span', { className: 'me-chip ok' }, '通过')),
            h('td', { className: 'me-num' }, pct(p.fallbackRate)), h('td', { className: 'me-num' }, fmt(p.counts.mentions)), h('td', { className: 'me-num' }, fmt(p.counts.events)),
            h('td', { className: 'me-num me-warn' }, fmt(p.counts.findings)), h('td', { className: 'me-num' }, fmt(p.review.pendingTime)), h('td', { className: 'me-num' }, fmt(p.review.findings)),
            h('td', { className: 'me-num' }, fmt(p.suggestions)), h('td', { className: 'me-num' }, `${(p.ms / 1000).toFixed(1)}s`))))))
    }

    function PatientList({ run, patient, setPatient }) {
      const [q, setQ] = useState('')
      const list = run.patients.filter((p) => !q || p.patient.includes(q))
      return h('div', { className: 'me-frame me-col', style: { width: 200, padding: 8, flex: 'none' } },
        h('input', { className: 'me-input', placeholder: '⌕ 病人', value: q, onChange: (e) => setQ(e.target.value) }),
        h('div', { className: 'me-scroll', style: { flex: 1 } }, list.map((p) => h('div', { key: p.patient, className: `me-pi${p.patient === patient ? ' on' : ''}`, onClick: () => setPatient(p.patient) },
          h('b', { title: p.patient }, p.patient.split('/').pop()), h('span', { className: p.review.findings ? 'me-warn me-num' : 'me-num' }, String(p.counts.findings)),
          h('span', {}, `事件 ${fmt(p.counts.events)}`), h('span', {})))))
    }

    /* --------------------------------------------------------------- timeline */
    const DAYMS = 86400000
    const toT = (d) => (d ? Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) : null)

    function Timeline({ run, patient, setPatient, focus, setFocus, gotoSource, gotoReview }) {
      const data = useAsync(() => (patient ? call('timeline', { runId: run.id, patient }) : null), [run.id, patient])
      const [cutoff, setCutoff] = useState('')
      const [sel, setSel] = useState(null) // { kind, id }
      useEffect(() => { if (focus?.kind === 'event' || focus?.kind === 'finding') setSel(focus) }, [focus])
      const tl = data.value
      return h('div', { className: 'me-body', style: { flex: 1 } },
        h(PatientList, { run, patient, setPatient }),
        h('div', { className: 'me-frame me-col', style: { flex: 1, minWidth: 0 } },
          !tl ? h('div', { className: 'me-empty' }, data.error ?? (patient ? '加载中…' : '选择一位病人'))
            : h(React.Fragment, {},
              h('div', { style: { padding: '10px 14px 6px', borderBottom: '1px solid var(--line)' } },
                h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10 } }, h('b', { className: 'me-num', style: { fontSize: 16 } }, patient.split('/').pop()),
                  h('span', { className: 'me-muted' }, [tl.manifest.person?.sex, tl.manifest.person?.birth ? `${tl.manifest.person.birth.slice(0, 4)} 年生` : null].filter(Boolean).join(' · ')),
                  h('span', { className: 'me-sp' }),
                  Object.values(tl.manifest.gates).every((g) => g.pass) ? h('span', { className: 'me-chip ok' }, '四道验收门全部通过') : h('span', { className: 'me-chip b' }, '有验收门未过')),
                h('div', { className: 'me-muted', style: { marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' } },
                  [`片段 ${fmt(tl.counts.fragments)}`, `提及 ${fmt(tl.counts.mentions)}`, `事件 ${fmt(tl.counts.events)}`, `发现 ${fmt(tl.counts.findings)}`].map((x) => h('span', { key: x }, x)),
                  h('span', { className: 'me-sp' }),
                  h('span', { className: 'me-chip f' }, '● 事实'), h('span', { className: 'me-chip j' }, '● 判断'), h('span', { className: 'me-chip d' }, '● 决策'),
                  h('label', {}, '可见截断 ', h('input', { className: 'me-input', type: 'date', value: cutoff, onChange: (e) => setCutoff(e.target.value), style: { padding: '1px 4px' } })))),
              h('div', { className: 'me-scroll', style: { flex: 1 } }, h(TimelineSvg, { tl, cutoff, sel, onSelect: (x) => { setSel(x); setFocus(x) } })))),
        h('div', { className: 'me-frame me-scroll me-pad', style: { width: 380, flex: 'none' } },
          !sel ? h('div', { className: 'me-faint' }, '点时间线上的条、点或发现标记查看详情。')
            : sel.kind === 'event' ? h(EventDetail, { run, patient, eventId: sel.id, gotoSource, onFinding: (id) => setSel({ kind: 'finding', id }) })
              : h(FindingDetail, { run, patient, findingId: sel.id, gotoSource, gotoReview })))
    }

    function TimelineSvg({ tl, cutoff, sel, onSelect }) {
      const W = 980; const L = 150; const R = W - 14
      const a0 = toT(tl.range.a); const b0 = toT(tl.range.b)
      const y0 = new Date(a0).getUTCFullYear(); const y1 = new Date(b0).getUTCFullYear() + 1
      const A = Date.UTC(y0, 0, 1); const B = Date.UTC(y1, 0, 1)
      const X = (d) => L + (toT(d) - A) / (B - A) * (R - L)
      const els = []
      let y = 22
      const C = { fact: '#4fb3ff', judge: '#c48bff', decide: '#2fd6a0', visit: '#6d8790' }
      for (let yr = y0; yr <= y1; yr++) {
        const x = L + (Date.UTC(yr, 0, 1) - A) / (B - A) * (R - L)
        els.push(h('line', { key: `g${yr}`, x1: x, x2: x, y1: 16, y2: 2000, stroke: '#1a2c34' }))
        if (yr < y1) els.push(h('text', { key: `t${yr}`, x: x + 4, y: 12, fill: '#58717a', fontSize: 10.5, fontFamily: 'SF Mono,Menlo' }, String(yr)))
      }
      const isSel = (kind, id) => sel && sel.kind === kind && sel.id === id
      for (const lane of tl.lanes) {
        if (!lane.rows.length) continue
        const color = C[lane.kind] ?? '#8ba5ad'
        const top = y
        els.push(h('line', { key: `ln${lane.id}`, x1: 0, x2: W, y1: y, y2: y, stroke: '#26404a' }))
        lane.rows.forEach((row, ri) => {
          const ry = y + 8 + ri * 20
          els.push(h('text', { key: `rl${lane.id}${ri}`, x: 34, y: ry + 9, fill: '#8ba5ad', fontSize: 10.5 }, row.label.length > 9 ? `${row.label.slice(0, 9)}…` : row.label))
          row.items.forEach((it, ii) => {
            if (!it.a) return
            const k = `${lane.id}${ri}-${ii}`
            const before = toT(it.a) < A
            const x1 = Math.max(L, X(it.a)); const x2 = Math.max(x1 + 2, X(it.b ?? it.a))
            if (before) els.push(h('path', { key: `${k}<`, d: `M${L - 2} ${ry + 4} l7 -5 v10z`, fill: color, opacity: 0.8 }, h('title', {}, `${row.label}：${it.a} 起（早于时间轴）`)))
            if (before && toT(it.b ?? it.a) < A) return
            const click = it.event ? { onClick: () => onSelect({ kind: 'event', id: it.event }), style: { cursor: 'pointer' } } : {}
            const strokeSel = it.event && isSel('event', it.event) ? { stroke: '#e2eef0', strokeWidth: 1.6 } : {}
            if (it.kind === 'tick') els.push(h('line', { key: k, x1, x2: x1, y1: ry, y2: ry + 10, stroke: '#4d6770' }))
            else if (it.kind === 'stay') els.push(h('rect', { key: k, x: x1 - 1, y: ry - 1, width: Math.max(5, x2 - x1 + 2), height: 12, rx: 2, fill: '#6d8790' }, h('title', {}, `住院 ${it.a}～${it.b} ${it.label ?? ''}`)))
            else if (it.kind === 'bar') els.push(h('rect', { key: k, x: x1, y: ry, width: x2 - x1, height: 9, rx: 2, fill: color, opacity: it.faint ? 0.35 : 0.85, ...click, ...strokeSel }, h('title', {}, `${row.label} ${it.a}～${it.b}${it.n ? ` · ${it.n} 条提及` : ''}`)))
            else if (it.kind === 'stop') els.push(h('rect', { key: k, x: x1 - 1, y: ry - 2, width: 3, height: 13, fill: '#e2eef0', ...click }, h('title', {}, `${row.label} 停用 ${it.a}`)))
            else {
              const d = `M${x1} ${ry - 1} l5.5 5.5 l-5.5 5.5 l-5.5 -5.5z`
              els.push(h('path', { key: k, d, fill: color, stroke: it.conflict ? '#f05252' : (strokeSel.stroke ?? 'none'), strokeWidth: it.conflict ? 1.8 : 1.4, ...click }, h('title', {}, `${row.label}${it.label ? ` ${it.label}` : ''} ${it.a}${it.b && it.b !== it.a ? `～${it.b}` : ''}${it.conflict ? ' · 时间不一致' : ''}`)))
            }
          })
        })
        const hgt = lane.rows.length * 20 + 12
        els.push(h('rect', { key: `lb${lane.id}`, x: 0, y: top + 1, width: 3, height: hgt - 2, fill: color, opacity: 0.8 }))
        ;[...lane.name].forEach((ch, i) => els.push(h('text', { key: `lc${lane.id}${i}`, x: 16, y: top + 17 + i * 14, fill: color === '#6d8790' ? '#e2eef0' : color, fontSize: 11.5, fontWeight: 700, textAnchor: 'middle' }, ch)))
        y += hgt
      }
      // labs
      if (tl.series.length) {
        els.push(h('line', { key: 'lnlab', x1: 0, x2: W, y1: y, y2: y, stroke: '#26404a' }))
        const top = y
        tl.series.forEach((s, si) => {
          const sy = y + 6 + si * 40; const hh = 30
          const vs = s.points.map((p) => p.v); const lo = Math.min(...vs); const hi = Math.max(...vs)
          const Y = (v) => sy + hh - (hi === lo ? hh / 2 : (v - lo) / (hi - lo) * hh)
          els.push(h('text', { key: `sl${si}`, x: 34, y: sy + 12, fill: '#8ba5ad', fontSize: 10.5 }, s.name))
          els.push(h('text', { key: `sr${si}`, x: 34, y: sy + 25, fill: '#58717a', fontSize: 9 }, `${lo}–${hi}`))
          els.push(h('path', { key: `sp${si}`, d: s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.d)} ${Y(p.v)}`).join(''), stroke: '#4fb3ff', strokeWidth: 1.1, fill: 'none', opacity: 0.8 }))
          s.points.forEach((p, i) => els.push(h('circle', { key: `sc${si}-${i}`, cx: X(p.d), cy: Y(p.v), r: 1.8, fill: '#4fb3ff', style: { cursor: 'pointer' }, onClick: () => onSelect({ kind: 'event', id: p.event }) }, h('title', {}, `${s.name} ${p.v} · ${p.d}`))))
        })
        const hgt = tl.series.length * 40 + 8
        els.push(h('rect', { key: 'lblab', x: 0, y: top + 1, width: 3, height: hgt - 2, fill: '#4fb3ff', opacity: 0.8 }))
        ;['检', '验'].forEach((ch, i) => els.push(h('text', { key: `lcl${i}`, x: 16, y: top + 17 + i * 14, fill: '#4fb3ff', fontSize: 11.5, fontWeight: 700, textAnchor: 'middle' }, ch)))
        y += hgt
      }
      // findings
      els.push(h('line', { key: 'lnf', x1: 0, x2: W, y1: y, y2: y, stroke: '#26404a' }))
      ;['发', '现'].forEach((ch, i) => els.push(h('text', { key: `lcf${i}`, x: 16, y: y + 17 + i * 14, fill: '#f5a524', fontSize: 11.5, fontWeight: 700, textAnchor: 'middle' }, ch)))
      tl.findings.forEach((f, i) => {
        if (!f.at) return
        const x = X(f.at)
        els.push(h('rect', { key: `f${i}`, x: x - 3, y: y + 8 + (i % 2) * 14, width: 6, height: 12, rx: 1.5, fill: VERDICT_COLOR[f.verdict] ?? '#8ba5ad', stroke: isSel('finding', f.id) ? '#e2eef0' : 'none', style: { cursor: 'pointer' }, onClick: () => onSelect({ kind: 'finding', id: f.id }) }, h('title', {}, `${f.verdict}·${f.subclass}：${f.why}`)))
      })
      y += 42
      if (cutoff) {
        const cx = X(cutoff)
        els.push(h('rect', { key: 'cut', x: cx, y: 16, width: Math.max(0, R - cx), height: y - 16, fill: 'rgba(8,17,22,.6)', pointerEvents: 'none' }))
        els.push(h('line', { key: 'cutl', x1: cx, x2: cx, y1: 16, y2: y, stroke: '#f5a524', strokeDasharray: '4 3', strokeWidth: 1.3 }))
        els.push(h('text', { key: 'cutt', x: cx + 5, y: 28, fill: '#f5a524', fontSize: 10 }, '可见截断：之后写成的不可见（按 as-of 重跑可重算）'))
      }
      return h('svg', { width: W, height: y, style: { display: 'block' } }, els)
    }

    function MentionRow({ m, gotoSource }) {
      return h('div', { className: 'me-mrow' },
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'baseline' } }, h('span', { className: 'me-num me-muted' }, m.writtenAt?.slice(0, 10)), h('span', { className: 'me-faint' }, `${m.recordType}${m.section && m.section !== m.recordType ? `／${m.section}` : ''}`), h('span', { className: 'me-sp' }),
          m.fragmentId && gotoSource ? h('button', { className: 'me-btn sm', onClick: () => gotoSource(m.fragmentId) }, '原文') : null),
        h('div', { style: { margin: '3px 0' } }, m.text),
        h('div', { className: 'me-faint', style: { fontSize: 10.5 } }, h('span', { className: `me-chip ${m.tier <= 2 ? 'ok' : ''}` }, `${m.tierName} · ${m.tier}`), `→ ${m.occurFrom ?? '?'}${m.occurTo && m.occurTo !== m.occurFrom ? `～${m.occurTo}` : ''} · ${m.timeSource ?? ''}${m.rule ? ` · ${m.rule}` : ''}`))
    }

    function EventDetail({ run, patient, eventId, gotoSource, onFinding }) {
      const d = useAsync(() => call('event', { runId: run.id, patient, eventId }), [run.id, patient, eventId])
      if (!d.value) return h('div', { className: 'me-faint' }, d.error ?? '加载中…')
      const e = d.value.event
      return h('div', {},
        h('div', { className: 'me-h' }, h('b', {}, '事件详情'), h('span', { className: 'me-cap' }, 'EVENT'), h('span', { className: 'me-sp' }), h('span', { className: 'me-faint me-num' }, e.id)),
        h('div', { style: { fontSize: 16, fontWeight: 700 } }, e.concept ?? '（未归一）'),
        h('div', { style: { margin: '6px 0' } }, h('span', { className: `me-chip ${TYPE_CLS[e.type] ?? ''}` }, `${e.type} › ${e.subdivision} › ${e.item ?? ''}`), h('span', { className: 'me-chip' }, e.form), e.polarity === '阴性' ? h('span', { className: 'me-chip' }, '阴性') : null),
        h('div', { className: 'me-kv' },
          h('span', { className: 'me-faint' }, '共识时间'), e.consensus ? h('span', { className: e.consensus.consistent ? '' : 'me-bad' }, `${e.consensus.consistent ? '' : '无交集 · 并集 '}${e.consensus.a ?? '?'} ～ ${e.consensus.b ?? '?'}`) : h('span', {}, '—'),
          e.segment ? h('span', { className: 'me-faint' }, '在用片段') : null, e.segment ? h('span', {}, `${e.segment.from} ～ ${e.segment.to}`) : null,
          h('span', { className: 'me-faint' }, '提及 / 文书'), h('span', {}, `${e.mentionCount} 条 / ${e.docCount} 份 · 首见 ${e.firstWritten?.slice(0, 10)} · 末见 ${e.lastWritten?.slice(0, 10)}`),
          h('span', { className: 'me-faint' }, '归并依据'), h('span', {}, e.mergeRule),
          e.aliases?.length ? h('span', { className: 'me-faint' }, '别名') : null, e.aliases?.length ? h('span', {}, e.aliases.map((a) => `${a.alias}（${a.nature}）`).join('；')) : null),
        d.value.findings.length ? h(React.Fragment, {}, h('div', { className: 'me-sec' }, h('b', {}, '相关发现')),
          d.value.findings.map((f) => h('div', { key: f.id, className: 'me-mrow', style: { cursor: 'pointer' }, onClick: () => onFinding(f.id) }, h('span', { className: `me-chip ${VERDICT_CLS[f.verdict] ?? ''}` }, `${f.verdict}·${f.subclass}`), f.why))) : null,
        h('div', { className: 'me-sec' }, h('b', {}, '各方提及'), h('span', { className: 'me-cap' }, '按写成时间')),
        d.value.mentions.map((m) => h(MentionRow, { key: m.id, m, gotoSource })),
        d.value.more ? h('div', { className: 'me-faint' }, `… 另 ${d.value.more} 条`) : null)
    }

    function FindingDetail({ run, patient, findingId, gotoSource, gotoReview, onDecided }) {
      const d = useAsync(() => call('finding', { runId: run.id, patient, findingId }), [run.id, patient, findingId])
      const [choice, setChoice] = useState(null)
      const [note, setNote] = useState('')
      const [saved, setSaved] = useState('')
      const [expanded, setExpanded] = useState({})
      useEffect(() => { setChoice(d.value?.finding?.review?.decision ?? null); setNote(d.value?.finding?.review?.note ?? ''); setSaved('') }, [d.value])
      if (!d.value) return h('div', { className: 'me-faint' }, d.error ?? '加载中…')
      const f = d.value.finding
      const model = d.value.model[0]
      const save = async () => {
        try { await call('decide', { runId: run.id, kind: 'findings', id: f.id, decision: choice, note }); setSaved('已保存；下次重跑沿用'); onDecided?.() } catch (e) { setSaved(msg(e)) }
      }
      const options = [`${f.verdict}${f.subclass ? `·${f.subclass}` : ''}（维持规则判定）`, '矛盾', '记录质量', '调整', '改判', '病情变化', '证据不足', '不是冲突（误报）']
      return h('div', {},
        h('div', { className: 'me-h' }, h('b', {}, '发现'), h('span', { className: 'me-cap' }, 'FINDING'), h('span', { className: 'me-sp' }), h('span', { className: 'me-faint me-num' }, f.id)),
        h('div', { style: { margin: '2px 0 6px' } }, h('span', { className: `me-chip ${VERDICT_CLS[f.verdict] ?? ''}` }, `${f.verdict}·${f.subclass ?? ''}`), h('span', { className: 'me-chip' }, f.rule), h('span', { className: `me-chip ${f.certainty === '规则确定' ? 'ok' : 'w'}` }, f.certainty)),
        h('div', { style: { lineHeight: 1.6 } }, f.why),
        f.qualityNote ? h('div', { className: 'me-warn', style: { marginTop: 4 } }, f.qualityNote) : null,
        h('div', { style: { marginTop: 6 } }, '建议采信 ', h('b', {}, f.adopt), h('span', { className: 'me-faint' }, `（${f.adoptReason ?? ''}）`)),
        f.impact?.length ? h('div', { className: 'me-faint' }, `影响：${f.impact.join('、')}`) : null,
        h('div', { style: { display: 'grid', gridTemplateColumns: f.sides.length > 1 ? 'repeat(auto-fit,minmax(280px,1fr))' : '1fr', gap: 10 } }, f.sides.map((s, i) => h('div', { key: i, style: { minWidth: 0 } },
          h('div', { className: 'me-sec' }, h('b', {}, s.label), h('span', { className: 'me-cap' }, s.tierName ? `${s.tierName} · ${s.tier}` : '')),
          (expanded[i] ? s.mentions : s.mentions.slice(0, 4)).map((m) => m && h(MentionRow, { key: m.id, m, gotoSource: gotoSource ? (fid) => gotoSource(fid) : null })),
          s.mentions.length > 4 || s.total > s.mentions.length ? h('button', { className: 'me-btn sm', onClick: () => setExpanded({ ...expanded, [i]: !expanded[i] }) }, expanded[i] ? '收起' : `展开（共 ${s.total} 条${s.total > s.mentions.length ? `，显示前 ${s.mentions.length}` : ''}）`) : null))),
        model ? h(React.Fragment, {}, h('div', { className: 'me-sec' }, h('b', {}, '模型意见'), h('span', { className: 'me-cap' }, model.outcome === 'candidate' ? '两模型一致' : model.outcome === 'review' ? '两模型分歧' : model.outcome)),
          model.suggest ? h('div', { className: 'me-mo' }, h('b', { style: { color: 'var(--vio)' } }, '◇ 建议模型 '), `倾向 ${model.suggest.verdict}：${model.suggest.reason}`, h('div', { className: 'me-faint' }, `引用 ${model.suggest.cites?.join('、')} ✓ 原文核对通过`)) : h('div', { className: 'me-faint' }, `建议模型：${model.suggestProblem}`),
          model.verify ? h('div', { className: 'me-mo' }, h('b', { style: { color: 'var(--vio)' } }, '◇ 核验模型 '), `倾向 ${model.verify.verdict}：${model.verify.reason}`) : model.verifyProblem ? h('div', { className: 'me-faint' }, `核验模型：${model.verifyProblem}`) : null) : null,
        h('div', { className: 'me-sec' }, h('b', {}, '你的裁定'), h('span', { className: 'me-cap' }, 'DECISION')),
        options.map((o) => h('div', { key: o, className: `me-opt${choice === o ? ' on' : ''}`, onClick: () => setChoice(o) }, o)),
        h('textarea', { className: 'me-input', style: { width: '100%', height: 46, marginTop: 4 }, placeholder: '备注（可选）', value: note, onChange: (e) => setNote(e.target.value) }),
        h('div', { style: { display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' } },
          h('button', { className: 'me-btn pri', disabled: !choice, onClick: save }, '保存裁定'),
          f.review ? h('button', { className: 'me-btn', onClick: async () => { await call('decide', { runId: run.id, kind: 'findings', id: f.id, clear: true }); setChoice(null); setSaved('已撤销'); onDecided?.() } }, '撤销裁定') : null,
          gotoReview ? h('button', { className: 'me-btn', onClick: () => gotoReview(f.id) }, '去复核') : null,
          h('span', { className: 'me-tl' }, saved)),
        h('div', { className: 'me-faint', style: { fontSize: 10.5, marginTop: 6 } }, '裁定按稳定编号写入裁定表（_records/decisions.json），下次重跑沿用；不改原文。'))
    }

    /* ----------------------------------------------------------------- source */
    function Source({ run, patient, setPatient, focus }) {
      const docs = useAsync(() => (patient ? call('documents', { runId: run.id, patient }) : null), [run.id, patient])
      const [docId, setDocId] = useState(null)
      const [filter, setFilter] = useState('')
      useEffect(() => { if (focus?.kind === 'fragment') setDocId(focus.id) }, [focus])
      useEffect(() => { if (docs.value && !docId) setDocId(docs.value.documents[0]?.id ?? null) }, [docs.value])
      const list = (docs.value?.documents ?? []).filter((d) => !filter || d.recordType === filter)
      const types = [...new Set((docs.value?.documents ?? []).map((d) => d.recordType))]
      let lastYear = null
      return h('div', { className: 'me-body', style: { flex: 1 } },
        h(PatientList, { run, patient, setPatient }),
        h('div', { className: 'me-frame me-col', style: { width: 240, flex: 'none', padding: 8 } },
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } }, h('button', { className: `me-btn sm${!filter ? ' on' : ''}`, onClick: () => setFilter('') }, '全部'), types.map((t) => h('button', { key: t, className: `me-btn sm${filter === t ? ' on' : ''}`, onClick: () => setFilter(t) }, t))),
          h('div', { className: 'me-scroll', style: { flex: 1 } }, list.map((d) => {
            const yr = d.visibleAt.slice(0, 4)
            const head = yr !== lastYear ? h('div', { key: `y${yr}`, className: 'me-num me-faint', style: { padding: '8px 8px 2px', fontSize: 10.5 } }, yr) : null
            lastYear = yr
            return h(React.Fragment, { key: d.id }, head, h('div', { className: `me-pi${d.id === docId ? ' on' : ''}`, onClick: () => setDocId(d.id) },
              h('b', { style: { fontFamily: 'inherit' } }, `${d.recordType}${d.field && d.field !== '全文' && d.field !== '正文' ? `·${d.field}` : ''}${d.version > 1 ? `（第${d.version}版）` : ''}`), h('span', { className: 'me-num' }, d.visibleAt.slice(5, 10)),
              h('span', {}, `提及 ${d.mentions}`), h('span', {})))
          }))),
        docId ? h(Document, { run, patient, fragmentId: docId }) : h('div', { className: 'me-frame me-empty', style: { flex: 1 } }, docs.error ?? '选择一份文书'))
    }

    function Document({ run, patient, fragmentId }) {
      const d = useAsync(() => call('fragment', { runId: run.id, patient, fragmentId }), [run.id, patient, fragmentId])
      const [sel, setSel] = useState(null)
      const [onlyReal, setOnlyReal] = useState(false)
      useEffect(() => setSel(null), [fragmentId])
      if (!d.value) return h('div', { className: 'me-frame me-empty', style: { flex: 1 } }, d.error ?? '加载中…')
      const f = d.value.fragment
      const ms = [...d.value.mentions].sort((a, b) => a.s - b.s)
      const counts = { 事实: 0, 判断: 0, 决策: 0 }
      for (const m of ms) counts[m.type] = (counts[m.type] ?? 0) + 1
      const parts = []
      let pos = 0
      for (const m of ms) {
        if (m.s < pos) continue
        if (m.s > pos) parts.push(f.text.slice(pos, m.s))
        const cls = ['me-m', TYPE_CLS[m.type] ?? 'f', m.negative ? 'n' : '', m.templated ? 't' : '', sel?.id === m.id ? 'sel' : ''].join(' ')
        if (onlyReal && m.templated) parts.push(f.text.slice(m.s, m.e))
        else parts.push(h('span', { key: m.id, className: cls, title: `${m.type}·${m.subclass} · ${m.rules?.classify}`, onClick: () => setSel(m) }, f.text.slice(m.s, m.e)))
        const tcls = /^本句自带|年龄换算|原文/.test(m.timeSource) ? '' : /前句继承/.test(m.timeSource) ? 'q' : /继承|副词/.test(m.timeSource) ? 'inh' : null
        if (tcls != null && m.kind === '文书') parts.push(h('span', { key: `t${m.id}`, className: `me-tm ${tcls}` }, tcls === 'inh' ? (m.timeSource.startsWith('同句') ? '同句' : m.timeSource.startsWith('同行') ? '同行' : '副词') : `${tcls === 'q' ? '前句 ' : ''}${m.occurFrom ?? ''}${m.occurTo && m.occurTo !== m.occurFrom ? `～${m.occurTo.slice(5)}` : ''}`))
        pos = m.e
      }
      parts.push(f.text.slice(pos))
      return h(React.Fragment, {},
        h('div', { className: 'me-frame me-col', style: { flex: 1, minWidth: 0 } },
          h('div', { style: { padding: '10px 16px 8px', borderBottom: '1px solid var(--line)' } },
            h('div', { style: { display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' } }, h('b', { style: { fontSize: 15 } }, `${f.recordType}${f.field !== '全文' && f.field !== '正文' ? `·${f.field}` : ''}`),
              h('span', { className: 'me-num me-muted' }, `写成 ${f.visibleAt}${f.anchorAt && f.anchorAt !== f.visibleAt ? ` · 锚点 ${f.anchorAt}` : ''} · ${f.visibleBasis}`), h('span', { className: 'me-sp' }),
              h('span', { className: 'me-chip f' }, `事实 ${counts['事实']}`), h('span', { className: 'me-chip j' }, `判断 ${counts['判断']}`), h('span', { className: 'me-chip d' }, `决策 ${counts['决策']}`)),
            h('div', { className: 'me-muted', style: { fontSize: 11, marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' } },
              '下划线＝提及 · 虚线＝阴性 · 淡色＝模板化 · ', h('span', { className: 'me-tm' }, '时间'), '本句自带 · ', h('span', { className: 'me-tm inh' }, '同句'), '继承 · ', h('span', { className: 'me-tm q' }, '前句'), '待复核',
              h('span', { className: 'me-sp' }), h('button', { className: `me-btn sm${onlyReal ? ' on' : ''}`, onClick: () => setOnlyReal((x) => !x) }, '只标非模板'))),
          h('div', { className: 'me-scroll me-doc', style: { flex: 1, padding: '6px 18px 20px' } }, parts)),
        h('div', { className: 'me-frame me-scroll me-pad', style: { width: 360, flex: 'none' } },
          !sel ? h('div', { className: 'me-faint' }, '点一条提及查看它在四道工序里各被怎么处理。')
            : h('div', {},
              h('div', { className: 'me-h' }, h('b', {}, '提及'), h('span', { className: 'me-cap' }, 'MENTION'), h('span', { className: 'me-sp' }), h('span', { className: 'me-faint me-num' }, sel.id)),
              h('div', { style: { fontSize: 15, fontWeight: 700 } }, sel.text),
              h('div', { className: 'me-kv', style: { marginTop: 8 } },
                h('span', { className: 'me-faint' }, '位置'), h('span', { className: 'me-num' }, `s ${sel.s} – e ${sel.e} · ${sel.section} · 第 ${sel.sentence} 句`),
                h('span', { className: 'me-faint' }, '逐字核对'), h('span', { className: f.text.slice(sel.s, sel.e) === sel.text ? 'me-ok' : 'me-bad' }, f.text.slice(sel.s, sel.e) === sel.text ? '✓ 与片段一致' : '✗ 不一致'),
                h('span', { className: 'me-faint' }, '写成'), h('span', { className: 'me-num' }, sel.writtenAt),
                h('span', { className: 'me-faint' }, '发生'), h('span', { className: 'me-num' }, `${sel.occurFrom ?? '—'}${sel.occurTo && sel.occurTo !== sel.occurFrom ? ` ～ ${sel.occurTo}` : ''} · ${sel.precision}`)),
              h('div', { className: 'me-sec' }, h('b', {}, '处理链路'), h('span', { className: 'me-cap' }, 'WHY')),
              h('div', { className: 'me-mrow' }, h('b', {}, '工序1 · 提及抽取'), h('div', { className: 'me-faint' }, `栏目 ${sel.section} → 句 ${sel.sentence}${sel.scope ? ` · 修饰继承 ${sel.scope}` : ''} · 时间来源 ${sel.timeSource}${sel.timePhrase ? `（“${sel.timePhrase}”）` : ''}`)),
              h('div', { className: 'me-mrow' }, h('b', {}, '工序2 · 类型切分'), h('div', { className: 'me-faint' }, `命中 ${sel.rules?.classify} → ${sel.type} › ${sel.subdivision} › ${sel.item} · 子类 ${sel.subclass}${sel.negative ? ' · 阴性' : ''}${sel.templated ? ` · ${sel.templated}` : ''} · ${sel.temporality} · ${sel.origin}${sel.action ? ` · 动作 ${sel.action}` : ''}${sel.certainty ? ` · ${sel.certainty}` : ''}`)),
              h('div', { className: 'me-mrow' }, h('b', {}, '工序3 · 事件归并'), h('div', { className: 'me-faint' }, `${sel.mergeRule ?? '—'} → 事件 ${sel.eventId ?? '—'}`)),
              sel.fallback ? h('div', { className: 'me-warn', style: { marginTop: 6 } }, '兜底规则命中：模型会给类型建议，见 复核／规则改进') : null)))
    }

    /* ----------------------------------------------------------------- review */
    function Review({ run, focus, gotoSource }) {
      const q = useAsync(() => call('reviewQueue', { runId: run.id }), [run.id])
      const [kind, setKind] = useState('finding')
      const [sel, setSel] = useState(null)
      useEffect(() => { if (focus?.kind === 'finding') { setKind('finding'); setSel({ kind: 'finding', id: focus.id }) } }, [focus])
      const items = (q.value?.items ?? []).filter((x) => x.kind === 'finding' || x.kind === 'mapping' || x.outcome === 'review')
      const counts = {}
      for (const x of items) counts[x.kind] = (counts[x.kind] ?? 0) + 1
      const list = items.filter((x) => x.kind === kind)
      const current = sel && list.find((x) => x.id === sel.id)
      const groups = kind === 'finding' ? ['矛盾', '记录质量', '改判', '证据不足', '调整', '命名不一致', '病情变化'] : [null]
      return h('div', { className: 'me-body', style: { flex: 1 } },
        h('div', { className: 'me-frame me-col', style: { width: 330, flex: 'none', padding: 8 } },
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 } }, ['finding', 'mapping', 'time', 'type', 'concept'].map((k) => h('button', { key: k, className: `me-btn sm${kind === k ? ' on' : ''}`, onClick: () => { setKind(k); setSel(null) } }, `${kindLabel[k]} ${counts[k] ?? 0}`))),
          q.error ? h('div', { className: 'me-err' }, q.error) : null,
          h('div', { className: 'me-scroll', style: { flex: 1 } }, groups.map((g) => {
            const sub = g ? list.filter((x) => x.verdict === g) : list
            if (!sub.length) return null
            return h(React.Fragment, { key: g ?? 'all' },
              g ? h('div', { className: 'me-faint', style: { padding: '8px 8px 3px', display: 'flex', justifyContent: 'space-between' } }, h('span', {}, h('span', { style: { color: VERDICT_COLOR[g] } }, '● '), g), h('span', { className: 'me-num' }, sub.length)) : null,
              sub.map((x) => h('div', { key: `${x.patient}${x.id}`, className: `me-pi${sel?.id === x.id ? ' on' : ''}`, style: { opacity: x.review ? 0.55 : 1 }, onClick: () => setSel(x) },
                h('b', { style: { fontFamily: 'inherit', whiteSpace: 'normal' } }, x.kind === 'finding' ? `${x.subclass ?? x.verdict}` : x.title), h('span', {}, x.review ? '✓' : ''),
                h('span', { style: { gridColumn: '1 / 3' } }, `${x.patient.split('/').pop()} · ${x.kind === 'finding' ? x.title.slice(0, 40) : x.kind === 'mapping' ? x.nature : `${x.suggest ? JSON.stringify(x.suggest.type ?? x.suggest.concept ?? x.suggest.answer) : '—'} / ${x.verify ? JSON.stringify(x.verify.type ?? x.verify.concept ?? x.verify.answer) : '—'}`}`))))
          }), !list.length ? h('div', { className: 'me-faint', style: { padding: 10 } }, '没有待处理的项。') : null)),
        h('div', { className: 'me-frame me-scroll me-pad', style: { flex: 1 } },
          !current ? h('div', { className: 'me-faint' }, '从左侧选一项。')
            : current.kind === 'finding' ? h(FindingDetail, { key: current.id, run, patient: current.patient, findingId: current.id, gotoSource: (fid) => gotoSource(current.patient, fid), onDecided: q.reload })
              : h(SuggestionReview, { key: current.id, run, item: current, onDecided: q.reload, gotoSource })))
    }

    function SuggestionReview({ run, item, onDecided }) {
      const [saved, setSaved] = useState('')
      const decide = async (decision) => {
        try { await call('decide', { runId: run.id, kind: item.kind, id: item.id, decision }); setSaved(`已记为「${decision}」`); onDecided?.() } catch (e) { setSaved(msg(e)) }
      }
      const show = (v) => (v ? Object.entries(v).filter(([k]) => k !== 'reason').map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join('、') : x}`).join(' · ') : '（无有效回答）')
      return h('div', {},
        h('div', { className: 'me-h' }, h('b', {}, kindLabel[item.kind]), h('span', { className: 'me-cap' }, item.patient), h('span', { className: 'me-sp' }), h('span', { className: 'me-faint me-num' }, item.id)),
        h('div', { style: { fontSize: 15, fontWeight: 700, margin: '4px 0 8px' } }, item.title),
        item.kind === 'mapping' ? h('div', {}, h('div', { className: 'me-muted' }, `映射性质：${item.nature}`),
          h('div', { style: { display: 'flex', gap: 6, marginTop: 10 } }, h('button', { className: 'me-btn pri', onClick: () => decide('确认映射') }, '确认映射'), h('button', { className: 'me-btn', onClick: () => decide('不应合并') }, '不应合并')))
          : h('div', {},
            h('div', { className: 'me-mo' }, h('b', { style: { color: 'var(--vio)' } }, '◇ 建议模型 '), show(item.suggest), item.suggest?.reason ? h('div', { className: 'me-faint' }, item.suggest.reason) : null),
            h('div', { className: 'me-mo' }, h('b', { style: { color: 'var(--vio)' } }, '◇ 核验模型 '), show(item.verify), item.verify?.reason ? h('div', { className: 'me-faint' }, item.verify.reason) : null),
            h('div', { style: { display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' } },
              h('button', { className: 'me-btn pri', disabled: !item.suggest, onClick: () => decide('采纳建议模型') }, '采纳建议模型'),
              h('button', { className: 'me-btn', disabled: !item.verify, onClick: () => decide('采纳核验模型') }, '采纳核验模型'),
              h('button', { className: 'me-btn', onClick: () => decide('维持规则') }, '维持规则'))),
        item.review ? h('div', { className: 'me-faint', style: { marginTop: 8 } }, `已有裁定：${item.review.decision}（${fmtTime(item.review.at)}）`) : null,
        h('div', { className: 'me-tl', style: { marginTop: 8 } }, saved),
        h('div', { className: 'me-faint', style: { fontSize: 10.5, marginTop: 8 } }, '采纳的建议不会自动改规则结果：它们汇总到「规则改进」，由人写进规则包、升版本后重跑生效。'))
    }

    /* ---------------------------------------------------------------- improve */
    function Improve({ run }) {
      const q = useAsync(() => call('reviewQueue', { runId: run.id }), [run.id])
      const items = (q.value?.items ?? []).filter((x) => x.kind !== 'finding' && x.kind !== 'mapping' && (x.outcome === 'candidate' || /^采纳/.test(x.review?.decision ?? '')))
      const groups = {}
      for (const x of items) {
        const v = x.review?.decision === '采纳核验模型' ? x.verify : x.suggest
        const key = x.kind === 'type' ? `类型 → ${v?.type}` : x.kind === 'concept' ? (v?.concept ? `${v.isNew ? '新概念' : '归入'} ${v.concept}` : '不是该类概念') : `时间 → ${v?.answer}`
        ;(groups[`${kindLabel[x.kind]}｜${key}`] ??= []).push(x)
      }
      return h('div', { className: 'me-frame me-scroll me-pad', style: { flex: 1 } },
        h('div', { className: 'me-h' }, h('b', {}, '规则改进候选'), h('span', { className: 'me-cap' }, 'ADVICE'), h('span', { className: 'me-faint' }, '两模型一致或人工采纳的建议，按结论汇总；由人写进规则包（rules/）并升版本，重跑后在「规则对比」里核对')),
        q.error ? h('div', { className: 'me-err' }, q.error) : null,
        !items.length ? h('div', { className: 'me-empty' }, q.loading ? '加载中…' : '没有候选。') : null,
        Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([g, xs]) => h('details', { key: g, style: { borderTop: '1px solid var(--line)', padding: '6px 0' } },
          h('summary', { style: { cursor: 'pointer' } }, h('b', {}, g), h('span', { className: 'me-num me-tl', style: { marginLeft: 8 } }, xs.length)),
          h('div', { style: { padding: '4px 0 4px 16px', columns: 2 } }, xs.slice(0, 200).map((x) => h('div', { key: x.patient + x.id, className: 'me-muted', style: { breakInside: 'avoid' } }, `· ${x.title}`))))))
    }

    /* ------------------------------------------------------------------ calls */
    function Calls({ run }) {
      const d = useAsync(() => call('calls', { runId: run.id }), [run.id, run.totals.modelCalls])
      const v = d.value
      return h('div', { className: 'me-frame me-scroll me-pad', style: { flex: 1 } },
        h('div', { className: 'me-h' }, h('b', {}, '模型调用'), h('span', { className: 'me-cap' }, 'MODELS'), h('span', { className: 'me-faint' }, '只记时间、类别、耗时、Token、成败，不记提示词和回复')),
        !v?.models?.length ? h('div', { className: 'me-empty' }, run.model ? '还没有调用。' : '本批次未配置模型。') : h('table', {},
          h('thead', {}, h('tr', {}, ['角色', '模型', '调用', '失败', '缓存复用', '平均耗时', '输入 Token', '输出 Token', '按类别'].map((x) => h('th', { key: x }, x)))),
          h('tbody', {}, v.models.map((m) => h('tr', { key: m.role + m.model }, h('td', {}, m.role === 'suggest' ? '建议' : '核验'), h('td', {}, m.model), h('td', { className: 'me-num' }, m.calls), h('td', { className: `me-num ${m.failed ? 'me-bad' : ''}` }, m.failed), h('td', { className: 'me-num' }, m.cached),
            h('td', { className: 'me-num' }, m.calls ? `${(m.ms / Math.max(1, m.calls - m.cached) / 1000).toFixed(1)}s` : '—'), h('td', { className: 'me-num' }, fmt(m.promptTokens)), h('td', { className: 'me-num' }, fmt(m.completionTokens)),
            h('td', { className: 'me-muted' }, Object.entries(m.kinds).map(([k, n]) => `${kindLabel[k] ?? k} ${n}`).join(' · ')))))),
        v?.recent?.length ? h(React.Fragment, {}, h('div', { className: 'me-sec' }, h('b', {}, '最近调用')),
          h('table', {}, h('tbody', {}, [...v.recent].reverse().slice(0, 60).map((c, i) => h('tr', { key: i }, h('td', { className: 'me-num me-faint' }, fmtTime(c.at)), h('td', {}, c.patient), h('td', {}, kindLabel[c.kind] ?? c.kind), h('td', {}, c.role), h('td', { className: 'me-num' }, c.cached ? '缓存' : c.ms ? `${(c.ms / 1000).toFixed(1)}s` : ''), h('td', { className: c.ok === false ? 'me-bad' : 'me-ok' }, c.ok === false ? c.error : '✓')))))) : null)
    }

    /* ------------------------------------------------------------------ rules */
    function Rules({ run }) {
      const d = useAsync(() => call('rulepack', { specialty: run.specialty }), [run.id])
      const [view, setView] = useState('classify')
      const v = d.value
      if (!v) return h('div', { className: 'me-frame me-empty', style: { flex: 1 } }, d.error ?? '加载中…')
      const groups = {}
      for (const c of v.concepts) (groups[c.group] ??= []).push(c)
      return h('div', { className: 'me-frame me-col', style: { flex: 1 } },
        h('div', { className: 'me-pad', style: { borderBottom: '1px solid var(--line)' } },
          h('div', { className: 'me-h' }, h('b', {}, '规则包'), h('span', { className: 'me-cap' }, 'RULEPACK'), h('span', { className: 'me-faint' }, '规则与引擎分开：引擎只写“怎么做”，规则包写“认什么”。改规则 → 升版本 → 重跑。')),
          h('div', {}, v.layers.map((l) => h('span', { key: l.id, className: 'me-chip' }, `${l.layer} · ${l.id} v${l.version}${l.basedOn ? ` · 基于 ${Object.entries(l.basedOn).map(([k, x]) => `${k} ${x}`).join(' ')}` : ''}`))),
          h('div', { style: { display: 'flex', gap: 4, marginTop: 8 } }, [['classify', `类型规则 ${v.classify.length}`], ['concepts', `概念词表 ${v.concepts.length}`], ['vocab', `词表正则 ${Object.keys(v.vocab).length}`], ['sections', '栏目与时间策略'], ['params', '参数与互斥组']].map(([k, l]) => h('button', { key: k, className: `me-btn sm${view === k ? ' on' : ''}`, onClick: () => setView(k) }, l)))),
        h('div', { className: 'me-scroll', style: { flex: 1 } },
          view === 'classify' ? h('table', {}, h('thead', {}, h('tr', {}, ['顺序', '编号', '名称', '类型', '子类', '条件'].map((x) => h('th', { key: x }, x)))),
            h('tbody', {}, v.classify.map((r, i) => h('tr', { key: r.id }, h('td', { className: 'me-num me-faint' }, i + 1), h('td', { className: 'me-num' }, r.id, r.fallback ? h('span', { className: 'me-chip w', style: { marginLeft: 4 } }, '兜底') : null), h('td', {}, r.name), h('td', {}, h('span', { className: `me-chip ${TYPE_CLS[r.type]}` }, r.type)), h('td', {}, r.subclass), h('td', { className: 'me-num me-faint', style: { fontSize: 11, wordBreak: 'break-all' } }, JSON.stringify(r.when))))))
            : view === 'concepts' ? h('div', { className: 'me-pad' }, Object.entries(groups).map(([g, cs]) => h('div', { key: g }, h('div', { className: 'me-sec' }, h('b', {}, g), h('span', { className: 'me-cap' }, String(cs.length))),
              h('table', {}, h('tbody', {}, cs.map((c) => h('tr', { key: c.name }, h('td', { style: { width: 180 } }, c.name, c.once ? h('span', { className: 'me-chip v', style: { marginLeft: 4 } }, '一次性') : null), h('td', { className: 'me-muted' }, c.aliases.join('、')), h('td', { className: /需药师|需医生/.test(c.nature ?? '') ? 'me-warn' : 'me-faint' }, c.nature ?? ''))))))))
              : view === 'vocab' ? h('table', {}, h('tbody', {}, Object.entries(v.vocab).map(([k, re]) => h('tr', { key: k }, h('td', { className: 'me-num', style: { width: 120 } }, k), h('td', { className: 'me-num me-muted', style: { fontSize: 11, wordBreak: 'break-all' } }, String(re))))))
                : view === 'sections' ? h('table', {}, h('tbody', {}, Object.entries(v.sections).flatMap(([doc, cfg]) => (cfg.list ?? [{ name: cfg.whole, time: cfg.time, label: cfg.label }]).map((s) => h('tr', { key: doc + s.name }, h('td', {}, doc), h('td', {}, s.name), h('td', { className: 'me-num me-faint' }, s.re ?? ''), h('td', {}, s.time), h('td', { className: 'me-muted' }, s.label ?? ''))))))
                  : h('div', { className: 'me-pad' }, h('table', {}, h('tbody', {}, Object.entries(v.params).map(([k, x]) => h('tr', { key: k }, h('td', { className: 'me-num' }, k), h('td', { className: 'me-num' }, String(x)))))),
                    h('div', { className: 'me-sec' }, h('b', {}, '互斥用药组')), v.exclusive.map((g) => h('div', { key: g.name }, `${g.name}：${g.drugs.join('、')}`, h('div', { className: 'me-faint' }, g.note))),
                    h('div', { className: 'me-sec' }, h('b', {}, '否认上位概念')), v.hypernyms.map((x) => h('div', { key: x.name }, `${x.name} ⊇ ${x.children.join('、')}`)),
                    h('div', { className: 'me-sec' }, h('b', {}, '候选同义（不合并）')), v.candidateSynonyms.map((x) => h('div', { key: x.name }, `${x.name}：${x.members.join('／')}`)))))
    }

    /* ----------------------------------------------------------------- report */
    function Report({ run }) {
      const d = useAsync(() => call('report', { runId: run.id }), [run.id, run.status])
      return h('div', { className: 'me-frame me-scroll me-pad', style: { flex: 1 } },
        d.value ? h(React.Fragment, {}, h('div', { className: 'me-faint', style: { marginBottom: 8 } }, d.value.path), h('div', { className: 'me-md' }, d.value.markdown)) : h('div', { className: 'me-faint' }, d.error ?? '加载中…'))
    }

    /* --------------------------------------------------------------- settings */
    function SettingsSection() {
      const [cfg, setCfg] = useState(null)
      const [form, setForm] = useState({})
      const [state, setState] = useState('')
      useEffect(() => { call('config').then((c) => { setCfg(c); setForm({ ...c, specialty: [].concat(c.specialty ?? []).join(','), apiKey: '' }) }).catch((e) => setState(msg(e))) }, [])
      if (!cfg) return h('div', { className: 'me-settings' }, h('style', {}, CSS), state || '加载中…')
      const field = (k, label, props = {}) => h('label', { className: 'me-field' }, label, h('input', { className: 'me-input', value: form[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }), ...props }))
      const save = async () => {
        const patch = {
          outputRoot: form.outputRoot ?? '', baseURL: form.baseURL ?? '', model: form.model ?? '', verifyBaseURL: form.verifyBaseURL ?? '', verifyModel: form.verifyModel ?? '',
          specialty: String(form.specialty ?? '').split(/[,，\s]+/).filter(Boolean), modelConcurrency: Number(form.modelConcurrency) || 4, modelLimit: Number(form.modelLimit) || 200,
          timeoutMs: Number(form.timeoutMs) || 120000, disableThinking: form.disableThinking !== false, modelEnabled: form.modelEnabled !== false, showSidebarEntry: form.showSidebarEntry !== false,
        }
        if (form.apiKey) patch.apiKey = form.apiKey
        try { await call('saveDefaults', patch); setState('已保存（插件会重新加载）') } catch (e) { setState(msg(e)) }
      }
      const check = (k, label) => h('label', { style: { display: 'flex', gap: 6, alignItems: 'center' } }, h('input', { type: 'checkbox', checked: form[k] !== false, onChange: (e) => setForm({ ...form, [k]: e.target.checked }) }), label)
      return h('div', { className: 'me-settings' }, h('style', {}, CSS),
        h('p', { style: { margin: 0, color: 'var(--dsw-alias-label-secondary)' } }, '这里只放配置。运行批次、看时间线与复核，请到左侧栏的「病历事件还原」，或在聊天框使用 /event。'),
        h('h3', { style: { margin: '6px 0 0' } }, '模型补充（可选）'),
        h('p', { style: { margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, '规则是主体。模型只处理规则判不了的项（待定时间、兜底类型、未归一概念、需人工确认的发现），只出建议、不改规则结果。病历内容只发往这里配置的端点，Agent 不能更改。'),
        check('modelEnabled', '启用模型补充'),
        h('div', { className: 'me-grid2' }, field('baseURL', '建议模型端点（OpenAI 兼容）', { placeholder: 'http://127.0.0.1:11434/v1' }), field('model', '建议模型'),
          field('verifyBaseURL', '核验模型端点（空＝同上）'), field('verifyModel', '核验模型（空＝不核验，建议一律进人工复核）'),
          field('apiKey', cfg.apiKeySet ? 'API Key（已设置；留空不修改）' : 'API Key（可空）', { type: 'password' }), field('timeoutMs', '单次调用超时（毫秒）'),
          field('modelConcurrency', '每个模型同时处理的请求数'), field('modelLimit', '每位病人每类候选最多送模型的条数')),
        check('disableThinking', '关闭思考模式（推理模型更快）'),
        h('h3', { style: { margin: '6px 0 0' } }, '批次'),
        h('div', { className: 'me-grid2' }, field('outputRoot', '默认输出根目录（空＝输入旁的 _medical-event）'), field('specialty', '专科规则包（逗号分隔；空＝只用通用层）')),
        check('showSidebarEntry', '在左侧栏显示「病历事件还原」入口'),
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } }, h('button', { className: 'me-btn', onClick: save }, '保存'), h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, state)))
    }

    /* ----------------------------------------------------------------- plugin */
    const plugin = {
      inject: ['slots'],
      apply(ctx) {
        services.ctx = ctx
        ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'medical-event', order: 31, label: () => '病历事件还原' }, SettingsSection))
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, Page))
        let disposeEntry = null
        const setSidebar = (visible) => {
          if (visible && !disposeEntry) disposeEntry = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 31, label: () => '病历事件还原' }, Icon))
          else if (!visible && disposeEntry) { disposeEntry(); disposeEntry = null }
        }
        setSidebar(true)
        let stopped = false
        ;(async () => {
          for (let i = 0; i < 10 && !stopped; i++) {
            try { const c = await call('config'); if (!stopped) setSidebar(c.showSidebarEntry !== false); return } catch { await new Promise((r) => setTimeout(r, 1000)) }
          }
        })()
        ctx.effect?.(() => () => { stopped = true; setSidebar(false) })
      },
    }
    return plugin
  },
})
