window.__ModuleLoader__.load({
  id: 'dsh-medical-event',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useCallback } = React
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
    // 主题：钴蓝（病历文书提取是薰衣草紫、匿名化与本体是青绿、HL7 是暖棕）；类名前缀 me-
    const CSS = `.me{--mono:"SF Mono","JetBrains Mono",Menlo,monospace;
  height:100%;box-sizing:border-box;background:var(--bg);color:var(--ink);font:12.5px -apple-system,"PingFang SC","Helvetica Neue",sans-serif;display:flex;flex-direction:column;gap:8px;padding:8px 10px 10px;color-scheme:dark;overflow:hidden}
.me.me-dark{--bg:#090c13;--panel:#0e131d;--panel2:#131a27;--panel3:#1a2334;--line:#1b2331;--line2:#2a354b;--ink:#e6ebf5;--ink2:#9aa6bf;--ink3:#5f6b85;--teal:#4f7cff;--teal2:#b8caff;--tealdim:rgba(79,124,255,.14);--fill:#2f5bea;--ok:#62c27e;--warn:#f0a63a;--bad:#e5484d;--badink:#ff8a8d;--vio:#a48dff;--fact:#47c6e6;--judge:#f38bc8;--decide:#4fd1a5;--visit:#7f8aa3;--tick:#4b5670;--arrow:#3a4560;--cell-ok:#62c27e;--top:#0c111a;--st1:#111826;--st2:#0c111a;--shade:rgba(9,12,19,.65);--sel:#e6ebf5;color-scheme:dark}
.me.me-light{--bg:#edf1f7;--panel:#fbfcfe;--panel2:#f2f5fa;--panel3:#e4eaf4;--line:#dbe2ed;--line2:#c3cddf;--ink:#16202f;--ink2:#56627a;--ink3:#8a96ac;--teal:#2a52d6;--teal2:#1c3aa6;--tealdim:rgba(42,82,214,.1);--fill:#2a52d6;--ok:#2f9a55;--warn:#c27a12;--bad:#cf3a3f;--badink:#b83034;--vio:#6a4fd6;--fact:#0a8db0;--judge:#c23d8c;--decide:#0f9d78;--visit:#8590a8;--tick:#adb7ca;--arrow:#b5bfd0;--cell-ok:#3fb27a;--top:#f7f9fc;--st1:#f9fbfe;--st2:#eff3f9;--shade:rgba(237,241,247,.72);--sel:#16202f;color-scheme:light}
.me *{box-sizing:border-box}
.me-frame{border:1px solid var(--line);background:var(--panel);border-radius:6px}
.me-top{display:flex;align-items:center;gap:14px;padding:6px 12px;background:linear-gradient(90deg,color-mix(in srgb,var(--teal) 10%,transparent),transparent 40%),var(--panel);flex:none}
.me-logo{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#6f9bff,#1f45c4);display:grid;place-items:center;flex:none}
.me-brand{display:flex;align-items:center;gap:10px;flex:none}.me-brand b{display:block;font-size:15px;letter-spacing:2px}.me-brand span{font-family:var(--mono);font-size:10px;color:var(--ink2);letter-spacing:1px}
.me-status{display:flex;align-items:center;gap:8px;height:58px;padding:4px 12px 4px 10px;border-radius:8px;border:1px solid var(--line2);min-width:170px;max-width:340px}
.me-status>div{display:flex;flex-direction:column;line-height:16px;min-width:0}.me-status>div>*{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.me-status b{font-size:13px}.me-status span{font-size:11px;color:var(--ink2)}.me-status .me-tl{color:var(--teal)}
.me-lamp{width:9px;height:9px;border-radius:50%;background:var(--line2);flex:none}
.s-running .me-lamp{background:var(--warn);box-shadow:0 0 0 3px color-mix(in srgb,var(--warn) 25%,transparent);animation:me-pulse 1.2s infinite}
.s-completed .me-lamp{background:var(--ok)}.s-review .me-lamp{background:var(--warn)}.s-failed .me-lamp,.s-cancelled .me-lamp{background:var(--bad)}
.me-clock{display:flex;flex-direction:column;align-items:flex-end;line-height:16px;padding:0 4px}
.me-clock span{font-size:10px;color:var(--ink2);letter-spacing:1px}
.me-clock b{font-family:var(--mono);font-size:18px;font-weight:600;letter-spacing:1px;line-height:22px}
.me-clock.sep{padding-right:14px;margin-right:6px;border-right:1px solid var(--line)}
.me-clock.pct b{color:var(--teal)}.me-clock.pct small{font-size:11px;font-weight:400;margin-left:1px;color:var(--ink2)}
.me-clock.ver{margin-right:6px}.me-clock.ver b{display:flex;align-items:baseline;gap:5px;white-space:nowrap;font-size:15px;font-weight:600;letter-spacing:0;color:var(--ink2)}
.me-clock.ver small{font-size:10.5px;font-weight:500;color:var(--ink3);padding:0 5px;border:1px solid var(--line2);border-radius:3px;line-height:15px}
.me-top .me-btn,.me-icon{height:34px;border-radius:7px}
.me-top .me-btn{display:inline-flex;align-items:center;gap:5px;padding:0 14px;box-shadow:none}
.me-stop{border-color:var(--bad);color:var(--badink)}
.me-hbtn{padding:0 10px 0 11px!important}.me-hbtn:hover,.me-hbtn[aria-expanded="true"]{border-color:var(--teal);color:var(--teal2)}
.me-hcount{font-style:normal;font-family:var(--mono);font-size:10.5px;line-height:15px;padding:0 5px;border-radius:8px;background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--ink2)}
.me-icon{width:34px;border:1px solid var(--line2);background:var(--panel2);color:var(--ink2);font-size:15px;cursor:pointer;display:grid;place-items:center}
.me-icon:hover{color:var(--teal);border-color:var(--teal)}
.me-runs-pop{width:440px;max-height:min(560px,calc(100vh - 120px))}
.me-runs{display:flex;flex-direction:column;gap:4px;overflow:auto;min-height:0}
.me-run{padding:7px 10px;border:1px solid var(--line);border-radius:6px;cursor:pointer}
.me-run:hover{border-color:var(--line2);background:var(--panel2)}.me-run.on{border-color:var(--teal);background:var(--tealdim)}
.me-run-top{display:flex;align-items:center;gap:8px}.me-run-name{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.me-run-meta{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--ink2);margin-top:2px}
.me-modal-back{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px}
.me-modal{width:min(880px,100%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;border-radius:10px;background:var(--dsw-alias-bg-layer-1,var(--panel));border:1px solid var(--line2);box-shadow:0 18px 50px rgba(0,0,0,.35);overflow:hidden;color:var(--dsw-alias-label-primary,var(--ink))}
.me-modal-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line2);border-top:3px solid var(--teal)}.me-modal-head h3{flex:1;margin:0;font-size:15px}
.me-modal-body{flex:1;min-height:0;overflow:auto;padding:16px 24px 20px}
.me-sp{flex:1}
.me-btn{border:1px solid var(--line2);border-radius:5px;padding:4px 11px;color:var(--ink);background:var(--panel2);font-size:12px;cursor:pointer;white-space:nowrap}
.me-btn:hover{border-color:var(--teal)}.me-btn:disabled{opacity:.45;cursor:default}
.me-btn.pri{border-color:var(--teal);color:var(--teal2);background:var(--tealdim)}
.me-btn.sm{padding:1px 7px;font-size:11px}
.me-btn.on{border-color:var(--teal);color:var(--teal2)}
.me-tabs{display:flex;gap:2px;padding:0 8px;flex:none;overflow-x:auto}
.me-tab-sep{flex:none;align-self:center;width:1px;height:20px;margin:0 10px;background:var(--ink3);opacity:.55}
.me-tab.me-tab-gap{margin-left:14px}
.me-tab i.hot{color:var(--warn);font-weight:600}
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
.me-chip.f{color:var(--fact);border-color:color-mix(in srgb,var(--fact) 45%,transparent);background:color-mix(in srgb,var(--fact) 8%,transparent)}
.me-chip.j{color:var(--judge);border-color:color-mix(in srgb,var(--judge) 45%,transparent);background:color-mix(in srgb,var(--judge) 8%,transparent)}
.me-chip.d{color:var(--decide);border-color:color-mix(in srgb,var(--decide) 45%,transparent);background:color-mix(in srgb,var(--decide) 8%,transparent)}
.me-chip.w{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 50%,transparent);background:color-mix(in srgb,var(--warn) 8%,transparent)}
.me-chip.b{color:var(--badink);border-color:color-mix(in srgb,var(--bad) 50%,transparent);background:color-mix(in srgb,var(--bad) 8%,transparent)}
.me-chip.ok{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 45%,transparent);background:color-mix(in srgb,var(--ok) 8%,transparent)}
.me-chip.v{color:var(--vio);border-color:color-mix(in srgb,var(--vio) 45%,transparent);background:color-mix(in srgb,var(--vio) 8%,transparent)}
.me-sec{border-left:3px solid var(--teal);background:linear-gradient(90deg,color-mix(in srgb,var(--teal) 16%,transparent),transparent 70%);padding:4px 10px;margin:10px 0 8px;display:flex;gap:8px;align-items:baseline}
.me-sec b{font-size:12.5px}
.me table{border-collapse:collapse;width:100%}
.me td,.me th{padding:5px 8px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
.me th{font-weight:500;color:var(--ink3);font-size:11px;position:sticky;top:0;background:var(--panel)}
.me tr.click{cursor:pointer}.me tr.click:hover td{background:var(--panel2)}
.me tr.sel td{background:var(--panel3)}
.me-input{background:var(--panel2);border:1px solid var(--line2);border-radius:5px;color:var(--ink);padding:5px 8px;font-size:12px;min-width:0}
.me-input:focus{outline:none;border-color:var(--teal)}
.me-field{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--ink2)}
.me-err{color:var(--badink);border:1px solid color-mix(in srgb,var(--bad) 40%,transparent);background:color-mix(in srgb,var(--bad) 8%,transparent);padding:6px 10px;border-radius:5px}
.me-empty{color:var(--ink3);padding:30px;text-align:center}
.me-bigs{display:flex;gap:22px;margin:4px 0 8px;flex-wrap:wrap}.me-bigs div small{display:block;color:var(--ink3);font-size:11px}.me-bigs div .me-num{font-size:24px;font-weight:700}
.me-pi{padding:6px 8px;border-radius:5px;cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:1px 6px}
.me-pi:hover{background:var(--panel2)}.me-pi.on{background:var(--panel3);box-shadow:inset 3px 0 0 var(--teal)}
.me-pi b{font-family:var(--mono);font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.me-pi span{font-size:10.5px;color:var(--ink3)}
.me-doc{font-size:13.5px;line-height:2.3;white-space:pre-wrap;word-break:break-all}
.me-m{border-bottom:2px solid;padding:1px 1px;border-radius:2px;cursor:pointer}
.me-m.f{border-color:var(--fact);background:color-mix(in srgb,var(--fact) 10%,transparent)}.me-m.j{border-color:var(--judge);background:color-mix(in srgb,var(--judge) 11%,transparent)}.me-m.d{border-color:var(--decide);background:color-mix(in srgb,var(--decide) 11%,transparent)}
.me-m.n{border-bottom-style:dashed}.me-m.t{opacity:.55}.me-m.sel{outline:1.5px solid var(--sel);outline-offset:1px}
.me-tm{font-family:var(--mono);font-size:9.5px;color:var(--warn);border:1px solid color-mix(in srgb,var(--warn) 40%,transparent);border-radius:3px;padding:0 3px;margin:0 2px;vertical-align:1px}
.me-tm.inh{color:var(--ink3);border-color:var(--line2)}.me-tm.q{color:var(--badink);border-color:color-mix(in srgb,var(--bad) 50%,transparent)}
.me-kv{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:11.5px}
.me-mrow{border-top:1px solid var(--line);padding:6px 0;font-size:11.5px}
.me-opt{border:1px solid var(--line2);border-radius:6px;padding:6px 10px;margin-bottom:5px;cursor:pointer;display:flex;gap:8px;align-items:center}
.me-opt.on{border-color:var(--teal);background:var(--tealdim)}
.me-mo{border:1px solid color-mix(in srgb,var(--vio) 35%,transparent);background:color-mix(in srgb,var(--vio) 5%,transparent);border-radius:6px;padding:7px 10px;font-size:11.5px;line-height:1.6;margin-bottom:6px}
.me-md{white-space:pre-wrap;font-family:var(--mono);font-size:12px;line-height:1.6}
.me-settings{max-width:820px;display:flex;flex-direction:column;gap:12px;color:var(--dsw-alias-label-primary)}
.me-settings .me-input{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.me-settings .me-btn{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.me-settings .me-field{color:var(--dsw-alias-label-secondary)}
.me-stabs{display:flex;gap:2px;box-shadow:inset 0 -1px 0 var(--dsw-alias-border-l2,var(--line2));overflow-x:auto}
.me-stab{position:relative;display:inline-flex;align-items:center;gap:6px;background:none;border:0;border-bottom:2px solid transparent;padding:8px 12px;font:inherit;font-size:13px;color:var(--dsw-alias-label-secondary,var(--ink2));cursor:pointer;white-space:nowrap}
.me-stab[aria-selected="true"]{color:var(--dsw-alias-label-primary,var(--ink));font-weight:600;border-bottom-color:var(--teal,#2a52d6)}
.me-sdot{width:6px;height:6px;border-radius:50%;background:var(--warn,#c27a12)}
.me-spanel{display:flex;flex-direction:column;gap:12px;min-height:240px}
.me-scard{border:1px solid var(--dsw-alias-border-l2,var(--line2));border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:var(--dsw-alias-bg-layer-1,var(--panel))}
.me-scard-h b{font-size:13.5px;color:var(--dsw-alias-label-primary,var(--ink))}.me-scard-h p{margin:3px 0 0}
.me-shint{display:block;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-tertiary,var(--ink3))}.me-shint.ok{color:var(--ok,#2f9a55)}.me-shint.bad{color:var(--bad,#cf3a3f)}
.me-scheck{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:var(--dsw-alias-label-primary,var(--ink))}.me-scheck input{margin-top:2px}
.me-sact{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.me-settings .me-wide{grid-column:1/-1}
.me-savebar{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;padding:10px 0 4px;border-top:1px solid var(--dsw-alias-border-l2,var(--line2));background:var(--dsw-alias-bg-base,var(--panel))}
.me-mp{position:relative;width:100%}.me-mp-row{display:flex;gap:6px}.me-mp-row .me-input{flex:1;min-width:0}.me-mp-btn{flex:none;width:32px;padding:0}
.me-mp-menu{position:absolute;z-index:30;left:0;right:0;top:calc(100% + 4px);max-height:240px;overflow:auto;padding:4px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,var(--line2));background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1,var(--panel)));box-shadow:0 8px 24px rgba(0,0,0,.16)}
.me-mp-item{display:block;width:100%;text-align:left;padding:6px 8px;border:0;border-radius:5px;background:none;color:var(--dsw-alias-label-primary,var(--ink));font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}
.me-mp-item:hover{background:var(--dsw-alias-bg-layer-2,var(--panel2))}.me-mp-item.on{color:var(--teal,#2a52d6);font-weight:600}
.me-mp-clear{font-family:inherit;color:var(--dsw-alias-label-secondary,var(--ink2))}
.me-mp-note{padding:6px 8px;font-size:12px;color:var(--dsw-alias-label-secondary,var(--ink2))}.me-mp-note.bad{color:var(--bad,#cf3a3f)}
.me-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.me-grid2>*{min-width:0}
.me-pop .me-grid2.tm{grid-template-columns:minmax(0,1fr) max-content}
/* ---- 流水线：等轴测工厂＋HUD 面板（参考工业监控大屏） ---- */
.me.me-dark{--lift:0 1px 0 rgba(255,255,255,.025) inset,0 12px 26px -22px #000}
.me.me-light{--lift:0 1px 0 rgba(255,255,255,.8) inset,0 10px 22px -20px rgba(20,35,80,.3)}
.me-frame{box-shadow:var(--lift);border-radius:4px}
.me-tab.on{color:var(--teal2);border-bottom-color:var(--teal)}
.me-tab i{color:var(--ink3)}.me-tab.on i{color:var(--teal)}
.me-stack{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:6px 0 4px;background:var(--line2)}.me-stack span{display:block;height:100%}
.me-scene{display:block;width:100%;height:auto;overflow:visible;margin:0 auto}
.me-scene text{pointer-events:none}
.me-scene:focus{outline:none}.me-scene:focus-visible{outline:1px dashed color-mix(in srgb,var(--teal) 60%,transparent);outline-offset:-2px;border-radius:3px}
.me-hero{position:relative;padding:10px 12px 8px;min-height:560px;background:radial-gradient(120% 90% at 45% 55%,var(--panel2),var(--bg) 75%);display:flex;flex-direction:column;min-height:420px}
/* 流水线页布局（同匿名化插件）：左＝流水线＋底部三栏，右＝工序详情拉到底 */
.me-line{flex:1;min-width:0;min-height:640px;display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:8px}
.me-line-left{min-width:0;min-height:0;display:flex;flex-direction:column;gap:8px}
.me-line .me-hero{flex:1;min-height:360px}
.me-line .me-scene{flex:1 1 0;min-height:0;width:100%;height:100%}
.me-line .me-side{width:auto;min-height:0}
.me-bottom{flex:none;display:grid;grid-template-columns:1.15fr 1.3fr .85fr}
.me-ro{padding:10px 14px 11px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:9px;min-width:0;overflow:hidden}
.me-ro:last-child{border-right:0}
.me-ro .me-legend{margin-top:-4px;padding-top:0}
.me-ro .me-stack{margin:0}
.me-ro-h{display:flex;align-items:center;gap:8px;min-height:18px}
.me-ro-h>b{font-size:12.5px}
.me-big{display:flex;gap:6px 20px;flex-wrap:wrap;align-items:flex-end}
.me-big>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.me-big span{font-size:10.5px;color:var(--ink3)}
.me-big b{font-family:var(--mono);font-size:21px;font-weight:600;color:var(--ink);line-height:1.1;white-space:nowrap}
.me-big b.me-dim{font-family:inherit;font-size:15px;color:var(--ink2);padding-bottom:2px}
.me-big small{font-size:11px;color:var(--ink3);font-weight:400;margin-left:2px}
.me-big .me-big-pair{gap:1px}
.me-big-pair p{margin:0;display:flex;gap:6px;align-items:baseline}
.me-big-pair b{font-size:12.5px}
.me-kv2{display:flex;gap:4px 18px;flex-wrap:wrap;font-size:11.5px;color:var(--ink3)}
.me-kv2 p{margin:0;display:flex;gap:7px;align-items:baseline}
.me-kv2 b{font-family:var(--mono);font-size:13px;font-weight:600;color:var(--ink)}
.me-kv2 small{font-size:10.5px;color:var(--ink3)}
.me-spark{margin-top:auto}
.me-spark svg{display:block;width:100%;height:40px}
.me-spark .grid{stroke:var(--line);stroke-width:1}
.me-spark .area{fill:var(--tealdim)}
.me-spark .line{fill:none;stroke:var(--teal);stroke-width:1.6;vector-effect:non-scaling-stroke}
.me-spark .avg{stroke:var(--ink3);stroke-width:1;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}
.me-spark-foot{display:flex;justify-content:space-between;font-size:10.5px;color:var(--ink3);margin-top:2px}
.me-ro-line{display:flex;align-items:center;gap:6px 14px;flex-wrap:wrap;font-size:11.5px;color:var(--ink2)}
.me-ro-line b{font-family:var(--mono);font-weight:600;color:var(--ink)}
.me-link{padding:0;border:0;background:none;font:inherit;color:var(--ink2);cursor:pointer}
.me-link:hover{color:var(--teal2)}
.me-link.me-warn b{color:var(--warn)}
.me-types span{display:inline-flex;gap:5px;color:var(--ink3)}
.me-types b{color:var(--ink2)}
.me-gdots{display:inline-flex;align-items:center;gap:4px;margin-left:auto;color:var(--ink3)}
.me-gdot{width:20px;height:20px;padding:0;border-radius:50%;border:1px solid var(--line2);background:none;font:inherit;font-size:11.5px;line-height:18px;color:var(--ink3);cursor:pointer}
.me-gdot.ok{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 50%,transparent);background:color-mix(in srgb,var(--ok) 9%,transparent)}
.me-gdot.bad{color:#fff;border-color:var(--bad);background:var(--bad)}
.me-ro .me-spath{margin-top:auto}
.me-ro .me-spath span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:10.5px;color:var(--ink3);min-width:0}
.me-gauges{flex:1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;align-items:center}
.me-gauge{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0;text-align:center}
.me-gauge svg{width:58px;height:58px}
.me-gauge .trk{fill:none;stroke:var(--line2);stroke-width:6}
.me-gauge .arc{fill:none;stroke-width:6;stroke-linecap:round;transform:rotate(-90deg);transform-origin:50% 50%}
.me-gauge .pk{fill:var(--ink2);stroke:var(--panel);stroke-width:1.2}
.me-gauge text{font-family:var(--mono);font-size:12px;font-weight:600;fill:var(--ink)}
.me-gauge span{font-size:11.5px;color:var(--ink2);white-space:nowrap}
.me-gauge small{font-family:var(--mono);font-size:10.5px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.me-dtab{width:100%;border-collapse:collapse;font-size:11.5px}
.me-dtab th{font-weight:400;font-size:10.5px;color:var(--ink3);text-align:right;padding:2px 4px;border-bottom:1px solid var(--line)}
.me-dtab th:first-child,.me-dtab td:first-child{text-align:left;padding-left:0;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.me-dtab td{text-align:right;padding:3px 4px;border-bottom:1px solid var(--line);color:var(--ink)}
.me-dtab td:last-child,.me-dtab th:last-child{padding-right:0}
.me-dz{display:flex;flex-direction:column;gap:2px;margin-bottom:6px;font-size:11.5px}
.me-dz p{margin:0;display:flex;gap:8px;align-items:baseline;min-width:0}
.me-dz p span{flex:none}
.me-dz p b{flex:none;font-weight:600}
.me-dz p small{color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.me-mdv-bar{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line);padding-top:8px;padding-bottom:8px}
.me-mdv-bar span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:11px}
.me-mdv{font-size:13px;line-height:21px;color:var(--ink);max-width:960px;min-width:0}
.me-mdv h1{font-size:18px;margin:6px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--teal)}
.me-mdv h2{font-size:15px;margin:20px 0 8px;padding-left:8px;border-left:3px solid var(--teal)}
.me-mdv h3{font-size:13.5px;margin:16px 0 6px}
.me-mdv h4{font-size:13px;margin:12px 0 4px}
.me-mdv p{margin:6px 0}
.me-mdv ul,.me-mdv ol{margin:4px 0 8px;padding-left:20px}
.me-mdv li{margin:2px 0;word-break:break-word}
.me-mdv blockquote{margin:8px 0;padding:6px 10px;border-left:3px solid var(--warn);background:color-mix(in srgb,var(--warn) 7%,transparent);color:var(--ink2)}
.me-mdv code{font-family:var(--mono);font-size:11.5px;padding:1px 4px;border-radius:4px;background:var(--tealdim);word-break:break-all}
.me-mdv-tw{overflow-x:auto;margin:6px 0 10px}
.me-mdv table{border-collapse:collapse;font-size:12.5px;min-width:50%}
.me-mdv th{text-align:left;font-weight:600;background:var(--tealdim);padding:5px 10px;border:1px solid var(--line)}
.me-mdv td{padding:4px 10px;border:1px solid var(--line);vertical-align:top;word-break:break-word}
.me-mdv table.kv th{font-weight:400;color:var(--ink2);background:var(--panel2);white-space:nowrap;width:1%}
.me-mdv-layout{display:grid;grid-template-columns:minmax(0,960px) 240px;gap:28px;align-items:start}
.me-mdv-toc{position:sticky;top:0;max-height:calc(100vh - 240px);overflow:auto;display:flex;flex-direction:column;gap:1px;padding:4px 0 4px 12px;border-left:1px solid var(--line)}
.me-mdv-toc-h{font-size:11px;font-weight:600;letter-spacing:1px;color:var(--ink3);padding:2px 6px 6px}
.me-mdv-toc-i{display:block;width:100%;padding:3px 6px;border:0;border-radius:4px;background:none;color:var(--ink2);font:inherit;font-size:12px;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.me-mdv-toc-i.l2{font-weight:600;color:var(--ink);margin-top:4px}
.me-mdv-toc-i.l3{padding-left:16px}
.me-mdv-toc-i:hover{background:var(--tealdim)}
.me-mdv-toc-i.on{color:var(--teal2);background:var(--tealdim);box-shadow:inset 2px 0 0 var(--teal)}
@media (max-width:1100px){.me-mdv-layout{grid-template-columns:minmax(0,1fr)}.me-mdv-toc{display:none}}
.me-res-line{display:flex;justify-content:center;align-items:baseline;gap:6px;font-size:11.5px;color:var(--ink2)}
.me-res-line b{font-family:var(--mono);font-weight:600;color:var(--ink)}
.me-res-line span{color:var(--ink3)}
@media (max-width:1200px){.me-line{grid-template-columns:minmax(0,1fr) 290px}.me-bottom{grid-template-columns:1fr 1fr}.me-bottom .me-ro:last-child{grid-column:1 / -1;border-top:1px solid var(--line)}}
.me-hero .me-scene{flex:1}
.me-hud{position:absolute;z-index:1;font-size:11px;color:var(--ink2);pointer-events:none}
.me-hud.tl{bottom:44px;left:14px;width:208px;padding:10px 12px;background:color-mix(in srgb,var(--panel) 82%,transparent);border:1px solid var(--line2);border-radius:3px;backdrop-filter:blur(3px)}
.me-hud-id{font-size:9.5px;letter-spacing:1px;color:var(--ink3);margin-bottom:8px}.me-hud-id b{color:var(--ink2);font-weight:500}
.me-hud-row{display:grid;grid-template-columns:1fr auto;gap:0 8px;margin-bottom:7px}.me-hud-row b{color:var(--ink);font-weight:500}
.me-hud-row .me-ticks{grid-column:1/3;height:9px;margin-top:3px}
.me-hud-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line2);margin-top:4px}
.me-hud-grid div{padding:6px 0 5px;border-bottom:1px solid var(--line)}.me-hud-grid div:nth-child(even){padding-left:10px;border-left:1px solid var(--line)}
.me-hud-grid small{display:block;font-family:var(--mono);font-size:9px;color:var(--ink3);letter-spacing:.5px}.me-hud-grid b{font-size:15px;font-weight:400;color:var(--ink)}
.me-hud-model{margin-top:8px;font-family:var(--mono);font-size:9.5px;color:var(--ink3);display:flex;align-items:center;gap:6px}
.me-hud-model i{width:6px;height:6px;border-radius:50%;background:var(--ink3)}.me-hud-model i.on{background:var(--ok);box-shadow:0 0 5px var(--ok)}
.me-al-ov{position:absolute;z-index:2;top:10px;right:12px;width:300px;max-height:calc(100% - 36px);overflow:auto;display:flex;flex-direction:column;gap:2px;padding:6px 10px;background:color-mix(in srgb,var(--panel) 90%,transparent);border:1px solid var(--line2);border-radius:6px;backdrop-filter:blur(3px);font-size:11px}
.me-al-ov.crit{border-color:var(--bad);box-shadow:inset 3px 0 0 var(--bad)}.me-al-ov.crit .me-al-dot{animation:me-pulse 1.4s ease-in-out infinite}
.me-al-ov.warn{box-shadow:inset 3px 0 0 var(--warn)}
.me-al-ov.ok{flex-direction:row;align-items:center;gap:6px;width:auto;color:var(--ink2)}.me-al-ov.shut{width:auto}
.me-al-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.me-al-head{display:flex;align-items:center;gap:6px;background:none;border:0;padding:2px 0;cursor:pointer;color:var(--ink);font:inherit}.me-al-head b{font-size:12px}.me-al-head .me-cap{flex:1;text-align:left}
.me-al-n{font-family:var(--mono);font-size:10.5px;color:var(--ink2);background:var(--panel3);border-radius:8px;padding:0 6px}
.me-al-list{display:flex;flex-direction:column}
.me-al-item{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;background:none;border:0;border-top:1px solid var(--line);padding:6px 2px;font:inherit;color:var(--ink);cursor:pointer}
.me-al-item:disabled{cursor:default}.me-al-item:not(:disabled):hover{background:var(--panel2)}
.me-al-item>i{width:7px;height:7px;border-radius:50%}.me-al-item b{display:block;font-weight:600;font-size:11.5px}.me-al-item small{display:block;color:var(--ink3);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.me-al-more{align-self:flex-end;font-size:11px;padding-top:4px}
.me-act{position:relative}
.me-new{border-color:var(--fill);background:var(--fill);color:#fff;font-weight:600}
.me-new:hover:not(:disabled){filter:brightness(1.06)}
.me-new:disabled{background:transparent;color:var(--ink2);border-color:var(--line2);font-weight:400}
.me-caret{font-size:9px;opacity:.7;margin-left:5px}
.me-shade{position:fixed;inset:0;z-index:940;background:rgba(0,0,0,.35)}
.me-pop{position:absolute;right:0;top:36px;z-index:950;width:460px;padding:14px 16px;border:1px solid color-mix(in srgb,var(--teal) 50%,transparent);border-radius:8px;background:var(--panel);box-shadow:0 20px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:10px;text-align:left}
.me-pop-h{display:flex;justify-content:space-between;align-items:center;gap:6px}.me-pop-h b{font-size:12px;letter-spacing:2px;color:var(--teal2);font-weight:600}
.me-pop .me-field{gap:4px}
.me-pick{display:flex;gap:8px;align-items:center;font-size:10.5px}
.me-pop-act{display:flex;gap:8px;margin-top:2px}
.me-pop-act .me-btn{height:32px}
.me-pick2{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:2px}
.me-pick2 .me-btn{height:32px;justify-content:flex-start;padding:0 12px;font-size:12.5px}
.me-pop-more{align-self:flex-start;font-size:11.5px;color:var(--ink2)}
.me-pop-more span{color:var(--ink3);margin-left:2px}
.me-pop-warn{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;font-size:11.5px;color:var(--badink);background:color-mix(in srgb,var(--bad) 9%,transparent);border:1px solid color-mix(in srgb,var(--bad) 35%,transparent)}
.me-pop-warn span{flex:1}
.me-btn.me-start{flex:1;height:36px;font-size:13.5px;font-weight:700;letter-spacing:2px;color:#fff;background:var(--teal);border-color:var(--teal)}
.me-btn.me-start:hover:not(:disabled){filter:brightness(1.08)}
.me-btn.me-start:disabled{opacity:.45;cursor:not-allowed}
.me-hero-cap{display:flex;align-items:center;gap:10px}
.me-live{font-family:var(--mono);font-size:10.5px;letter-spacing:1px;color:var(--teal);display:inline-flex;align-items:center;gap:6px}
.me-live i{width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 6px currentColor;animation:me-pulse 1.6s ease-in-out infinite}
.me-live.ok{color:var(--ok)}.me-live.bad{color:var(--bad)}
.me-hero-err{margin:8px 0 0;align-self:flex-start;max-width:720px;font-size:12px}
.me-side{width:300px;flex:none;padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.me-side-h{display:flex;align-items:center;gap:8px}.me-side-h b{font-size:14px;font-weight:600;flex:1}
.me-side-sec{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;letter-spacing:.5px;color:var(--ink3);margin-top:12px;padding-top:8px;border-top:1px solid var(--line2)}
.me-side{overflow-y:auto;contain:size}.me-side>*{flex:none}
.me-back{font-size:11px;margin-left:4px;white-space:nowrap}
.me-ov{gap:8px}.me-ov .me-side-h b{flex:none}.me-ov .me-side-h .me-cap{flex:1}
.me-ob{border:1px solid var(--line2);border-radius:6px;overflow:hidden;flex:none}
.me-ob-h{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--panel2);border-bottom:1px solid var(--line);border-left:3px solid var(--teal)}.me-ob-h b{font-size:12.5px}
.me-ob-b{padding:8px 10px;display:flex;flex-direction:column;gap:6px}.me-ob-b .me-legend{margin-top:0;padding-top:0}
.me-ob-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.me-ob-kv div{display:flex;justify-content:space-between;align-items:baseline;gap:6px;background:var(--panel2);border-radius:4px;padding:4px 8px;min-width:0}
.me-ob-kv span{font-size:10.5px;color:var(--ink3)}.me-ob-kv b{font-family:var(--mono);font-size:13px}
.me-ob-models{display:grid;gap:5px 10px;align-items:center;font-size:11px}.me-ob-models>span{color:var(--ink3)}.me-ob-models>b{font-family:var(--mono);font-weight:600;text-align:right;font-size:12px}
.me-ob-models b small{font-weight:400;color:var(--warn)}
.me-ob-mh{display:flex;flex-direction:column;align-items:flex-end;min-width:0;border-bottom:1px solid var(--line);padding-bottom:3px}.me-ob-mh small{font-family:var(--mono);font-size:10px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.me-ob-mh small i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ok);margin-right:4px}.me-ob-mh small i.bad{background:var(--bad)}
.me-lat .bars{display:flex;align-items:flex-end;gap:2px;height:30px}.me-lat .bars i{flex:1;background:color-mix(in srgb,var(--teal) 55%,transparent);border-radius:1px 1px 0 0}.me-lat .bars i.slow{background:var(--bad)}
.me-lat .lbl{display:flex;gap:2px;font-family:var(--mono);font-size:8.5px;color:var(--ink3)}.me-lat .lbl span{flex:1;text-align:center}
.me-ob-conc{display:flex;flex-direction:column;gap:2px}.me-ob-ch{display:flex;gap:10px;align-items:baseline;font-size:11px;color:var(--ink3)}.me-ob-ch>b{color:var(--ink);font-size:12px}.me-ob-ch b{font-family:var(--mono)}.me-ob-ch .tp{color:var(--vio)}
.me-conc{width:100%;height:74px;display:block}.me-conc path,.me-conc polyline{fill:none;vector-effect:non-scaling-stroke}
.me-conc .in{stroke:var(--teal);stroke-width:2}.me-conc .lim{stroke:var(--ink3);stroke-dasharray:4 3;stroke-width:1}.me-conc .zero{stroke:var(--line2);stroke-width:1}
.me-conc .tp{stroke:color-mix(in srgb,var(--vio) 70%,transparent);stroke-width:1.2}.me-conc .q{fill:color-mix(in srgb,var(--warn) 30%,transparent);stroke:none}
.me-legend i.ln{width:12px;height:2px;border-radius:0}.me-legend i.ln.in{background:var(--teal)}.me-legend i.ln.lim{background:repeating-linear-gradient(90deg,var(--ink3) 0 3px,transparent 3px 5px)}.me-legend i.ln.tp{background:var(--vio)}.me-legend i.ln.q{background:color-mix(in srgb,var(--warn) 50%,transparent);height:6px}
.me-rounds{display:flex;flex-direction:column;gap:4px;margin:8px 0;border-left:2px solid var(--line2);padding-left:8px}
.me-round{display:grid;grid-template-columns:48px minmax(0,1fr) minmax(0,1fr);gap:10px;font-size:11.5px}.me-round em{font-style:normal;font-family:var(--mono);font-size:10.5px;color:var(--ink3)}
.me-round small{display:block;font-size:10px;color:var(--ink3)}.me-why{font-size:10.5px;color:var(--ink2);margin-top:2px}
.me-nd{display:grid;grid-template-columns:minmax(0,1fr) auto auto;grid-template-rows:auto auto;column-gap:8px;text-align:left;background:none;border:0;border-top:1px solid var(--line);padding:5px 2px;font:inherit;color:var(--ink);cursor:pointer}
.me-nd:hover{background:var(--panel2)}.me-nd span{font-size:11.5px;font-weight:600}.me-nd small{grid-column:1;grid-row:2;font-size:10.5px;color:var(--ink3)}.me-nd b{grid-column:2;grid-row:1/3;align-self:center}.me-nd i{grid-column:3;grid-row:1/3;align-self:center;font-style:normal;font-size:11px;color:var(--teal)}
.me-ob-models .z{background:var(--panel2)}
button.me-ob-mh{background:none;border:0;border-bottom:1px solid var(--line);font:inherit;color:var(--ink);cursor:pointer;padding:0 0 3px;text-align:right}button.me-ob-mh:hover b{color:var(--teal)}
.me-conc2{display:flex;flex-direction:column;gap:3px;padding-top:4px}
.me-conc2-h{display:flex;align-items:baseline;gap:10px;font-size:11px;color:var(--ink3);flex-wrap:wrap}.me-conc2-h>b{color:var(--ink);font-size:12px}
.me-conc2-h em{font-style:normal;font-family:var(--mono);font-weight:700;color:var(--ink);font-size:12.5px}.me-conc2-h .thr,.me-conc2-h .thr em{color:var(--vio)}
.me-conc2-chip{margin-left:auto;font-size:10.5px;border-radius:3px;padding:0 6px;line-height:17px;border:1px solid var(--line2)}
.me-conc2-chip.up{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 45%,transparent);background:color-mix(in srgb,var(--ok) 8%,transparent)}
.me-conc2-chip.full{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,transparent);background:color-mix(in srgb,var(--warn) 8%,transparent)}
.me-conc2-plot{position:relative;display:grid;grid-template-columns:22px minmax(0,1fr) 28px;align-items:stretch;height:76px}
.me-conc2-plot .gut{display:flex;flex-direction:column;justify-content:space-between;font-family:var(--mono);font-size:9px;color:var(--ink3);text-align:right;padding-right:3px}.me-conc2-plot .gut .z{margin-top:auto;margin-bottom:12px}
.me-conc2-plot svg{width:100%;height:76px;display:block}.me-conc2-plot svg path,.me-conc2-plot svg line{vector-effect:non-scaling-stroke}
.me-conc2-plot .fa{fill:color-mix(in srgb,var(--teal) 14%,transparent);stroke:none}.me-conc2-plot .al{fill:none;stroke:var(--teal);stroke-width:2}
.me-conc2-plot .lim{fill:none;stroke:var(--ink3);stroke-width:1;stroke-dasharray:4 3}.me-conc2-plot .tl{fill:none;stroke:var(--vio);stroke-width:1.2;opacity:.8}
.me-conc2-plot .q{fill:none;stroke:var(--teal);stroke-width:1;opacity:.55}.me-conc2-plot .sq{fill:none;stroke:var(--warn);stroke-width:1.2;stroke-dasharray:3 2}.me-conc2-plot .ax{stroke:var(--line2);stroke-width:1}
.me-conc2-plot .rg{font-family:var(--mono);font-size:9px;color:var(--vio);padding-left:3px}.me-conc2-plot .wait{position:absolute;left:30px;top:24px;font-size:10.5px;color:var(--ink3)}
.me-conc2-srv{font-size:10.5px;color:var(--ink2)}.me-conc2-srv .k{display:inline-block;background:var(--panel3);border-radius:3px;padding:0 5px;margin-right:6px;color:var(--ink3)}
.me-conc2-f{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;color:var(--ink3)}.me-conc2-f .mono{font-family:var(--mono);color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.me-legend i.ln.sq{background:repeating-linear-gradient(90deg,var(--warn) 0 3px,transparent 3px 5px);height:2px}
.me-ob-house{display:grid;grid-template-columns:8px minmax(0,1fr) auto 12px;gap:8px;align-items:center;text-align:left;background:none;border:0;border-top:1px solid var(--line);padding:6px 2px;font:inherit;color:var(--ink);cursor:pointer}
.me-ob-house:first-child{border-top:0}.me-ob-house:disabled{cursor:default;opacity:.7}.me-ob-house:not(:disabled):hover{background:var(--panel2)}
.me-ob-house>i{width:7px;height:7px;border-radius:50%;background:var(--ink3)}.me-ob-house>i.on{background:var(--ok)}.me-ob-house>i.bad{background:var(--bad)}
.me-ob-house b{display:block;font-family:var(--mono);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.me-ob-house small{display:block;font-size:10.5px;color:var(--ink3)}
.me-ob-house .me-num{font-size:11px;color:var(--ink2);white-space:nowrap}.me-ob-go{color:var(--ink3)}
.me-ob .me-link{align-self:flex-end;font-size:11px}
.me-slegacy{margin:6px 0 0;font-size:11px;line-height:1.55;padding:6px 8px}
.me-sdesc{margin:6px 0 2px;font-size:11.5px;line-height:1.6;color:var(--ink2)}.me-sdesc span{color:var(--ink3)}
.me-shead{display:flex;flex-direction:column;gap:6px;margin-top:8px;padding-top:10px;border-top:1px solid var(--line2)}
.me-ring{display:flex;flex-direction:column;gap:6px;min-width:0}.me-ring-t{display:flex;align-items:baseline;gap:10px;min-width:0}.me-ring b{font-size:22px;font-weight:500;color:var(--ink);line-height:1.1;white-space:nowrap}.me-ring small{font-size:11px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.me-ring-bar{height:6px;border-radius:3px;background:var(--line2);overflow:hidden}.me-ring-bar i{display:block;height:100%;border-radius:3px}
.me-skv{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}.me-skv div{display:flex;flex-direction:column;min-width:0}
.me-skv span{font-size:10px;color:var(--ink3)}.me-skv b{font-size:12.5px;font-weight:500;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.me-ssec{margin-top:10px;padding-top:8px;border-top:1px solid var(--line)}
.me-ssec-h{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;color:var(--ink3);margin-bottom:4px}.me-ssec-h b{font-weight:600}.me-ssec-h>span:last-child:not(:first-child){flex:none;white-space:nowrap}
.me-ssec .me-legend{margin-top:0;padding-top:2px}
.me-snote{margin:2px 0 0;font-size:11px;line-height:1.5;color:var(--ink2)}
.me-rank{display:flex;flex-direction:column;gap:4px}
.me-rank-r{display:grid;grid-template-columns:96px 1fr 52px;align-items:center;gap:6px;font-size:11px;color:var(--ink2)}
.me-rank-r span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.me-rank-r div{height:6px;border-radius:3px;background:var(--line)}.me-rank-r i{display:block;height:100%;border-radius:3px}
.me-rank-r b{text-align:right;font-weight:500;color:var(--ink)}
.me-spath{display:flex;gap:6px;align-items:center}.me-spath span{flex:1;min-width:0;font-family:var(--mono);font-size:10.5px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
.me-slist{margin:2px 0 0;padding-left:16px;font-size:11px;line-height:1.7;color:var(--ink2)}
.me-saction{margin-top:12px;align-self:stretch;justify-content:center}
.me-ticks{display:flex;gap:2px;height:13px;margin-top:5px}
.me-ticks i{flex:1;max-width:3px;background:var(--line2);border-radius:.5px}
.me-ticks i.on{background:var(--ink2)}.me-ticks.hot i.on{background:var(--teal)}
.me-panel{padding:12px 14px;display:flex;flex-direction:column;min-width:0}
.me-panel-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}.me-panel-h b{font-size:12.5px;letter-spacing:1px}
.me-panel-foot{margin-top:auto;padding-top:8px;font-size:11px;color:var(--ink2)}
.me-gl{margin-bottom:9px}
.me-gl-h{display:flex;justify-content:space-between;font-size:11.5px}.me-gl-h em{font-style:normal;font-family:var(--mono);color:var(--ink3);margin-right:6px}.me-gl-h b{font-weight:500}
.me-tagbox{font-family:var(--mono);font-size:9.5px;border:1px solid var(--line2);color:var(--ink2);padding:0 5px;border-radius:2px}
.me-mets{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line)}
.me-met{padding:8px 8px 10px 0;border-bottom:1px solid var(--line)}
.me-met:not(:nth-child(3n+1)){padding-left:10px;border-left:1px solid var(--line)}
.me-met small{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:1px;color:var(--ink3);margin-bottom:6px}
.me-met .me-num{font-size:24px;font-weight:300;letter-spacing:-.5px}.me-met em{font-style:normal;font-size:10px;color:var(--ink3);margin-left:3px}
.me-panel-sec{display:flex;justify-content:space-between;font-family:var(--mono);font-size:9.5px;color:var(--ink3);margin:10px 0 6px;gap:8px}
.me-pchips{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.me-pchips button{font-family:var(--mono);font-size:10px;padding:2px 0;width:42px;border:1px solid var(--line2);border-radius:2px;background:var(--panel2);color:var(--ink2);cursor:pointer}
.me-pchips button:hover{border-color:var(--ink2);color:var(--ink)}
.me-pchips button.w{border-color:color-mix(in srgb,var(--warn) 60%,transparent);color:var(--warn);background:color-mix(in srgb,var(--warn) 9%,transparent)}
.me-pchips button.x{border-color:color-mix(in srgb,var(--bad) 60%,transparent);color:var(--badink);background:color-mix(in srgb,var(--bad) 10%,transparent)}
.me-hero-num{display:flex;align-items:center;gap:10px;margin-bottom:6px}.me-hero-num>.me-num{font-size:40px;font-weight:200;letter-spacing:-1px;line-height:1}
.me-hero-num small{display:block;font-family:var(--mono);font-size:10px;color:var(--ink2);letter-spacing:.5px}
.me-vchips{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.me-alerts{display:flex;flex-direction:column;gap:4px}
.me-al{display:grid;grid-template-columns:5px 44px 1fr 46px 40px;gap:8px;align-items:center;padding:6px 8px 6px 0;border:1px solid var(--line);border-radius:3px;background:var(--panel2)}
.me-al.click{cursor:pointer}.me-al.click:hover{border-color:var(--line2);background:var(--panel3)}
.me-al-bar{align-self:stretch;margin:-6px 0;border-radius:3px 0 0 3px;background:var(--line2)}
.me-al.crit{background:color-mix(in srgb,var(--bad) 8%,var(--panel2));border-color:color-mix(in srgb,var(--bad) 30%,transparent)}
.me-al.crit .me-al-bar{background:repeating-linear-gradient(135deg,var(--bad) 0 3px,transparent 3px 6px)}
.me-al.warn .me-al-bar{background:repeating-linear-gradient(135deg,var(--warn) 0 3px,transparent 3px 6px)}
.me-al-src{font-size:10px;color:var(--ink3)}
.me-al-t{min-width:0}.me-al-t b{display:block;font-size:11.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.me-al-t small{display:block;font-size:10px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.me-al .me-ticks{margin:0;height:11px}
.me-al-tag{font-family:var(--mono);font-size:9.5px;text-align:center;border:1px solid var(--line2);border-radius:2px;color:var(--ink2);padding:1px 0}
.me-al.crit .me-al-tag{color:var(--badink);border-color:var(--bad)}.me-al.warn .me-al-tag{color:var(--warn);border-color:var(--warn)}.me-al.ok .me-al-tag{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 60%,transparent)}
.me-flow{animation:me-flow 1.2s linear infinite}
@keyframes me-flow{to{stroke-dashoffset:-30}}
.me-breathe{animation:me-breathe 2.4s ease-in-out infinite}
@keyframes me-breathe{50%{opacity:.82}}
.me-cardin{animation:me-cardin .25s ease-out}
@keyframes me-cardin{from{opacity:0;transform:translateY(4px)}}
.me-pulse{animation:me-pulse 1.4s ease-in-out infinite}
@keyframes me-pulse{50%{opacity:.35}}

.me-tpl{display:inline-flex;align-items:center;gap:8px;height:58px;padding:4px 12px 4px 10px;border:1px solid color-mix(in srgb,var(--teal) 45%,transparent);border-radius:8px;background:var(--tealdim);max-width:260px}
.me-tpl>div{display:flex;flex-direction:column;line-height:16px;min-width:0}.me-tpl b{font-size:12.5px;color:var(--teal2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.me-tpl span{font-size:10.5px;color:var(--ink2);white-space:nowrap}
.me-fr{display:grid;grid-template-columns:92px 1fr 40px;gap:8px;align-items:center;font-size:11px;margin-bottom:6px}
.me-fr>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.me-fr em{font-style:normal;font-family:var(--mono);color:var(--ink3);margin-right:4px}
.me-fr .me-stack{margin:0;height:7px}
.me-fr b{font-family:var(--mono);font-weight:500;text-align:right;font-size:10.5px;color:var(--ink2)}
.me-clear{margin:2px 0 8px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--bad) 45%,var(--line2));border-radius:6px;background:color-mix(in srgb,var(--bad) 6%,var(--panel));display:flex;flex-direction:column;gap:6px;font-size:12px}
.me-clear p{margin:0;color:var(--ink2);line-height:1.5}.me-clear-act{display:flex;justify-content:flex-end;gap:6px}
.me-btn.me-danger{background:var(--bad);border-color:var(--bad);color:#fff}.me-btn.me-danger:disabled{opacity:.6}
.me-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:10.5px;color:var(--ink2);margin-top:auto;padding-top:6px}
.me-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}
/* 一行放下：不折行，三项平分宽度，太窄时各自省略号（悬停看全） */
.me-legend.me-lg1{flex-wrap:nowrap;gap:8px;justify-content:space-between}.me-legend.me-lg1>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.me-ev{display:grid;grid-template-columns:76px 1fr 44px;gap:8px;align-items:center;font-size:11px;margin-bottom:5px}
.me-ev b{font-family:var(--mono);font-weight:500;text-align:right}
.me-ev .me-ticks{margin:0;height:10px}
.me-q{border-bottom:2px solid var(--teal);background:color-mix(in srgb,var(--teal) 14%,transparent);border-radius:2px;cursor:pointer}
.me-q.neg{border-color:var(--ink3);background:color-mix(in srgb,var(--ink3) 14%,transparent);border-bottom-style:dashed}
.me-q.hx{border-color:var(--fact);background:color-mix(in srgb,var(--fact) 12%,transparent)}
.me-q.fam{border-color:var(--judge);background:color-mix(in srgb,var(--judge) 12%,transparent)}
.me-q.mdl{border-color:var(--vio)}
.me-q.sel{outline:1.5px solid var(--sel);outline-offset:1px}
.me-split{display:grid;grid-template-columns:320px 1fr;gap:8px;flex:1;min-height:0}
.me-fl{gap:0}
.me-fl-bar{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);flex-wrap:wrap}
.me-fl-tg{display:flex;gap:4px}.me-fl-tg .me-dc-tgb{flex:none}
.me-dc-ff{display:flex;flex-wrap:wrap;gap:4px;padding:0 10px 8px;border-bottom:1px solid var(--line)}
.me-dc-ffb{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line2);background:var(--panel2);color:var(--ink2);border-radius:999px;padding:2px 9px;font:inherit;font-size:11.5px;cursor:pointer}
.me-dc-ffb i{font-style:normal;font-family:var(--mono);font-size:10.5px;color:var(--ink3)}
.me-dc-ffb.on{border-color:var(--teal);color:var(--teal2);background:var(--tealdim)}
.me-dc-ffb.on i{color:var(--teal2)}
.me-dc-ffb.todo:not(.zero) i,.me-dc-ffb.hint:not(.zero) i{color:var(--warn)}
.me-dc-ffb.zero{opacity:.5}
.me-fl-note{padding:6px 14px;font-size:11.5px;color:var(--warn);border-bottom:1px solid var(--line)}
.me-fl-tbl{width:100%;border-collapse:collapse;font-size:12px}
.me-fl-tbl th{position:sticky;top:0;background:var(--panel);text-align:left;font-weight:500;color:var(--ink3);font-size:11px;padding:7px 10px;border-bottom:1px solid var(--line);z-index:1}
.me-fl-tbl td{padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.me-fl-tbl .n{text-align:right;white-space:nowrap}.me-fl-tbl td.z{color:var(--ink3)}
.me-fl-tbl tr.click{cursor:pointer}.me-fl-tbl tr.click:hover td{background:var(--panel2)}
.me-fl-name{max-width:520px}.me-fl-name span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.me-fl-name small{color:var(--ink3);font-size:10.5px;margin-right:8px}
.me-fl-st{display:inline-flex;gap:5px;align-items:center;white-space:nowrap}.me-fl-st i{width:7px;height:7px;border-radius:50%;background:var(--ink3)}
.me-fl-st.ok i{background:var(--ok)}.me-fl-st.run i{background:var(--warn);animation:me-pulse 1.2s infinite}.me-fl-st.bad{color:var(--badink)}.me-fl-st.bad i{background:var(--bad)}.me-fl-st.wait{color:var(--ink3)}.me-fl-st.wait i{background:none;border:1.5px solid var(--ink3);box-sizing:border-box}
.me-fl-err{font-size:10.5px;color:var(--badink);margin-top:2px;max-width:280px}
.me-dc{display:grid;grid-template-columns:260px minmax(0,1fr) 380px;gap:8px;flex:1;min-height:0}
.me-dc-side{padding:10px;gap:8px;min-height:0}
.me-dc-list{flex:1;border-top:1px solid var(--line);padding-top:6px}
.me-dc-search{display:flex;flex-direction:column;gap:6px}
.me-dc-tgb{flex:1;border:1px solid var(--line2);background:var(--panel2);color:var(--ink2);border-radius:5px;padding:3px 6px;font:inherit;font-size:11.5px;cursor:pointer}
.me-dc-tgb.on{border-color:var(--teal);color:var(--teal2);background:var(--tealdim)}.me-dc-tgb.hot:not(.on){color:var(--warn)}
.me-dc-pc{border-radius:7px;margin-bottom:4px;border:1px solid transparent}
.me-dc-pc.open{border-color:var(--line2);background:var(--panel2);padding-bottom:6px}
.me-dc-ph{display:flex;align-items:center;gap:5px;padding:7px 8px 2px;cursor:pointer;border-radius:6px}
.me-dc-pc:not(.open) .me-dc-ph:hover{background:var(--panel2)}
.me-dc-ph b{font-size:12.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.me-dc-caret{color:var(--ink3);font-size:10px;width:10px}
.me-dc-pill{font-size:10px;line-height:16px;padding:0 6px;border-radius:8px;background:var(--panel3);color:var(--ink3);white-space:nowrap}
.me-dc-pill.hot{background:color-mix(in srgb,var(--warn) 16%,transparent);color:var(--warn);font-weight:600}
.me-dc-pm{font-size:10.5px;color:var(--ink3);padding:0 8px 6px 23px}
.me-dc-prog{height:3px;margin:0 8px 6px 23px;border-radius:2px;background:var(--line)}.me-dc-prog i{display:block;height:100%;border-radius:2px;background:var(--ok)}
.me-dc-tl{padding:0 6px 0 10px}
.me-dc-enc{position:relative;margin-top:4px}
.me-dc-eh{display:flex;gap:6px;align-items:baseline;font-size:10.5px;color:var(--ink2);padding:2px 4px 2px 18px;font-weight:600}
.me-dc-eh span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.me-dc-eh em{font-style:normal;font-weight:400;color:var(--ink3);font-family:var(--mono)}
.me-dc-dr{position:relative;display:grid;grid-template-columns:14px minmax(0,1fr) auto auto;gap:6px;align-items:center;padding:4px 6px 4px 4px;border-radius:5px;cursor:pointer;font-size:11.5px}
.me-dc-dr::before{content:'';position:absolute;left:10px;top:-4px;bottom:-4px;width:1px;background:var(--line2)}
.me-dc-enc .me-dc-dr:first-of-type::before{top:50%}.me-dc-enc .me-dc-dr:last-child::before{bottom:50%}.me-dc-enc .me-dc-dr:first-of-type:last-child::before{display:none}
.me-dc-dr:hover{background:var(--panel3)}
.me-dc-dr.on{background:var(--tealdim);box-shadow:inset 3px 0 0 var(--teal)}.me-dc-dr.on b{color:var(--teal2)}
.me-dc-dr b{font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.me-dc-dot{position:relative;z-index:1;width:11px;height:11px;border-radius:50%;justify-self:center;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:8px;line-height:1;color:#fff}
.me-dc-dr.todo .me-dc-dot{background:var(--warn)}.me-dc-dr.val .me-dc-dot{background:var(--teal)}
.me-dc-dr.seen .me-dc-dot{background:var(--ok)}.me-dc-dr.empty .me-dc-dot{background:var(--panel);border:1.5px solid var(--ink3)}
.me-dc-time{font-size:10px;color:var(--ink3)}
.me-dc-st{font-size:10.5px;color:var(--ink3);font-family:var(--mono);min-width:34px;text-align:right}
.me-dc-dr.todo .me-dc-st{color:var(--warn);font-weight:700}.me-dc-dr.empty .me-dc-st{color:var(--ink3)}
.me-dc-key{display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:6px;font-size:10.5px;color:var(--ink3)}
.me-dc-key span::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:-1px;box-sizing:border-box}
.me-dc-key .todo::before{background:var(--warn)}.me-dc-key .seen::before{background:var(--ok)}.me-dc-key .val::before{background:var(--teal)}.me-dc-key .empty::before{border:1.5px solid var(--ink3)}
.me-dc-bar2{padding:7px 12px}
.me-dc-swatch{display:flex;gap:10px;flex-wrap:wrap;font-size:10.5px;color:var(--ink3)}
.me-dc-swatch i{display:inline-block;width:12px;height:8px;border-radius:2px;margin-right:4px;vertical-align:0}
.me-dc-swatch i.val{background:color-mix(in srgb,var(--teal) 35%,transparent);border-bottom:2px solid var(--teal)}
.me-dc-swatch i.add{background:color-mix(in srgb,var(--decide) 35%,transparent);border-bottom:2px solid var(--decide)}
.me-dc-swatch i.other{background:color-mix(in srgb,var(--warn) 30%,transparent);border-bottom:2px dashed var(--warn)}
.me-dc-swatch i.rej{border-bottom:2px dotted var(--bad);height:4px}
.me-dc-swatch i.hit{border-bottom:2px dotted var(--warn);height:4px}
.me-dc-banner{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:7px 12px;background:color-mix(in srgb,var(--warn) 14%,transparent);color:var(--warn);font-size:12px;font-weight:600;border-bottom:1px solid color-mix(in srgb,var(--warn) 40%,transparent)}
.me-dc-text{flex:1;position:relative;background:var(--panel);padding:0}
.me-dc-paper{padding:14px 20px 12px}
.me-dc-ttl{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:12px}
.me-dc-ttl b{font-size:16px}.me-dc-ttl span{color:var(--ink2);font-size:12px}.me-dc-ttl small{margin-left:auto;color:var(--ink3);font-size:10px}
.me-dc-body{font-size:13.5px;line-height:2.1}
.me-dc-tip{margin-top:14px;padding-top:8px;border-top:1px dashed var(--line);font-size:10.5px;color:var(--ink3);text-align:center}
.me-dc-page{display:flex;gap:6px;align-items:center;justify-content:center;padding:6px 0}
.me-dc-legacy{font-size:11px;padding:8px;line-height:1.6}
.me-dc-mid,.me-dc-right{min-width:0;min-height:0;gap:0}
.me-dc-bar{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line)}
.me-dk{border-radius:2px;cursor:pointer}
.me-dk.val{background:color-mix(in srgb,var(--teal) 14%,transparent);border-bottom:2px solid var(--teal)}
.me-dk.add{background:color-mix(in srgb,var(--decide) 18%,transparent);border-bottom:2px solid var(--decide)}
.me-dk.other{background:color-mix(in srgb,var(--warn) 18%,transparent);border-bottom:2px dashed var(--warn)}
.me-dk.rej{text-decoration:line-through;text-decoration-color:var(--bad);border-bottom:1px dotted var(--ink3)}
.me-dk.hit{border-bottom:2px dotted var(--warn)}
.me-dk.on{background:color-mix(in srgb,var(--teal) 32%,transparent);border-bottom-width:3px;border-bottom-style:solid;border-bottom-color:var(--teal2)}
.me-dc-add{position:absolute;z-index:5;width:290px;background:var(--panel);border:1px solid var(--teal);border-radius:7px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:10px;display:flex;flex-direction:column;gap:6px;font-size:12px;line-height:1.5}
.me-dc-add label{display:grid;grid-template-columns:56px 1fr;align-items:center;gap:6px;color:var(--ink2)}
.me-dc-addq{color:var(--ink2);font-size:11.5px}
.me-dc-fields{flex:1;padding:8px 10px}
.me-dc-f{border:1px solid var(--line);border-radius:6px;padding:6px 8px;margin-bottom:6px;background:var(--panel2)}
.me-dc-f.none{background:transparent}.me-dc-f.on{border-color:var(--teal)}.me-dc-f.hot{border-color:var(--warn);box-shadow:inset 3px 0 0 var(--warn)}
.me-dc-fh{display:flex;gap:6px;align-items:center;cursor:pointer}.me-dc-fh b{font-size:12px}
.me-dc-hint{display:block;margin-top:4px;border:0;background:none;padding:0;font:inherit;font-size:11px;color:var(--warn);cursor:pointer;text-align:left}
.me-dc-v{margin-top:4px}
.me-dc-vb{display:flex;gap:4px;align-items:center;flex-wrap:wrap;width:100%;border:1px solid var(--line2);border-radius:4px;background:var(--panel);padding:3px 6px;font:inherit;font-size:12px;color:var(--ink);cursor:pointer;text-align:left}
.me-dc-v.on .me-dc-vb{border-color:var(--teal)}.me-dc-v.rej .me-dc-vb b{text-decoration:line-through;color:var(--ink3)}
.me-dc-va{padding:4px 2px 2px}.me-dc-q{font-size:11px;margin-bottom:4px}
.me-dc-btns{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
.me-dc-edit{display:flex;gap:4px}.me-dc-edit .me-input{flex:1}
.me-dc-rv{border:1px dashed var(--warn);border-radius:5px;padding:6px;margin-top:5px;background:color-mix(in srgb,var(--warn) 5%,transparent)}
.me-dc-rvh{display:flex;gap:4px}.me-dc-rvc{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px;font-size:11.5px}.me-dc-rvc small{display:block;font-size:10px;color:var(--ink3)}
.me-dc-other{margin:6px 2px;font-size:11.5px}
.me-dc-foot{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-top:1px solid var(--line);font-size:11px}
.me-rvx-note{padding:6px 14px;border-bottom:1px solid var(--line);color:var(--ok);font-size:12px;cursor:pointer}.me-rvx-note.bad{color:var(--badink)}
.me-json{width:100%;min-height:420px;font-family:var(--mono);font-size:11.5px;background:var(--panel2);color:var(--ink);border:1px solid var(--line2);border-radius:5px;padding:8px}
.me-mk{cursor:pointer;border-radius:2px;border-bottom:2px solid transparent}
.me-mk.fact{background:color-mix(in srgb,var(--fact) 16%,transparent);border-bottom-color:var(--fact)}
.me-mk.judge{background:color-mix(in srgb,var(--judge) 16%,transparent);border-bottom-color:var(--judge)}
.me-mk.decide{background:color-mix(in srgb,var(--decide) 16%,transparent);border-bottom-color:var(--decide)}
.me-mk.neg{border-bottom-style:dashed}
.me-mk.add{background:color-mix(in srgb,var(--decide) 28%,transparent);border-bottom:2px solid var(--decide);outline:1px dashed var(--decide)}
.me-mk.rej{text-decoration:line-through;opacity:.55;background:none}
.me-mk.todo,.me-mk.rv-todo{box-shadow:inset 0 -3px 0 color-mix(in srgb,var(--warn) 70%,transparent)}
.me-mk.seen{background:color-mix(in srgb,var(--ink3) 10%,transparent)}
.me-mk.on{outline:2px solid var(--teal);outline-offset:1px}
.me-dc-swatch i.fact{background:var(--fact)}.me-dc-swatch i.judge{background:var(--judge)}.me-dc-swatch i.decide{background:var(--decide)}.me-dc-swatch i.todo{background:var(--warn)}
.me-dc-rv.on{border-style:solid}
.me-tpl.warn{border-color:color-mix(in srgb,var(--warn) 45%,transparent);background:color-mix(in srgb,var(--warn) 10%,transparent)}.me-tpl.warn span{color:var(--warn)}
.me-rank-r.click{cursor:pointer;border-radius:3px}.me-rank-r.click:hover{background:var(--panel2)}
.me-rl-top{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:12px;margin-top:10px}
.me-rl-layers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.me-rl-layer{border:1px solid var(--line2);border-radius:6px;padding:9px 10px;background:var(--panel2);border-top:3px solid var(--teal)}
.me-rl-layer.l-source{border-top-color:var(--fact)}.me-rl-layer.l-general{border-top-color:var(--teal)}.me-rl-layer.l-specialty{border-top-color:var(--decide)}
.me-rl-lh{display:flex;align-items:baseline;gap:6px;margin-bottom:3px}.me-rl-lh em{font-style:normal;font-family:var(--mono);font-size:10px;color:var(--ink3)}.me-rl-lh b{font-size:13px}.me-rl-lh span{margin-left:auto;font-size:10.5px;color:var(--ink3)}
.me-rl-items{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:7px;font-size:11px;color:var(--ink2)}.me-rl-items b{color:var(--ink);margin-right:3px}
.me-rl-hit{margin-top:8px;padding-top:6px;border-top:1px dashed var(--line2);font-size:11px;color:var(--ink2)}.me-rl-hit b{font-size:15px;color:var(--teal2);margin-right:5px}
.me-rl-flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;align-content:start}
.me-rl-st{border:1px solid var(--line);border-radius:6px;padding:6px 8px;font-size:11.5px}.me-rl-st.model{border-color:color-mix(in srgb,var(--vio) 50%,transparent)}
.me-rl-st>div{display:flex;gap:3px;margin-top:4px;flex-wrap:wrap}.me-rl-st small{display:block;margin-top:3px;font-size:10px;color:var(--ink3)}
.me-rl-dot{font-size:10px;padding:0 5px;border-radius:3px;color:#fff;line-height:16px}.me-rl-dot.l-source{background:var(--fact)}.me-rl-dot.l-general{background:var(--teal)}.me-rl-dot.l-specialty{background:var(--decide)}
.me-rl-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:6px 0 10px}
.me-rl-kpi{border:1px solid var(--line);border-radius:6px;padding:7px 9px;display:flex;flex-direction:column;gap:2px}.me-rl-kpi span{font-size:10.5px;color:var(--ink3)}.me-rl-kpi b{font-size:18px}.me-rl-kpi small{font-size:10px;color:var(--ink3)}
.me-rl-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.me-rl-ex{margin-top:10px;border:1px solid var(--line2);border-radius:6px;padding:8px 10px;background:var(--panel2)}
`

    /* -------------------------------------------------------------- helpers */
    const PAL = {
      dark: { fact: '#47c6e6', judge: '#f38bc8', decide: '#4fd1a5', visit: '#7f8aa3', grid: '#18202e', lane: '#263147', ink: '#e6ebf5', ink2: '#9aa6bf', ink3: '#5f6b85', tick: '#4b5670', bad: '#e5484d', warn: '#f0a63a', vio: '#a48dff', ok: '#62c27e', shade: 'rgba(9,12,19,.65)', teal: '#4f7cff', halo: '#090c13', band: '#0e131d' },
      light: { fact: '#0a8db0', judge: '#c23d8c', decide: '#0f9d78', visit: '#8590a8', grid: '#dbe2ed', lane: '#c3cddf', ink: '#16202f', ink2: '#56627a', ink3: '#8a96ac', tick: '#adb7ca', bad: '#cf3a3f', warn: '#c27a12', vio: '#6a4fd6', ok: '#2f9a55', shade: 'rgba(237,241,247,.72)', teal: '#2a52d6', halo: '#fbfcfe', band: '#f2f5fa' },
    }
    const CLAY = {
      dark: { top: '#d3dae6', left: '#a9b3c6', right: '#808ba0', edge: 'rgba(0,0,0,.28)', top2: '#e1e6ef', left2: '#b8c1d2', right2: '#939db1', win: '#2c3445', hole: '#3a4357', pad: '#1d2432', padL: '#151b26', padR: '#10151e', grid: '#e2e8f2', floorShadow: '#000', card: 'rgba(9,12,19,.88)', cardLine: '#36425c', lamp: '#dfe8ff' },
      light: { top: '#e6ebf3', left: '#c4ccdb', right: '#a2acbf', edge: 'rgba(20,35,80,.2)', top2: '#f1f4f9', left2: '#d2d9e5', right2: '#b1bacb', win: '#5a6479', hole: '#7a859a', pad: '#d7dee9', padL: '#c5cedc', padR: '#b3bdcd', grid: '#56627a', floorShadow: '#1a2a50', card: 'rgba(251,252,254,.94)', cardLine: '#c3cddf', lamp: '#cddcff' },
    }
    function shade(hex, k) {
      const m = /^#([0-9a-f]{6})$/i.exec(hex ?? ''); if (!m) return hex
      const n = parseInt(m[1], 16)
      const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)))
      return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`
    }
    const pts = (a) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    function hostIsDark() {
      try {
        let color = getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-base').trim()
        if (!color) color = getComputedStyle(document.body).backgroundColor
        const probe = document.createElement('span'); probe.style.color = color; document.body.appendChild(probe)
        const rgb = getComputedStyle(probe).color; probe.remove()
        const parts = (rgb.match(/[\d.]+/g) ?? []).map(Number)
        if (parts.length < 3 || /rgba\(0, 0, 0, 0\)|transparent/.test(rgb)) throw new Error('no colour')
        const scale = rgb.startsWith('color(') ? 255 : 1
        return (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) * scale / 255 < 0.5
      } catch { return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true }
    }
    function useHostDark() {
      const [dark, setDark] = useState(() => hostIsDark())
      useEffect(() => {
        const check = () => setDark(hostIsDark())
        const obs = new MutationObserver(check)
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'] })
        if (document.body) obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
        const media = window.matchMedia?.('(prefers-color-scheme: dark)'); media?.addEventListener?.('change', check)
        return () => { obs.disconnect(); media?.removeEventListener?.('change', check) }
      }, [])
      return dark
    }
    const ThemeCtx = React.createContext(PAL.dark)
    const useClay = () => { const P = React.useContext(ThemeCtx); return [P, P === PAL.light ? CLAY.light : CLAY.dark] }
    const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString())
    const big = (n) => (n == null ? '—' : n >= 1e8 ? `${(n / 1e8).toFixed(2)}亿` : n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e6 ? 0 : 1)}万` : fmt(n))
    const fmtTime = (s) => { if (!s) return '—'; try { return new Date(s).toLocaleString() } catch { return String(s) } }
    const pct = (x) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(1)}%`)
    const clock = (ms) => { if (ms == null) return '00:00'; const t = Math.floor(ms / 1000); const hh = Math.floor(t / 3600); const mm = Math.floor(t / 60) % 60; const ss = t % 60; const p = (n) => String(n).padStart(2, '0'); return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}` }
    const STATUS_LABEL = { completed: '完成', running: '运行中', review: '待复核', failed: '失败', cancelled: '已取消' }
    const statusChip = (s) => h('span', { className: `me-chip ${s === 'completed' ? 'ok' : s === 'running' ? '' : s === 'review' ? 'w' : 'b'}` }, STATUS_LABEL[s] ?? s)
    const MODE_LABEL = { hybrid: '模型通读＋规则对照', model: '仅模型通读' }
    // 旧版本（规则为主、模型只给建议）的批次仍能查看
    const modeLabel = (m) => MODE_LABEL[m] ?? (m ? m : '规则为主（旧版本）')
    const TYPE_CLS = { 事实: 'f', 判断: 'j', 决策: 'd' }
    const VERDICT_CLS = { 矛盾: 'b', 记录质量: 'w', 改判: 'v', 病情变化: 'v', 调整: 'ok', 命名不一致: '', 证据不足: '' }
    const verdictColor = (pal) => ({ 矛盾: pal.bad, 记录质量: pal.warn, 改判: pal.vio, 病情变化: pal.vio, 调整: pal.ok, 命名不一致: pal.ink2, 证据不足: pal.ink3 })
    const VERDICT_COLOR = verdictColor(PAL.dark)
    const STATE_LABEL = { run: '运行中', part: '进行中', hold: '待复核', done: '完成', idle: '未开始' }
    const MONO = 'SF Mono,JetBrains Mono,Menlo,monospace'
    function Icon({ size = 16 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M3 12h3l2-5 4 10 2-5h7' }))
    }

    /* ================================================================ page */
    function Page() {
      const [tab, setTab] = useState('line')
      const [runs, setRuns] = useState([])
      const [activeId, setActiveId] = useState(null)
      const [runId, setRunId] = useState(null)
      const [run, setRun] = useState(null)
      // 复核页打开的病人、文书；时间线打开的病人与选中的事件／发现
      const [focus, setFocus] = useState(null)
      const [tlPatient, setTlPatient] = useState(null)
      const [tlFocus, setTlFocus] = useState(null)
      const [error, setError] = useState('')
      const [showNew, setShowNew] = useState(false)
      const [runsOpen, setRunsOpen] = useState(false)
      // 清空批次记录：null＝没在确认；{ deliverable, busy, error }＝确认中
      const [clearing, setClearing] = useState(null)
      const [modal, setModal] = useState(null)
      const [version, setVersion] = useState(null)
      const [now, setNow] = useState(Date.now())
      const [runTick, setRunTick] = useState(0)
      useEffect(() => { call('config').then((c) => setVersion(c.version ?? null)).catch(() => {}) }, [])
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
            if (v.run?.status === 'running') timer = setTimeout(load, 2000)
            else if (v.active === null) refreshList()
          } catch (e) { if (alive) setError(msg(e)) }
        }
        load()
        return () => { alive = false; clearTimeout(timer) }
      }, [runId, runTick])
      useEffect(() => {
        if (run?.status !== 'running') return undefined
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
      }, [run?.status])
      useEffect(() => {
        if (!modal && !runsOpen) return undefined
        const onKey = (e) => { if (e.key === 'Escape') { setModal(null); setRunsOpen(false) } }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [modal, runsOpen])
      const openPatient = (p) => { setFocus({ patient: p }); setTab('source') }
      const openTimeline = (p) => { setTlPatient(p); setTab('timeline') }
      const selectRun = (id) => { setRunId(id); setRun(null); setFocus(null); setTlPatient(null); setTlFocus(null); setRunsOpen(false); setTab('line') }
      const clearAll = async () => {
        setClearing((c) => ({ ...c, busy: true, error: '' }))
        try {
          const v = await call('clearRuns', { deliverable: clearing?.deliverable === true })
          setRun(null); setFocus(null); setRunId(activeId ?? null)
          await refreshList()
          setClearing(v.failed?.length ? { deliverable: false, busy: false, error: `已删除 ${v.removed} 个，${v.failed.length} 个失败：${v.failed[0].error}` } : null)
        } catch (e) { setClearing((c) => ({ ...c, busy: false, error: msg(e) })) }
      }
      const elapsed = run?.startedAt ? Math.max(0, (run.status === 'running' ? now : Date.parse(run.finishedAt ?? run.startedAt)) - Date.parse(run.startedAt)) : null
      const percent = run?.shards?.total ? Math.round(run.shards.done / run.shards.total * 100) : null
      const lineStatus = run?.status ?? 'idle'
      const dark = useHostDark()
      const heldFormats = run?.format?.held ?? 0
      // 按流程顺序（同病历文书提取）：流水线｜规则包　格式　文件｜复核　时间线｜模型调用　报告
      const tabs = [['line', '◈ 流水线'], ['rules', '规则包', null, 'sep'], ...(run?.format?.kind === 'recognized' ? [['formats', '格式', heldFormats]] : []), ['files', '文件', run?.totals?.failed, 'gap'], ['source', '复核', run?.humanReview?.todo ?? run?.totals?.review, null, true], ['timeline', '时间线'], ['calls', '模型调用', null, 'gap'], ['report', '报告']]
      const spec = [].concat(run?.specialty ?? [])
      return h(ThemeCtx.Provider, { value: dark ? PAL.dark : PAL.light }, h('div', { className: `me ${dark ? 'me-dark' : 'me-light'}` },
        h('style', {}, CSS),
        h('header', { className: 'me-frame me-top' },
          h('div', { className: 'me-brand' },
            h('div', { className: 'me-logo' }, h('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M3 12h3l2-5 4 10 2-5h7' }))),
            h('div', {}, h('b', {}, '病历事件还原流水线'), h('span', {}, 'MEDICAL EVENT RECONSTRUCTION PIPELINE'))),
          h('div', { className: `me-status s-${lineStatus}` },
            h('span', { className: 'me-lamp' }),
            h('div', {},
              h('b', {}, lineStatus === 'idle' ? '空闲' : STATUS_LABEL[lineStatus] ?? lineStatus),
              h('span', { className: 'me-num' }, run?.id ?? '—'),
              run?.status === 'running' && run.current ? h('span', { className: 'me-tl' }, `${run.current.patient ? `${run.current.patient} · ` : ''}${run.current.step}`)
                : run ? h('span', { title: run.input }, [modeLabel(run.mode), run.asOf ? `截至 ${run.asOf}` : null, run.inputName].filter(Boolean).join(' · ')) : null)),
          h('span', { className: 'me-sp' }),
          h('div', { className: 'me-clock sep' }, h('span', {}, '用时'), h('b', {}, clock(elapsed))),
          run ? h('div', { className: 'me-clock sep pct', title: `${run.shards?.done ?? 0} / ${run.shards?.total ?? 0} 个数据块` }, h('span', {}, '完成'), h('b', {}, percent == null ? '—' : String(percent), h('small', {}, '%'))) : null,
          version ? (() => {
            const [main, pre] = String(version).split(/-(.+)/)
            return h('div', { className: 'me-clock ver', title: `v${version}` }, h('span', {}, '版本'), h('b', {}, `v${main}`, pre ? h('small', {}, pre) : null))
          })() : null,
          h('div', { className: 'me-act' },
            run?.status === 'running'
              ? h('button', { className: 'me-btn me-stop', onClick: () => call('cancel', { runId: run.id }).catch((e) => setError(msg(e))) }, '■ 停止批次')
              : h('button', { className: 'me-btn me-new', disabled: !!activeId, onClick: () => setShowNew((x) => !x) }, activeId ? '正在处理…' : h(React.Fragment, {}, '＋ 新批次', h('span', { className: 'me-caret' }, '▾'))),
            showNew && !activeId ? h('div', { className: 'me-shade', onMouseDown: () => setShowNew(false) }) : null,
            showNew && !activeId ? h(NewRun, {
              resumable: run && ['cancelled', 'failed'].includes(run.status) ? run : null,
              onClose: () => setShowNew(false),
              onStarted: (id) => { setShowNew(false); setRunId(id); setRun(null); refreshList(); setTab('line') },
              onError: setError,
              openSettings: () => { setShowNew(false); setModal('settings') },
            }) : null),
          h('div', { className: 'me-act' },
            h('button', { className: 'me-btn me-hbtn', 'aria-expanded': runsOpen ? 'true' : 'false', onClick: () => { if (!runsOpen) refreshList(); setClearing(null); setRunsOpen(!runsOpen) } }, '记录', runs.length ? h('i', { className: 'me-hcount' }, String(runs.length)) : null),
            runsOpen ? h('div', { className: 'me-shade', onMouseDown: () => setRunsOpen(false) }) : null,
            runsOpen ? h('div', { className: 'me-pop me-runs-pop', role: 'dialog', 'aria-label': '批次记录' },
              h('div', { className: 'me-pop-h' }, h('b', {}, '批次记录'), h('span', { className: 'me-sp' }), h('button', { className: 'me-btn sm', onClick: refreshList }, '刷新'),
                h('button', { className: 'me-btn sm', disabled: !runs.some((r) => r.id !== activeId) || !!clearing, title: '删除所有批次记录（正在运行的保留）', onClick: () => setClearing({ deliverable: false, busy: false, error: '' }) }, '清空')),
              clearing ? h('div', { className: 'me-clear' },
                h('b', {}, `清空 ${runs.filter((r) => r.id !== activeId).length} 个批次记录${activeId ? '（正在运行的保留）' : ''}`),
                h('p', {}, '删除这些批次的报告、过程文件和调用记录，记录列表清空，已取消或失败的批次也不能再续跑。不可撤销。'),
                h('p', {}, '保留：人工判断（重跑沿用）、模型回复缓存、格式库。'),
                h('label', { className: 'me-pick' }, h('input', { type: 'checkbox', checked: clearing.deliverable === true, disabled: clearing.busy, onChange: (e) => setClearing({ ...clearing, deliverable: e.target.checked }) }), '同时删除交付数据（输出根目录 output 下的事件包）'),
                clearing.error ? h('div', { className: 'me-err' }, clearing.error) : null,
                h('div', { className: 'me-clear-act' },
                  h('button', { className: 'me-btn sm', disabled: clearing.busy, onClick: () => setClearing(null) }, '取消'),
                  h('button', { className: 'me-btn sm me-danger', disabled: clearing.busy, onClick: clearAll }, clearing.busy ? '正在删除…' : '全部删除'))) : null,
              !runs.length ? h('div', { className: 'me-faint' }, '还没有批次。')
                : h('div', { className: 'me-runs' }, runs.map((r) => h('div', { key: r.id, role: 'button', tabIndex: 0, className: `me-run${r.id === runId ? ' on' : ''}`, onClick: () => selectRun(r.id) },
                  h('div', { className: 'me-run-top' }, h('span', { className: 'me-run-name', title: r.outputRoot }, `${r.input}${r.mode ? ` · ${modeLabel(r.mode)}` : ''}`), statusChip(r.status)),
                  h('div', { className: 'me-run-meta' }, h('span', {}, fmtTime(r.startedAt)), h('span', { className: 'me-num' }, `病人 ${fmt(r.patients)} · 提及 ${big(r.mentions)} · 发现 ${fmt(r.findings)}${r.review ? ` · 待复核 ${r.review}` : ''}`)))))) : null),
          h('button', { className: 'me-icon', title: '设置', 'aria-label': '设置', onClick: () => setModal('settings') }, '⚙')),
        h('nav', { className: 'me-frame me-tabs', role: 'tablist' }, tabs.map(([k, label, n, group, hot]) => h(React.Fragment, { key: k },
          group === 'sep' ? h('span', { className: 'me-tab-sep', 'aria-hidden': 'true' }) : null,
          h('button', { role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', className: `me-tab${tab === k ? ' on' : ''}${group === 'gap' ? ' me-tab-gap' : ''}`, onClick: () => setTab(k) }, label, n ? h('i', { className: hot ? 'hot' : '', title: hot ? `待判断 ${fmt(n)} 项` : undefined }, big(n)) : null)))),
        error ? h('div', { className: 'me-err', onClick: () => setError('') }, error) : null,
        h('div', { className: 'me-body' },
          tab === 'rules' ? h(Rules, { run })
            : !run ? h('div', { className: 'me-frame me-empty', style: { flex: 1 } }, runs.length ? '加载中…' : '还没有批次。点右上角「＋ 新批次」选择病人导出目录开始。')
              : tab === 'line' ? h(Pipeline, { run, goto: setTab, openPatient })
                : tab === 'formats' ? h(Formats, { run, busy: !!activeId, onRerun: (id) => { setRunId(id); setRun(null); refreshList(); setTab('line') }, onError: setError })
                  : tab === 'files' ? h(Files, { run, openPatient, openTimeline })
                    : tab === 'source' ? h(Review, { key: run.id, run, focus, setFocus, onError: setError, openTimeline, onRunChanged: () => { setRunTick((n) => n + 1); refreshList() } })
                      : tab === 'timeline' ? h(Timeline, { run, patient: tlPatient ?? run.patients?.find((p) => p.status !== 'failed')?.patient ?? null, setPatient: setTlPatient, focus: tlFocus, setFocus: setTlFocus, gotoSource: (fragmentId, p) => { setFocus({ patient: p ?? tlPatient ?? run.patients?.[0]?.patient, doc: fragmentId }); setTab('source') } })
                        : tab === 'calls' ? h(Calls, { run })
                          : h(Report, { run })),
        modal === 'settings' ? h('div', { className: 'me-modal-back', onMouseDown: (e) => { if (e.target === e.currentTarget) setModal(null) } },
          h('div', { className: 'me-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '设置' },
            h('div', { className: 'me-modal-head' }, h('h3', {}, '设置 · 病历事件还原'), h('button', { className: 'me-btn sm', onClick: () => setModal(null), 'aria-label': '关闭' }, '✕')),
            h('div', { className: 'me-modal-body' }, activeId ? h('div', { className: 'me-err', style: { marginBottom: 10 } }, '有批次在运行：改动从下一个批次起生效。') : null, h(SettingsSection, { inModal: true })))) : null))
    }

    /* --------------------------------------------------------------- new run */
    /** 新批次（同病历文书提取的弹窗）：输入目录、输出根目录，一个大的开始按钮；模式、复查轮次、截至时刻收在「更多选项」 */
    function NewRun({ onStarted, onError, onClose, resumable, openSettings }) {
      const [inputDir, setInput] = useState('')
      const [outputRoot, setOut] = useState('')
      const [asOf, setAsOf] = useState('')
      const [mode, setMode] = useState('')
      const [rounds, setRounds] = useState('')
      const [more, setMore] = useState(false)
      const [busy, setBusy] = useState(false)
      const [picking, setPicking] = useState(false)
      const cfg = useAsync(() => call('config'), [])
      useEffect(() => { const onKey = (e) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [])
      const pick = async () => {
        setPicking(true)
        try { const v = await call('pickFolder'); if (v.path) setInput(v.path) } catch (cause) {
          try { const ws = services.ctx?.get('uiWorkspace'); if (!ws?.pickDirectory) throw cause; const picked = await ws.pickDirectory(); if (picked) setInput(picked) } catch (e) { onError(msg(e)) }
        } finally { setPicking(false) }
      }
      const go = async (payload) => { setBusy(true); try { const v = await call('start', payload); onStarted(v.runId) } catch (e) { onError(msg(e)) } finally { setBusy(false) } }
      // 本插件由模型通读：没配通读模型不能开始
      const noModel = cfg.value && !cfg.value.modelConfigured
      const curMode = MODE_LABEL[mode] ? mode : MODE_LABEL[cfg.value?.mode] ? cfg.value.mode : 'hybrid'
      const resumeOk = resumable && resumable.version
      const moreSet = [mode && mode !== cfg.value?.mode ? MODE_LABEL[curMode] : '', rounds ? `复查 ${rounds} 轮` : '', asOf ? `截至 ${asOf}` : ''].filter(Boolean)
      const why = noModel ? '先在设置里配置通读模型' : !inputDir.trim() ? '先选择病人导出目录' : undefined
      return h('div', { className: 'me-pop', role: 'dialog', 'aria-label': '新批次' },
        h('div', { className: 'me-pop-h' }, h('b', {}, '新批次'), h('button', { className: 'me-link', onClick: onClose, 'aria-label': '关闭', title: '关闭（Esc）' }, '✕')),
        noModel ? h('div', { className: 'me-pop-warn' }, h('span', {}, '还没有配置通读模型，先在设置里填写模型端点和模型名称。'),
          openSettings ? h('button', { className: 'me-btn sm', onClick: openSettings }, '去设置') : null) : null,
        h('label', { className: 'me-field' }, '病人导出目录',
          h('input', { className: 'me-input', value: inputDir, onChange: (e) => setInput(e.target.value), placeholder: '一位病人，或包含多位病人的上级目录', title: inputDir, autoFocus: true }),
          h('div', { className: 'me-pick2' },
            h('button', { className: 'me-btn', onClick: pick, disabled: picking }, picking ? '请在弹出的窗口里选择…' : '选文件夹…'))),
        h('label', { className: 'me-field' }, '输出根目录', h('input', { className: 'me-input', value: outputRoot, onChange: (e) => setOut(e.target.value), placeholder: `留空：${cfg.value?.outputRoot || '输入目录旁的 _medical-event'}` })),
        h('button', { type: 'button', className: 'me-link me-pop-more', 'aria-expanded': more ? 'true' : 'false', onClick: () => setMore(!more) },
          `${more ? '▾' : '▸'} 更多选项`, !more && moreSet.length ? h('span', {}, `（${moreSet.join('，')}）`) : null),
        more ? h(React.Fragment, {},
          h('label', { className: 'me-field' }, '模式',
            h('select', { className: 'me-input', value: curMode, onChange: (e) => setMode(e.target.value) },
              Object.entries(MODE_LABEL).map(([k, l]) => h('option', { key: k, value: k }, l)))),
          h('label', { className: 'me-field' }, '复查轮次上限', h('input', { className: 'me-input', type: 'number', min: 1, max: 6, value: rounds, onChange: (e) => setRounds(e.target.value), placeholder: `1–6，留空用设置里的（${cfg.value?.settings?.maxRounds ?? 3}）` })),
          h('label', { className: 'me-field' }, '截至时刻', h('input', { className: 'me-input', value: asOf, onChange: (e) => setAsOf(e.target.value), placeholder: 'YYYY-MM-DD HH:mm · 只用此刻以前写成的记录；留空不截断' }))) : null,
        h('div', { className: 'me-pop-act' },
          h('button', { className: 'me-btn me-start', disabled: Boolean(why) || busy, title: why, onClick: () => go({ inputDir: inputDir.trim(), outputRoot, mode: curMode, asOf, maxRounds: rounds ? Number(rounds) : undefined }) }, busy ? '启动中…' : '▶ 开始还原'),
          resumeOk ? h('button', { className: 'me-btn', disabled: busy || noModel, title: `继续批次 ${resumable.id}：已完成的数据块和模型调用直接复用`, onClick: () => go({ resumeFrom: resumable.id }) }, '↻ 继续') : null))
    }

    /* --------------------------------------------------------------- pipeline */
    /**
     * 工序（楼）：每位病人在数据块里依次走完 读入·片段 → 切句·去重 → 通读 → 核验·复查 → 类型·对照 → 归并·矛盾，
     * 不同的数据块、不同的病人同时在跑；所有数据块做完以后才交付。
     * 返回数组的下标就是场景里的位置：0 读入楼，1–5 五栋工序楼，6 交付堆场，7 规则包塔。
     */
    function stationsOf(run) {
      const t = run.totals ?? {}
      const running = run.status === 'running'
      const stage = running ? run.current?.stage : null
      const broken = !running && ['failed', 'cancelled'].includes(run.status)
      const sh = run.shards ?? { done: 0, total: 0 }
      const shardFrac = sh.total ? sh.done / sh.total : 0
      const hasVerify = Boolean(run.model?.verifyModel)
      const phase = !running ? null : stage === 'S00' ? 'format' : run.current?.step === '质检·交付' || run.current?.step === '整批汇总表' ? 'deliver' : 'shards'
      const stShard = (no) => {
        if (broken) return 'part'
        if (!running) return 'done'
        if (phase === 'format') return no === 'S01' ? 'run' : 'idle'
        if (phase === 'shards') return no === 'S02v' && !hasVerify ? 'idle' : 'run'
        return 'done'
      }
      const gate = (id) => run.gates?.find((g) => g.id === id)
      const gateRow = (id, label) => [label, gate(id) ? (gate(id).skipped ? '跳过' : gate(id).pass ? '通过' : '未过') : '—', gate(id) && !gate(id).skipped ? (gate(id).pass ? 'ok' : 'warn') : '']
      const AB = { S01: '读入', S02a: '切句', S02: '通读', S02v: '核验', S03: '类型', S04: '归并', S07: '交付', R: '规则' }
      const st = (no, nm, sub, bigv, unit, rows, state, frac) => ({ no, ab: AB[no], nm, sub, big: bigv, unit, rows, state, frac })
      const f = (no) => (phase === 'format' && no !== 'S01' ? 0 : shardFrac)
      const A = t.agreement ?? {}
      const an = Object.values(A).reduce((s, x) => s + (x.n ?? 0), 0); const aa = Object.values(A).reduce((s, x) => s + (x.agree ?? 0), 0)
      const rc = t.ruleCompare ?? {}
      const spec = [].concat(run.specialty ?? [])
      const legacy = !run.version
      return [
        st('S01', '读入·片段', '读导出（或先识别格式），切成片段，挂可见时间；剔除作废记录', big(t.documents), '文书', [['数据块', `${fmt(sh.done)}/${fmt(sh.total)}`, ''], ['病人', `${fmt(t.done)}/${fmt(t.patients)}`, ''], ['出错跳过', fmt(t.failed ?? 0), t.failed ? 'warn' : '']], stShard('S01'), f('S01')),
        st('S02a', '切句·去重', '文书按栏目切成句子单位；同一句跨文书、跨病人只问一次', big(t.unique), '句', [['句子', big(t.units), ''], ['去重后', big(t.unique), '']], stShard('S02a'), f('S02a')),
        st('S02', '通读', legacy ? '旧批次：规则抽取，模型只给建议' : `通读模型 ${run.model?.model ?? '—'}：拆成提及、判类型、找时间短语；片段逐字回原文核对`, big(t.mentions), '提及', [gateRow('①', '质检①'), ['无效回答（已拦下）', fmt(t.invalid ?? 0), t.invalid ? 'warn' : ''], ['没答出的句子', fmt(t.noAnswer ?? 0), t.noAnswer ? 'warn' : '']], stShard('S02'), f('S02')),
        st('S02v', '核验·复查', hasVerify ? `核验模型 ${run.model.verifyModel} 抽查 ${Math.round((run.sampleRate ?? 0) * 100)}% 的句子；有分歧时复查，至多 ${run.maxRounds ?? 3} 轮` : '未配置核验模型：不做抽样核验', fmt(t.review), '待复核', [gateRow('⑤', '质检⑤'), ['核验一致（复查前）', an ? pct(aa / an) : '—', ''], ['复查后一致', fmt(t.resolved ?? 0), t.resolved ? 'ok' : '']], t.review && !running ? 'hold' : stShard('S02v'), hasVerify ? f('S02v') : 0),
        st('S03', '类型·对照', run.mode === 'model' ? '按规则包推出属性（模板化、时间性质、动作、执行状态）' : '规则对照：规则在同一处再抽一次，模型漏的补上；按规则包推出属性', rc.matched ? pct(rc.type / rc.matched) : '—', '大类一致', [gateRow('②', '质检②'), ['规则补漏', fmt(t.coverage?.filled ?? 0), ''], ['规则第三票', fmt(t.byRule ?? 0), '']], stShard('S03'), f('S03')),
        st('S04', '归并·矛盾', '同一件事归并成事件、前后印证；登记记录之间的冲突（矛盾判断）', big(t.events), '事件', [['发现', fmt(t.findings), t.findings ? 'warn' : ''], gateRow('③', '质检③'), gateRow('④', '质检④')], stShard('S04'), f('S04')),
        st('S07', '交付', '事件包 → 导出视图 → 整批汇总表 → 只读核对', run.output ? '已写出' : '—', '', [['输出', run.output ? '已写出' : '未交付', run.output ? 'ok' : '']], run.output ? 'done' : broken ? 'idle' : !running ? 'done' : phase === 'deliver' ? 'run' : 'idle', run.output ? 1 : 0),
        st('R', '规则包', `数据源层 ${run.format?.kind === 'recognized' ? '自动识别' : '区域平台'} · 通用医学层${spec.length ? ` · 专科 ${spec.join('、')}` : ''}`, String(spec.length + 2), '层', [['模式', modeLabel(run.mode), '']], 'done', 1),
      ]
    }

    function Pipeline({ run, goto, openPatient }) {
      const stations = stationsOf(run)
      // 没选工序时右列是批次概览（同匿名化插件）；点楼、标签或底部质检进工序详情
      const [selK, setSelK] = useState(null)
      const k = selK ?? -1
      // 布局同匿名化插件：左列＝2.5D 流水线（撑满）＋底部「进展｜结果｜监控」；右列＝所选工序的详情，拉到底
      return h('div', { className: 'me-scroll', style: { flex: 1, display: 'flex' } },
        h('div', { className: 'me-line' },
          h('div', { className: 'me-line-left' },
          h('div', { className: 'me-frame me-hero' },
            h('div', { className: 'me-hero-cap' },
              h('span', { className: 'me-cap', style: { color: 'var(--ink2)' } }, '处理流程'),
              // 右上角原来的状态提示（「核验·复查 待复核」等）删掉：页头批次框、屋顶标签、底部处理结果都有同样的信息
            ),
            run.status === 'failed' && run.error ? h('div', { className: 'me-err me-hero-err' }, h('b', {}, '批次失败：'), String(run.error).split('\n')[0].replace(/^Error:\s*/, '')) : null,
            h(PlantScene, { run, stations, sel: k, onSel: setSelK, goto }),
            h(AlertsOverlay, { run, stations, goto, onSel: setSelK })),
          h('div', { className: 'me-frame me-bottom' },
            h(ProgressPanel, { run }),
            h(ResultsPanel, { run, stations, onSel: setSelK, goto }),
            h(ResourcesPanel, { run }))),
          k >= 8 ? h(ModelPanel, { run, house: modelHousesOf(run)[k - 8], goto, onBack: () => setSelK(null) })
            : k >= 0 ? h(StationPanel, { run, s: stations[k], goto, onBack: () => setSelK(null) }) : h(Overview, { run, goto, onSel: setSelK, stations })))
    }

    /* 等轴测投影 */
    const IX = [0.94, 0.26]; const JX = [-0.66, 0.58]
    const iso = (i, j, z = 0) => [i * IX[0] + j * JX[0], i * IX[1] + j * JX[1] - z]
    const depthOf = (i, j) => i * IX[1] + j * JX[1]
    function isoBox(key, i, j, z, a, b, hh, { top, left, right, edge, props } = {}) {
      const s = edge ? { stroke: edge, strokeWidth: 0.6, strokeLinejoin: 'round' } : {}
      return [
        h('polygon', { key: `${key}l`, points: pts([iso(i, j + b, z), iso(i + a, j + b, z), iso(i + a, j + b, z + hh), iso(i, j + b, z + hh)]), fill: left, ...s, ...props }),
        h('polygon', { key: `${key}r`, points: pts([iso(i + a, j, z), iso(i + a, j + b, z), iso(i + a, j + b, z + hh), iso(i + a, j, z + hh)]), fill: right, ...s, ...props }),
        h('polygon', { key: `${key}t`, points: pts([iso(i, j, z + hh), iso(i + a, j, z + hh), iso(i + a, j + b, z + hh), iso(i, j + b, z + hh)]), fill: top, ...s, ...props }),
      ]
    }
    const leftPatch = (key, i0, i1, j, z0, z1, props) => h('polygon', { key, points: pts([iso(i0, j, z0), iso(i1, j, z0), iso(i1, j, z1), iso(i0, j, z1)]), ...props })
    const rightPatch = (key, i, j0, j1, z0, z1, props) => h('polygon', { key, points: pts([iso(i, j0, z0), iso(i, j1, z0), iso(i, j1, z1), iso(i, j0, z1)]), ...props })
    function isoCyl(key, ci, cj, z, r, hh, C) {
      const [x0, y0] = iso(ci, cj, z); const [, y1] = iso(ci, cj, z + hh)
      const rx = r * 1.12; const ry = r * 0.62
      return [
        h('ellipse', { key: `${key}b`, cx: x0, cy: y0, rx, ry, fill: C.right }),
        h('rect', { key: `${key}m`, x: x0 - rx, y: y1, width: rx * 2, height: y0 - y1, fill: 'url(#me-cyl)' }),
        h('ellipse', { key: `${key}t`, cx: x0, cy: y1, rx, ry, fill: C.top, stroke: C.edge, strokeWidth: 0.6 }),
        h('ellipse', { key: `${key}h`, cx: x0, cy: y1, rx: rx * 0.62, ry: ry * 0.62, fill: C.hole }),
      ]
    }

    const STATION_LABEL = { format: '格式识别', extract: '通读', verify: '核验', adjudicate: '复查' }
    const shortModel = (m) => { const x = String(m ?? ''); return x.length > 22 ? `${x.slice(0, 21)}…` : x }
    /** 模型房子：一栋＝一个模型服务。用的哪几道工序、各调用多少，按 run.models 的角色拆 */
    function modelHousesOf(run) {
      const M = run.models ?? {}
      const ROLE_ST = { format: ['extract', 'format'], read: ['extract', 'extract'], 'review-read': ['extract', 'adjudicate'], 'format-verify': ['verify', 'format'], verify: ['verify', 'verify'], 'review-verify': ['verify', 'adjudicate'] }
      const list = run.modelHouses ?? [{ slot: 0, max: run.modelConcurrency ?? 8, model: run.model?.model, host: '', roles: run.model?.verifyModel && run.model.verifyModel === run.model.model ? ['extract', 'verify'] : ['extract'] },
        ...(run.model?.verifyModel && run.model.verifyModel !== run.model.model ? [{ slot: 1, max: run.modelConcurrency ?? 8, model: run.model.verifyModel, host: '', roles: ['verify'] }] : [])]
      const houses = list.map((x) => ({ ...x, calls: {}, total: 0, failed: 0, perf: [], stations: [] }))
      if (houses.length === 1 && !houses[0].roles.includes('verify')) houses.push({ slot: 1, max: 0, model: null, host: '', roles: ['verify'], calls: {}, total: 0, failed: 0, perf: [], stations: ['format', 'verify', 'adjudicate'], label: '核验模型', why: '未配置 · 不做抽样核验' })
      for (const hs of houses) {
        if (hs.model) hs.stations = [...new Set(hs.roles.flatMap((r) => (r === 'extract' ? ['format', 'extract', 'adjudicate'] : ['format', 'verify', 'adjudicate'])))]
        hs.label ??= hs.roles.includes('extract') ? '通读模型' : '核验模型'
        hs.why ??= '未配置'
      }
      for (const [role, p] of Object.entries(M)) {
        const [r0, st] = ROLE_ST[role] ?? [null, null]; if (!r0) continue
        const hs = houses.find((x) => x.model && x.roles.includes(r0)); if (!hs) continue
        hs.calls[st] = (hs.calls[st] ?? 0) + (p.calls ?? 0); hs.cached = hs.cached ?? {}; hs.cached[st] = (hs.cached[st] ?? 0) + (p.cached ?? 0); hs.total += p.calls ?? 0; hs.failed += p.failed ?? 0; hs.perf.push([role, st, p])
      }
      for (const hs of houses) {
        // 格式识别只在通用文件、本批真的识别了表时才算（区域平台导出不做；格式库里已有结果、命中缓存的也不算这个模型干了活）
        const fmtNow = run.status === 'running' && String(run.current?.step ?? '').startsWith('格式识别')
        hs.didFormat = Boolean(hs.calls.format || fmtNow)
        // 两个模型拿同一份提示各自起草（各自独立，互相看不到），一致才采用；「核对」专指插件逐字对照，这里不用
        const FMT = hs.roles.includes('extract') && hs.roles.includes('verify') ? '格式识别' : hs.roles.includes('extract') ? '格式识别' : '格式识别（各自独立）'
        hs.roleText = hs.model ? hs.stations.filter((st) => st !== 'format' || hs.didFormat).map((st) => (st === 'format' ? FMT : STATION_LABEL[st])).join(' · ') : (hs.roles.includes('verify') ? '核验 · 复查' : '通读')
      }
      return houses
    }

    /**
     * 流水线主视图：分拣中心。整个场地垫在三层规则包底座上（数据源层、通用医学层、专科层）；
     * 文书从左边进料口进来（读入·片段）→ 切句 → 通读塔（通读模型）与后方的核验塔（核验模型），两塔之间的天桥是复查 →
     * 分拣台把提及按类型分到三条滑道（事实、判断、决策，和复核页、时间线同色）→ 按时间上架的事件仓库（归并），
     * 旁边的冲突台堆着发现 → 交付堆场。质检是路上的关卡：① 通读出口、⑤ 天桥、② 滑道口、③ 仓库门口。
     */
    function PlantScene({ run, stations, sel, onSel, goto }) {
      const [P, C] = useClay()
      const A = P.teal
      const t = run.totals ?? {}
      const running = run.status === 'running'
      const tone = (s) => (s.state === 'hold' || s.state === 'run' ? A : null)
      const els = []; const defs = []; const bb = []
      const click = (k) => ({ onClick: () => onSel(k), style: { cursor: 'pointer' } })
      const halo = { stroke: C.card, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }
      const AMB = { top: shade(P.warn, 0.3), left: P.warn, right: shade(P.warn, -0.32) }
      const RED = { top: shade(P.bad, 0.3), left: P.bad, right: shade(P.bad, -0.35) }
      const CL = { top: C.top, left: C.left, right: C.right, edge: C.edge }
      const CL2 = { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }
      const tint = (c, k = 0.55) => ({ top: shade(c, k + 0.15), left: shade(c, k), right: shade(c, k - 0.2), edge: C.edge })
      const TYPE3 = [['事实', P.fact], ['判断', P.judge], ['决策', P.decide]]
      const hasVerify = Boolean(run.model?.verifyModel)
      // 场地：底座范围、各站位置（i 向右下，j 向左下）
      const BASE = { i0: -90, i1: 1040, j0: -150, j1: 262 }
      const BELT = [70, 94] // 主传送带的 j 范围
      const ST = {
        intake: [0, 30, 86, 100, 74], cutter: [150, 50, 74, 64, 36], read: [292, 52, 58, 58, 150], verify: [292, -104, 58, 58, 128],
        sorter: [440, 40, 80, 84, 40], ware: [640, 18, 180, 162, 3], desk: [688, 204, 86, 34, 14], dock: [876, 20, 140, 132, 4],
      }
      defs.push(h('radialGradient', { key: 'rg', id: 'me-fade', cx: '50%', cy: '55%', r: '58%' }, h('stop', { offset: 0, stopColor: '#fff', stopOpacity: 1 }), h('stop', { offset: 1, stopColor: '#fff', stopOpacity: 0 })))
      defs.push(h('filter', { key: 'bl', id: 'me-blur', x: '-30%', y: '-30%', width: '160%', height: '160%' }, h('feGaussianBlur', { stdDeviation: 9 })))
      defs.push(h('filter', { key: 'gl', id: 'me-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, h('feGaussianBlur', { stdDeviation: 3.5, result: 'b' }), h('feMerge', {}, h('feMergeNode', { in: 'b' }), h('feMergeNode', { in: 'SourceGraphic' }))))
      defs.push(h('marker', { key: 'ar', id: 'me-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, h('path', { d: 'M0 0L10 5L0 10z', fill: P.ink2 })))
      defs.push(h('linearGradient', { key: 'cy', id: 'me-cyl', x1: 0, x2: 1, y1: 0, y2: 0 }, h('stop', { offset: 0, stopColor: C.left2 }), h('stop', { offset: 0.55, stopColor: C.left }), h('stop', { offset: 1, stopColor: C.right })))

      /* ---- 规则包底座：三层叠起来，整个场地都站在上面（点底座看规则包） ---- */
      const spec = [].concat(run.specialty ?? [])
      const LAYERS = [['数据源层', run.format?.kind === 'recognized' ? '自动识别' : 'zj-regional', P.fact], ['通用医学层', 'general', A], ...(spec.length ? [['专科层', spec.join('·'), P.decide]] : [])]
      {
        const g = []
        const n = LAYERS.length; const th = 11
        LAYERS.forEach(([nm, id, c], li) => {
          const z = -(n - li) * th
          const inset = li * 6
          g.push(...isoBox(`base${li}`, BASE.i0 + inset, BASE.j0 + inset, z, BASE.i1 - BASE.i0 - inset * 2, BASE.j1 - BASE.j0 - inset * 2, th, { top: C.pad, left: shade(c, C === CLAY.light ? 0.55 : -0.55), right: shade(c, C === CLAY.light ? 0.4 : -0.65), edge: C.edge }))
          const [x, y] = iso(BASE.i0 + inset + 14, BASE.j1 - inset, z + 2)
          g.push(h('g', { key: `bl${li}`, transform: `matrix(${IX[0]} ${IX[1]} 0 1 ${x.toFixed(1)} ${y.toFixed(1)})`, pointerEvents: 'none' },
            h('text', { x: 0, y: 0, fill: C === CLAY.light ? shade(c, -0.3) : shade(c, 0.45), fontSize: 8, fontWeight: 700 }, `${li + 1} ${nm}`, h('tspan', { dx: 4, fontWeight: 400, fontFamily: MONO, opacity: 0.85 }, id))))
        })
        if (sel === 7) g.push(h('polygon', { key: 'basesel', points: pts([iso(BASE.i0, BASE.j0), iso(BASE.i1, BASE.j0), iso(BASE.i1, BASE.j1), iso(BASE.i0, BASE.j1)]), fill: 'none', stroke: A, strokeWidth: 1.6, strokeDasharray: '6 5' }))
        els.push(h('g', { key: 'base', ...click(7) }, h('title', {}, `规则包（三层）：${LAYERS.map(([nm, id]) => `${nm} ${id}`).join(' → ')}\n规则是地基：读入、切句、类型、归并、矛盾判断都按它算；通读由模型做，规则补漏、投第三票\n点开看规则包`), g))
        for (const [i, j] of [[BASE.i0, BASE.j0], [BASE.i1, BASE.j0], [BASE.i1, BASE.j1], [BASE.i0, BASE.j1]]) bb.push(iso(i, j, 0), iso(i, j, -LAYERS.length * 11))
      }
      // 地面网格（画在底座顶面上，向四周淡出）
      {
        const grid = []
        for (let i = BASE.i0 + 20; i < BASE.i1; i += 40) { const a = iso(i, BASE.j0); const b = iso(i, BASE.j1); grid.push(h('line', { key: `gi${i}`, x1: a[0], y1: a[1], x2: b[0], y2: b[1] })) }
        for (let j = BASE.j0 + 20; j < BASE.j1; j += 40) { const a = iso(BASE.i0, j); const b = iso(BASE.i1, j); grid.push(h('line', { key: `gj${j}`, x1: a[0], y1: a[1], x2: b[0], y2: b[1] })) }
        els.push(h('g', { key: 'grid', stroke: C.grid, strokeOpacity: 0.07, strokeWidth: 0.8, mask: 'url(#me-gridmask)', pointerEvents: 'none' }, grid))
      }
      const shadow = (key, [i, j, a, b], push = 22) => h('polygon', { key, points: pts([iso(i + 6, j + 4), iso(i + a + push, j + 4), iso(i + a + push, j + b + push * 0.5), iso(i + 6, j + b + push * 0.5)]), fill: C.floorShadow, opacity: 0.45, filter: 'url(#me-blur)', pointerEvents: 'none' })
      for (const [k, v] of Object.entries(ST)) if (k !== 'ware' && k !== 'dock') els.push(shadow(`sh-${k}`, v, k === 'read' || k === 'verify' ? 46 : 22))
      // 选中框：站在地面的角括号
      const FOOT = [ST.intake, ST.cutter, ST.read, ST.verify, ST.sorter, [ST.ware[0], ST.ware[1], ST.ware[2], ST.desk[1] + ST.desk[3] - ST.ware[1]], ST.dock]
      if (sel >= 0 && sel <= 6) {
        const [fi, fj, fa, fb] = FOOT[sel]; const m = 10
        const corners = [[fi - m, fj - m], [fi + fa + m, fj - m], [fi + fa + m, fj + fb + m], [fi - m, fj + fb + m]]
        els.push(h('polygon', { key: 'selfloor', points: pts(corners.map(([a, b]) => iso(a, b))), fill: A, opacity: 0.08, pointerEvents: 'none' }))
        corners.forEach(([ci, cj], q) => { const di = q === 0 || q === 3 ? 1 : -1; const dj = q < 2 ? 1 : -1; els.push(h('polyline', { key: `br${q}`, points: pts([iso(ci + di * 16, cj), iso(ci, cj), iso(ci, cj + dj * 16)]), fill: 'none', stroke: A, strokeWidth: 1.6, opacity: 0.9, pointerEvents: 'none' })) })
      }
      const gateOf = (id) => run.gates?.find((x) => x.id === id)
      /** 质检关卡：一个带编号的圆点（绿＝通过、红＝未过、灰＝跳过或还没判定），未过时旁边写「未过」 */
      const gateDot = (key, id, [i, j, z]) => {
        const g = gateOf(id)
        const gc = !g ? P.ink3 : g.skipped ? P.ink2 : g.pass ? P.ok : P.bad
        const [x, y] = iso(i, j, z)
        const fail = g && !g.pass && !g.skipped
        return h('g', { key },
          h('title', {}, g ? `质检${id} ${g.label}：${g.skipped ? '跳过' : g.pass ? '通过' : '未过'}${g.detail ? `（${g.detail}）` : ''}` : `质检${id}：批次结束时判定`),
          h('circle', { cx: x, cy: y, r: 7, fill: gc, stroke: C.card, strokeWidth: 1.5 }),
          h('text', { x, y: y + 3.3, textAnchor: 'middle', fill: '#fff', fontSize: 9, fontWeight: 700, fontFamily: MONO }, id.charCodeAt(0) - 0x245f),
          fail ? h('text', { x: x + 11, y: y - 6, fill: P.bad, fontSize: 10.5, fontWeight: 600, ...halo }, '未过') : null)
      }
      /** 传送带：一段带流动线的走廊；gate＝出口处的质检 */
      const belt = (key, i0, i1, gate = null, j0 = BELT[0], j1 = BELT[1]) => {
        const a = iso(i0, (j0 + j1) / 2, 22); const b = iso(i1, (j0 + j1) / 2, 22)
        return h('g', { key, pointerEvents: 'none' },
          isoBox('c', i0, j0, 10, i1 - i0, j1 - j0, 10, CL2),
          h('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: running ? A : P.ink3, strokeWidth: 2.4, strokeLinecap: 'round', strokeDasharray: '2 8', className: 'me-flow', style: { animationDuration: running ? '0.9s' : '3.2s' }, filter: running ? 'url(#me-glow)' : undefined, opacity: running ? 1 : 0.6 }),
          gate ? gateDot('g', gate, [(i0 + i1) / 2, j1 + 2, 22]) : null)
      }
      /** 一面墙上的窗格：亮几格按工序进度（运行中用主色发光） */
      const windows = (key, s, i0, i1, j, z0, z1, cols, rows) => {
        const out = []; const lit = s.state === 'hold' ? cols * rows : s.state === 'run' ? Math.max(1, Math.round((s.frac ?? 0) * cols * rows)) : s.state === 'done' ? cols * rows : 0
        const c = tone(s); const cw = (i1 - i0) / cols; const rh = (z1 - z0) / rows
        let q = 0
        for (let r = rows - 1; r >= 0; r--) for (let k = 0; k < cols; k++) {
          const on = q++ < lit
          out.push(leftPatch(`${key}${r}-${k}`, i0 + k * cw + 2, i0 + (k + 1) * cw - 2, j, z0 + r * rh + 2, z0 + (r + 1) * rh - 2, { fill: on ? (c ?? C.lamp) : C.win, opacity: on ? 0.92 : 0.55, filter: on && c ? 'url(#me-glow)' : undefined }))
        }
        return out
      }

      /* ---- 核验塔（后方）与复查天桥 ---- */
      {
        const s = stations[3]; const [i, j, a, b, hh] = ST.verify; const g = []
        g.push(...isoBox('v', i, j, 0, a, b, hh, CL))
        g.push(...isoBox('vc', i + 8, j + 8, hh, a - 16, b - 16, 10, CL2))
        g.push(...windows('vw', s, i + 4, i + a - 4, j + b, 14, hh - 10, 3, 7))
        for (let r = 0; r < 7; r++) g.push(rightPatch(`vr${r}`, i + a, j + 10, j + b - 10, 18 + r * 15, 21 + r * 15, { fill: C.win, opacity: 0.4 }))
        const dish = iso(i + a / 2, j + b / 2, hh + 16)
        g.push(h('ellipse', { key: 'vd', cx: dish[0], cy: dish[1], rx: 9, ry: 4.5, fill: hasVerify ? P.vio : C.hole, opacity: 0.85 }))
        els.push(h('g', { key: 'verify', opacity: hasVerify ? 1 : 0.45, ...click(3) }, h('title', {}, hasVerify ? `核验塔：${run.model.verifyModel} 抽查 ${Math.round((run.sampleRate ?? 0) * 100)}% 的句子` : '核验塔：未配置核验模型，不做抽样核验与复查'), g))
        bb.push(iso(i, j, hh + 30), iso(i + a, j, hh + 30))
        // 天桥：核验塔 ⇄ 通读塔，分歧在这里来回复查
        const bi = i + 18; const bw2 = 22; const bz = 104
        const bridge = []
        bridge.push(...isoBox('br', bi, j + b, bz, bw2, ST.read[1] - (j + b), 9, CL2))
        const p0 = iso(bi + bw2 / 2, j + b, bz + 10); const p1 = iso(bi + bw2 / 2, ST.read[1], bz + 10)
        const disputes = t.disputes ?? 0
        bridge.push(h('line', { key: 'brf', x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], stroke: hasVerify && (running || disputes) ? P.vio : P.ink3, strokeWidth: 2, strokeDasharray: '3 6', className: hasVerify && running ? 'me-flow' : undefined, opacity: hasVerify ? 0.95 : 0.4 }))
        bridge.push(gateDot('g5', '⑤', [bi + bw2 / 2, (j + b + ST.read[1]) / 2, bz + 11]))
        const lp = iso(bi + bw2 + 8, (j + b + ST.read[1]) / 2, bz + 16)
        bridge.push(h('text', { key: 'brt', x: lp[0] + 10, y: lp[1] - 4, fill: hasVerify ? P.vio : P.ink3, fontSize: 10, fontWeight: 600, ...halo }, hasVerify ? `复查 ≤${run.maxRounds ?? 3} 轮${disputes ? ` · 分歧 ${fmt(disputes)}` : ''}` : '复查（未配置核验模型）'))
        els.push(h('g', { key: 'bridge', ...click(3) }, h('title', {}, `天桥＝复查：通读模型和核验模型看对方的答案和理由，坚持或改，至多 ${run.maxRounds ?? 3} 轮；仍不一致的${run.mode === 'model' ? '' : '先让规则投第三票，再'}转人工\n人工判断按稳定编号保存，重跑沿用`), bridge))
      }

      /* ---- 进料口：文书一张张进来 ---- */
      {
        const s = stations[0]; const [i, j, a, b, hh] = ST.intake; const g = []
        g.push(...isoBox('ramp', i - 64, j + 44, 0, 64, 30, 6, CL2))
        // 文书堆：一叠纸（颜色淡淡的三种，表示不同记录类型）
        const sheets = Math.min(9, Math.max(running || t.documents ? 3 : 1, Math.ceil(Math.log2((t.documents ?? 0) + 1))))
        for (let q = 0; q < sheets; q++) g.push(...isoBox(`pp${q}`, i - 50 + (q % 2) * 2, j + 50 + (q % 3), 6 + q * 2.6, 26, 18, 2.2, q % 3 === 0 ? CL2 : tint(TYPE3[q % 3][1], C === CLAY.light ? 0.75 : 0.45)))
        g.push(...isoBox('b', i, j, 0, a, b, hh, CL))
        g.push(...isoBox('cap', i + 8, j + 10, hh, 46, 40, 10, CL2))
        g.push(...isoBox('hop', i + 56, j + 58, hh, 22, 26, 16, CL2))
        g.push(...windows('iw', s, i + 6, i + a - 6, j + b, 12, hh - 8, 6, 4))
        els.push(h('g', { key: 'intake', ...click(0) }, h('title', {}, `${s.nm}：${s.sub}`), g))
      }
      els.push(belt('b1', ST.intake[0] + ST.intake[2], ST.cutter[0]))
      /* ---- 切句：屋顶三片刀 ---- */
      {
        const s = stations[1]; const [i, j, a, b, hh] = ST.cutter; const g = []
        g.push(...isoBox('b', i, j, 0, a, b, hh, CL))
        g.push(...windows('cw', s, i + 6, i + a - 6, j + b, 8, hh - 8, 4, 2))
        for (let q = 0; q < 3; q++) g.push(...isoBox(`bl${q}`, i + 14 + q * 18, j + 10, hh, 4, b - 20, 14, tone(s) ? tint(A, 0.2) : CL2))
        els.push(h('g', { key: 'cutter', ...click(1) }, h('title', {}, `${s.nm}：${s.sub}`), g))
      }
      els.push(belt('b2', ST.cutter[0] + ST.cutter[2], ST.read[0]))
      const underQueue = els.length // 模型小楼的管子画在这之后、各站之前
      /* ---- 通读塔 ---- */
      {
        const s = stations[2]; const [i, j, a, b, hh] = ST.read; const g = []
        g.push(...isoBox('r', i, j, 0, a, b, hh, CL))
        g.push(...isoBox('rc', i + 8, j + 8, hh, a - 16, b - 16, 12, CL2))
        g.push(...windows('rw', s, i + 4, i + a - 4, j + b, 14, hh - 10, 3, 8))
        for (let r = 0; r < 8; r++) g.push(rightPatch(`rr${r}`, i + a, j + 10, j + b - 10, 18 + r * 16, 21 + r * 16, { fill: C.win, opacity: 0.4 }))
        const ant0 = iso(i + a / 2, j + b / 2, hh + 12); const ant1 = iso(i + a / 2, j + b / 2, hh + 34)
        g.push(h('line', { key: 'ant', x1: ant0[0], y1: ant0[1], x2: ant1[0], y2: ant1[1], stroke: C.left, strokeWidth: 2 }), h('circle', { key: 'antl', cx: ant1[0], cy: ant1[1], r: 3, fill: running ? P.vio : C.hole, className: running ? 'me-pulse' : undefined }))
        els.push(h('g', { key: 'read', ...click(2) }, h('title', {}, `${s.nm}：${s.sub}`), g))
        bb.push(ant1)
      }
      els.push(belt('b3', ST.read[0] + ST.read[2], ST.sorter[0], '①'))
      /* ---- 分拣台：按类型分到三条滑道 ---- */
      {
        const s = stations[4]; const [i, j, a, b, hh] = ST.sorter; const g = []
        g.push(...isoBox('b', i, j, 0, a, b, hh, CL))
        g.push(...windows('sw', s, i + 6, i + a - 6, j + b, 8, hh - 8, 5, 2))
        g.push(...isoCyl('hop', i + a / 2, j + b / 2, hh, 14, 14, C))
        els.push(h('g', { key: 'sorter', ...click(4) }, h('title', {}, `${s.nm}：${s.sub}`), g))
        // 三条滑道：事实、判断、决策（和复核页、时间线同色）；宽度按本批各类提及的比例
        const types = {}
        for (const p of run.patients ?? []) for (const [k, n] of Object.entries(p.types ?? {})) types[k] = (types[k] ?? 0) + n
        const sum = TYPE3.reduce((x, [k]) => x + (types[k] ?? 0), 0)
        const x0 = i + a; const x1 = ST.ware[0] + 6
        const chutes = []
        TYPE3.forEach(([nm, c], q) => {
          const cj = j + 8 + q * 26; const cw = 18
          chutes.push(...isoBox(`ch${q}`, x0, cj, 8, x1 - x0, cw, 6, tint(c, C === CLAY.light ? 0.5 : -0.1)))
          const pa = iso(x0 + 4, cj + cw / 2, 15); const pb = iso(x1 - 2, cj + cw / 2, 15)
          chutes.push(h('line', { key: `cf${q}`, x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1], stroke: c, strokeWidth: 3, strokeDasharray: '4 7', className: running ? 'me-flow' : undefined, opacity: 0.95 }))
          const lp = iso(x0 + 30, cj + cw, 16)
          chutes.push(h('text', { key: `ct${q}`, x: lp[0], y: lp[1] + 9, fill: c, fontSize: 9.5, fontWeight: 700, ...halo }, `${nm}${sum ? ` ${Math.round(((types[nm] ?? 0) / sum) * 100)}%` : ''}`))
        })
        chutes.push(gateDot('g2', '②', [x0 + 10, j - 6, 16]))
        els.push(h('g', { key: 'chutes', ...click(4) }, h('title', {}, `三条滑道：模型判定的类型直接采用，其余由规则推出${sum ? `\n${TYPE3.map(([nm]) => `${nm} ${fmt(types[nm] ?? 0)}`).join(' · ')}` : ''}`), chutes))
      }
      /* ---- 事件仓库：按时间上架（归并），门口质检③ ---- */
      {
        const s = stations[5]; const [i, j, a, b] = ST.ware; const g = []
        g.push(...isoBox('pad', i, j, 0, a, b, 3, { top: C.pad, left: C.padL, right: C.padR }))
        // 后墙
        g.push(...isoBox('wall', i, j, 3, a, 6, 40, CL2))
        const racks = 4
        const ev = t.events ?? 0
        const perRack = ev ? Math.min(5, Math.max(1, Math.round(Math.log2(ev + 1) / 1.8))) : 0
        for (let r = 0; r < racks; r++) {
          const rj = j + 20 + r * 34
          g.push(...isoBox(`rk${r}`, i + 16, rj, 3, a - 32, 14, 22, CL))
          for (let q = 0; q < perRack - (r % 2); q++) {
            const ci = i + 22 + q * 24; const c = TYPE3[(q + r) % 3][1]
            g.push(...isoBox(`cr${r}-${q}`, ci, rj + 1, 25, 18, 12, 11, tone(s) && running ? tint(A, 0.2) : tint(c, C === CLAY.light ? 0.62 : 0.1)))
          }
        }
        // 时间轴：沿货架往右是更晚的时间
        const ta = iso(i + 20, j + b - 6, 4); const tb = iso(i + a - 14, j + b - 6, 4)
        g.push(h('line', { key: 'tax', x1: ta[0], y1: ta[1], x2: tb[0], y2: tb[1], stroke: P.ink3, strokeWidth: 1.2, markerEnd: 'url(#me-arr)' }))
        const [tx, ty] = iso(i + 24, j + b - 2)
        g.push(h('g', { key: 'tcap', transform: `matrix(${IX[0]} ${IX[1]} ${JX[0]} ${JX[1]} ${tx.toFixed(1)} ${ty.toFixed(1)})`, pointerEvents: 'none' }, h('text', { x: 0, y: 0, fill: P.ink3, fontSize: 9 }, '同一件事归成一箱 · 按时间上架 →')))
        g.push(gateDot('g3', '③', [i + 4, j - 8, 26]))
        els.push(h('g', { key: 'ware', ...click(5) }, h('title', {}, `${s.nm}：${s.sub}\n箱子＝事件（同一件事的提及归在一起），按发生时间排在货架上`), g))
        bb.push(iso(i, j, 50), iso(i + a, j, 50))
      }
      /* ---- 冲突台：发现（记录之间的冲突）堆在这里 ---- */
      {
        const [i, j, a, b, hh] = ST.desk; const g = []
        const nF = t.findings ?? 0
        g.push(...isoBox('leg0', i + 4, j + 4, 0, 4, 4, hh, CL2), ...isoBox('leg1', i + a - 8, j + b - 8, 0, 4, 4, hh, CL2))
        g.push(...isoBox('top', i, j, hh, a, b, 4, CL))
        for (let q = 0; q < Math.min(8, nF); q++) g.push(...isoBox(`fx${q}`, i + 6 + (q % 4) * 19, j + 6 + Math.floor(q / 4) * 13, hh + 4 + (q >= 8 ? 10 : 0), 14, 10, 9, RED))
        const lp = iso(i + a / 2, j + b, hh + 4)
        g.push(h('text', { key: 'dt', x: lp[0] - 6, y: lp[1] + 16, textAnchor: 'middle', fill: nF ? P.bad : P.ink3, fontSize: 10, fontWeight: 600, ...halo }, nF ? `冲突台 · ${fmt(nF)} 条发现` : '冲突台'))
        els.push(h('g', { key: 'desk', ...click(5) }, h('title', {}, `冲突台：记录之间的矛盾、改判、调整、病情变化、记录质量问题，登记为发现，不自动选边\n需人工确认的进复核`), g))
      }
      els.push(belt('b4', ST.ware[0] + ST.ware[2], ST.dock[0]))
      /* ---- 交付堆场 ---- */
      {
        const s = stations[6]; const [i, j, a, b] = ST.dock; const g = []
        g.push(...isoBox('pad', i, j, 0, a, b, 4, { top: C.pad, left: C.padL, right: C.padR }))
        const unit = (key, ui, uj, label) => {
          g.push(...isoBox(key, ui, uj, 4, 30, 30, 22, CL2))
          const f = iso(ui + 15, uj + 15, 26)
          g.push(h('ellipse', { key: `${key}f`, cx: f[0], cy: f[1], rx: 11.5, ry: 6.5, fill: C.hole }), h('ellipse', { key: `${key}g`, cx: f[0], cy: f[1], rx: 8, ry: 4.5, fill: 'none', stroke: C.left, strokeWidth: 1 }))
          const tp = iso(ui + 15, uj + 15, 40)
          g.push(h('text', { key: `${key}t`, x: tp[0], y: tp[1], textAnchor: 'middle', fill: P.ink2, fontSize: 9, ...halo }, label))
        }
        unit('du0', i + 8, j + 10, '事件包'); unit('du1', i + 54, j + 10, '导出视图'); unit('du2', i + 100, j + 10, '复核项')
        const crates = Math.min(run.shards?.done ?? 0, 12)
        const cells = []
        for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 4; c2++) cells.push([i + 10 + c2 * 32, j + 54 + r * 24])
        cells.slice(0, crates).sort((p, q) => depthOf(p[0], p[1]) - depthOf(q[0], q[1])).forEach(([ci, cj], q) => {
          g.push(...isoBox(`cr${q}`, ci, cj, 4, 22, 18, 13, CL2))
          const pa = iso(ci, cj + 9, 17); const pb = iso(ci + 22, cj + 9, 17)
          g.push(h('line', { key: `ct${q}`, x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1], stroke: A, strokeWidth: 1.4, opacity: 0.85 }))
        })
        if (run.output) [[i + 4, j + 4], [i + a - 4, j + 4], [i + a - 4, j + b - 4], [i + 4, j + b - 4]].forEach(([ci, cj], q) => { const di = q === 0 || q === 3 ? 1 : -1; const dj = q < 2 ? 1 : -1; g.push(h('polyline', { key: `dk${q}`, points: pts([iso(ci + di * 12, cj, 4), iso(ci, cj, 4), iso(ci, cj + dj * 12, 4)]), fill: 'none', stroke: A, strokeWidth: 1.8, filter: 'url(#me-glow)' })) })
        els.push(h('g', { key: 'dock', opacity: s.state === 'idle' ? 0.6 : 1, ...click(6) }, h('title', {}, `${s.nm}：${s.sub}`), g))
      }
      /* ---- 排队与红箱 ---- */
      {
        const waiting = running ? Math.max(0, (run.shards?.total ?? 0) - (run.shards?.done ?? 0) - (run.shards?.running ?? 0)) : 0
        const review = !running ? t.review ?? 0 : 0
        const pile = (key, n, shownN, [pi, pj], hot, label, title, k) => {
          if (!n) return
          const shown = Math.min(24, n); const g = []
          for (let q = 0; q < shown; q++) { const lv = Math.floor(q / 6); const a = q % 3; const c = Math.floor((q % 6) / 3); g.push(...isoBox(`p${q}`, pi + a * 13, pj + c * 12, lv * 9, 11, 10, 8, hot ? AMB : CL2)) }
          const top = iso(pi + 19, pj + 11, Math.ceil(shown / 6) * 9 + 10)
          els.push(h('g', { key, ...click(k) }, h('title', {}, title), g,
            h('text', { x: top[0], y: top[1], textAnchor: 'middle', fill: hot ? P.warn : A, fontSize: 16, fontWeight: 700, fontFamily: MONO, stroke: C.card, strokeWidth: 3.5, paintOrder: 'stroke' }, fmt(shownN)),
            label ? h('text', { x: top[0], y: top[1] + 13, textAnchor: 'middle', fill: P.ink, fontSize: 10, stroke: C.card, strokeWidth: 3, paintOrder: 'stroke' }, label) : null))
          bb.push(iso(pi, pj + 24), iso(pi + 39, pj, 60))
        }
        pile('qwait', waiting, waiting, [ST.intake[0] + 8, ST.intake[1] + ST.intake[3] + 12], false, '排队 · 等待读入', `等待读入的数据块 ${fmt(waiting)} 个，每箱一个数据块`, 0)
        pile('qrev', review ? Math.ceil(review / 10) : 0, review, [ST.read[0] + ST.read[2] + 22, BELT[1] + 40], true, null, `待复核 ${fmt(review)} 项：复查后仍不一致的通读分歧、需人工确认的发现、需药师复核的药名\n箱子＝待复核的项，每箱 10 项\n点开看核验工序，再去复核`, 3)
        if (t.invalid) {
          const gi = ST.read[0] + ST.read[2] + 54; const gg = []
          for (let q = 0; q < Math.min(4, Math.ceil(t.invalid / 50)); q++) gg.push(...isoBox(`rq${q}`, gi + (q % 2) * 15, BELT[0] - 30 - Math.floor(q / 2) * 13, 0, 13, 12, 11, RED))
          const lp = iso(gi + 8, BELT[0] - 34, 22)
          gg.push(h('text', { key: 't', x: lp[0], y: lp[1], textAnchor: 'middle', fill: P.bad, fontSize: 10, ...halo }, h('title', {}, '模型回答的片段在原文里找不到，或类型不在类型表里：插件拦下、不采用'), `${fmt(t.invalid)} 条无效回答已拦下`))
          els.push(h('g', { key: 'redq' }, gg))
        }
        if (running && run.current?.stage && !['S00', 'S07'].includes(run.current.stage)) {
          const at = [ST.read[0] + ST.read[2] + 20, BELT[0] + 2]; const tp = iso(at[0] + 8, at[1], 18)
          els.push(h('g', { key: 'cur', pointerEvents: 'none' }, h('g', { filter: 'url(#me-glow)', className: 'me-pulse' }, isoBox('cc', at[0], at[1], 20, 16, 14, 12, AMB)),
            h('text', { x: tp[0] + 4, y: tp[1] - 22, fill: A, fontSize: 10.5, fontWeight: 700, ...halo }, `处理中 · ${run.shards?.running ?? 0} 个数据块 · ${Object.keys(run.live ?? {}).length} 位病人`)))
        }
      }

      /* ---- 模型小楼：通读模型在通读塔前，核验模型在核验塔后；管子按在途数流动发光 ---- */
      const houses = modelHousesOf(run)
      const last = running ? (run.series ?? []).filter((p) => p.length >= 18).at(-1) : null
      const HOUSE_MA = 74; const HOUSE_MB = 44
      const towerFront = [ST.read[0] + ST.read[2] / 2, ST.read[1] + ST.read[3], 20]
      const towerBack = [ST.verify[0] + ST.verify[2], ST.verify[1] + ST.verify[3] / 2, 20]
      const spotOf = (hs, st) => (st === 'format' ? [ST.intake[0] + 40, hs.roles.includes('verify') && !hs.roles.includes('extract') ? ST.intake[1] : ST.intake[1] + ST.intake[3], 26] : hs.roles.includes('extract') ? towerFront : towerBack)
      const HOUSE_AT = (hs, hi) => (hs.roles.includes('extract') || hi === 0 ? [towerFront[0] - HOUSE_MA / 2, ST.read[1] + ST.read[3] + 104] : [ST.verify[0] + ST.verify[2] + 70, ST.verify[1] + ST.verify[3] / 2 - HOUSE_MB / 2])
      const isBack = (hs, hi) => !(hs.roles.includes('extract') || hi === 0)
      houses.forEach((hs, hi) => {
        const V = P.vio; const on = !!hs.model
        const [mi, mj] = HOUSE_AT(hs, hi); const ma = HOUSE_MA; const mb = HOUSE_MB; const mh = 30
        const live = last ? { inflight: last[2 + hs.slot] ?? 0, waiting: last[4 + hs.slot] ?? 0, st: last.slice(10 + hs.slot * 4, 14 + hs.slot * 4) } : null
        const recentFail = (() => { if (!running) return false; const ps = (run.series ?? []).filter((p) => p.length >= 20); if (ps.length < 2) return false; const z = ps.at(-1); const old = ps.filter((p) => z[0] - p[0] <= 10000)[0] ?? ps.at(-2); return (z[18 + hs.slot] ?? 0) > (old[18 + hs.slot] ?? 0) })()
        const g = []; const pipes = []
        g.push(...isoBox('mp', mi - 6, mj - 6, -1, ma + 12, mb + 12, 1, { top: C.pad, left: C.padL, right: C.padR }))
        const uses = hs.stations.filter((x) => x !== 'format' || hs.didFormat)
        const seen = new Set()
        uses.forEach((st) => {
          const sp = spotOf(hs, st); const key = sp.join(','); if (seen.has(key)) return; seen.add(key)
          const stI = ['format', 'extract', 'verify', 'adjudicate'].indexOf(st)
          const hot = on && live && uses.filter((u) => spotOf(hs, u).join(',') === key).some((u) => (live.st[['format', 'extract', 'verify', 'adjudicate'].indexOf(u)] ?? 0) > 0)
          const used = on && uses.filter((u) => spotOf(hs, u).join(',') === key).some((u) => (hs.calls[u] ?? 0) > 0)
          const front = sp[1] < mj // 目标在房子后方（j 更小）：从房子后边出管
          const bi = Math.max(mi + 6, Math.min(mi + ma - 6, sp[0]))
          // 核验模型的小楼在核验塔右边：从房子左侧出管
          const start = isBack(hs, hi) && sp[0] < mi ? [mi + 4, Math.max(mj + 6, Math.min(mj + mb - 6, sp[1]))] : [bi, front ? mj + 4 : mj + mb - 4]
          const d = 'M' + [start, [sp[0], sp[1]]].map(([i, j]) => iso(i, j, sp[2]).map((v) => v.toFixed(1)).join(' ')).join(' L')
          const names = uses.filter((u) => spotOf(hs, u).join(',') === key).map((u) => STATION_LABEL[u]).join('、')
          pipes.push(h('path', { key: `h${hi}p${st}`, d, fill: 'none', stroke: hot || used ? V : C.left2, strokeWidth: hot ? 2.4 : used ? 1.7 : 1.3, strokeDasharray: hot ? '3 5' : '2 5', className: hot ? 'me-flow' : undefined, filter: hot ? 'url(#me-glow)' : undefined, opacity: hot ? 1 : used ? 0.7 : 0.4 }, h('title', {}, `${names}${on ? `：调用 ${fmt(uses.filter((u) => spotOf(hs, u).join(',') === key).reduce((x, u) => x + (hs.calls[u] ?? 0), 0))} 次` : ''}`)))
          void stI
        })
        g.push(...isoBox('mb', mi, mj, 0, ma, mb, mh, on ? CL : CL2))
        const cap = on ? Math.max(1, last?.length >= 22 && last[20 + hs.slot] > 0 ? last[20 + hs.slot] : run.autoTune?.[hs.slot]?.limit ?? hs.max) : 8
        const per = cap <= 32 ? 1 : Math.ceil(cap / 32)
        const nWin = Math.ceil(cap / per); const rowsW = nWin > 12 ? 2 : 1; const perRow = Math.ceil(nWin / rowsW)
        const litWin = on && live ? Math.min(nWin, Math.ceil(live.inflight / per)) : 0
        const ww = (ma - 8) / perRow; const wGap = Math.min(3, ww * 0.3); const wh = rowsW === 2 ? 8 : 15
        for (let k2 = 0; k2 < nWin; k2++) {
          const row = Math.floor(k2 / perRow); const col = k2 % perRow
          const wi = mi + 4 + col * ww; const z0 = rowsW === 2 ? (row === 0 ? 18 : 6) : 7
          const isLit = k2 < litWin; const isRed = recentFail && k2 === Math.max(0, litWin - 1)
          g.push(leftPatch(`mw${k2}`, wi, wi + ww - wGap, mj + mb, z0, z0 + wh, { fill: isRed ? P.bad : isLit ? V : C.win, opacity: isLit || isRed ? 0.95 : 0.55, filter: isLit || isRed ? 'url(#me-glow)' : undefined, className: isRed ? 'me-pulse' : undefined }))
        }
        const nQ = on && live ? live.waiting : 0
        const QA = { top: shade(P.warn, 0.35), left: P.warn, right: shade(P.warn, -0.3), edge: shade(P.warn, -0.45) }
        const slots2 = [[2, 1], [1, 1], [3, 1], [2, 0], [1, 0], [3, 0], [0, 1], [4, 1], [0, 0], [4, 0]]
        for (let q = 0; q < Math.min(10, nQ); q++) { const [cx, cy] = slots2[q]; g.push(...isoBox(`qb${q}`, mi + 6 + cx * 13, mj + 6 + cy * 16, mh, 10, 12, 7, QA)) }
        if (nQ > 10) { const tp = iso(mi + ma / 2, mj + mb / 2, mh + 26); g.push(h('text', { key: 'qn', x: tp[0], y: tp[1], textAnchor: 'middle', fill: P.warn, fontSize: 13, fontWeight: 700, fontFamily: MONO, ...halo }, fmt(nQ))) }
        if (sel === 8 + hi) g.push(h('polygon', { key: 'selroof', points: pts([iso(mi + 2, mj + 2, mh + 0.5), iso(mi + ma - 2, mj + 2, mh + 0.5), iso(mi + ma - 2, mj + mb - 2, mh + 0.5), iso(mi + 2, mj + mb - 2, mh + 0.5)]), fill: 'none', stroke: A, strokeWidth: 1.4, strokeDasharray: '5 4' }))
        const back = isBack(hs, hi)
        const lt = back ? iso(mi + ma + 10, mj + mb / 2, 6) : iso(mi - 8, mj + mb + 12)
        const anchorT = back ? 'start' : 'end'
        const name = hs.model ? shortModel(hs.model) : hs.label
        const sub = !on ? hs.why : live ? `在途 ${live.inflight}／${cap}${live.waiting ? ` · 排队 ${live.waiting}` : ''}` : `调用 ${big(hs.total)}${hs.failed ? ` · 失败 ${fmt(hs.failed)}` : ''}`
        g.push(h('text', { key: 't1', x: lt[0], y: lt[1] + 4, textAnchor: anchorT, fill: on ? V : P.ink3, fontSize: 11, fontWeight: 700, fontFamily: MONO, ...halo }, name),
          h('text', { key: 't2', x: lt[0], y: lt[1] + 17, textAnchor: anchorT, fill: P.ink2, fontSize: 9.5, ...halo }, hs.roleText),
          h('text', { key: 't3', x: lt[0], y: lt[1] + 30, textAnchor: anchorT, fill: live?.inflight ? V : P.ink3, fontSize: 9.5, ...halo }, sub))
        els.splice(underQueue, 0, ...pipes)
        els.push(h('g', { key: `house${hi}`, ...click(8 + hi) }, h('title', {}, `${hs.model ?? hs.label}（${hs.roleText}）\n窗户＝并发名额（共 ${cap} 个），亮着的＝在途${live ? ` ${live.inflight}` : ''}\n屋顶的箱子＝排队的请求${recentFail ? '\n红窗＝最近 10 秒有调用失败' : ''}\n点开看模型状态`), g))
        bb.push(iso(mi - 6, mj + mb + 6), back ? iso(mi + ma + 180, mj + mb / 2, -30) : iso(mi - 170, mj + mb + 44), iso(mi + ma + 6, mj + mb + 6), iso(mi, mj, mh + 30))
      })

      /* ---- 屋顶标签：两字工序名＋关键数＋单位，质检一个色点；选中＝实心 ---- */
      const textW = (str, fs, mono) => [...String(str)].reduce((w, ch) => w + (/[\u2E80-\uFFFF]/.test(ch) ? fs : fs * (mono ? 0.62 : 0.56)), 0)
      const gateDotColor = { ok: P.ok, warn: P.bad, '': P.ink3 }
      const ANCHOR = [
        iso(ST.intake[0] + 43, ST.intake[1] + 50, ST.intake[4] + 34), iso(ST.cutter[0] + 37, ST.cutter[1] + 32, ST.cutter[4] + 34),
        iso(ST.read[0] + 29, ST.read[1] + 29, ST.read[4] + 50), iso(ST.verify[0] + 29, ST.verify[1] + 29, ST.verify[4] + 40),
        iso(ST.sorter[0] + 40, ST.sorter[1] + 84, ST.sorter[4] + 34), iso(ST.ware[0] + 90, ST.ware[1] + 20, 66),
        iso(ST.dock[0] + 70, ST.dock[1] + 20, 78), iso(BASE.i0 + 120, BASE.j1 - 10, 2),
      ]
      stations.forEach((s, k) => {
        const [x, y] = ANCHOR[k]
        const on = k === sel; const hotS = s.state === 'hold' || s.state === 'run'
        const g = s.rows.find((r) => /^(验收|质检)/.test(r[0]))
        const w = 9 + textW(s.ab, 10.5) + 6 + textW(s.big, 12.5, true) + (s.unit ? textW(s.unit, 9.5) + 3 : 0) + (g ? 13 : 0) + 9
        const hh = 21; const x0 = x - w / 2; const y0 = y - hh - 5
        const bg = on ? A : C.card; const line = hotS || on ? A : C.cardLine
        bb.push([x0, y0], [x0 + w, y])
        els.push(h('g', { key: `tag${k}`, ...click(k) },
          h('title', {}, [`${s.nm}：${s.sub}`, ...s.rows.map(([l, v]) => `${l}：${v}`)].join('\n')),
          h('rect', { x: x0, y: y0, width: w, height: hh, rx: hh / 2, fill: bg, stroke: line, strokeWidth: hotS ? 1.4 : 1 }),
          h('path', { d: `M${x - 4} ${y0 + hh - 0.5}L${x} ${y - 1}L${x + 4} ${y0 + hh - 0.5}Z`, fill: bg, stroke: line, strokeWidth: 1 }),
          h('rect', { x: x - 4.6, y: y0 + hh - 2, width: 9.2, height: 2.4, fill: bg }),
          h('text', { x: x0 + 9, y: y0 + 14.5, fill: on ? '#fff' : hotS ? A : P.ink2, fontSize: 10.5, fontWeight: 600 }, s.ab,
            h('tspan', { dx: 6, fill: on ? '#fff' : P.ink, fontSize: 12.5, fontWeight: 700, fontFamily: MONO }, s.big),
            s.unit ? h('tspan', { dx: 3, fill: on ? 'rgba(255,255,255,.75)' : P.ink3, fontSize: 9.5, fontWeight: 400 }, s.unit) : null),
          g ? h('circle', { cx: x0 + w - 12, cy: y0 + hh / 2, r: 3.6, fill: gateDotColor[g[2]] ?? P.ink3, stroke: on ? '#fff' : 'none', strokeWidth: 1 }) : null))
      })
      const xs = bb.map((p) => p[0]); const ys = bb.map((p) => p[1])
      const x0 = Math.min(...xs) - 20; const y0 = Math.min(...ys) - 14; const x1 = Math.max(...xs) + 20; const y1 = Math.max(...ys) + 14
      defs.push(h('mask', { key: 'mk', id: 'me-gridmask', maskUnits: 'userSpaceOnUse', x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, h('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'url(#me-fade)' })))
      // 键盘：场景本身是一个 Tab 停靠点，←／→ 按流程顺序（规则底座在前）切换
      const ORDER = [7, 0, 1, 2, 3, 4, 5, 6, ...houses.map((_, i) => 8 + i)]
      const onKeyDown = (e) => {
        if (e.key === 'Escape') { onSel(null); return }
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
        if (!d) return
        e.preventDefault()
        onSel(sel < 0 ? ORDER[d > 0 ? 0 : ORDER.length - 1] : ORDER[(ORDER.indexOf(sel) + d + ORDER.length) % ORDER.length])
      }
      return h('svg', { className: 'me-scene', tabIndex: 0, role: 'group', 'aria-label': `处理流程，当前 ${sel >= 8 ? '模型' : sel >= 0 ? stations[sel].nm : '批次概览'}（←／→ 切换工序）`, onKeyDown, viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, preserveAspectRatio: 'xMidYMid meet', style: { overflow: 'hidden' } }, h('defs', {}, defs), els)
    }

    /** 小进度环 */
    /** 面板头部的主指标：大字＋说明一行，下面一条占满宽度的横条（原来是小圆圈，右边空着） */
    function Ring({ v, label, sub, hot }) {
      const x = Math.max(0, Math.min(1, v ?? 0))
      return h('div', { className: 'me-ring' },
        h('div', { className: 'me-ring-t' }, h('b', { className: 'me-num' }, label), sub ? h('small', {}, sub) : null),
        h('div', { className: 'me-ring-bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${x * 100}%`, background: hot ? 'var(--warn)' : 'var(--teal)' } })))
    }

    /** 带名字的横条：rows = [[名称, 数, 显示文本?, 颜色?, 提示?, 点击?]] */
    function RankBars({ rows, max }) {
      const m = max ?? Math.max(1, ...rows.map((r) => r[1]))
      return h('div', { className: 'me-rank' }, rows.map(([name, n, txt, color, tip, onClick], i) => h('div', { key: `${name}${i}`, className: `me-rank-r${onClick ? ' click' : ''}`, title: tip ?? `${name}：${txt ?? fmt(n)}`, onClick },
        h('span', {}, name), h('div', {}, h('i', { style: { width: `${Math.max(2, (n / m) * 100)}%`, background: color ?? 'var(--teal)' } })), h('b', { className: 'me-num' }, txt ?? big(n)))))
    }

    /** 分段条＋图例：parts = [[名称, 数, 颜色]] */
    function Split({ parts }) {
      const sum = parts.reduce((s, p) => s + p[1], 0)
      return h(React.Fragment, {},
        h('div', { className: 'me-stack' }, sum ? parts.map(([k, n, c]) => (n ? h('span', { key: k, style: { width: `${(n / sum) * 100}%`, background: c } }) : null)) : null),
        h('div', { className: 'me-legend' }, parts.map(([k, n, c]) => h('span', { key: k }, h('i', { style: { background: c } }), `${k} ${big(n)}`))))
    }

    /* ------------------------------------------------------------- alerts */
    /** 待办告警（同匿名化插件）：流水线右上角，最严重的在前，最多 3 条（其余「再看 N 条」），点一条直接去处理；可收起 */
    function AlertsOverlay({ run, stations, goto, onSel }) {
      const [fold, setFold] = useState(false)
      const [all, setAll] = useState(false)
      const t = run.totals
      const running = run.status === 'running'
      const at = (no) => () => onSel(stations.findIndex((x) => x.no === no))
      const GB = 1024 ** 3
      const a = []
      if (run.status === 'failed') a.push({ tone: 'crit', tag: '失败', title: '批次失败', sub: String(run.error ?? '').split('\n')[0].replace(/^Error:\s*/, '').slice(0, 80) })
      if (run.sourceCheck?.changed) a.push({ tone: 'crit', tag: '源文件', title: `源文件有 ${fmt(run.sourceCheck.changed)} 个变化`, sub: '只读核对不一致：运行期间输入被改过', onClick: at('S07') })
      const disk = run.disk
      if (running && disk?.free != null && disk.free < 20 * GB) a.push({ tone: disk.free < 5 * GB ? 'crit' : 'warn', tag: '磁盘', title: `输出盘只剩 ${(disk.free / GB).toFixed(1)} GB`, sub: '空间不够时数据块写不出来' })
      const mem = run.memory
      const memR = running && mem?.heapLimit ? mem.heapUsed / mem.heapLimit : null
      if (memR != null && memR >= 0.7) a.push({ tone: memR >= 0.85 ? 'crit' : 'warn', tag: '内存', title: `堆内存用了 ${Math.round(memR * 100)}%`, sub: '可在设置里减少工作线程数' })
      if (!running) for (const g of run.gates ?? []) if (!g.pass && !g.skipped) a.push({ tone: 'warn', tag: `质检${g.id}`, title: `质检${g.id}未过`, sub: g.detail, onClick: at({ '①': 'S02', '②': 'S03', '③': 'S04', '④': 'S04', '⑤': 'S02v' }[g.id]) })
      if (t.review) a.push({ tone: 'warn', tag: '复核', title: `待复核 ${fmt(t.review)} 项`, sub: `通读分歧转人工 ${fmt(t.human ?? 0)} · 需人工确认的发现、药名映射`, onClick: () => goto('source') })
      if (t.failed) a.push({ tone: 'warn', tag: '病人', title: `${fmt(t.failed)} 位病人出错`, sub: '读不了或处理出错，已跳过', onClick: () => goto('files') })
      if (run.format?.held) a.push({ tone: 'warn', tag: '格式', title: `${fmt(run.format.held)} 张表的格式待确认`, sub: '这些表没有用来生成事件；确认后重跑', onClick: () => goto('formats') })
      for (const role of ['read', 'verify']) {
        const m = run.models?.[role]
        const fr = m?.calls ? m.failed / m.calls : 0
        if (m?.calls >= 20 && fr > 0.02) a.push({ tone: 'warn', tag: '模型', title: `${role === 'read' ? '通读' : '核验'}模型失败率 ${(fr * 100).toFixed(1)}%`, sub: `已自动重试；失败的句子没有模型答案${run.mode === 'hybrid' ? '，由规则补上' : ''}`, onClick: () => goto('calls') })
      }
      if (t.noAnswer) a.push({ tone: 'warn', tag: '通读', title: `${fmt(t.noAnswer)} 句没有模型答案`, sub: run.mode === 'hybrid' ? '调用失败或答不全；这些句子由规则补上。取消后「继续」会重问' : '调用失败或答不全；这些句子没有提及', onClick: at('S02') })
      if (t.invalid) a.push({ tone: 'info', tag: '通读', title: `${fmt(t.invalid)} 条无效回答已拦下`, sub: '片段不在原文里或类型不在类型表里', onClick: at('S02') })
      if (!run.model?.verifyModel && run.version) a.push({ tone: 'info', tag: '核验', title: '未配置核验模型', sub: '不做抽样核验，质检⑤跳过' })
      if (run.warnings?.length) a.push({ tone: 'info', tag: '提示', title: `${fmt(run.warnings.length)} 条提示`, sub: run.warnings[0].slice(0, 60), onClick: () => goto('report') })
      if (run.status === 'cancelled') a.push({ tone: 'info', tag: '续跑', title: '批次已取消', sub: '点「＋ 新批次」里的「↻ 继续」接着跑，已完成的数据块直接复用' })
      const RANK = { crit: 0, warn: 1, info: 2 }
      a.sort((x, y) => RANK[x.tone] - RANK[y.tone])
      const COLOR = { crit: 'var(--bad)', warn: 'var(--warn)', info: 'var(--ink3)', ok: 'var(--ok)' }
      if (!a.length) return h('div', { className: 'me-al-ov ok' }, h('i', { className: 'me-al-dot', style: { background: COLOR.ok } }), running ? '运行正常' : '全部完成，没有待办')
      const worst = a[0].tone
      const shown = all ? a : a.slice(0, 3)
      return h('div', { className: `me-al-ov ${worst}${fold ? ' shut' : ''}` },
        h('button', { type: 'button', className: 'me-al-head', onClick: () => setFold(!fold), title: fold ? '展开' : '收起' },
          h('i', { className: 'me-al-dot', style: { background: COLOR[worst] } }), h('b', {}, '待办告警'), h('span', { className: 'me-cap' }, 'ALERTS'), h('span', { className: 'me-al-n' }, String(a.length))),
        fold ? null : h('div', { className: 'me-al-list' },
          shown.map((x, i) => h('button', { key: i, type: 'button', className: `me-al-item ${x.tone}`, onClick: x.onClick, disabled: !x.onClick },
            h('i', { style: { background: COLOR[x.tone] } }),
            h('div', {}, h('b', {}, x.title), x.sub ? h('small', {}, x.sub) : null),
            h('span', { className: `me-chip ${x.tone === 'crit' ? 'b' : x.tone === 'warn' ? 'w' : ''}` }, x.tag))),
          a.length > 3 ? h('button', { type: 'button', className: 'me-link me-al-more', onClick: () => setAll(!all) }, all ? '收起' : `再看 ${a.length - 3} 条`) : null))
    }

    /* ------------------------------------------------------------ overview */
    const kfmt = (n) => (n == null ? '—' : n >= 1e9 ? `${(n / 1e9).toFixed(1)}G` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : fmt(Math.round(n)))
    const ROLE_NM = { extract: '提取', verify: '核验' }
    const LAT_LABELS = ['<.5', '.5', '1', '2', '4', '8', '16+']


    /** 一栋模型房子（一个模型服务）的合计表现：各角色（格式识别、提取、核验、复查）加起来 */
    function houseAgg(hs) {
      const a = { calls: 0, cached: 0, failed: 0, retries: 0, ms: 0, pt: 0, ct: 0, ptMax: 0, sentChars: 0, reusedChars: 0, hist: [0, 0, 0, 0, 0, 0, 0] }
      for (const [, , p] of hs.perf) { for (const k of ['calls', 'cached', 'failed', 'retries', 'ms', 'pt', 'ct', 'sentChars', 'reusedChars']) a[k] += p[k] ?? 0; a.ptMax = Math.max(a.ptMax, p.ptMax ?? 0); a.hist = a.hist.map((x, i) => x + (p.hist?.[i] ?? 0)) }
      return a
    }
    const fmtTok = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v)))
    const TUNE_REASON = { up: '满载，加并发', flat: '加了吞吐不涨，退回', server: '服务器排队或 KV 将满，试降一档', back: '降了吞吐下降，回升', errors: '出现超时或连接错误，降低' }
    const TUNE_CHIP = { up: '↑ 满载，加并发', flat: '↺ 吞吐不涨，退回', server: '↓ 服务器满，试降', back: '↑ 吞吐下降，回升', errors: '↓ 出错，降低' }
    const hhmmss = (iso) => { const d = new Date(iso); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, '0')).join(':') }

    /**
     * 一个模型服务的并发曲线（同匿名化插件）：实线＋面积＝在途；虚线阶梯＝并发上限（自动调并发会移动它）；
     * 紫线＝吞吐（30 秒窗口内每秒完成的输入＋输出 token，右侧自己的刻度）；轴下方＝插件这边的排队，橙色虚线＝推理服务器自己的排队。
     */
    function ConcPanel({ run, hs, title }) {
      const running = run.status === 'running'
      const slot = hs.slot
      const pts = (run.series ?? []).filter((p) => p.length >= 10)
      const fixed = hs.max
      const limOf = (p) => (p.length >= 22 && p[20 + slot] > 0 ? p[20 + slot] : fixed)
      const empty = pts.length < 2
      const state = run.autoTune?.[slot] ?? null
      const steps = state?.history ?? []
      const last = steps.at(-1)
      const nowLimit = empty ? (state?.limit ?? fixed) : limOf(pts.at(-1))
      const top = Math.max(1, ...pts.map((p) => Math.max(p[2 + slot] ?? 0, limOf(p))))
      const srvQ = (p) => (p.length >= 28 && p[23 + slot * 3] >= 0 ? p[23 + slot * 3] : null)
      const srvSeen = pts.some((p) => srvQ(p) != null)
      const qMax = Math.max(1, ...pts.map((p) => p[4 + slot] ?? 0), ...pts.map((p) => srvQ(p) ?? 0))
      // 吞吐：30 秒窗口
      const thr = pts.map((p, i) => { let j = i; while (j > 0 && p[0] - pts[j - 1][0] <= 30000) j--; const dt = (p[0] - pts[j][0]) / 1000; return dt > 0 ? Math.max(0, (p[8 + slot] - pts[j][8 + slot]) / dt) : 0 })
      const thrMax = Math.max(1, ...thr); const thrNow = thr.at(-1) ?? 0; const thrPeak = Math.max(0, ...thr)
      const W = 300; const H = 72; const AX = 54
      const t1 = pts.at(-1)?.[0] || 1; const t0 = pts[0]?.[0] ?? 0
      const x = (p) => ((p[0] - t0) / Math.max(1, t1 - t0)) * W
      const up = (v) => AX - (Math.min(v, top) / top) * (AX - 3)
      const upT = (v) => AX - (v / thrMax) * (AX - 3)
      const down = (v) => AX + (v / qMax) * (H - AX - 2)
      const line = (pick) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)} ${pick(p, i).toFixed(1)}`).join(' ')
      const stepLine = pts.map((p, i) => (i ? `H${x(p).toFixed(1)} V${up(limOf(p)).toFixed(1)}` : `M0 ${up(limOf(p)).toFixed(1)}`)).join(' ')
      const peakA = Math.max(0, ...pts.map((p) => p[2 + slot] ?? 0)); const peakQ = Math.max(0, ...pts.map((p) => p[4 + slot] ?? 0))
      const lastP = running ? pts.at(-1) : null
      const sv = run.server?.[slot] ?? null
      const auto = run.autoConcurrency && state
      const tone = !state ? 'idle' : last?.reason === 'up' || last?.reason === 'back' ? 'up' : last ? 'full' : 'idle'
      const chip = auto ? (last ? TUNE_CHIP[last.reason] ?? last.reason : `保持 ${state.limit}`) : null
      const history = steps.length ? steps.map((st) => `${hhmmss(st.at)}  ${st.from}→${st.to}  ${TUNE_REASON[st.reason] ?? st.reason}（吞吐 ${fmtTok(st.thr)} token/秒）`).join('\n') : ''
      const path = state ? [state.start, ...steps.map((st) => st.to)].slice(-7).join('→') : String(fixed)
      return h('div', { className: 'me-conc2', title: `${auto ? '自动调并发：每 30 秒看一次吞吐，只在名额跑满的窗口下结论；加并发吞吐涨 5% 才保留，服务器满时试降一档、吞吐不变才保留，出错降低。' : '并发固定（设置里关了自动调并发）。'}${history ? `\n\n${history}` : ''}` },
        h('div', { className: 'me-conc2-h' },
          h('b', {}, title),
          h('span', {}, '并发 ', h('em', {}, String(nowLimit))),
          thr.some(Boolean) ? h('span', { className: 'thr' }, '吞吐 ', h('em', {}, fmtTok(running ? thrNow : thrPeak)), running ? '' : ' 峰值') : null,
          chip ? h('span', { className: `me-conc2-chip ${tone}` }, chip) : null),
        h('div', { className: 'me-conc2-plot' },
          h('div', { className: 'gut', 'aria-hidden': 'true' }, h('span', {}, String(top)), h('span', { className: 'z' }, '0'), h('span', {}, '排队')),
          h('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': `${title} 并发` },
            empty ? null : h('path', { className: 'fa', d: `${line((p) => up(p[2 + slot] ?? 0))} L${W} ${AX} L0 ${AX} Z` }),
            empty ? null : h('path', { className: 'q', d: line((p) => down(p[4 + slot] ?? 0)) }),
            srvSeen ? h('path', { className: 'sq', d: line((p) => down(srvQ(p) ?? 0)) }) : null,
            h('line', { className: 'ax', x1: 0, x2: W, y1: AX, y2: AX }),
            empty ? h('line', { className: 'lim', x1: 0, x2: W, y1: up(nowLimit), y2: up(nowLimit) }) : h('path', { className: 'lim', d: stepLine }),
            thr.length > 1 ? h('path', { className: 'tl', d: line((p, i) => upT(thr[i])) }) : null,
            empty ? null : h('path', { className: 'al', d: line((p) => up(p[2 + slot] ?? 0)) })),
          h('div', { className: 'rg', 'aria-hidden': 'true' }, thr.some(Boolean) ? h('span', {}, fmtTok(thrMax)) : null),
          empty ? h('span', { className: 'wait' }, running ? '采样中…' : '这个批次没有并发记录（旧版本跑的或太短）') : null),
        sv?.available === true
          ? h('div', { className: 'me-conc2-srv', title: '推理服务器自己的指标（vLLM /metrics，含其他客户端的请求）：在跑＝服务器正在计算的请求数，排队＝服务器内部等待的请求数，KV＝KV 缓存占用。结束后显示峰值。' },
            h('span', { className: 'k' }, '服务器'),
            running ? `在跑 ${sv.running ?? 0} · 排队 ${sv.waiting ?? 0} · KV ${Math.round((sv.kv ?? 0) * 100)}%${sv.genRate != null ? ` · 生成 ${fmtTok(sv.genRate)}/秒` : ''}（整台）` : `峰值 在跑 ${sv.peakRunning ?? 0} · 排队 ${sv.peakWaiting ?? 0} · KV ${Math.round((sv.peakKv ?? 0) * 100)}%（整台）`)
          : sv?.available === false ? h('div', { className: 'me-conc2-srv', title: '读不到服务器的 /metrics（不是 vLLM、没开放或要认证），只能看插件这边的数字。' }, h('span', { className: 'k' }, '服务器'), '读不到指标') : null,
        h('div', { className: 'me-conc2-f' },
          h('span', { className: 'mono' }, auto ? path : `固定 ${fixed}`),
          lastP ? h('span', {}, `现在 在途 ${lastP[2 + slot]} · 排队 ${lastP[4 + slot]}`) : empty ? null : h('span', {}, `峰值 在途 ${peakA} · 排队 ${peakQ}`)))
    }

    function Overview({ run, goto, onSel, stations }) {
      const t = run.totals
      const legacy = !run.version
      const houses = modelHousesOf(run).filter((x) => x.model)
      const aggs = houses.map(houseAgg)
      const sum = (k) => aggs.reduce((a, x) => a + (x[k] ?? 0), 0)
      const tot = (k) => aggs.reduce((x, y) => x + (y[k] ?? 0), 0)
      const block = (title, cap, body, aside) => h('div', { className: 'me-ob' }, h('div', { className: 'me-ob-h' }, h('b', {}, title), h('span', { className: 'me-cap' }, cap), h('span', { className: 'me-sp' }), aside ?? null), h('div', { className: 'me-ob-b' }, body))
      const roleOf = (hs) => (hs.roles.includes('extract') && hs.roles.includes('verify') ? '通读·核验' : hs.roles.includes('extract') ? '通读' : '核验')
      const A = t.agreement ?? {}; const an = Object.values(A).reduce((x, y) => x + (y.n ?? 0), 0); const aa = Object.values(A).reduce((x, y) => x + (y.agree ?? 0), 0)
      const cols = houses.length
      const cell = (hi, v, cls) => h('b', { key: hi, className: cls }, v)
      const rows = [
        ['调用', (a) => fmt(a.calls), '实际发给模型的调用（不含缓存复用），格式识别、通读、核验、复查合计'],
        ['失败率', (a) => (a.calls ? h('span', { className: a.failed ? 'me-bad' : '' }, `${((a.failed / a.calls) * 100).toFixed(a.failed && a.failed / a.calls < 0.1 ? 1 : 0)}%`, a.retries ? h('small', { className: 'me-warn' }, ` ↻${fmt(a.retries)}`) : null) : '—'), '重试后仍失败的调用占比；↻＝断线、超时、429／5xx 自动重试的次数'],
        ['耗时分布', (a) => { const mx = Math.max(1, ...a.hist); return a.calls ? h('div', { className: 'me-lat', title: a.hist.map((n, i) => `${LAT_LABELS[i]}s：${n}`).join('\n') }, h('div', { className: 'bars' }, a.hist.map((n, i) => h('i', { key: i, className: i >= 5 && n ? 'slow' : '', style: { height: `${Math.max(n ? 6 : 2, (n / mx) * 100)}%` } }))), h('div', { className: 'lbl' }, LAT_LABELS.map((x) => h('span', { key: x }, x)))) : '—' }, '每次调用的耗时（秒），8 秒以上标红'],
        ['上下文 均/最大', (a) => (a.calls ? `${kfmt(a.pt / a.calls)} / ${a.ptMax ? kfmt(a.ptMax) : '—'}` : '—'), '每次调用的输入 token'],
        ['每次 输出/耗时', (a) => (a.calls ? `${fmt(Math.round(a.ct / a.calls))} / ${(a.ms / a.calls / 1000).toFixed(1)}s` : '—'), '每次调用平均输出 token 与平均耗时'],
      ]
      return h('div', { className: 'me-frame me-side me-ov' },
        h('div', { className: 'me-side-h' }, h('b', {}, '批次概览'), h('span', { className: 'me-cap' }, 'BATCH OVERVIEW')),
        block('模型用量', 'WORKLOAD', t.units ? h(React.Fragment, {},
          h('div', { className: 'me-stack', style: { height: 8 } }, [[t.unique, 'var(--teal)'], [Math.max(0, t.units - t.unique), 'var(--ok)']].map(([n, c], i) => (n ? h('span', { key: i, style: { width: `${(n / t.units) * 100}%`, background: c } }) : null))),
          h('div', { className: 'me-legend me-lg1' }, [['要问的句子', t.unique, 'var(--teal)', '去重后的句子单位：每句通读一次（命中缓存的不再发）'], ['重复句', Math.max(0, t.units - t.unique), 'var(--ok)', '同一句（同记录类型、同栏目）在别的文书、别的病人里又出现：直接用同一个答案']].map(([k, n, c, tip]) => h('span', { key: k, title: tip }, h('i', { style: { background: c } }), `${k} ${kfmt(n)}`))),
          h('div', { className: 'me-ob-kv' },
            h('div', {}, h('span', {}, '调用'), h('b', {}, fmt(tot('calls')))),
            h('div', {}, h('span', {}, '复用'), h('b', {}, fmt(tot('cached')))),
            h('div', {}, h('span', {}, 'Token'), h('b', {}, kfmt(tot('pt') + tot('ct'))))))
          : h('p', { className: 'me-snote' }, legacy ? '这个批次是旧版本跑的（规则为主），没有通读统计' : '还没有调用模型')),
        block('模型表现', 'MODELS', cols ? h('div', { className: 'me-ob-models', style: { gridTemplateColumns: `86px repeat(${cols}, minmax(0,1fr))` } },
          h('span', {}), ...houses.map((hs, hi) => h('button', { key: hi, type: 'button', className: 'me-ob-mh', title: `${hs.model}（${hs.roleText}）：点开看这个模型`, onClick: () => onSel(8 + modelHousesOf(run).findIndex((x) => x.slot === hs.slot)) }, h('b', {}, roleOf(hs)), h('small', {}, h('i', { className: aggs[hi].calls && aggs[hi].failed / aggs[hi].calls > 0.05 ? 'bad' : '' }), hs.model))),
          ...rows.flatMap(([label, val, tip], ri) => [h('span', { key: `l${ri}`, title: tip, className: ri % 2 ? 'z' : '' }, label), ...aggs.map((a, hi) => cell(`${ri}-${hi}`, val(a), ri % 2 ? 'z' : ''))]))
          : h('p', { className: 'me-snote' }, '还没有模型调用'), h('button', { className: 'me-link', onClick: () => goto('calls') }, '明细 →')),
        block('并发调度', 'CONCURRENCY', h(React.Fragment, {},
          h('div', { className: 'me-legend me-conc2-lg' }, h('span', {}, h('i', { className: 'ln in' }), '在途'), h('span', {}, h('i', { className: 'ln lim' }), '上限'), h('span', {}, h('i', { className: 'ln tp' }), '吞吐'), h('span', {}, h('i', { className: 'ln q' }), '排队'), h('span', { title: '推理服务器自己的排队（vLLM /metrics，整台服务器），画在轴下方与插件排队对照；读不到服务器指标时不画' }, h('i', { className: 'ln sq' }), '服务器排队')),
          houses.map((hs) => h(ConcPanel, { key: hs.slot, run, hs, title: roleOf(hs) })),
          !cols ? h('p', { className: 'me-snote' }, '还没有模型') : null)),
        block('核验与复核', 'CROSS-CHECK', h(React.Fragment, {},
          h('p', { className: 'me-snote' }, run.model?.verifyModel ? `抽查 ${fmt(t.sampled ?? 0)} 句 · 复查前一致 ${an ? pct(aa / an) : '—'} · 分歧 ${fmt(t.disputes ?? 0)}` : '未配置核验模型，不做抽样核验'),
          t.disputes ? h('p', { className: 'me-snote' }, `复查后一致 ${fmt(t.resolved ?? 0)}（至多 ${run.maxRounds ?? 3} 轮）· 规则第三票 ${fmt(t.byRule ?? 0)} · 转人工 ${fmt(t.human ?? 0)}`) : null,
          t.ruleCompare?.matched ? h('p', { className: 'me-snote' }, `规则对照：大类一致 ${pct(t.ruleCompare.type / t.ruleCompare.matched)} · 发生时间一致 ${t.ruleCompare.timeComparable ? pct(t.ruleCompare.time / t.ruleCompare.timeComparable) : '—'}`) : null,
          h('p', { className: 'me-snote' }, `待人工复核 ${fmt(t.review)} 项`)),
          h('button', { className: 'me-link', onClick: () => goto('source') }, '去复核 →')))
    }

    /** 模型房子的面板：一个模型服务的负载、并发、耗时与按工序拆的调用 */
    function ModelPanel({ run, house: hs, goto, onBack }) {
      const calls = useAsync(() => call('calls', { runId: run.id }).catch(() => null), [run.id, hs?.total ?? 0])
      if (!hs) return h('div', { className: 'me-frame me-side' }, h('p', { className: 'me-snote' }, '没有这个模型'))
      const running = run.status === 'running'
      const series = run.series ?? []
      const last = running ? series.filter((p) => p.length >= 18).at(-1) : null
      const inflight = last ? last[2 + hs.slot] : 0; const waiting = last ? last[4 + hs.slot] : 0
      const lim = Math.max(1, last?.length >= 22 && last[20 + hs.slot] > 0 ? last[20 + hs.slot] : run.autoTune?.[hs.slot]?.limit ?? hs.max)
      const tune = run.autoTune?.[hs.slot]
      const P0 = { calls: 0, cached: 0, failed: 0, retries: 0, ms: 0, pt: 0, ct: 0, ptMax: 0, hist: [0, 0, 0, 0, 0, 0, 0] }
      const agg = hs.perf.reduce((a, [, , p]) => { for (const k of ['calls', 'cached', 'failed', 'retries', 'ms', 'pt', 'ct']) a[k] += p[k] ?? 0; a.ptMax = Math.max(a.ptMax, p.ptMax ?? 0); a.hist = a.hist.map((x, i) => x + (p.hist?.[i] ?? 0)); return a }, { ...P0, hist: [...P0.hist] })
      const byStation = {}
      for (const [, st, p] of hs.perf) { const x = (byStation[st] ??= { calls: 0, cached: 0, failed: 0 }); x.calls += p.calls ?? 0; x.cached += p.cached ?? 0; x.failed += p.failed ?? 0 }
      const ps = series.filter((p) => p.length >= 10); let peak = 0; let peakT = 0
      for (let j = 0; j < ps.length; j++) { peak = Math.max(peak, ps[j][2 + hs.slot]); if (j) { const dt = (ps[j][0] - ps[j - 1][0]) / 1000; if (dt > 0) peakT = Math.max(peakT, (ps[j][8 + hs.slot] - ps[j - 1][8 + hs.slot]) / dt) } }
      const fr = agg.calls ? agg.failed / agg.calls : 0
      const sec = (title, body, aside) => h('div', { key: title, className: 'me-ssec' }, h('div', { className: 'me-ssec-h' }, h('span', {}, title), aside ? h('span', {}, aside) : null), body)
      const kv = (pairs) => h('div', { className: 'me-skv' }, pairs.filter(Boolean).map(([l, v, cls]) => h('div', { key: l }, h('span', {}, l), h('b', { className: `me-num ${cls === 'warn' ? 'me-warn' : cls === 'bad' ? 'me-bad' : ''}` }, v))))
      const errs = (calls.value?.errors ?? []).filter((e) => e.model === hs.model).slice(0, 5)
      const mx = Math.max(1, ...agg.hist)
      return h('div', { className: 'me-frame me-side' },
        h('div', { className: 'me-side-h' }, h('b', { style: { fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: hs.model }, hs.model), h('span', { className: `me-chip ${inflight ? 'w' : 'ok'}` }, running ? (inflight ? '处理中' : '空闲') : '已结束'), h('button', { className: 'me-link me-back', onClick: onBack }, '← 概览')),
        h('p', { className: 'me-sdesc' }, `${hs.roles.includes('extract') && hs.roles.includes('verify') ? '通读模型兼核验模型' : hs.roles.includes('extract') ? '通读模型' : '核验模型'}：用于 ${hs.roleText}`, h('br'), h('span', {}, `端点 ${hs.host || '—'} · 并发 ${run.autoConcurrency ? `自动（起始 ${tune?.start ?? hs.max}，现在 ${lim}${tune?.ceiling ? `，上限 ${tune.ceiling}` : ''}）` : `固定 ${hs.max}`}`)),
        h('div', { className: 'me-shead' },
          h(Ring, { v: running ? inflight / lim : peak / lim, label: running ? `${inflight}／${lim}` : `${peak}／${lim}`, sub: running ? `在途${waiting ? ` · 排队 ${waiting}` : ''}` : '在途峰值', hot: running && waiting > 0 }),
          kv([['调用', fmt(agg.calls)], ['缓存复用', fmt(agg.cached)], ['失败率', agg.calls ? `${(fr * 100).toFixed(fr && fr < 0.1 ? 1 : 0)}%` : '—', fr > 0.02 ? 'bad' : ''], ['自动重试', fmt(agg.retries)], ['Token', kfmt(agg.pt + agg.ct)], ['吞吐峰值', `${kfmt(peakT)} token/秒`]])),
        sec('按工序', h('div', { className: 'me-ob-models', style: { gridTemplateColumns: '64px repeat(3, minmax(0,1fr))' } },
          h('span', {}), h('b', {}, '调用'), h('b', {}, '缓存'), h('b', {}, '失败'),
          ...hs.stations.filter((st) => st !== 'format' || hs.didFormat).flatMap((st) => { const x = byStation[st] ?? { calls: 0, cached: 0, failed: 0 }; return [h('span', { key: `${st}n` }, STATION_LABEL[st]), h('b', { key: `${st}c` }, fmt(x.calls)), h('b', { key: `${st}k` }, fmt(x.cached)), h('b', { key: `${st}f`, className: x.failed ? 'me-bad' : '' }, fmt(x.failed))] }))),
        sec('并发', h(ConcPanel, { run, hs, title: '' })),
        sec('每次调用', h(React.Fragment, {},
          kv([['耗时 均', agg.calls ? `${(agg.ms / agg.calls / 1000).toFixed(1)}s` : '—'], ['输出 均', agg.calls ? `${fmt(Math.round(agg.ct / agg.calls))} token` : '—'], ['上下文 均', agg.calls ? kfmt(agg.pt / agg.calls) : '—'], ['上下文 最大', agg.ptMax ? kfmt(agg.ptMax) : '—']]),
          h('div', { className: 'me-lat', style: { marginTop: 6 }, title: agg.hist.map((n, i) => `${LAT_LABELS[i]}s：${n}`).join('\n') }, h('div', { className: 'bars', style: { height: 44 } }, agg.hist.map((n, i) => h('i', { key: i, className: i >= 5 && n ? 'slow' : '', style: { height: `${Math.max(n ? 6 : 2, (n / mx) * 100)}%` } }))), h('div', { className: 'lbl' }, LAT_LABELS.map((x) => h('span', { key: x }, `${x}s`))))), '耗时分布'),
        errs.length ? sec('最近的失败', h('ul', { className: 'me-slist' }, errs.map((e, i) => h('li', { key: i, title: e.error }, `${fmtTime(e.at)} · ${String(e.error).slice(0, 60)}`)))) : null,
        h('button', { className: 'me-btn me-saction', onClick: () => goto('calls') }, '模型调用明细 →'))
    }

    /* 每道工序：做什么 → 产出什么（引擎的通用工序说明，不含病种内容） */
    /** 面板顶部的一句话；完整说明（STEP_HELP）放在悬停提示里 */
    const STEP_SHORT = {
      R: '三层规则包：数据源层、通用医学层、专科层',
      S01: '识别格式，读入记录，切成片段并挂可见时间',
      S02a: '文书按栏目切句，同一句只问一次模型',
      S02: '通读模型拆提及、判类型、找时间短语',
      S02v: '核验模型抽查同样的句子，分歧复查后转人工',
      S03: '规则在同一处再抽一次作对照，推出属性',
      S04: '同一件事归并成事件，登记记录之间的冲突',
      S07: '写出事件包与导出视图，核对源文件没有被改动',
    }
    const STEP_HELP = {
      R: ['规则包分三层：数据源层（平台字段、文书类型与栏目、作废标记、时间字段陷阱）、通用医学层（症状、检验别名、药名归一、类型规则）、专科层（可选，如血透）。规则写「认什么」，引擎写「怎么做」', '下发给每道工序的规则与词表'],
      S01: ['区域平台导出直接读；其他导出先过格式识别（按表起草读法，两个模型一致才采用）。记录切成片段，挂可见时间（写成时间）与就诊；剔除作废记录，处理迁移时间、补充诊断段、第二版入院记录、计费周期“住院”等陷阱；截至时刻以后写成的不读', '片段（文书段落与结构化记录）'],
      S02a: ['文书按栏目切成句子单位（叙述栏目带上一句作上文）；宣教、医嘱模板句标出来；同一句（同记录类型、同栏目）跨文书、跨病人只问一次', '句子单位'],
      S02: ['通读模型逐句拆成提及（并列项按顿号拆开、修饰继承），给类型代码、否定、动作，并抄出管这件事的时间短语；插件只信原文片段、自己定位，日期由代码换算；结构化记录不走模型', '提及：每条带原文起止、两个时间、类型与出处'],
      S02v: ['核验模型对抽到的句子逐条审通读结果（是不是提及、边界对不对），背靠背给类型和时间，补漏掉的；不一致的两个模型轮流复查（看对方答案与理由，坚持或改），任一步一致即采用；仍不一致的转人工（hybrid 模式下规则先投第三票）', '一致率与复核单'],
      S03: ['hybrid 模式：规则按规则包在同一处再抽一次，模型没覆盖的有意义文字用规则补上；模型已判定的类型直接采用，其余属性（模板化、时间性质、动作、执行状态、确定程度、依从）由规则推出', '带完整属性的提及；与规则的一致率'],
      S04: ['七级归并规则把同一件事的提及归成事件（概念归一、用药片段）；前后印证只连不并；矛盾判断 R1–R10 登记七类发现，按来源可信度给建议采信，需人工确认的进复核', '事件、印证关系、发现'],
      S07: ['每位病人写出事件包（manifest、片段、提及、事件、发现、复核项）和导出视图（用药暴露区间、检验长表、抽取训练样本），多位病人另出整批汇总表；再只读核对源文件', '交付目录 output/<输入名>'],
    }

    function StationPanel({ run, s, goto, onBack }) {
      const t = run.totals ?? {}
      const [copied, setCopied] = useState(false)
      const id = s.no
      const [what, out] = STEP_HELP[id] ?? ['', '']
      const hot = s.state === 'run' || s.state === 'hold'
      const stateCls = hot ? 'w' : s.state === 'done' ? 'ok' : ''
      const gate = (g) => run.gates?.find((x) => x.id === g)
      const sec = (title, body, aside) => h('div', { key: title, className: 'me-ssec' }, h('div', { className: 'me-ssec-h' }, h('span', {}, title), aside ? h('span', {}, aside) : null), body)
      const note = (text) => h('p', { className: 'me-snote' }, text)
      const gateLine = (g, label) => {
        const x = gate(g)
        const txt = !x ? '—' : x.skipped ? '跳过' : x.pass ? '通过' : '未过'
        return sec(`质检${g} · ${x?.label ?? label}`, x?.detail ? note(x.detail) : null, h('b', { className: x && !x.skipped ? (x.pass ? 'me-ok' : 'me-warn') : '' }, txt))
      }
      const kv = (pairs) => h('div', { className: 'me-skv' }, pairs.filter(Boolean).map(([l, v, cls]) => h('div', { key: l }, h('span', {}, l), h('b', { className: `me-num ${cls === 'ok' ? 'me-ok' : cls === 'warn' ? 'me-warn' : ''}` }, v))))
      const sh = run.shards ?? { done: 0, total: 0 }
      const running = run.status === 'running'
      const progRing = h(Ring, { v: s.frac, label: `${Math.round((s.frac ?? 0) * 100)}%`, sub: `${fmt(sh.done)} / ${fmt(sh.total)} 数据块`, hot })
      const P = run.patients ?? []
      const done = P.filter((p) => p.status === 'done')
      const sumOf = (fn) => done.reduce((a, p) => a + (fn(p) ?? 0), 0)
      const A = t.agreement ?? {}
      let ring = null; let stats = []; const parts = []; let action = null
      if (id === 'R') {
        const spec = [].concat(run.specialty ?? [])
        ring = h(Ring, { v: 1, label: String(spec.length + 2), sub: '层规则包' })
        stats = [['数据源层', run.format?.kind === 'recognized' ? `自动识别 ${run.format.id ?? ''}` : '区域平台导出'], ['通用医学层', 'general'], ['专科层', spec.join('、') || '未装（照样能跑）'], ['模式', modeLabel(run.mode)]]
        const types = {}
        for (const p of done) for (const [k, n] of Object.entries(p.types ?? {})) types[k] = (types[k] ?? 0) + n
        if (Object.keys(types).length) parts.push(sec('提及类型', h(Split, { parts: [['事实', types['事实'] ?? 0, 'var(--fact)'], ['判断', types['判断'] ?? 0, 'var(--judge)'], ['决策', types['决策'] ?? 0, 'var(--decide)']] })))
        action = ['查看规则包', 'rules']
      } else if (id === 'S01') {
        ring = running ? progRing : h(Ring, { v: t.patients ? t.done / t.patients : 0, label: `${fmt(t.done)}/${fmt(t.patients)}`, sub: '病人处理完成', hot: Boolean(t.failed) })
        stats = [['文书', big(t.documents)], ['片段', big(sumOf((p) => p.counts?.fragments))], ['病人', fmt(t.patients)], ['出错跳过', fmt(t.failed ?? 0), t.failed ? 'warn' : '']]
        if (run.format?.kind === 'recognized') {
          parts.push(sec('格式识别', h(Split, { parts: [['采用', run.format.adopted ?? 0, 'var(--teal)'], ['待确认', run.format.held ?? 0, 'var(--warn)'], ['跳过', run.format.ignored ?? 0, 'var(--line2)']] }), `${fmt(run.format.tables ?? 0)} 张表`))
          if (run.format.adjudicated) parts.push(note(`复查后一致 ${fmt(run.format.adjudicated)} 张（两个模型各自起草，有分歧的先复查）`))
          if (run.format.held) action = [`去确认 ${run.format.held} 张表`, 'formats']
        } else parts.push(note('内置格式：区域平台导出（p_doc_*，按月分文件）'))
        const failed = P.filter((p) => p.status === 'failed')
        if (failed.length) parts.push(sec('出错的病人', h('ul', { className: 'me-slist' }, failed.slice(0, 5).map((p) => h('li', { key: p.patient, title: p.error }, `${p.patient}：${String(p.error ?? '').slice(0, 60)}`))), h('button', { className: 'me-link', onClick: () => goto('files') }, '文件页 →')))
      } else if (id === 'S02a') {
        ring = running || !t.units ? progRing : h(Ring, { v: t.units ? 1 - t.unique / t.units : 0, label: pct(t.units ? 1 - t.unique / t.units : 0), sub: `重复句省下（${big(t.units - t.unique)} 句不再问）` })
        stats = [['句子单位', big(t.units)], ['去重后', big(t.unique)], ['每位病人', done.length ? `${fmt(Math.round(t.units / done.length))} 句` : '—']]
        parts.push(note('同一句（同记录类型、同栏目）跨文书、跨病人只问一次；回答按句子缓存在记录库，各批次复用'))
      } else if (id === 'S02') {
        const C = t.coverage ?? {}
        ring = running || !C.meaningful ? progRing : h(Ring, { v: C.covered / C.meaningful, label: pct(C.covered / C.meaningful), sub: '有意义的字被提及覆盖', hot: C.covered / C.meaningful < 0.85 })
        stats = [['提及', big(t.mentions)], ['通读模型', run.model?.model ?? '—'], ['无效回答（已拦下）', fmt(t.invalid ?? 0), t.invalid ? 'warn' : ''], ['没答出的句子', fmt(t.noAnswer ?? 0), t.noAnswer ? 'warn' : '']]
        const tally = {}
        for (const p of done) for (const [k, v] of Object.entries(p.read?.tally?.['分类'] ?? {})) tally[k] = (tally[k] ?? 0) + v
        if (Object.keys(tally).length) parts.push(sec('类型怎么定的', h(Split, { parts: [['双模型一致', tally['双模型一致'] ?? 0, 'var(--ok)'], ['复查后一致', Object.entries(tally).filter(([k]) => /^复查/.test(k)).reduce((a, [, n]) => a + n, 0), 'var(--teal)'], ['规则第三票', tally['规则第三票'] ?? 0, 'var(--fact)'], ['待人工', tally['待人工'] ?? 0, 'var(--warn)'], ['人工', tally['人工'] ?? 0, 'var(--decide)']] }), '抽查到的句子'))
        parts.push(gateLine('①', '提及与原文逐字一致'))
        if (run.model) action = ['模型调用', 'calls']
      } else if (id === 'S02v') {
        const an = Object.values(A).reduce((a, x) => a + (x.n ?? 0), 0); const aa = Object.values(A).reduce((a, x) => a + (x.agree ?? 0), 0)
        ring = h(Ring, { v: an ? aa / an : 0, label: an ? pct(aa / an) : '—', sub: '核验一致率（复查前）', hot: an > 0 && aa / an < 0.9 })
        stats = [['核验模型', run.model?.verifyModel || '未配置'], ['抽查句子', fmt(t.sampled ?? 0)], ['分歧', fmt(t.disputes ?? 0)], ['待复核', fmt(t.review), t.review ? 'warn' : '']]
        if (an) parts.push(sec('按问题', h(RankBars, { max: 1, rows: ['边界', '分类', '时间'].map((k) => [k, A[k]?.n ? A[k].agree / A[k].n : 0, A[k]?.n ? pct(A[k].agree / A[k].n) : '—', A[k]?.n && A[k].agree / A[k].n < 0.9 ? 'var(--warn)' : null, `${k}：${fmt(A[k]?.agree ?? 0)} / ${fmt(A[k]?.n ?? 0)} 一致`]) }), '复查前'))
        if (t.disputes) {
          const byR = (t.resolvedByRound ?? []).map((n, i) => [i + 1, n]).filter(([, n]) => n)
          parts.push(sec(`复查（至多 ${run.maxRounds ?? 3} 轮）`, h(React.Fragment, {},
            h(Split, { parts: [['复查后一致', t.resolved ?? 0, 'var(--ok)'], ['规则第三票', t.byRule ?? 0, 'var(--fact)'], ['转人工', t.human ?? 0, 'var(--warn)']] }),
            byR.length ? note(byR.map(([r, n]) => `第 ${r} 轮 ${fmt(n)}`).join('，')) : null)))
        }
        parts.push(gateLine('⑤', '抽样核验一致率'))
        action = [t.review ? `去复核 ${fmt(t.review)} 项` : '复核', 'source']
      } else if (id === 'S03') {
        const rc = t.ruleCompare ?? {}
        ring = running || !rc.matched ? progRing : h(Ring, { v: rc.type / rc.matched, label: pct(rc.type / rc.matched), sub: '与规则的大类一致' })
        stats = [['模型提及', big(rc.model)], ['规则提及', big(rc.rule)], ['位置对得上', rc.model ? pct(rc.matched / rc.model) : '—'], ['发生时间一致', rc.timeComparable ? pct(rc.time / rc.timeComparable) : '—'], ['规则补漏', fmt(t.coverage?.filled ?? 0)]]
        if (run.mode === 'model') parts.push(note('model 模式：规则不补漏、不投第三票，只作对照统计'))
        const fb = done.map((p) => p.fallbackRate).filter((x) => x != null)
        if (fb.length) parts.push(gateLine('②', '兜底规则命中率'))
      } else if (id === 'S04') {
        ring = h(Ring, { v: t.mentions ? 1 - t.events / t.mentions : 0, label: big(t.events), sub: `个事件（提及 ${big(t.mentions)}）` })
        stats = [['事件', big(t.events)], ['发现', fmt(t.findings), t.findings ? 'warn' : ''], ['待人工确认的发现', fmt(sumOf((p) => p.review?.findings)), '']]
        const verdicts = {}
        for (const p of done) for (const [k, n] of Object.entries(p.verdicts ?? {})) { const v = k.split('·')[0]; verdicts[v] = (verdicts[v] ?? 0) + n }
        const vs = Object.entries(verdicts).sort((a, b) => b[1] - a[1])
        if (vs.length) parts.push(sec('发现（判定）', h(RankBars, { rows: vs.map(([k, n]) => [k, n, fmt(n), VERDICT_COLOR[k]]) })))
        parts.push(gateLine('③', '每条提及恰属一个事件'), gateLine('④', '每条发现可回溯'))
        action = ['时间线', 'timeline']
      } else if (id === 'S07') {
        ring = run.output ? h(Ring, { v: run.sourceCheck?.changed ? 0.4 : 1, label: fmt(done.length), sub: `个事件包已交付${run.cohort ? ' · 含整批汇总表' : ''}`, hot: Boolean(run.sourceCheck?.changed) }) : h(Ring, { v: 0, label: '—', sub: '未交付' })
        stats = [['源文件核对', run.sourceCheck ? (run.sourceCheck.changed ? `${run.sourceCheck.changed} 个变化` : '一致') : '—', run.sourceCheck ? (run.sourceCheck.changed ? 'warn' : 'ok') : '']]
        if (run.output) parts.push(sec('输出位置', h('div', { className: 'me-spath' }, h('span', { title: run.output }, run.output),
          h('button', { className: 'me-btn sm', onClick: () => { navigator.clipboard?.writeText(run.output).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {}) } }, copied ? '已复制' : '复制'))))
        if (run.output) {
          const files = [['manifest.json', '计数、质检、通读统计'], ['mentions.jsonl.gz', '提及（两个时间、类型、出处）'], ['events.jsonl.gz', '事件'], ['findings.jsonl', '发现（记录之间的冲突）'], ['reviews.jsonl', '复核项与处理情况'], ['exports/', '用药暴露区间、检验长表、抽取样本'], ...(run.cohort ? [['_cohort/', '整批汇总表']] : [])]
          parts.push(sec('每位病人的事件包', h('table', { className: 'me-dtab' }, h('tbody', {}, files.map(([f, d]) => h('tr', { key: f }, h('td', { className: 'me-num', style: { fontSize: 11 } }, f), h('td', { style: { textAlign: 'left', color: 'var(--ink2)' } }, d)))))))
        }
        action = ['报告', 'report']
      }
      return h('div', { className: 'me-frame me-side' },
        h('div', { className: 'me-side-h' }, h('b', {}, s.nm), h('span', { className: `me-chip ${stateCls}` }, STATE_LABEL[s.state]), onBack ? h('button', { className: 'me-link me-back', onClick: onBack }, '← 概览') : null),
        h('p', { className: 'me-sdesc', title: `${what}\n→ ${out}` }, STEP_SHORT[id] ?? what),
        h('div', { className: 'me-shead' }, ring, kv(stats)),
        ...parts,
        action ? h('button', { className: `me-btn me-saction${id === 'S02v' && t.review ? ' me-new' : ''}`, onClick: () => goto(action[1]) }, `${action[0]} →`) : null)
    }

    /** 时长：秒 → 「42 秒」「3 分 05 秒」「1 小时 12 分」 */
    function dur(ms) {
      if (ms == null || !Number.isFinite(ms)) return '—'
      const sec = Math.round(ms / 1000)
      if (sec < 60) return `${sec} 秒`
      if (sec < 3600) return `${Math.floor(sec / 60)} 分 ${String(sec % 60).padStart(2, '0')} 秒`
      return `${Math.floor(sec / 3600)} 小时 ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')} 分`
    }
    /** 时长的大字写法：41 秒 → [41, 秒]；3 分 05 秒 → [3:05, 分]；1 小时 12 分 → [1:12, 时] */
    function clockParts(ms) {
      if (ms == null || !Number.isFinite(ms)) return ['—']
      const sec = Math.round(ms / 1000)
      if (sec < 60) return [String(sec), h('small', { key: 'u' }, '秒')]
      if (sec < 3600) return [`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, h('small', { key: 'u' }, '分')]
      return [`${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`, h('small', { key: 'u' }, '时')]
    }
    const roHead = (title, cap, aside) => h('div', { className: 'me-ro-h' }, h('b', {}, title), h('span', { className: 'me-cap' }, cap), h('span', { className: 'me-sp' }), aside)

    /** 进度曲线：由 run.series［毫秒, 已完成病人］画出 */
    function Spark({ run }) {
      const pts0 = (run.series ?? []).filter((p) => p.length >= 2)
      const W = 260; const H = 40
      const span = pts0.length ? pts0[pts0.length - 1][0] : 0
      const total = Math.max(1, run.totals?.patients ?? 0)
      const has = pts0.length >= 4 && span > 0
      const xy = has ? pts0.map((p) => `${((p[0] / span) * W).toFixed(1)},${(H - 3 - (Math.min(p[1], total) / total) * (H - 8)).toFixed(1)}`) : [`0,${H - 3}`, `${W},${H - 3}`]
      return h('div', { className: 'me-spark', title: has ? '完成的病人数随时间' : '' },
        h('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' },
          [1, 2, 3].map((g) => h('path', { key: g, className: 'grid', d: `M0 ${(H / 4) * g}H${W}` })),
          has ? h('path', { className: 'area', d: `M0 ${H} L${xy.join(' L')} L${W} ${H} Z` }) : null,
          h('polyline', { className: 'line', points: xy.join(' ') })),
        h('div', { className: 'me-spark-foot' }, has ? h(React.Fragment, {}, h('span', {}, '完成的病人'), h('span', {}, `${fmt(run.totals?.done ?? 0)} / ${fmt(run.totals?.patients ?? 0)}`)) : h('span', {}, run.status === 'running' ? '进度曲线：采样中…' : '这个批次没有记录进度（旧版本跑的或太短）')))
    }

    /** 运行进度：完成、用时（运行中为预计剩余）、数据块与病人，进度曲线。 */
    function ProgressPanel({ run }) {
      const t = run.totals ?? {}
      const running = run.status === 'running'
      const sh = run.shards ?? { done: 0, total: 0 }
      const frac = t.patients ? (t.done + (t.failed ?? 0)) / t.patients : sh.total ? sh.done / sh.total : 0
      const elapsed = run.startedAt ? (running ? Date.now() : Date.parse(run.finishedAt ?? run.startedAt)) - Date.parse(run.startedAt) : null
      const doneN = (t.done ?? 0) + (t.failed ?? 0)
      const eta = running && doneN > 0 && t.patients > doneN && elapsed ? (elapsed / doneN) * (t.patients - doneN) : null
      const per = !running && doneN && elapsed ? elapsed / doneN : null
      return h('div', { className: 'me-ro' },
        roHead('运行进度', 'PROGRESS', running ? h('span', { className: 'me-live' }, h('i'), run.current?.step ?? '运行中') : null),
        h('div', { className: 'me-big' },
          h('div', {}, h('span', {}, '完成'), h('b', {}, Math.round(frac * 100), h('small', {}, '%'))),
          h('div', { title: '每位病人平均用时（并行时按墙钟算）' }, h('span', {}, '每位病人'), h('b', {}, ...(per ? clockParts(per) : ['—']))),
          h('div', { title: dur(running ? eta : elapsed) }, h('span', {}, running ? '预计剩余' : '用时'), h('b', {}, ...clockParts(running ? eta : elapsed)))),
        h('div', { className: 'me-kv2' },
          h('p', {}, h('span', {}, '数据块'), h('b', {}, fmt(sh.done), h('small', {}, ` / ${fmt(sh.total)}`))),
          h('p', {}, h('span', {}, '病人'), h('b', {}, fmt(t.done ?? 0), h('small', {}, ` / ${fmt(t.patients ?? 0)}`)), running && Object.keys(run.live ?? {}).length ? h('small', {}, `（处理中 ${Object.keys(run.live).length}）`) : null)),
        h(Spark, { run }))
    }

    /** 处理结果：提及、事件、发现，类型比例条，质检，待复核，交付位置。 */
    function ResultsPanel({ run, stations, onSel, goto }) {
      const t = run.totals ?? {}
      const [copied, setCopied] = useState(false)
      const types = {}
      for (const p of run.patients ?? []) for (const [k, n] of Object.entries(p.types ?? {})) types[k] = (types[k] ?? 0) + n
      const way = [['事实', types['事实'] ?? 0, 'var(--fact)'], ['判断', types['判断'] ?? 0, 'var(--judge)'], ['决策', types['决策'] ?? 0, 'var(--decide)']]
      const sum = way.reduce((a, x) => a + x[1], 0)
      const GATE_AT = { '①': 'S02', '②': 'S03', '③': 'S04', '④': 'S04', '⑤': 'S02v' }
      const tag = run.status === 'review' ? h('span', { className: 'me-chip w' }, '待复核') : run.status === 'failed' ? h('span', { className: 'me-chip b' }, '失败') : run.status === 'cancelled' ? h('span', { className: 'me-chip b' }, '已取消') : null
      return h('div', { className: 'me-ro' },
        roHead('处理结果', 'RESULTS', tag),
        h('div', { className: 'me-big' },
          h('div', {}, h('span', {}, '提及'), h('b', {}, big(t.mentions))),
          h('div', {}, h('span', {}, '事件'), h('b', {}, big(t.events))),
          h('div', {}, h('span', {}, '发现'), h('b', {}, big(t.findings)))),
        h('div', { className: 'me-stack', title: way.map(([k, n]) => `${k} ${fmt(n)}`).join(' · ') }, sum ? way.map(([k, n, c]) => (n ? h('span', { key: k, style: { width: `${(n / sum) * 100}%`, background: c } }) : null)) : null),
        h('div', { className: 'me-ro-line' },
          h('button', { className: `me-link${t.review ? ' me-warn' : ''}`, onClick: () => goto('source') }, '待判断 ', h('b', {}, fmt(t.review))),
          h('span', { className: 'me-gdots' }, '质检', ['①', '②', '③', '④', '⑤'].map((id) => {
            const g = run.gates?.find((x) => x.id === id)
            const cls = !g || g.skipped ? '' : g.pass ? 'ok' : 'bad'
            return h('button', { key: id, className: `me-gdot ${cls}`, title: g ? `${g.label}：${g.pass ? (g.skipped ? '跳过' : '通过') : '未过'}\n${g.detail}` : '尚未质检', onClick: () => onSel(stations.findIndex((s) => s.no === GATE_AT[id])) }, id)
          }))),
        h('div', { className: 'me-ro-line me-types' }, way.filter(([, n]) => n).map(([k, n]) => h('span', { key: k }, k, h('b', {}, sum ? `${Math.round((n / sum) * 100)}%` : '—')))),
        run.output ? h('div', { className: 'me-spath' }, h('span', { title: run.output }, run.output),
          h('button', { className: 'me-btn sm', onClick: () => { navigator.clipboard?.writeText(run.output).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {}) } }, copied ? '已复制' : '复制')) : null)
    }

    /** 资源占用（同匿名化插件）：堆内存、输出盘，进程常驻。圈上的小点是本批峰值。 */
    function ResourcesPanel({ run }) {
      const GB = 1024 ** 3
      const running = run.status === 'running'
      const mem = run.memory; const disk = run.disk
      const gauge = (label, ratio, detail, tone, title, peak) => {
        const r = 23; const len = 2 * Math.PI * r
        const v = ratio == null || !Number.isFinite(ratio) ? null : Math.max(0, Math.min(1, ratio))
        const pk = peak == null || !Number.isFinite(peak) || v == null ? null : Math.max(v, Math.min(1, peak))
        const ang = pk == null ? 0 : pk * 2 * Math.PI - Math.PI / 2
        const color = tone === 'crit' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--teal)'
        return h('div', { className: 'me-gauge', title },
          h('svg', { viewBox: '0 0 58 58' },
            h('circle', { className: 'trk', cx: 29, cy: 29, r }),
            v == null ? null : h('circle', { className: 'arc', cx: 29, cy: 29, r, stroke: color, strokeDasharray: `${(len * v).toFixed(1)} ${len.toFixed(1)}` }),
            pk != null && pk > 0 ? h('circle', { className: 'pk', cx: (29 + r * Math.cos(ang)).toFixed(2), cy: (29 + r * Math.sin(ang)).toFixed(2), r: 3.4 }, h('title', {}, `峰值 ${Math.round(pk * 100)}%`)) : null,
            h('text', { x: 29, y: 33, textAnchor: 'middle' }, v == null ? '—' : `${Math.round(v * 100)}%`)),
          h('span', {}, label), h('small', {}, detail))
      }
      const memRatio = mem?.heapLimit ? (running ? mem.heapUsed : mem.peakHeap) / mem.heapLimit : null
      return h('div', { className: 'me-ro' },
        roHead('资源占用', 'RESOURCES', h('span', { className: 'me-faint', style: { fontSize: 11 } }, '本机')),
        h('div', { className: 'me-gauges' },
          gauge('堆内存', memRatio, mem?.heapLimit ? `${((running ? mem.heapUsed : mem.peakHeap) / GB).toFixed(1)} / ${(mem.heapLimit / GB).toFixed(1)}G` : '—', memRatio >= 0.85 ? 'crit' : memRatio >= 0.7 ? 'warn' : '', '主线程堆内存（结束后显示本批峰值）；数据块在工作线程里处理，计入下方进程常驻', mem?.heapLimit && mem.peakHeap ? mem.peakHeap / mem.heapLimit : null),
          gauge('磁盘', disk?.total ? 1 - disk.free / disk.total : null, disk?.total ? `剩 ${(disk.free / GB).toFixed(disk.free < 10 * GB ? 1 : 0)}G` : '—', disk?.total && disk.free < 5 * GB ? 'crit' : disk?.total && disk.free < 20 * GB ? 'warn' : '', '输出目录所在磁盘；圈上的点是本批最满的时候', disk?.total && Number.isFinite(disk.minFree) ? 1 - disk.minFree / disk.total : null)),
        mem?.peakRss ? h('div', { className: 'me-res-line', title: '整个进程的常驻内存（含工作线程）' }, '进程常驻', h('b', {}, `${((running ? mem.rss ?? mem.peakRss : mem.peakRss) / GB).toFixed(1)}G`), h('span', {}, running ? `峰值 ${(mem.peakRss / GB).toFixed(1)}G` : '峰值'))
          : h('div', { className: 'me-res-line' }, h('span', {}, '这个批次没有记录资源（旧版本跑的），重跑后显示')))
    }

    /* --------------------------------------------------------------- formats */
    const FMT_STATUS = { agreed: ['自动采用', 'ok'], confirmed: ['已确认', 'ok'], disputed: ['有分歧', 'w'], invalid: ['校验未过', 'w'], pending: ['待确认', 'w'], failed: ['调用失败', 'b'], rejected: ['已跳过', ''] }
    const FMT_ORIGIN = { model: '通读模型', verify: '核验模型', rule: '规则', user: '人工' }
    const DRAFT_LABEL = { model: '通读模型的方案', verify: '核验模型的方案', rule: '规则的方案' }
    const FIELD_KIND = { time: '时间', number: '数', code: '代码', text: '短文', long: '长文', embedded: '嵌入文书', pseudonym: '假名' }
    const stripSpec = (s) => { if (!s) return {}; const { origin, accept, ...rest } = s; return rest }
    /** 读法的一句话小结；labels：字段 → 中文名（数据元对照表） */
    function specLine(spec, labels = {}) {
      if (!spec) return '—'
      const nm = (f) => (labels[f] ? `${labels[f]}（${f}）` : f)
      const parts = [spec.recordType ?? '（未定类别）']
      if (spec.written?.length) parts.push(`写成：${spec.written.map(nm).join(' › ')}`)
      if (spec.sections?.length) parts.push(`栏目：${spec.sections.map(([f, n]) => `${n}←${nm(f)}`).join('，')}`)
      const roles = Object.entries(spec.roles ?? {})
      if (roles.length) parts.push(`角色：${roles.map(([r, f]) => `${r}←${[].concat(f).map(nm).join('+')}`).join('，')}`)
      if (spec.measures?.length) parts.push(`测量：${spec.measures.map((m) => m[1]).join('、')}`)
      return parts.join('｜')
    }

    function Formats({ run, busy, onRerun, onError }) {
      const data = useAsync(() => call('formats', { runId: run.id }), [run.id])
      const [sel, setSel] = useState(null)
      // 有待确认的表才默认看待确认，否则看全部（不停在空列表上）
      const [filter, setFilter] = useState(() => ((run.format?.held ?? 0) > 0 ? 'held' : 'all'))
      const [rerunning, setRerunning] = useState(false)
      const rows = data.value?.tables ?? []
      const held = (r) => !['agreed', 'confirmed', 'rejected'].includes(r.status)
      const shown = rows.filter((r) => filter === 'all' || (filter === 'held' ? held(r) : !held(r)))
      const counts = { held: rows.filter(held).length, ok: rows.filter((r) => !held(r)).length, all: rows.length }
      const decide = async (payload) => {
        try { const r = await call('formatDecide', payload); if (r?.ok === false) onError(`没有保存：${r.problems.join('；')}`); data.reload() } catch (e) { onError(msg(e)) }
      }
      const rerun = async () => {
        setRerunning(true)
        try { const v = await call('start', { inputDir: run.input, outputRoot: run.outputRoot, mode: run.mode, maxRounds: run.maxRounds, asOf: run.asOf || undefined }); onRerun(v.runId) } catch (e) { onError(msg(e)) } finally { setRerunning(false) }
      }
      const changed = Boolean(data.value?.changed)
      const current = sel ? rows.find((r) => r.signature === sel) : null
      const policy = '没有用来生成事件'
      return h('div', { style: { display: 'flex', gap: 8, flex: 1, minWidth: 0, minHeight: 0 } },
        h('div', { className: 'me-frame me-col', style: { flex: 1, minWidth: 0 } },
          h('div', { className: 'me-pad', style: { borderBottom: '1px solid var(--line)' } },
            h('div', { className: 'me-h' }, h('b', {}, '格式识别'), h('span', { className: 'me-cap' }, 'FORMAT'),
              h('span', { className: 'me-sp' }),
              h('button', { className: `me-btn ${changed ? 'me-new' : ''}`, disabled: busy || rerunning, title: busy ? '有批次在运行' : '用格式库里的最新结果重新跑这个输入', onClick: rerun }, rerunning ? '启动中…' : '↻ 按确认结果重新运行')),
            h('div', { className: 'me-muted', style: { lineHeight: 1.7 } },
              `${rows.length} 张表：采用 ${run.format?.adopted ?? 0}，待确认 ${run.format?.held ?? 0}${run.format?.held ? `（${policy}）` : ''}，跳过 ${run.format?.ignored ?? 0}${run.format?.dict ? `；数据元对照表 ${fmt(run.format.dict)} 条` : ''}。`),
            h('div', { style: { display: 'flex', gap: 6, marginTop: 8 } },
              [['held', '待确认'], ['ok', '已采用／跳过'], ['all', '全部']].map(([k, l]) => h('button', { key: k, className: `me-btn sm${filter === k ? ' on' : ''}`, onClick: () => setFilter(k) }, `${l} ${counts[k]}`)))),
          h('div', { className: 'me-scroll', style: { flex: 1 } },
            !data.value ? h('div', { className: 'me-empty' }, data.error ?? '加载中…')
              : !shown.length ? h('div', { className: 'me-empty' }, filter === 'held' ? '没有待确认的表。' : '—')
                : h('table', {}, h('thead', {}, h('tr', {}, ['表', '行', '状态', '类别', '依据'].map((x) => h('th', { key: x }, x)))),
                  h('tbody', {}, shown.map((r) => {
                    const [label, cls] = r.scope ? ['本插件内采用', 'ok'] : FMT_STATUS[r.status] ?? [r.status, '']
                    return h('tr', { key: r.signature, className: `click${sel === r.signature ? ' sel' : ''}`, onClick: () => setSel(r.signature) },
                      h('td', { className: 'me-num', style: { maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.table }, r.table),
                      h('td', { className: 'me-num' }, fmt(r.rows)),
                      h('td', {}, h('span', { className: `me-chip ${cls}` }, label)),
                      h('td', { style: { whiteSpace: 'nowrap' } }, r.spec?.recordType ?? r.recordType ?? '—', (r.spec?.origin ?? r.origin) ? h('span', { className: 'me-faint', style: { marginLeft: 6, fontSize: 10.5 } }, FMT_ORIGIN[r.spec?.origin ?? r.origin] ?? '') : null),
                      h('td', { className: 'me-muted', style: { fontSize: 11.5 } }, [r.borrowedFrom ? `沿用${r.borrowedFrom}` : r.reason, ...(r.diffs ?? []), ...(r.problems ?? []).slice(0, 2)].filter(Boolean).join('；') || '—'))
                  }))))),
        h('div', { className: 'me-frame me-scroll me-pad', style: { width: 480, flex: 'none', overflowX: 'hidden' } },
          !current ? h('div', { className: 'me-faint' }, '点左边的一张表，查看识别出的读法和各方方案，并确认、修改或跳过。')
            : h(FormatDetail, { key: current.signature, row: current, recordTypes: data.value?.canon?.recordTypes ?? [], decide })))
    }

    function FormatDetail({ row, recordTypes, decide }) {
      const [editing, setEditing] = useState(false)
      const [text, setText] = useState(() => JSON.stringify(stripSpec(row.spec), null, 1))
      const [jsonErr, setJsonErr] = useState('')
      const [label, cls] = row.scope ? ['本插件内采用', 'ok'] : FMT_STATUS[row.status] ?? [row.status, '']
      const drafts = row.drafts ?? {}
      const labels = Object.fromEntries((row.fields ?? []).filter((f) => f.label).map((f) => [f.name, f.label]))
      return h('div', {},
        h('div', { className: 'me-h' }, h('b', { className: 'me-num', style: { wordBreak: 'break-all' } }, row.table), h('span', { className: `me-chip ${cls}` }, label)),
        h('div', { className: 'me-muted', style: { fontSize: 11.5, marginBottom: 8 } }, `${fmt(row.rows)} 行 · ${row.files} 个文件 · 字段 ${row.fields?.length ?? '—'}（空 ${row.fields?.filter((f) => f.kind === 'empty').length ?? '—'}）`),
        row.reason ? h('div', { className: 'me-mo', style: { wordBreak: 'break-all' } }, row.reason, ...(row.diffs ?? []).map((d, i) => h('div', { key: i }, `· ${d}`)), ...(row.problems ?? []).map((d, i) => h('div', { key: `p${i}`, className: 'me-warn' }, `· ${d}`))) : null,
        
        row.rounds?.length ? h(React.Fragment, {},
          h('div', { className: 'me-sec' }, h('b', {}, '复查经过'), h('span', { className: 'me-cap' }, row.adjudicated ? `第 ${row.adjudicated} 轮一致` : `${row.rounds.length} 轮仍不一致`)),
          row.firstDiffs?.length ? h('div', { className: 'me-faint', style: { fontSize: 11 } }, `起初的分歧：${row.firstDiffs.join('；')}`) : null,
          h('div', { className: 'me-rounds' }, row.rounds.map((rd) => h('div', { key: rd.round, className: 'me-round' },
            h('em', {}, `第 ${rd.round} 轮`),
            h('div', {}, h('small', {}, '通读模型'), h('div', { style: { wordBreak: 'break-all' } }, specLine(rd.extract, labels)), rd.extractReason ? h('div', { className: 'me-why' }, rd.extractReason) : null, rd.extractInvalid ? h('div', { className: 'me-warn', style: { fontSize: 10.5 } }, `改出的读法没过校验，当作坚持：${rd.extractInvalid[0]}`) : null),
            rd.verify ? h('div', {}, h('small', {}, '核验模型'), h('div', { style: { wordBreak: 'break-all' } }, specLine(rd.verify, labels)), rd.verifyReason ? h('div', { className: 'me-why' }, rd.verifyReason) : null, rd.verifyInvalid ? h('div', { className: 'me-warn', style: { fontSize: 10.5 } }, `改出的读法没过校验，当作坚持：${rd.verifyInvalid[0]}`) : null) : h('div', { className: 'me-faint' }, rd.extract ? '（对照规则的方案，只复查 1 轮）' : ''))))) : null,
        h('div', { className: 'me-sec' }, h('b', {}, '当前读法'), h('span', { className: 'me-cap' }, FMT_ORIGIN[row.spec?.origin] ?? '')),
        h('div', { style: { fontSize: 12, lineHeight: 1.7, wordBreak: 'break-all' } }, specLine(row.spec, labels)),
        row.spec?.note ? h('div', { className: 'me-faint', style: { fontSize: 11, marginTop: 4 } }, `依据：${row.spec.note}`) : null,
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 } },
          h('button', { className: 'me-btn me-new', onClick: () => decide({ signature: row.signature, action: 'confirm' }) }, '✓ 采用当前读法'),
          h('button', { className: 'me-btn', onClick: () => decide({ signature: row.signature, action: 'reject' }) }, '跳过这张表'),
          h('button', { className: 'me-btn', title: '从格式库删掉，下次运行重新起草', onClick: () => decide({ signature: row.signature, action: 'reset' }) }, '重新起草'),
          h('button', { className: `me-btn${editing ? ' on' : ''}`, onClick: () => setEditing(!editing) }, '编辑…')),
        editing ? h('div', { style: { marginTop: 8 } },
          h('textarea', { className: 'me-json', style: { minHeight: 260 }, value: text, onChange: (e) => setText(e.target.value), spellCheck: false }),
          h('div', { className: 'me-faint', style: { fontSize: 10.5, margin: '4px 0 6px' } }, `类别：${recordTypes.join('、')}。字段名必须是这张表里有的；保存时插件会校验。`),
          jsonErr ? h('div', { className: 'me-err', style: { marginBottom: 6 } }, jsonErr) : null,
          h('button', { className: 'me-btn me-new', onClick: () => { let spec; try { spec = JSON.parse(text) } catch (e) { return setJsonErr(`不是合法的 JSON：${msg(e)}`) } setJsonErr(''); decide({ signature: row.signature, action: 'confirm', spec }) } }, '校验并确认')) : null,
        Object.keys(drafts).length ? h(React.Fragment, {},
          h('div', { className: 'me-sec' }, h('b', {}, '各方方案'), h('span', { className: 'me-cap' }, 'DRAFTS')),
          Object.entries(DRAFT_LABEL).filter(([k]) => drafts[k]).map(([k, l]) => h('div', { key: k, className: 'me-mrow' },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } }, h('b', { style: { fontSize: 12 } }, l), h('span', { className: 'me-sp' }),
              h('button', { className: 'me-btn sm', onClick: () => decide({ signature: row.signature, action: 'confirm', use: k }) }, '采用这份')),
            h('div', { className: 'me-muted', style: { marginTop: 3, wordBreak: 'break-all' } }, specLine(drafts[k], labels))))) : null,
        row.fields?.length ? h(React.Fragment, {},
          h('div', { className: 'me-sec' }, h('b', {}, '字段'), h('span', { className: 'me-cap' }, 'FIELDS')),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } }, row.fields.filter((f) => f.kind !== 'empty').map((f) => h('span', { key: f.name, className: 'me-chip', title: `${f.kind} · 填充 ${f.fill}%` }, `${f.label ? `${f.label}·` : ''}${f.name}·${FIELD_KIND[f.kind] ?? f.kind}`)))) : null)
    }

    /* ------------------------------------------------------------- rulepack */
    /**
     * 规则包页：上半部三块图——三层结构（每层管哪些工序、各多少条）、这一批规则实际干了多少（补漏、第三票、
     * 与模型的一致率、类型规则与概念的命中排行）、点一条规则看命中的例子；下半部是原来的明细表。
     */
    const LAYER_INFO = {
      source: { nm: '数据源层', tip: '换医院、换平台时改这一层', does: ['读入·片段', '切句'], what: ['表', 'tables'], items: [['表', 'tables'], ['文书栏目', 'sections'], ['噪声行', 'noise']] },
      general: { nm: '通用医学层', tip: '与病种无关：类型规则、常见概念、归并与矛盾判断参数', does: ['类型·对照', '归并', '矛盾判断'], items: [['类型规则', 'classify'], ['概念', 'concepts'], ['词表正则', 'vocab'], ['上位概念', 'hypernyms'], ['参数', 'params']] },
      specialty: { nm: '专科层', tip: '可选；换病种时改这一层。不装也能跑，只是专科概念归不了一', does: ['类型·对照', '归并', '矛盾判断'], items: [['类型规则', 'classify'], ['概念', 'concepts'], ['词表正则', 'vocab'], ['互斥组', 'exclusive'], ['候选同义', 'candidateSynonyms']] },
    }
    const EXTRACT_NM = { model: '模型通读', STRUCT: '结构化记录', 规则补漏: '规则补漏', manual: '人工补充' }
    function Rules({ run }) {
      const d = useAsync(() => call('rulepack', { specialty: run?.specialty, runId: run?.id }), [run?.id])
      const [view, setView] = useState('taxonomy')
      const [pick, setPick] = useState(null) // { kind, id, label }
      const ex = useAsync(() => (pick && run ? call('ruleExamples', { runId: run.id, kind: pick.kind, id: pick.id, limit: 8 }) : null), [run?.id, pick?.kind, pick?.id])
      const v = d.value
      if (!v) return h('div', { className: 'me-frame me-empty', style: { flex: 1 } }, d.error ?? '加载中…')
      const groups = {}
      for (const c of v.concepts) (groups[c.group] ??= []).push(c)
      const U = run?.ruleUse ?? null
      const T = run?.totals ?? {}
      const sum = (o) => Object.values(o ?? {}).reduce((a, n) => a + n, 0)
      const ruleById = new Map(v.classify.map((r) => [r.id, r]))
      const layerOfConcept = new Map(v.concepts.map((c) => [`${c.group}\u0000${c.name}`, c.layer]))
      const layers = v.layers.map((l) => ({ ...l, info: LAYER_INFO[l.layer] ?? { nm: l.layer, does: [], items: [] } }))
      // 每层这一批实际命中：类型规则命中次数、概念（按事件）
      const hitsOf = (l) => {
        if (!U) return null
        if (l.layer === 'source') return { main: sum(U.extract) - (U.extract?.model ?? 0) - (U.extract?.manual ?? 0), label: '条提及由规则抽出（结构化、补漏、无栏目配置）' }
        const cls = Object.entries(U.classify ?? {}).filter(([id]) => ruleById.get(id)?.layer === l.id).reduce((a, [, n]) => a + n, 0)
        const con = Object.entries(U.concepts ?? {}).filter(([k]) => layerOfConcept.get(k) === l.id).reduce((a, [, n]) => a + n, 0)
        return { main: cls + con, label: `次命中（类型规则 ${fmt(cls)} · 概念归一 ${fmt(con)} 个事件）` }
      }
      const STAGES = ['读入·片段', '切句', '通读', '类型·对照', '归并', '矛盾判断']
      const layerCard = (l, i) => {
        const hit = hitsOf(l)
        return h('div', { key: l.id, className: `me-rl-layer l-${l.layer}` },
          h('div', { className: 'me-rl-lh' }, h('em', {}, String(i + 1)), h('b', {}, l.info.nm), h('span', { className: 'me-num' }, `${l.id} v${l.version}`)),
          h('div', { className: 'me-faint', style: { fontSize: 11 } }, l.layer === 'source' && run?.format?.kind === 'recognized' ? '由格式识别组装（每张表两个模型起草、一致才采用）' : l.info.tip),
          h('div', { className: 'me-rl-items' }, l.info.items.filter(([, k]) => l.counts?.[k]).map(([nm, k]) => h('span', { key: k }, h('b', { className: 'me-num' }, fmt(l.counts[k])), nm))),
          hit ? h('div', { className: 'me-rl-hit' }, h('b', { className: 'me-num' }, big(hit.main)), h('span', {}, hit.label)) : null,
          l.basedOn ? h('div', { className: 'me-faint', style: { fontSize: 10.5, marginTop: 4 } }, `基于 ${Object.entries(l.basedOn).map(([k, x]) => `${k} ${x}`).join(' · ')}`) : null)
      }
      // 三层 → 工序：哪层管哪道工序（通读由模型做，规则只对照）
      const flow = h('div', { className: 'me-rl-flow' },
        STAGES.map((st) => {
          const by = layers.filter((l) => l.info.does.includes(st))
          return h('div', { key: st, className: `me-rl-st${st === '通读' ? ' model' : ''}` }, h('b', {}, st),
            h('div', {}, st === '通读' ? h('span', { className: 'me-chip v' }, '模型') : null, by.map((l) => h('span', { key: l.id, className: `me-rl-dot l-${l.layer}`, title: l.info.nm }, l.info.nm.slice(0, 2)))),
            st === '通读' ? h('small', {}, run?.mode === 'model' ? '规则只作对照统计' : '规则补漏、投第三票') : null)
        }))
      // 这一批：规则在通读里的作用
      const rc = T.ruleCompare ?? {}
      const cov = T.coverage ?? {}
      const fb = sum(Object.fromEntries(Object.entries(U?.classify ?? {}).filter(([id]) => ruleById.get(id)?.fallback)))
      const ruleTyped = sum(U?.classify) - (U?.classify?.model ?? 0)
      const kpi = (label, val, sub, tone) => h('div', { className: 'me-rl-kpi' }, h('span', {}, label), h('b', { className: `me-num${tone ? ` me-${tone}` : ''}` }, val), sub ? h('small', {}, sub) : null)
      const usage = !U ? h('p', { className: 'me-snote' }, run ? '这个批次没有记录规则用量（旧版本跑的或还没跑完），重跑后显示' : '还没有批次') : h(React.Fragment, {},
        h('div', { className: 'me-rl-kpis' },
          kpi('与模型大类一致', rc.matched ? pct(rc.type / rc.matched) : '—', rc.matched ? `${fmt(rc.matched)} 条位置对得上` : '没有可比的提及'),
          kpi('发生时间一致', rc.timeComparable ? pct(rc.time / rc.timeComparable) : '—'),
          kpi('规则补漏', fmt(cov.filled ?? 0), '模型漏掉、规则补上的提及', cov.filled ? null : null),
          kpi('规则第三票', fmt(T.byRule ?? 0), '复查仍不一致时由规则定'),
          kpi('规则定类型', fmt(ruleTyped), `兜底 ${fmt(fb)}（${ruleTyped ? pct(fb / ruleTyped) : '—'}）`, ruleTyped && fb / ruleTyped > 0.03 ? 'warn' : null)),
        h('div', { className: 'me-rl-cols' },
          h('div', {}, h('div', { className: 'me-ssec-h' }, h('span', {}, '类型规则命中'), h('span', {}, '点一条看例子')),
            h(RankBars, { rows: Object.entries(U.classify).filter(([id]) => id !== 'model').sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => { const r = ruleById.get(id); return [`${id} ${r?.name ?? ''}`, n, fmt(n), r?.fallback ? 'var(--warn)' : `var(--${TYPE_KIND[r?.type] ?? 'teal'})`, `${id} ${r?.name ?? ''}（${r?.type ?? ''}·${r?.subclass ?? ''}${r?.fallback ? '，兜底' : ''}）：${fmt(n)} 条\n点击看例子`, () => setPick({ kind: 'classify', id, label: `${id} ${r?.name ?? ''}` })] }) }),
            U.classify.model ? h('p', { className: 'me-snote' }, `另有 ${fmt(U.classify.model)} 条提及的类型由模型判定，不走类型规则`) : null),
          h('div', {}, h('div', { className: 'me-ssec-h' }, h('span', {}, '概念归一（按事件）'), h('span', {}, `未归一 ${fmt(sum(U.unnormalized))}`)),
            h(RankBars, { rows: Object.entries(U.concepts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n], _i, all) => { const [g, c] = k.split('\u0000'); const l = layerOfConcept.get(k); const dup = all.filter(([k2]) => k2.split('\u0000')[1] === c).length > 1; return [dup ? `${g.slice(0, 2)}·${c}` : c, n, fmt(n), l && l !== 'general' ? 'var(--decide)' : 'var(--teal)', `${g} · ${c}（${l ?? ''}）：${fmt(n)} 个事件\n点击看例子`, () => setPick({ kind: 'concept', id: k, label: `${g} · ${c}` })] }) })),
          h('div', {}, h('div', { className: 'me-ssec-h' }, h('span', {}, '归并与矛盾判断')),
            h(RankBars, { rows: [...Object.entries(U.merge).filter(([k]) => k && k !== 'null').sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => [k, n, fmt(n), 'var(--fact)', `归并：${k}，${fmt(n)} 条提及\n点击看例子`, () => setPick({ kind: 'merge', id: k, label: `归并 ${k}` })]),
              ...Object.entries(U.finding).sort((a, b) => b[1] - a[1]).map(([k, n]) => [`矛盾 ${k}`, n, fmt(n), 'var(--warn)', `矛盾判断 ${k}：${fmt(n)} 条发现\n点击看例子`, () => setPick({ kind: 'finding', id: k, label: `矛盾判断 ${k}` })])] }))))
      const examples = pick ? h('div', { className: 'me-rl-ex' },
        h('div', { className: 'me-ssec-h' }, h('span', {}, `命中例子 · ${pick.label}`), h('button', { className: 'me-link', onClick: () => setPick(null) }, '收起')),
        !ex.value ? h('p', { className: 'me-snote' }, ex.error ?? '加载中…') : !ex.value.items.length ? h('p', { className: 'me-snote' }, '这一批里没有找到') :
          ex.value.items.map((x, i) => h('div', { key: i, className: 'me-mrow' },
            h('div', { style: { display: 'flex', gap: 8, alignItems: 'baseline' } }, h('span', { className: 'me-num me-muted' }, x.patient), x.writtenAt ? h('span', { className: 'me-num me-faint' }, String(x.writtenAt).slice(0, 10)) : null, x.recordType ? h('span', { className: 'me-faint' }, `${x.recordType}${x.section ? `／${x.section}` : ''}`) : null, x.verdict ? h('span', { className: `me-chip ${VERDICT_CLS[x.verdict] ?? ''}` }, `${x.verdict}·${x.subclass ?? ''}`) : null),
            h('div', { style: { margin: '3px 0' } }, x.text),
            x.type ? h('div', { className: 'me-faint', style: { fontSize: 10.5 } }, `${x.type}›${x.subdivision ?? ''}›${x.item ?? ''}${x.negative ? '·否定' : ''} · ${x.occurFrom ?? '?'}${x.aliases?.length ? ` · 写法：${x.aliases.join('、')}` : ''}${x.mentionCount ? ` · ${x.mentionCount} 条提及` : ''}`) : null))) : null
      return h('div', { className: 'me-frame me-col', style: { flex: 1, minHeight: 0 } },
        h('div', { className: 'me-scroll', style: { flex: 1 } },
          h('div', { className: 'me-pad', style: { borderBottom: '1px solid var(--line)' } },
            h('div', { className: 'me-h' }, h('b', {}, '规则包'), h('span', { className: 'me-cap' }, 'RULEPACK'), h('span', { className: 'me-faint' }, '规则写“认什么”，引擎写“怎么做”。每批不用选：数据源层跟着输入格式走，专科层在设置里定。改规则 → 升版本 → 重跑。')),
            h('div', { className: 'me-rl-top' }, h('div', { className: 'me-rl-layers' }, layers.map(layerCard)), flow),
            h('div', { className: 'me-sec' }, h('b', {}, run ? '这一批规则干了多少' : '规则用量'), h('span', { className: 'me-cap' }, run ? `${run.id} · ${modeLabel(run.mode)}` : '')),
            h('div', { className: 'me-rl-usage' }, usage),
            examples),
          h('div', { className: 'me-pad', style: { paddingBottom: 0 } },
            h('div', { style: { display: 'flex', gap: 4 } }, [['taxonomy', `类型表 ${v.taxonomy?.length ?? 0}`], ['classify', `类型规则 ${v.classify.length}`], ['concepts', `概念词表 ${v.concepts.length}`], ['vocab', `词表正则 ${Object.keys(v.vocab).length}`], ['sections', '栏目与时间策略'], ['params', '参数与互斥组']].map(([k, l]) => h('button', { key: k, className: `me-btn sm${view === k ? ' on' : ''}`, onClick: () => setView(k) }, l)))),
          view === 'taxonomy' ? h('div', { className: 'me-pad' }, h('div', { className: 'me-faint', style: { marginBottom: 6 } }, '通读模型只能从这张表里选类型代码；人工改类型、补提及也用它。'), h('table', {}, h('thead', {}, h('tr', {}, ['代码', '类型', '细分', '细项'].map((x) => h('th', { key: x }, x)))),
            h('tbody', {}, (v.taxonomy ?? []).map((c) => h('tr', { key: c.code }, h('td', { className: 'me-num' }, c.code), h('td', {}, h('span', { className: `me-chip ${TYPE_CLS[c.t]}` }, c.t)), h('td', {}, c.sd), h('td', {}, c.it))))))
            : view === 'classify' ? h('table', {}, h('thead', {}, h('tr', {}, ['顺序', '编号', '名称', '类型', '子类', '层', '本批命中', '条件'].map((x) => h('th', { key: x }, x)))),
              h('tbody', {}, v.classify.map((r, i) => h('tr', { key: r.id, className: U ? 'click' : '', onClick: U ? () => setPick({ kind: 'classify', id: r.id, label: `${r.id} ${r.name}` }) : undefined }, h('td', { className: 'me-num me-faint' }, i + 1), h('td', { className: 'me-num' }, r.id, r.fallback ? h('span', { className: 'me-chip w', style: { marginLeft: 4 } }, '兜底') : null), h('td', {}, r.name), h('td', {}, h('span', { className: `me-chip ${TYPE_CLS[r.type]}` }, r.type)), h('td', {}, r.subclass), h('td', { className: 'me-faint' }, r.layer ?? ''), h('td', { className: 'me-num' }, U ? fmt(U.classify[r.id] ?? 0) : '—'), h('td', { className: 'me-num me-faint', style: { fontSize: 11, wordBreak: 'break-all' } }, JSON.stringify(r.when))))))
              : view === 'concepts' ? h('div', { className: 'me-pad' }, Object.entries(groups).map(([g, cs]) => h('div', { key: g }, h('div', { className: 'me-sec' }, h('b', {}, g), h('span', { className: 'me-cap' }, String(cs.length))),
                h('table', {}, h('tbody', {}, cs.map((c) => h('tr', { key: c.name, className: U ? 'click' : '', onClick: U ? () => setPick({ kind: 'concept', id: `${g}\u0000${c.name}`, label: `${g} · ${c.name}` }) : undefined }, h('td', { style: { width: 180 } }, c.name, c.once ? h('span', { className: 'me-chip v', style: { marginLeft: 4 } }, '一次性') : null), h('td', { className: 'me-muted' }, c.aliases.join('、')), h('td', { className: 'me-faint', style: { width: 90 } }, c.layer ?? ''), h('td', { className: 'me-num', style: { width: 70 } }, U ? fmt(U.concepts[`${g}\u0000${c.name}`] ?? 0) : ''), h('td', { className: /需药师|需医生/.test(c.nature ?? '') ? 'me-warn' : 'me-faint' }, c.nature ?? ''))))))))
                : view === 'vocab' ? h('table', {}, h('tbody', {}, Object.entries(v.vocab).map(([k, re]) => h('tr', { key: k }, h('td', { className: 'me-num', style: { width: 120 } }, k), h('td', { className: 'me-num me-muted', style: { fontSize: 11, wordBreak: 'break-all' } }, String(re))))))
                  : view === 'sections' ? h('table', {}, h('tbody', {}, Object.entries(v.sections).flatMap(([doc, cfg]) => (cfg.list ?? [{ name: cfg.whole, time: cfg.time, label: cfg.label }]).map((s) => h('tr', { key: doc + s.name }, h('td', {}, doc), h('td', {}, s.name), h('td', { className: 'me-num me-faint' }, s.re ?? ''), h('td', {}, s.time), h('td', { className: 'me-muted' }, s.label ?? ''))))))
                    : h('div', { className: 'me-pad' }, h('table', {}, h('tbody', {}, Object.entries(v.params).map(([k, x]) => h('tr', { key: k }, h('td', { className: 'me-num' }, k), h('td', { className: 'me-num' }, String(x)))))),
                      h('div', { className: 'me-sec' }, h('b', {}, '互斥用药组')), v.exclusive.map((g) => h('div', { key: g.name }, `${g.name}：${g.drugs.join('、')}`, h('div', { className: 'me-faint' }, g.note))),
                      h('div', { className: 'me-sec' }, h('b', {}, '否认上位概念')), v.hypernyms.map((x) => h('div', { key: x.name }, `${x.name} ⊇ ${x.children.join('、')}`)),
                      h('div', { className: 'me-sec' }, h('b', {}, '候选同义（不合并）')), v.candidateSynonyms.map((x) => h('div', { key: x.name }, `${x.name}：${x.members.join('／')}`)))))
    }



    /* ---------------------------------------------------------------- files */
    /** 文件：每位病人的导出文件夹一行，处理状态与小计；运行中随批次刷新。点完成的病人打开复核 */
    const FILE_STATUS = { done: ['完成', 'ok'], running: ['处理中', 'run'], queued: ['排队', 'run'], failed: ['出错', 'bad'], waiting: ['等待', 'wait'], stopped: ['未处理', 'wait'] }
    const fmtMs = (ms) => (ms == null ? '—' : ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} 秒` : `${Math.floor(ms / 60000)} 分 ${Math.round((ms % 60000) / 1000)} 秒`)
    function Files({ run, openPatient, openTimeline }) {
      const [status, setStatus] = useState('all')
      const [q, setQ] = useState('')
      const [offset, setOffset] = useState(0)
      const d = useAsync(() => call('files', { runId: run.id, status, q: q.trim(), offset, limit: 100 }), [run.id, status, q, offset, run.status, run.shards?.done, (run.shards?.active ?? []).join(','), run.humanReview?.appliedAt, run.current?.patient])
      const v = d.value
      const c = v?.counts ?? {}
      const FILTERS = [['all', '全部'], ['running', '处理中'], ['failed', '出错或质检未过'], ['todo', '有待判断'], ['waiting', run.status === 'running' ? '等待' : '未处理']]
      return h('div', { className: 'me-frame me-col me-fl', style: { flex: 1, minWidth: 0 } },
        h('div', { className: 'me-pad me-fl-bar' },
          h('b', {}, '文件'), h('span', { className: 'me-faint' }, '一位病人一个导出文件夹；处理中的显示走到哪一站'),
          h('span', { className: 'me-sp' }),
          h('div', { className: 'me-fl-tg' }, FILTERS.map(([k, l]) => (k !== 'all' && !c[k] && status !== k ? null
            : h('button', { key: k, className: `me-dc-tgb${status === k ? ' on' : ''}${(k === 'failed' || k === 'todo') && c[k] ? ' hot' : ''}`, onClick: () => { setStatus(k); setOffset(0) } }, `${l} ${fmt(c[k] ?? 0)}`)))),
          h('input', { className: 'me-input', placeholder: '搜索病人', value: q, onChange: (e) => { setQ(e.target.value); setOffset(0) }, style: { width: 180 } }),
          v ? h('span', { className: 'me-faint me-num' }, v.total ? `${fmt(offset + 1)}–${fmt(offset + v.items.length)} / ${fmt(v.total)}` : '0') : null,
          h('button', { className: 'me-btn sm', disabled: offset === 0, onClick: () => setOffset(Math.max(0, offset - 100)) }, '‹'),
          h('button', { className: 'me-btn sm', disabled: !v || offset + 100 >= v.total, onClick: () => setOffset(offset + 100) }, '›')),
        h('div', { className: 'me-scroll', style: { flex: 1 } },
          !v ? h('div', { className: 'me-empty' }, d.error ?? '加载中…')
            : !v.items.length ? h('div', { className: 'me-empty' }, run.status === 'running' && !c.all ? '正在规划输入…' : '没有符合的病人。')
              : h('table', { className: 'me-fl-tbl' },
                h('thead', {}, h('tr', {}, ['病人文件夹', '状态', '质检', '文书', '提及', '事件', '发现', '待判断', '用时', ''].map((x, i) => h('th', { key: `${x}${i}`, className: i > 2 && i < 9 ? 'n' : '' }, x)))),
                h('tbody', {}, v.items.map((r) => {
                  const [label, tone] = FILE_STATUS[r.status] ?? [r.status, 'wait']
                  const canOpen = r.status === 'done'
                  const n = (x, warn = false) => h('td', { className: `n me-num${warn ? ' me-warn' : ''}${x === 0 ? ' z' : ''}` }, x == null ? '—' : fmt(x))
                  return h('tr', { key: r.patient, className: `${canOpen ? 'click' : ''} st-${tone}`, title: canOpen ? '点击打开复核' : r.error ?? '', onClick: canOpen ? () => openPatient(r.patient) : undefined },
                    h('td', { className: 'me-fl-name' }, h('span', { className: 'me-num', title: r.name }, r.name)),
                    h('td', {}, h('span', { className: `me-fl-st ${tone}` }, h('i'), label, r.stage ? ` · ${STAGE_NAME[r.stage] ?? r.stage}` : ''), r.error ? h('div', { className: 'me-fl-err' }, r.error) : null),
                    h('td', {}, r.status !== 'done' ? '—' : r.failedGates.length ? h('span', { className: 'me-chip b' }, `未过 ${r.failedGates.join('')}`) : h('span', { className: 'me-chip ok' }, '通过')),
                    n(r.documents), n(r.mentions), n(r.events), n(r.findings), n(r.review, r.review > 0),
                    h('td', { className: 'n me-num me-faint' }, fmtMs(r.ms)),
                    h('td', {}, canOpen ? h('button', { className: 'me-btn sm', onClick: (e) => { e.stopPropagation(); openTimeline(r.patient) } }, '时间线') : null))
                })))))
    }
    const STAGE_NAME = { S01: '读入', S02: '通读', S03: '类型', S04: '归并', S05: '矛盾判断', S07: '写事件包' }

    /* --------------------------------------------------------------- review */
    /**
     * 复核页（逐份核对）：左＝病人与文书（按就诊分组，圆点＝状态），中＝原文（提及按类型着色，有分歧的句子标橙，
     * 可选中文字补漏提），右＝这份文书：选中的提及（可去掉、改类型、改时间）与落在这份文书上的通读分歧（维持、改用另一方、去掉）；
     * 另一页是这位病人的发现与药名映射。判断按稳定编号存，点「更新事件包」不调模型重新生成，重跑也沿用。
     */
    const TYPE_KIND = { 事实: 'fact', 判断: 'judge', 决策: 'decide' }
    const DISPUTE_TIP = { 边界: '这一条该怎么切、是不是提及', 分类: '类型与否定', 时间: '这件事的时间短语', 遗漏: '这一段该不该单独成一条提及' }
    const BY_CLS = (by) => (!by ? '' : /人工/.test(by) ? 'd' : /待人工/.test(by) ? 'w' : /规则/.test(by) ? 'f' : /复查/.test(by) ? 'v' : /一致/.test(by) ? 'ok' : '')
    const REVIEW_DEC = { confirm: '已维持当前结果', useVerify: '已改用另一方', reject: '已去掉这一条' }
    const FINDING_OPTS = ['确认', '不是冲突（误报）', '矛盾', '记录质量', '调整', '改判', '病情变化', '命名不一致', '证据不足']
    const shortTime = (w) => (w ? String(w).slice(0, 16) : '时间不详')
    function Review({ run, focus, setFocus, onError, openTimeline, onRunChanged }) {
      const [q, setQ] = useState('')
      const [only, setOnly] = useState('all')
      const [selMention, setSelMention] = useState(null)
      const [selReview, setSelReview] = useState(null)
      const [adder, setAdder] = useState(null)
      const [busy, setBusy] = useState(false)
      const [note, setNote] = useState(null)
      const [pane, setPane] = useState('doc')
      const [shut, setShut] = useState(false)
      const [edit, setEdit] = useState(null) // { kind: 'type'|'time', code, neg, from, to }
      const patient = focus?.patient ?? null
      const pl = useAsync(() => call('patients', { runId: run.id, q: q.trim(), only: only === 'todo' ? 'todo' : null }), [run.id, q, only, run.humanReview?.appliedAt])
      const dl = useAsync(() => (patient ? call('documents', { runId: run.id, patient }) : null), [run.id, patient])
      const docs = (() => { const m = new Map(); for (const d of [...(dl.value?.documents ?? [])].sort((a, b) => String(a.visibleAt).localeCompare(String(b.visibleAt)))) { const k = d.encounterId ?? ''; if (!m.has(k)) m.set(k, []); m.get(k).push(d) } return [...m.values()].flat() })()
      const docId = focus?.doc ?? (docs.find((d) => d.todo) ?? docs[0])?.id ?? null
      const dv = useAsync(() => (patient && docId ? call('fragment', { runId: run.id, patient, fragmentId: docId }) : null), [run.id, patient, docId])
      const fq = useAsync(() => (patient ? call('reviewQueue', { runId: run.id, patient, status: 'open', limit: 500 }) : null), [run.id, patient])
      useEffect(() => { setSelMention(null); setSelReview(null); setAdder(null); setEdit(null) }, [docId])
      useEffect(() => { if (!patient && pl.value?.items?.length) setFocus({ patient: pl.value.items[0].patient }) }, [pl.value, patient])
      const v = dv.value
      const textRef = React.useRef(null)
      const reloadAll = () => { dv.reload(); dl.reload(); pl.reload(); fq.reload() }
      const act = async (fn, okText) => {
        setBusy(true); setNote(null)
        try { await fn(); if (okText) setNote({ ok: true, text: okText }); reloadAll() } catch (e) { setNote({ ok: false, text: msg(e) }) } finally { setBusy(false) }
      }
      const decide = (kind, target, decision, value = null) => act(() => call('decide', { runId: run.id, kind, target, decision, value }), decision === 'clear' ? '已撤销' : '已记下；点「更新事件包」生效')
      const apply = () => act(async () => { const r = await call('applyDecisions', { runId: run.id }); onRunChanged?.(); return r }, '已按你的判断重新生成事件包（没有调用模型）')
      const scrollTo = (s) => {
        const box = textRef.current; if (!box) return
        const el = [...box.querySelectorAll('[data-s]')].reverse().find((x) => Number(x.dataset.s) <= s)
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      // 原文：按提及、人工补充、分歧句切段
      const body = v?.fragment?.text ?? ''
      const spans = []
      if (v) {
        for (const m of v.mentions) if (m.e > m.s) spans.push({ s: m.s, e: m.e, id: m.id, kind: m.decision?.decision === 'reject' ? 'rej' : TYPE_KIND[m.type] ?? 'fact', m, neg: m.negative })
        for (const x of v.added) spans.push({ s: x.s, e: x.e, id: x.id, kind: 'add', added: x })
        for (const r of v.reviews) for (const at of r.at ?? []) spans.push({ s: at.s, e: at.e, id: `rv:${r.id}:${at.s}`, kind: r.resolved || r.decision ? 'seen' : 'todo', review: r })
      }
      const cuts = [...new Set([0, body.length, ...spans.flatMap((x) => [x.s, x.e])])].filter((n) => n >= 0 && n <= body.length).sort((a, b) => a - b)
      const RANK = { add: 6, rej: 5, fact: 4, judge: 4, decide: 4, todo: 2, seen: 1 }
      const segs = []
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i]; const b = cuts[i + 1]
        const cover = spans.filter((x) => x.s <= a && x.e >= b)
        const top = [...cover].sort((x, y) => RANK[y.kind] - RANK[x.kind])[0]
        const sent = cover.find((x) => x.review)
        const on = cover.some((x) => x.id === selMention) || (sent && sent.review.id === selReview)
        segs.push(h('span', {
          key: a, 'data-s': a,
          className: top ? `me-mk ${top.kind}${top.neg ? ' neg' : ''}${sent ? ` rv-${sent.kind}` : ''}${on ? ' on' : ''}` : undefined,
          title: top ? cover.map((x) => (x.m ? `${x.m.type}›${x.m.subdivision}›${x.m.item}${x.m.negative ? '·否定' : ''} · ${x.m.occurFrom ?? '?'}${x.m.occurTo && x.m.occurTo !== x.m.occurFrom ? `～${x.m.occurTo}` : ''}` : x.added ? `人工补充 ${x.added.code}` : `通读分歧：${x.review.dispute}`)).join('\n') : undefined,
          onClick: top ? () => { if (top.m || top.added) setSelMention(top.id); if (sent) setSelReview(sent.review.id); setPane('doc') } : undefined,
        }, body.slice(a, b)))
      }
      const posOf = (node, off) => {
        const el = node?.nodeType === 3 ? node.parentElement : node
        const seg = el?.closest?.('[data-s]')
        if (!seg || !textRef.current?.contains(seg)) return null
        return Number(seg.dataset.s) + (node.nodeType === 3 ? off : 0)
      }
      const onMouseUp = (ev) => {
        const sel = window.getSelection?.(); if (!sel || sel.isCollapsed) return
        let a = posOf(sel.anchorNode, sel.anchorOffset); let b = posOf(sel.focusNode, sel.focusOffset)
        if (a == null || b == null) return
        if (a > b) [a, b] = [b, a]
        while (a < b && /\s/.test(body[a])) a++
        while (b > a && /\s/.test(body[b - 1])) b--
        if (b - a < 1 || b - a > 200) return
        const box = ev.currentTarget.getBoundingClientRect()
        setAdder({ s: a, e: b, text: body.slice(a, b), x: Math.min(ev.clientX - box.left, box.width - 300), y: ev.clientY - box.top + ev.currentTarget.scrollTop + 14, code: 'F02', neg: false, from: '' })
      }
      const codes = v?.codes ?? []
      const codeSelect = (value, onChange) => h('select', { className: 'me-input', value, onChange: (e) => onChange(e.target.value) },
        ['事实', '判断', '决策'].map((tp) => h('optgroup', { key: tp, label: tp }, codes.filter((c) => c.t === tp).map((c) => h('option', { key: c.code, value: c.code }, `${c.code} ${c.sd}›${c.it}`)))))
      const saveAdd = () => act(async () => {
        await call('addMention', { runId: run.id, patient, fragmentId: docId, s: adder.s, e: adder.e, code: adder.code, neg: adder.neg, from: adder.from || null })
        setAdder(null); window.getSelection?.().removeAllRanges()
      }, '已补上这条提及；点「更新事件包」生效')

      const mention = v && selMention ? v.mentions.find((m) => m.id === selMention) ?? null : null
      const added = v && selMention ? v.added.find((x) => x.id === selMention) ?? null : null
      const codeOf = (m) => codes.find((c) => c.t === m.type && c.sd === m.subdivision && c.it === m.item)?.code ?? ''
      const mentionCard = (m) => {
        const d = m.decision?.decision
        return h('div', { className: 'me-dc-f on' },
          h('div', { className: 'me-dc-fh' }, h('span', { className: `me-chip ${TYPE_CLS[m.type] ?? ''}` }, m.type), h('b', {}, m.text.length > 30 ? `${m.text.slice(0, 30)}…` : m.text), h('span', { className: 'me-sp' }), d ? h('span', { className: `me-chip ${d === 'reject' ? 'b' : 'w'}` }, d === 'reject' ? '已去掉' : '已改') : null),
          h('div', { className: 'me-kv', style: { fontSize: 11.5 } },
            h('span', { className: 'me-faint' }, '类型'), h('span', {}, `${m.subdivision} › ${m.item}${m.negative ? ' · 否定' : ''}${m.subclass ? `（${m.subclass}）` : ''}`),
            h('span', { className: 'me-faint' }, '发生时间'), h('span', {}, `${m.occurFrom ?? '?'}${m.occurTo && m.occurTo !== m.occurFrom ? ` ～ ${m.occurTo}` : ''}`),
            h('span', { className: 'me-faint' }, '时间来源'), h('span', {}, `${m.timeSource ?? '—'}${m.timePhrase ? `「${m.timePhrase}」` : ''}`),
            h('span', { className: 'me-faint' }, '出处'), h('span', {}, [m.rules?.extract === 'model' ? '模型通读' : m.rules?.extract === 'manual' ? '人工补充' : m.rules?.extract === 'STRUCT' ? '结构化记录' : `规则（${m.rules?.extract ?? ''}）`, m.rules?.classify ? `类型规则 ${m.rules.classify}` : ''].filter(Boolean).join(' · ')),
            m.by ? h('span', { className: 'me-faint' }, '怎么定的') : null, m.by ? h('span', {}, ['span', 'type', 'time'].map((k) => h('span', { key: k, className: `me-chip ${BY_CLS(m.by[k])}`, title: { span: '边界', type: '类型', time: '时间' }[k] }, `${{ span: '边界', type: '类型', time: '时间' }[k]}：${m.by[k]}`))) : null,
            m.templated ? h('span', { className: 'me-faint' }, '模板化') : null, m.templated ? h('span', {}, m.templated) : null),
          edit ? h('div', { className: 'me-dc-edit', style: { flexWrap: 'wrap' } },
            edit.kind === 'type' ? h(React.Fragment, {}, codeSelect(edit.code, (c) => setEdit({ ...edit, code: c })), h('label', { className: 'me-pick' }, h('input', { type: 'checkbox', checked: edit.neg, onChange: (e) => setEdit({ ...edit, neg: e.target.checked }) }), '否定'))
              : h(React.Fragment, {}, h('input', { className: 'me-input', type: 'date', value: edit.from, onChange: (e) => setEdit({ ...edit, from: e.target.value }) }), '～', h('input', { className: 'me-input', type: 'date', value: edit.to, onChange: (e) => setEdit({ ...edit, to: e.target.value }) })),
            h('button', { className: 'me-btn sm pri', disabled: busy, onClick: () => { decide('mention', m.id, 'correct', edit.kind === 'type' ? { code: edit.code, neg: edit.neg } : { from: edit.from || null, to: edit.to || edit.from || null }); setEdit(null) } }, '保存'),
            h('button', { className: 'me-btn sm', onClick: () => setEdit(null) }, '取消'))
            : h('div', { className: 'me-dc-btns' }, d ? h('button', { className: 'me-btn sm', disabled: busy, onClick: () => decide('mention', m.id, 'clear') }, '撤销判断')
              : h(React.Fragment, {},
                h('button', { className: 'me-btn sm', disabled: busy, title: '这一条不该成为提及', onClick: () => decide('mention', m.id, 'reject') }, '✗ 去掉'),
                h('button', { className: 'me-btn sm', disabled: busy, onClick: () => setEdit({ kind: 'type', code: codeOf(m) || 'F02', neg: Boolean(m.negative) }) }, '✎ 改类型'),
                h('button', { className: 'me-btn sm', disabled: busy, onClick: () => setEdit({ kind: 'time', from: m.occurFrom ?? '', to: m.occurTo ?? '' }) }, '✎ 改时间'),
                m.eventId && openTimeline ? h('button', { className: 'me-btn sm', onClick: () => openTimeline(patient) }, '时间线 →') : null)))
      }
      const addedCard = (x) => h('div', { className: 'me-dc-f on' },
        h('div', { className: 'me-dc-fh' }, h('span', { className: 'me-chip d' }, '人工补充'), h('b', {}, x.text), h('span', { className: 'me-sp' }), h('span', { className: 'me-faint' }, x.code)),
        h('div', { className: 'me-dc-btns' }, h('button', { className: 'me-btn sm', disabled: busy, onClick: () => decide('add', x.id, 'clear') }, '撤销这个补充')))
      const reviewCard = (r) => {
        const d = r.decision?.decision
        return h('div', { key: r.id, className: `me-dc-rv${selReview === r.id ? ' on' : ''}`, onClick: () => { setSelReview(r.id); if (r.at?.[0]) scrollTo(r.at[0].s) } },
          h('div', { className: 'me-dc-rvh' }, h('span', { className: 'me-chip v', title: DISPUTE_TIP[r.dispute] }, `通读分歧 · ${r.dispute}`), r.resolved ? h('span', { className: `me-chip ${BY_CLS(r.resolved.by)}` }, r.resolved.by) : null, d ? h('span', { className: 'me-chip ok' }, REVIEW_DEC[d] ?? d) : null),
          h('div', { className: 'me-dc-rvc' },
            h('div', {}, h('small', {}, `通读模型${r.current === '甲' ? '（当前）' : ''}`), h('b', {}, r.aText)),
            h('div', {}, h('small', {}, `核验模型${r.current === '乙' ? '（当前）' : ''}`), h('b', { className: 'me-warn' }, r.bText))),
          ...(r.rounds ?? []).map((rd) => h('div', { key: rd.round, className: 'me-why' }, `第 ${rd.round} 轮：${rd.a ? `通读 ${rd.a.keep ? '坚持' : '改用对方'}${rd.a.reason ? `（${rd.a.reason}）` : ''}` : ''}${rd.b ? `；核验 ${rd.b.keep ? '坚持' : '改用对方'}${rd.b.reason ? `（${rd.b.reason}）` : ''}` : ''}`)),
          h('div', { className: 'me-dc-btns' }, d
            ? h('button', { className: 'me-btn sm', disabled: busy, onClick: (e) => { e.stopPropagation(); decide('review', r.id, 'clear') } }, '撤销判断')
            : h(React.Fragment, {},
              h('button', { className: 'me-btn sm', disabled: busy, onClick: (e) => { e.stopPropagation(); decide('review', r.id, 'confirm') } }, '维持当前结果'),
              h('button', { className: 'me-btn sm pri', disabled: busy, onClick: (e) => { e.stopPropagation(); decide('review', r.id, 'useVerify') } }, '改用另一方'),
              h('button', { className: 'me-btn sm', disabled: busy, title: '两边都不对：这一条不要', onClick: (e) => { e.stopPropagation(); decide('review', r.id, 'reject') } }, '去掉这一条'))))
      }
      const queue = (fq.value?.items ?? []).filter((x) => x.kind !== 'mention')
      const queueCard = (x) => h('div', { key: `${x.kind}:${x.id}`, className: 'me-dc-rv' },
        h('div', { className: 'me-dc-rvh' }, h('span', { className: `me-chip ${x.kind === 'finding' ? VERDICT_CLS[x.verdict] ?? 'w' : 'f'}` }, x.kind === 'finding' ? `发现 · ${x.verdict}${x.subclass ? `·${x.subclass}` : ''}` : '药名映射 · 需药师复核'), x.decision ? h('span', { className: 'me-chip ok' }, x.decision.decision) : null),
        h('div', { style: { margin: '4px 0', lineHeight: 1.6 } }, x.title),
        h('div', { className: 'me-dc-btns' }, x.decision ? h('button', { className: 'me-btn sm', disabled: busy, onClick: () => decide(x.kind, x.id, 'clear') }, '撤销判断')
          : x.kind === 'mapping' ? h(React.Fragment, {}, h('button', { className: 'me-btn sm pri', disabled: busy, onClick: () => decide('mapping', x.id, 'confirm') }, '✓ 映射对'), h('button', { className: 'me-btn sm', disabled: busy, onClick: () => decide('mapping', x.id, 'reject') }, '✗ 不对'))
            : h('select', { className: 'me-input', value: '', disabled: busy, onChange: (e) => e.target.value && decide('finding', x.id, e.target.value) }, h('option', { value: '' }, '判断为…'), FINDING_OPTS.map((o) => h('option', { key: o, value: o }, o)))))

      const docIdx = docs.findIndex((d) => d.id === docId)
      useEffect(() => {
        const onKey = (e) => {
          if (e.metaKey || e.ctrlKey || e.altKey) return
          const tag = e.target?.tagName
          if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
          const k = e.key.toLowerCase()
          if ((k === 'j' || k === 'k') && docs.length) { e.preventDefault(); const n = docs[Math.max(0, Math.min(docs.length - 1, docIdx + (k === 'j' ? 1 : -1)))]; if (n) setFocus({ patient, doc: n.id }) }
          if (e.key === 'Escape') setAdder(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      })
      const P = pl.value
      const seenKey = `me-seen:${run.id}`
      const [seen, setSeen] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(seenKey) ?? '[]')) } catch { return new Set() } })
      useEffect(() => {
        if (!docId || seen.has(docId)) return
        const arr = [...seen, docId].slice(-20000)
        try { localStorage.setItem(seenKey, JSON.stringify(arr)) } catch { /* 隐私模式 */ }
        setSeen(new Set(arr))
      }, [docId])
      const encGroups = (() => {
        const m = new Map()
        for (const d of docs) {
          const k = d.encounterId ?? ''
          if (!m.has(k)) m.set(k, { key: k || '-', label: k || '没有就诊号', day: d.visibleAt ? String(d.visibleAt).slice(0, 10) : null, docs: [] })
          m.get(k).docs.push(d)
        }
        return [...m.values()]
      })()
      const openRv = v ? v.reviews.filter((r) => !r.resolved && !r.decision).length : 0

      return h('div', { className: 'me-dc' },
        h('aside', { className: 'me-frame me-col me-dc-side' },
          h('div', { className: 'me-dc-search' },
            h('input', { className: 'me-input', placeholder: '搜索病人', value: q, onChange: (e) => setQ(e.target.value) }),
            h('div', { className: 'me-dc-tg' }, [['all', `全部${P ? ` ${fmt(P.patientsAll)} 人` : ''}`], ['todo', `有待判断${P?.patientsTodo ? ` ${fmt(P.patientsTodo)} 人` : ''}`]].map(([k, l]) => h('button', { key: k, title: k === 'todo' && P?.todo ? `合计 ${fmt(P.todo)} 项待判断` : undefined, className: `me-dc-tgb${only === k ? ' on' : ''}${k === 'todo' && P?.patientsTodo ? ' hot' : ''}`, onClick: () => setOnly(k) }, l)))),
          h('div', { className: 'me-scroll me-dc-list' },
            !P ? h('div', { className: 'me-faint', style: { padding: 8 } }, pl.error ?? '加载中…')
              : !P.items.length ? h('div', { className: 'me-faint', style: { padding: 8 } }, '没有符合的病人。')
                : P.items.map((p) => {
                  const open = p.patient === patient && !shut
                  const seenN = open ? docs.filter((d) => seen.has(d.id)).length : 0
                  return h('div', { key: p.patient, className: `me-dc-pc${open ? ' open' : ''}` },
                    h('div', { className: 'me-dc-ph', onClick: () => { if (p.patient === patient) setShut(!shut); else { setShut(false); setFocus({ patient: p.patient }) } } },
                      h('span', { className: 'me-dc-caret' }, open ? '▾' : '▸'),
                      h('b', { className: 'me-num', title: p.patient }, p.patient),
                      h('span', { className: 'me-sp' }),
                      p.status === 'failed' ? h('span', { className: 'me-dc-pill hot', title: p.error }, '出错') : null,
                      p.todo ? h('span', { className: 'me-dc-pill hot', title: '还没判断的项（通读分歧、发现、药名）' }, `待判断 ${fmt(p.todo)}`) : null,
                      p.failedGates?.length ? h('span', { className: 'me-dc-pill', title: '质检未过' }, `未过 ${p.failedGates.join('')}`) : null),
                    h('div', { className: 'me-dc-pm' }, p.counts ? `${fmt(p.counts.documents ?? 0)} 份文书 · ${fmt(p.counts.mentions)} 提及 · ${fmt(p.counts.findings)} 发现` : '', open && docs.length ? h('span', {}, ` · 看过 ${seenN}/${docs.length}`) : null),
                    open && docs.length ? h('div', { className: 'me-dc-prog' }, h('i', { style: { width: `${Math.round((seenN / docs.length) * 100)}%` } })) : null,
                    open ? (dl.loading && !docs.length ? h('div', { className: 'me-faint me-dc-pm' }, '加载中…')
                      : dl.error ? h('div', { className: 'me-faint me-dc-pm' }, dl.error)
                        : h('div', { className: 'me-dc-tl' }, encGroups.map((g) => h('div', { key: g.key, className: 'me-dc-enc' },
                          h('div', { className: 'me-dc-eh', title: g.label }, h('span', {}, g.label), h('em', {}, g.day ?? '')),
                          g.docs.map((d) => {
                            const st = d.todo ? 'todo' : seen.has(d.id) ? 'seen' : d.mentions ? 'val' : 'empty'
                            return h('div', { key: d.id, className: `me-dc-dr ${st}${d.id === docId ? ' on' : ''}`, title: `${d.recordType}${d.field ? ` · ${d.field}` : ''}\n${d.id}`, onClick: () => setFocus({ patient, doc: d.id }) },
                              h('span', { className: 'me-dc-dot' }, st === 'seen' ? '✓' : ''),
                              h('b', {}, d.recordType || '文书'),
                              h('span', { className: 'me-dc-time me-num' }, shortTime(d.visibleAt).slice(5)),
                              h('span', { className: 'me-dc-st' }, d.todo ? `⚠ ${d.todo}` : `${d.mentions} 条`))
                          }))))) : null)
                })),
          h('div', { className: 'me-dc-key' }, h('span', { className: 'todo' }, '有分歧'), h('span', { className: 'seen' }, '看过'), h('span', { className: 'val' }, '有提及'), h('span', { className: 'empty' }, '无提及'))),
        h('section', { className: 'me-frame me-col me-dc-mid' },
          h('div', { className: 'me-dc-bar me-dc-bar2' },
            h('span', { className: 'me-dc-swatch' }, [['fact', '事实'], ['judge', '判断'], ['decide', '决策'], ['add', '人工补充'], ['rej', '已去掉'], ['todo', '有分歧的句子']].map(([k, l]) => h('span', { key: k }, h('i', { className: k }), l))),
            h('span', { className: 'me-sp' }),
            docs.length ? h('span', { className: 'me-faint me-num' }, `${docIdx + 1} / ${docs.length}`) : null,
            h('button', { className: 'me-btn sm', disabled: docIdx <= 0, title: '上一份（K）', onClick: () => setFocus({ patient, doc: docs[docIdx - 1].id }) }, '‹ 上一份'),
            h('button', { className: 'me-btn sm', disabled: docIdx < 0 || docIdx >= docs.length - 1, title: '下一份（J）', onClick: () => setFocus({ patient, doc: docs[docIdx + 1].id }) }, '下一份 ›')),
          h('div', { ref: textRef, className: 'me-scroll me-dc-text', onMouseUp: v ? onMouseUp : undefined },
            !patient ? h('div', { className: 'me-faint me-pad' }, '在左边选一位病人。')
              : dv.loading && !v ? h('div', { className: 'me-faint me-pad' }, '加载中…')
                : dv.error ? h('div', { className: 'me-err' }, dv.error)
                  : v ? h('div', { className: 'me-dc-paper' },
                    h('div', { className: 'me-dc-ttl' },
                      h('b', {}, v.fragment.recordType || '文书'),
                      h('span', {}, [v.fragment.visibleAt ?? '时间不详', v.fragment.field, v.fragment.encounterId].filter(Boolean).join(' · ')),
                      h('small', { className: 'me-num', title: '片段编号' }, v.fragment.id)),
                    h('div', { className: 'me-doc me-dc-body' }, segs),
                    h('div', { className: 'me-dc-tip' }, '点提及看详情；选中原文里的文字，可以补一条漏提的提及')) : null,
            adder ? h('div', { className: 'me-dc-add', style: { left: Math.max(4, adder.x), top: adder.y }, onMouseUp: (e) => e.stopPropagation() },
              h('div', { className: 'me-dc-addq' }, `「${adder.text.length > 40 ? `${adder.text.slice(0, 40)}…` : adder.text}」`),
              h('label', {}, '类型', codeSelect(adder.code, (c) => setAdder({ ...adder, code: c }))),
              h('label', { className: 'me-pick' }, h('input', { type: 'checkbox', checked: adder.neg, onChange: (e) => setAdder({ ...adder, neg: e.target.checked }) }), '否定（无、否认、未见）'),
              h('label', {}, '发生日期（留空＝写成当时）', h('input', { className: 'me-input', type: 'date', value: adder.from, onChange: (e) => setAdder({ ...adder, from: e.target.value }) })),
              h('div', { className: 'me-dc-btns' },
                h('button', { className: 'me-btn sm pri', disabled: busy, onClick: saveAdd }, busy ? '保存中…' : '补上'),
                h('button', { className: 'me-btn sm', onClick: () => setAdder(null) }, '取消'))) : null)),
        h('aside', { className: 'me-frame me-col me-dc-right' },
          h('div', { className: 'me-dc-ff' },
            h('button', { className: `me-dc-ffb${pane === 'doc' ? ' on' : ''}`, onClick: () => setPane('doc') }, '这份文书', openRv ? h('i', {}, String(openRv)) : null),
            h('button', { className: `me-dc-ffb${pane === 'patient' ? ' on' : ''}`, onClick: () => setPane('patient') }, '发现与药名', queue.filter((x) => !x.decision).length ? h('i', {}, String(queue.filter((x) => !x.decision).length)) : null)),
          note ? h('div', { className: `me-rvx-note${note.ok ? '' : ' bad'}`, onClick: () => setNote(null) }, note.text) : null,
          h('div', { className: 'me-scroll me-dc-fields' },
            pane === 'patient'
              ? (!queue.length ? h('div', { className: 'me-faint', style: { padding: 10 } }, '这位病人没有需要人工确认的发现或药名映射。') : queue.map(queueCard))
              : !v ? null : h(React.Fragment, {},
                mention ? mentionCard(mention) : added ? addedCard(added) : h('div', { className: 'me-faint', style: { padding: 10 } }, `点原文里的提及看详情（这份文书 ${v.mentions.length} 条提及${v.added.length ? `，人工补充 ${v.added.length}` : ''}）。`),
                v.reviews.length ? h('div', { className: 'me-sec', style: { padding: '0 8px' } }, h('b', {}, '通读分歧'), h('span', { className: 'me-cap' }, `${v.reviews.length} 项 · 同一句在别处出现时一起生效`)) : null,
                [...v.reviews].sort((a, b) => Number(Boolean(a.resolved || a.decision)) - Number(Boolean(b.resolved || b.decision))).map(reviewCard))),
          h('div', { className: 'me-dc-foot' },
            h('button', { className: `me-btn${v?.dirty || run.humanReview?.dirty ? ' me-new' : ''}`, disabled: busy || !run.output || run.status === 'running', onClick: apply }, '更新事件包'),
            h('span', { className: 'me-faint' }, v?.dirty ? '有新的判断还没更新到事件包' : '判断后点这里生效（不调模型），重跑也沿用'))))
    }

    function PatientList({ run, patient, setPatient }) {
      const [q, setQ] = useState('')
      const list = (run.patients ?? []).filter((p) => p.status !== 'failed' && (!q || p.patient.includes(q)))
      return h('div', { className: 'me-frame me-col', style: { width: 200, padding: 8, flex: 'none' } },
        h('input', { className: 'me-input', placeholder: '⌕ 病人', value: q, onChange: (e) => setQ(e.target.value) }),
        h('div', { className: 'me-scroll', style: { flex: 1 } }, list.map((p) => h('div', { key: p.patient, className: `me-pi${p.patient === patient ? ' on' : ''}`, onClick: () => setPatient(p.patient) },
          h('b', { title: p.patient }, p.patient.split('/').pop()), h('span', { className: p.review?.pending ? 'me-warn me-num' : 'me-num', title: '发现' }, String(p.counts?.findings ?? 0)),
          h('span', {}, `事件 ${fmt(p.counts?.events ?? 0)}`), h('span', {})))))
    }

    /* --------------------------------------------------------------- timeline */
    const DAYMS = 86400000
    const toT = (d) => (d ? Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) : null)

    function Timeline({ run, patient, setPatient, focus, setFocus, gotoSource, gotoReview }) {
      const data = useAsync(() => (patient ? call('timeline', { runId: run.id, patient }) : null), [run.id, patient])
      const [cutoff, setCutoff] = useState('')
      const [sel, setSel] = useState(null) // { kind, id }
      const [depth, setDepth] = useState(() => { try { return localStorage.getItem('me-timeline-depth') !== 'flat' } catch { return true } })
      const toggleDepth = () => setDepth((d) => { try { localStorage.setItem('me-timeline-depth', d ? 'flat' : '2.5d') } catch {} return !d })
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
                  Object.values(tl.manifest.gates).every((g) => g.pass) ? h('span', { className: 'me-chip ok' }, '质检全部通过') : h('span', { className: 'me-chip b' }, '有质检未过')),
                h('div', { className: 'me-muted', style: { marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' } },
                  [`片段 ${fmt(tl.counts.fragments)}`, `提及 ${fmt(tl.counts.mentions)}`, `事件 ${fmt(tl.counts.events)}`, `发现 ${fmt(tl.counts.findings)}`].map((x) => h('span', { key: x }, x)),
                  h('span', { className: 'me-sp' }),
                  h('span', { className: 'me-chip f' }, '● 事实'), h('span', { className: 'me-chip j' }, '● 判断'), h('span', { className: 'me-chip d' }, '● 决策'),
                  h('button', { className: `me-btn sm${depth ? ' on' : ''}`, title: '切换立体（2.5D）／平面显示', onClick: toggleDepth }, depth ? '◆ 2.5D' : '▭ 平面'),
                  h('label', {}, '可见截断 ', h('input', { className: 'me-input', type: 'date', value: cutoff, onChange: (e) => setCutoff(e.target.value), style: { padding: '1px 4px' } })))),
              h('div', { className: 'me-scroll', style: { flex: 1 } }, h(TimelineSvg, { tl, cutoff, sel, depth, onSelect: (x) => { setSel(x); setFocus(x) } })))),
        h('div', { className: 'me-frame me-scroll me-pad', style: { width: 380, flex: 'none' } },
          !sel ? h('div', { className: 'me-faint' }, '点时间线上的条、点或发现标记查看详情。')
            : sel.kind === 'event' ? h(EventDetail, { run, patient, eventId: sel.id, gotoSource: (fid) => gotoSource(fid, patient), onFinding: (id) => setSel({ kind: 'finding', id }), onEvent: (id) => setSel({ kind: 'event', id }) })
              : h(FindingDetail, { run, patient, findingId: sel.id, gotoSource: (fid) => gotoSource(fid, patient) })))
    }

    function TimelineSvg({ tl, cutoff, sel, onSelect, depth = true }) {
      const P = React.useContext(ThemeCtx)
      const VC = verdictColor(P)
      const W = 980; const L = 150; const R = W - 14
      const a0 = toT(tl.range.a); const b0 = toT(tl.range.b)
      const y0 = new Date(a0).getUTCFullYear(); const y1 = new Date(b0).getUTCFullYear() + 1
      const A = Date.UTC(y0, 0, 1); const B = Date.UTC(y1, 0, 1)
      const X = (d) => L + (toT(d) - A) / (B - A) * (R - L)
      // 2.5D：条与标记“浮”在泳道上——柔和投影＋顶部受光
      const els = []
      const bands = []
      let y = 22
      const C = { fact: P.fact, judge: P.judge, decide: P.decide, visit: P.visit }
      for (let yr = y0; yr <= y1; yr++) {
        const x = L + (Date.UTC(yr, 0, 1) - A) / (B - A) * (R - L)
        els.push(h('line', { key: `g${yr}`, x1: x, x2: x, y1: 16, y2: 2000, stroke: P.grid }))
        if (yr < y1) els.push(h('text', { key: `t${yr}`, x: x + 4, y: 12, fill: P.ink3, fontSize: 10.5, fontFamily: 'SF Mono,Menlo' }, String(yr)))
      }
      const isSel = (kind, id) => sel && sel.kind === kind && sel.id === id
      /** 一块条／块：平面模式画矩形；2.5D 模式加投影与顶部高光，像浮在泳道上。 */
      const block = (key, x, by, w, hh, color, { opacity = 1, props = {}, title, selected } = {}) => {
        const sStroke = selected ? { stroke: P.ink, strokeWidth: 1.6 } : {}
        const r = Math.min(hh / 2, 3)
        if (!depth) return h('rect', { key, x, y: by, width: w, height: hh, rx: 2, fill: color, opacity, ...props, ...sStroke }, title ? h('title', {}, title) : null)
        return h('g', { key, ...props }, title ? h('title', {}, title) : null,
          h('rect', { x: x + 0.5, y: by + 2.5, width: w, height: hh, rx: r, fill: '#000', opacity: 0.32 * opacity, filter: 'url(#me-soft)' }),
          h('rect', { x, y: by, width: w, height: hh, rx: r, fill: color, opacity, ...sStroke }),
          h('rect', { x, y: by, width: w, height: hh, rx: r, fill: 'url(#me-sheen)', opacity: 0.9 * opacity, pointerEvents: 'none' }))
      }
      /** 菱形标记：2.5D 模式带投影和上半受光面。 */
      const gem = (key, x1, ry, color, { props = {}, title, edge, edgeW } = {}) => {
        const d = `M${x1} ${ry - 1} l5.5 5.5 l-5.5 5.5 l-5.5 -5.5z`
        if (!depth) return h('path', { key, d, fill: color, stroke: edge ?? 'none', strokeWidth: edgeW, ...props }, title ? h('title', {}, title) : null)
        return h('g', { key, ...props }, title ? h('title', {}, title) : null,
          h('path', { d: `M${x1 + 0.5} ${ry + 1.5} l5.5 5.5 l-5.5 5.5 l-5.5 -5.5z`, fill: '#000', opacity: 0.35, filter: 'url(#me-soft)' }),
          h('path', { d, fill: color, stroke: edge ?? 'none', strokeWidth: edgeW }),
          h('path', { d: `M${x1} ${ry - 1} l5.5 5.5 h-11z`, fill: '#fff', opacity: 0.28, pointerEvents: 'none' }))
      }
      for (const lane of tl.lanes) {
        if (!lane.rows.length) continue
        const color = C[lane.kind] ?? P.ink2
        const top = y
        const hgt = lane.rows.length * 20 + 12
        if (depth) bands.push(h('rect', { key: `bd${lane.id}`, x: 0, y: top, width: W, height: hgt, fill: bands.length % 2 ? 'transparent' : P.band, opacity: 0.6 }))
        els.push(h('line', { key: `ln${lane.id}`, x1: 0, x2: W, y1: y, y2: y, stroke: P.lane }))
        lane.rows.forEach((row, ri) => {
          const ry = y + 8 + ri * 20
          if (depth) els.push(h('line', { key: `rg${lane.id}${ri}`, x1: L, x2: R, y1: ry + 10.5, y2: ry + 10.5, stroke: P.grid, strokeOpacity: 0.7, strokeDasharray: '1 3' }))
          els.push(h('text', { key: `rl${lane.id}${ri}`, x: 34, y: ry + 9, fill: P.ink2, fontSize: 10.5 }, row.label.length > 9 ? `${row.label.slice(0, 9)}…` : row.label))
          row.items.forEach((it, ii) => {
            if (!it.a) return
            const k = `${lane.id}${ri}-${ii}`
            const before = toT(it.a) < A
            const x1 = Math.max(L, X(it.a)); const x2 = Math.max(x1 + 2, X(it.b ?? it.a))
            if (before) els.push(h('path', { key: `${k}<`, d: `M${L - 2} ${ry + 4} l7 -5 v10z`, fill: color, opacity: 0.8 }, h('title', {}, `${row.label}：${it.a} 起（早于时间轴）`)))
            if (before && toT(it.b ?? it.a) < A) return
            const click = it.event ? { onClick: () => onSelect({ kind: 'event', id: it.event }), style: { cursor: 'pointer' } } : {}
            const selected = !!(it.event && isSel('event', it.event))
            if (it.kind === 'tick') els.push(depth ? block(k, x1 - 0.75, ry, 1.5, 10, P.tick) : h('line', { key: k, x1, x2: x1, y1: ry, y2: ry + 10, stroke: P.tick }))
            else if (it.kind === 'stay') els.push(block(k, x1 - 1, ry - 1, Math.max(5, x2 - x1 + 2), 12, P.visit, { title: `住院 ${it.a}～${it.b} ${it.label ?? ''}` }))
            else if (it.kind === 'bar') els.push(block(k, x1, ry, x2 - x1, 9, color, { opacity: it.faint ? 0.35 : depth ? 0.92 : 0.85, props: click, selected, title: `${row.label} ${it.a}～${it.b}${it.n ? ` · ${it.n} 条提及` : ''}` }))
            else if (it.kind === 'stop') els.push(block(k, x1 - 1, ry - 2, 3, 13, P.ink, { props: click, title: `${row.label} 停用 ${it.a}` }))
            else els.push(gem(k, x1, ry, color, { props: click, edge: it.conflict ? P.bad : selected ? P.ink : undefined, edgeW: it.conflict ? 1.8 : 1.4, title: `${row.label}${it.label ? ` ${it.label}` : ''} ${it.a}${it.b && it.b !== it.a ? `～${it.b}` : ''}${it.conflict ? ' · 时间不一致' : ''}` }))
          })
        })
        els.push(h('rect', { key: `lb${lane.id}`, x: 0, y: top + 1, width: 3, height: hgt - 2, fill: color, opacity: 0.8 }))
        ;[...lane.name].forEach((ch, i) => els.push(h('text', { key: `lc${lane.id}${i}`, x: 16, y: top + 17 + i * 14, fill: color === P.visit ? P.ink : color, fontSize: 11.5, fontWeight: 700, textAnchor: 'middle' }, ch)))
        y += hgt
      }
      // labs
      if (tl.series.length) {
        els.push(h('line', { key: 'lnlab', x1: 0, x2: W, y1: y, y2: y, stroke: P.lane }))
        const top = y
        const hgt = tl.series.length * 40 + 8
        if (depth) bands.push(h('rect', { key: 'bdlab', x: 0, y: top, width: W, height: hgt, fill: bands.length % 2 ? 'transparent' : P.band, opacity: 0.6 }))
        tl.series.forEach((s, si) => {
          const sy = y + 6 + si * 40; const hh = 30
          const vs = s.points.map((p) => p.v); const lo = Math.min(...vs); const hi = Math.max(...vs)
          const Y = (v) => sy + hh - (hi === lo ? hh / 2 : (v - lo) / (hi - lo) * hh)
          els.push(h('text', { key: `sl${si}`, x: 34, y: sy + 12, fill: P.ink2, fontSize: 10.5 }, s.name))
          els.push(h('text', { key: `sr${si}`, x: 34, y: sy + 25, fill: P.ink3, fontSize: 9 }, `${lo}–${hi}`))
          const line = s.points.map((p) => [X(p.d), Y(p.v)])
          if (depth && line.length) {
            // 立起来的“缎带”：折线与它向纵深平移的副本之间填色；下方投一层渐隐的地面
            // 曲线下方渐隐填充＋柔和投影
            els.push(h('polygon', { key: `sg${si}`, points: pts([[line[0][0], sy + hh + 2], ...line, [line.at(-1)[0], sy + hh + 2]]), fill: 'url(#me-area)' }))
            els.push(h('path', { key: `sd${si}`, d: line.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py + 2.5}`).join(''), stroke: '#000', strokeWidth: 1.6, fill: 'none', opacity: 0.3, filter: 'url(#me-soft)' }))
          }
          els.push(h('path', { key: `sp${si}`, d: line.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(''), stroke: P.fact, strokeWidth: depth ? 1.5 : 1.1, fill: 'none', opacity: depth ? 1 : 0.8 }))
          s.points.forEach((p, i) => els.push(h('circle', { key: `sc${si}-${i}`, cx: X(p.d), cy: Y(p.v), r: depth ? 2.4 : 1.8, fill: P.fact, stroke: depth ? P.halo : 'none', strokeWidth: 1, style: { cursor: 'pointer' }, onClick: () => onSelect({ kind: 'event', id: p.event }) }, h('title', {}, `${s.name} ${p.v} · ${p.d}`))))
        })
        els.push(h('rect', { key: 'lblab', x: 0, y: top + 1, width: 3, height: hgt - 2, fill: P.fact, opacity: 0.8 }))
        ;['检', '验'].forEach((ch, i) => els.push(h('text', { key: `lcl${i}`, x: 16, y: top + 17 + i * 14, fill: P.fact, fontSize: 11.5, fontWeight: 700, textAnchor: 'middle' }, ch)))
        y += hgt
      }
      // findings
      els.push(h('line', { key: 'lnf', x1: 0, x2: W, y1: y, y2: y, stroke: P.lane }))
      ;['发', '现'].forEach((ch, i) => els.push(h('text', { key: `lcf${i}`, x: 16, y: y + 17 + i * 14, fill: P.warn, fontSize: 11.5, fontWeight: 700, textAnchor: 'middle' }, ch)))
      tl.findings.forEach((f, i) => {
        if (!f.at) return
        const x = X(f.at)
        els.push(block(`f${i}`, x - 3, y + 8 + (i % 2) * 14, 6, 12, VC[f.verdict] ?? P.ink2, { selected: isSel('finding', f.id), props: { style: { cursor: 'pointer' }, onClick: () => onSelect({ kind: 'finding', id: f.id }) }, title: `${f.verdict}·${f.subclass}：${f.why}` }))
      })
      y += 42
      if (cutoff) {
        const cx = X(cutoff)
        els.push(h('rect', { key: 'cut', x: cx, y: 16, width: Math.max(0, R - cx), height: y - 16, fill: P.shade, pointerEvents: 'none' }))
        els.push(h('line', { key: 'cutl', x1: cx, x2: cx, y1: 16, y2: y, stroke: P.warn, strokeDasharray: '4 3', strokeWidth: 1.3 }))
        els.push(h('text', { key: 'cutt', x: cx + 5, y: 28, fill: P.warn, fontSize: 10 }, '可见截断：之后写成的不可见（按 as-of 重跑可重算）'))
      }
      const defs = depth ? h('defs', { key: 'defs' },
        h('filter', { id: 'me-soft', x: '-20%', y: '-50%', width: '140%', height: '220%' }, h('feGaussianBlur', { stdDeviation: 1.6 })),
        h('linearGradient', { id: 'me-sheen', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, stopColor: '#fff', stopOpacity: 0.32 }), h('stop', { offset: 0.45, stopColor: '#fff', stopOpacity: 0.04 }), h('stop', { offset: 1, stopColor: '#000', stopOpacity: 0.12 })),
        h('linearGradient', { id: 'me-area', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, stopColor: P.fact, stopOpacity: 0.22 }), h('stop', { offset: 1, stopColor: P.fact, stopOpacity: 0 }))) : null
      return h('svg', { width: W, height: y, style: { display: 'block' } }, defs, bands, els)
    }

    function MentionRow({ m, gotoSource }) {
      return h('div', { className: 'me-mrow' },
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'baseline' } }, h('span', { className: 'me-num me-muted' }, m.writtenAt?.slice(0, 10)), h('span', { className: 'me-faint' }, `${m.recordType}${m.section && m.section !== m.recordType ? `／${m.section}` : ''}`), h('span', { className: 'me-sp' }),
          m.fragmentId && gotoSource ? h('button', { className: 'me-btn sm', onClick: () => gotoSource(m.fragmentId) }, '原文') : null),
        h('div', { style: { margin: '3px 0' } }, m.text),
        h('div', { className: 'me-faint', style: { fontSize: 10.5 } }, h('span', { className: `me-chip ${m.tier <= 2 ? 'ok' : ''}` }, `${m.tierName} · ${m.tier}`), `→ ${m.occurFrom ?? '?'}${m.occurTo && m.occurTo !== m.occurFrom ? `～${m.occurTo}` : ''} · ${m.timeSource ?? ''}${m.rule ? ` · ${m.rule}` : ''}`))
    }

    function EventDetail({ run, patient, eventId, gotoSource, onFinding, onEvent }) {
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
        d.value.links?.length ? h(React.Fragment, {}, h('div', { className: 'me-sec' }, h('b', {}, '印证关系'), h('span', { className: 'me-cap' }, '只连不并')),
          d.value.links.map((l) => h('div', { key: l.id, className: 'me-mrow' },
            h('div', { style: { display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' } },
              h('span', { className: `me-chip ${l.to ? 'ok' : 'w'}` }, l.dir === 'out' ? `${l.relation} →` : `← ${l.relation}`),
              l.other ? h('a', { className: 'me-tl', style: { cursor: 'pointer' }, onClick: () => onEvent?.(l.other.id) }, `${l.other.concept ?? l.other.conceptGroup}（${l.other.form} · ${l.other.a ?? ''}）`) : h('span', { className: 'me-warn' }, '无法印证：记录里找不到它本身'),
              h('span', { className: 'me-faint' }, l.rule)),
            l.note ? h('div', { className: 'me-faint', style: { fontSize: 10.5 } }, l.note) : null))) : null,
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
      const model = d.value.model?.[0]
      const save = async () => {
        try { await call('decide', { runId: run.id, kind: 'finding', target: f.id, decision: choice, note }); setSaved('已保存；下次重跑沿用'); onDecided?.() } catch (e) { setSaved(msg(e)) }
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
        h('div', { className: 'me-sec' }, h('b', {}, '你的判断'), h('span', { className: 'me-cap' }, 'DECISION')),
        options.map((o) => h('div', { key: o, className: `me-opt${choice === o ? ' on' : ''}`, onClick: () => setChoice(o) }, o)),
        h('textarea', { className: 'me-input', style: { width: '100%', height: 46, marginTop: 4 }, placeholder: '备注（可选）', value: note, onChange: (e) => setNote(e.target.value) }),
        h('div', { style: { display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' } },
          h('button', { className: 'me-btn pri', disabled: !choice, onClick: save }, '保存判断'),
          f.review ? h('button', { className: 'me-btn', onClick: async () => { await call('decide', { runId: run.id, kind: 'finding', target: f.id, decision: 'clear' }); setChoice(null); setSaved('已撤销'); onDecided?.() } }, '撤销判断') : null,
          gotoReview ? h('button', { className: 'me-btn', onClick: () => gotoReview(f.id) }, '去复核') : null,
          h('span', { className: 'me-tl' }, saved)),
        h('div', { className: 'me-faint', style: { fontSize: 10.5, marginTop: 6 } }, '判断按稳定编号写入记录库（_records/records.sqlite），每次改动留痕；点复核页的「更新事件包」或重跑后生效，不改原文。'))
    }


    /* ---------------------------------------------------------------- calls */
    const ROLE_NAME = { read: '通读', verify: '核验', 'review-read': '复查（通读模型）', 'review-verify': '复查（核验模型）', format: '格式识别', 'format-verify': '格式识别（核验）', suggest: '建议（旧版本）' }
    function Calls({ run }) {
      const d = useAsync(() => call('calls', { runId: run.id }), [run.id, run.totals?.calls, run.status])
      const v = d.value
      return h('div', { className: 'me-frame me-scroll me-pad', style: { flex: 1 } },
        h('div', { className: 'me-h' }, h('b', {}, '模型调用'), h('span', { className: 'me-cap' }, 'MODELS'), h('span', { className: 'me-faint' }, '按角色与模型累计；不记提示词与回复内容（回复缓存在记录库，供重跑复用）')),
        !v?.byModel?.length ? h('div', { className: 'me-empty' }, run.model ? '还没有调用。' : '本批次未配置模型。') : h('table', {},
          h('thead', {}, h('tr', {}, ['角色', '模型', '调用', '失败', '缓存复用', '平均耗时', '输入 Token', '输出 Token'].map((x) => h('th', { key: x }, x)))),
          h('tbody', {}, v.byModel.map((m) => h('tr', { key: m.role + m.model }, h('td', {}, ROLE_NAME[m.role] ?? m.role), h('td', {}, m.model), h('td', { className: 'me-num' }, fmt(m.calls)), h('td', { className: `me-num ${m.failed ? 'me-bad' : ''}` }, fmt(m.failed)), h('td', { className: 'me-num' }, fmt(m.cached)),
            h('td', { className: 'me-num' }, m.calls ? `${(m.ms / m.calls / 1000).toFixed(1)}s` : '—'), h('td', { className: 'me-num' }, fmt(m.prompt_tokens)), h('td', { className: 'me-num' }, fmt(m.completion_tokens)))))),
        v?.errors?.length ? h(React.Fragment, {}, h('div', { className: 'me-sec' }, h('b', {}, '最近的失败')),
          h('table', {}, h('tbody', {}, v.errors.map((c, i) => h('tr', { key: i }, h('td', { className: 'me-num me-faint' }, fmtTime(c.at)), h('td', {}, ROLE_NAME[c.role] ?? c.role), h('td', {}, c.patient ?? ''), h('td', {}, c.model), h('td', { className: 'me-bad' }, c.error)))))) : null)
    }

    /* 报告：Markdown 渲染（同匿名化插件）——标题、表格、列表、引用、粗体、行内代码；只生成 React 元素，不注入 HTML */
    function inlineMd(text, keyBase) {
      const out = []
      const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g
      let last = 0; let m; let i = 0
      while ((m = pattern.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index))
        const tk = m[0]
        out.push(tk.startsWith('`') ? h('code', { key: `${keyBase}-${i}` }, tk.slice(1, -1)) : h('strong', { key: `${keyBase}-${i}` }, tk.slice(2, -2)))
        last = m.index + tk.length; i++
      }
      if (last < text.length) out.push(text.slice(last))
      return out
    }
    function markdownBlocks(lines) {
      const blocks = []; let i = 0
      const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      while (i < lines.length) {
        const line = lines[i]; const key = `b${i}`
        if (!line.trim()) { i++; continue }
        const hd = /^(#{1,4})\s+(.*)$/.exec(line)
        if (hd) { blocks.push(h(`h${hd[1].length}`, { key, id: `me-md-l${i}` }, inlineMd(hd[2], key))); i++; continue }
        if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
          const head = cells(line); const rows = []
          i += 2
          while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++ }
          // 两列「项 | 值」的表画成键值表，第一列不加粗底色
          const kvTable = head.length === 2 && /^(项|项目)$/.test(head[0])
          blocks.push(h('div', { key, className: 'me-mdv-tw' }, h('table', { className: kvTable ? 'kv' : '' },
            kvTable ? null : h('thead', {}, h('tr', {}, head.map((c, ci) => h('th', { key: ci }, inlineMd(c, `${key}h${ci}`))))),
            h('tbody', {}, rows.map((r, ri) => h('tr', { key: ri }, r.map((c, ci) => h(kvTable && ci === 0 ? 'th' : 'td', { key: ci }, inlineMd(c, `${key}r${ri}c${ci}`)))))))))
          continue
        }
        if (line.startsWith('>')) {
          const q = []
          while (i < lines.length && lines[i].startsWith('>')) { q.push(lines[i].replace(/^>\s?/, '')); i++ }
          blocks.push(h('blockquote', { key }, inlineMd(q.join(' '), key))); continue
        }
        if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
          const ordered = /^\s*\d+\.\s+/.test(line); const items = []
          while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i])) { items.push(h('li', { key: i }, inlineMd(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ''), `${key}i${i}`))); i++ }
          blocks.push(h(ordered ? 'ol' : 'ul', { key }, items)); continue
        }
        const para = []
        while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(lines[i])) { para.push(lines[i]); i++ }
        if (!para.length) { para.push(line); i++ }
        blocks.push(h('p', { key }, inlineMd(para.join(' '), key)))
      }
      return blocks
    }
    function Report({ run }) {
      const d = useAsync(() => call('report', { runId: run.id }), [run.id, run.status])
      const [copied, setCopied] = useState(false)
      const [active, setActive] = useState(null)
      const boxRef = React.useRef(null)
      const text = d.value?.markdown ?? ''
      const lines = React.useMemo(() => String(text).split(/\r?\n/), [text])
      const blocks = React.useMemo(() => markdownBlocks(lines), [lines])
      const toc = React.useMemo(() => lines.map((l, i) => [l, i]).filter(([l]) => /^#{2,3}\s/.test(l)).map(([l, i]) => ({ i, level: /^###/.test(l) ? 3 : 2, title: l.replace(/^#{2,3}\s+/, '').replace(/[`*]/g, '') })), [lines])
      // 目录高亮滚到顶部的那一节
      useEffect(() => {
        const box = boxRef.current; if (!box || toc.length < 2) return undefined
        let fr = 0
        const on = () => { cancelAnimationFrame(fr); fr = requestAnimationFrame(() => {
          const top = box.getBoundingClientRect().top + 24; let hit = null
          for (const it of toc) { const n = document.getElementById(`me-md-l${it.i}`); if (n && n.getBoundingClientRect().top <= top) hit = it.i; else if (n) break }
          setActive(hit)
        }) }
        on(); box.addEventListener('scroll', on, { passive: true })
        return () => { box.removeEventListener('scroll', on); cancelAnimationFrame(fr) }
      }, [toc])
      if (!d.value) return h('div', { className: 'me-frame me-empty', style: { flex: 1 } }, d.error ?? '加载中…')
      return h('div', { className: 'me-frame me-col', style: { flex: 1, minHeight: 0 } },
        h('div', { className: 'me-pad me-mdv-bar' },
          h('span', { className: 'me-faint', title: d.value.path }, d.value.path),
          h('button', { className: 'me-btn sm', onClick: () => { navigator.clipboard?.writeText(d.value.path).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {}) } }, copied ? '已复制' : '复制路径')),
        h('div', { className: 'me-scroll me-pad', ref: boxRef, style: { flex: 1 } },
          h('div', { className: toc.length >= 2 ? 'me-mdv-layout' : '' },
            h('div', { className: 'me-mdv' }, blocks),
            toc.length >= 2 ? h('nav', { className: 'me-mdv-toc', 'aria-label': '目录' }, h('div', { className: 'me-mdv-toc-h' }, '目录'),
              toc.map((it) => h('button', { key: it.i, type: 'button', title: it.title, className: `me-mdv-toc-i l${it.level}${active === it.i ? ' on' : ''}`, onClick: () => document.getElementById(`me-md-l${it.i}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, it.title))) : null)))
    }

    /* --------------------------------------------------------------- settings */
    /**
     * 模型名称：可输入，也可从端点的 /models 下拉选择（同匿名化插件）。
     * 聚焦或点 ▾ 时取列表；端点或 Key 变了重新取。
     */
    function ModelPicker({ value, onChange, placeholder, baseURL, apiKey }) {
      const [open, setOpen] = useState(false)
      const [st, setSt] = useState({ src: null, loading: false, models: [], error: '' })
      const box = React.useRef(null)
      const src = `${baseURL}|${apiKey}`
      const load = async (force = false) => {
        if (!force && st.src === src && (st.loading || st.models.length || st.error)) return
        setSt({ src, loading: true, models: [], error: '' })
        try { const r = await call('models', { baseURL, apiKey }); setSt({ src, loading: false, models: r.models ?? [], error: r.ok ? '' : r.error ?? '取不到模型列表' }) } catch (e) { setSt({ src, loading: false, models: [], error: msg(e) }) }
      }
      useEffect(() => {
        if (!open) return undefined
        const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
      }, [open])
      const stale = st.src !== src
      const q = String(value ?? '').trim().toLowerCase()
      const list = stale ? [] : st.models
      const shown = q && list.some((n) => n.toLowerCase() === q) ? list : list.filter((n) => !q || n.toLowerCase().includes(q))
      const note = (t, cls = '') => h('div', { className: `me-mp-note ${cls}` }, t)
      return h('div', { className: 'me-mp', ref: box },
        h('div', { className: 'me-mp-row' },
          h('input', { className: 'me-input', value: value ?? '', placeholder, autoComplete: 'off', spellCheck: false, onChange: (e) => { onChange(e.target.value); setOpen(true) }, onFocus: () => { setOpen(true); load() }, onKeyDown: (e) => { if (e.key === 'Escape') setOpen(false) } }),
          h('button', { type: 'button', className: 'me-btn me-mp-btn', title: '从端点取模型列表', onClick: () => { setOpen(true); load(true) } }, st.loading && !stale ? '…' : '▾')),
        open ? h('div', { className: 'me-mp-menu', role: 'listbox' },
          stale || st.loading ? note('正在取模型列表…')
            : st.error ? note(`取不到模型列表：${st.error}`, 'bad')
              : !list.length ? note('端点没有列出模型，请直接输入名称')
                : [
                  value ? h('button', { key: '__clear', type: 'button', className: 'me-mp-item me-mp-clear', onClick: () => { onChange(''); setOpen(false) } }, '清空') : null,
                  ...shown.map((n) => h('button', { key: n, type: 'button', role: 'option', 'aria-selected': n === value ? 'true' : 'false', className: `me-mp-item${n === value ? ' on' : ''}`, onClick: () => { onChange(n); setOpen(false) } }, n)),
                  shown.length ? null : h('div', { key: '__none', className: 'me-mp-note' }, '没有匹配的模型'),
                ]) : null)
    }

    const SET_TABS = [
      ['model', '模型连接', ['baseURL', 'model', 'apiKey', 'clearKey', 'verifyBaseURL', 'verifyModel', 'disableThinking', 'timeoutMs', 'modelConcurrency', 'verifyConcurrency', 'autoConcurrency']],
      ['read', '通读与核验', ['readMode', 'verifySampleRate', 'verifyThreshold', 'maxRounds', 'specialty']],
      ['format', '格式识别', ['borrowFormats', 'elementDict']],
      ['batch', '批次与界面', ['outputRoot', 'workers', 'shardUnits', 'compress', 'xlsx', 'showSidebarEntry']],
    ]

    function SettingsSection({ inModal = false } = {}) {
      const [cfg, setCfg] = useState(null)
      const [base, setBase] = useState({})
      const [form, setForm] = useState({})
      const [tab, setTab] = useState('model')
      const [state, setState] = useState({ text: '', tone: '' })
      const [saving, setSaving] = useState(false)
      const [tests, setTests] = useState({})
      const load = () => call('config').then((c) => {
        const f = { ...c.settings, specialty: [].concat(c.settings.specialty ?? []).join(','), apiKey: '', clearKey: false }
        setCfg(c); setBase(f); setForm(f)
      }).catch((e) => setState({ text: msg(e), tone: 'bad' }))
      useEffect(() => { load() }, [])
      if (!cfg) return h('div', { className: 'me-settings' }, h('style', {}, CSS), state.text || '加载中…')
      const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setState({ text: '', tone: '' }) }
      const same = (a, b) => String(a ?? '') === String(b ?? '')
      const dirty = new Set(Object.keys(form).filter((k) => (typeof form[k] === 'boolean' || typeof base[k] === 'boolean' ? (form[k] !== false) !== (base[k] !== false) : !same(form[k], base[k]))))
      const field = (k, label, props = {}, hint) => h('label', { className: 'me-field' }, label, h('input', { className: 'me-input', value: form[k] ?? '', onChange: (e) => set(k, e.target.value), ...props }), hint ? h('small', { className: 'me-shint' }, hint) : null)
      const check = (k, label, hint) => h('label', { className: 'me-scheck' }, h('input', { type: 'checkbox', checked: form[k] !== false, onChange: (e) => set(k, e.target.checked) }), h('span', {}, label, hint ? h('small', { className: 'me-shint' }, hint) : null))
      const select = (k, label, opts, hint) => h('label', { className: 'me-field' }, label, h('select', { className: 'me-input', value: form[k] ?? '', onChange: (e) => set(k, e.target.value) }, opts.map(([v, l]) => h('option', { key: v, value: v }, l))), hint ? h('small', { className: 'me-shint' }, hint) : null)
      const card = (title, hint, ...body) => h('div', { className: 'me-scard' }, h('div', { className: 'me-scard-h' }, h('b', {}, title), hint ? h('p', { className: 'me-shint' }, hint) : null), ...body)
      const num = (k, d) => (form[k] === '' || form[k] == null ? d : Number(form[k]))
      const endpointOf = (which) => (which === 'verify' ? form.verifyBaseURL || form.baseURL : form.baseURL) || ''
      const test = async (which) => {
        const name = String(which === 'verify' ? form.verifyModel : form.model).trim()
        setTests((t) => ({ ...t, [which]: { pending: true } }))
        try {
          const r = await call('models', { baseURL: endpointOf(which), apiKey: form.apiKey || '' })
          const tone = !r.ok ? 'bad' : name && r.models.length && !r.models.includes(name) ? 'bad' : 'ok'
          const text = !r.ok ? `连接失败：${r.error}` : !name ? `已连通，端点有 ${r.models.length} 个模型；请选一个` : r.models.length && !r.models.includes(name) ? `已连通，但端点没有「${name}」` : `已连通，模型「${name}」可用`
          setTests((t) => ({ ...t, [which]: { tone, text } }))
        } catch (e) { setTests((t) => ({ ...t, [which]: { tone: 'bad', text: msg(e) } })) }
      }
      const testLine = (which) => { const x = tests[which]; return h('div', { className: 'me-sact' }, h('button', { type: 'button', className: 'me-btn sm', disabled: x?.pending || !endpointOf(which), onClick: () => test(which) }, x?.pending ? '测试中…' : '测试连接'), x && !x.pending ? h('span', { className: `me-shint ${x.tone}` }, x.text) : null) }
      const save = async () => {
        const patch = {
          outputRoot: form.outputRoot ?? '', readMode: MODE_LABEL[form.readMode] ? form.readMode : 'hybrid', specialty: String(form.specialty ?? '').split(/[,，\s]+/).filter(Boolean),
          baseURL: String(form.baseURL ?? '').trim(), model: String(form.model ?? '').trim(), verifyBaseURL: String(form.verifyBaseURL ?? '').trim(), verifyModel: String(form.verifyModel ?? '').trim(), disableThinking: form.disableThinking !== false,
          timeoutMs: num('timeoutMs', 120000), modelConcurrency: num('modelConcurrency', 8), verifyConcurrency: num('verifyConcurrency', 8), maxRounds: Math.max(1, Math.min(6, num('maxRounds', 3))), workers: num('workers', 0), shardUnits: num('shardUnits', 4),
          verifySampleRate: num('verifySampleRate', 0.1), verifyThreshold: num('verifyThreshold', 0.9), autoConcurrency: form.autoConcurrency !== false, showSidebarEntry: form.showSidebarEntry !== false,
          borrowFormats: form.borrowFormats !== false, elementDict: form.elementDict ?? '', compress: form.compress !== false, xlsx: form.xlsx === true,
        }
        if (form.apiKey) patch.apiKey = form.apiKey
        else if (form.clearKey === true) patch.apiKey = ''
        setSaving(true)
        try { await call('saveDefaults', patch); setState({ text: '已保存（插件会重新加载）', tone: 'ok' }); setBase({ ...form, apiKey: '', clearKey: false }); setForm((f) => ({ ...f, apiKey: '', clearKey: false })) } catch (e) { setState({ text: msg(e), tone: 'bad' }) } finally { setSaving(false) }
      }
      const sameName = form.verifyModel && String(form.verifyModel).trim() === String(form.model ?? '').trim() && (form.verifyBaseURL || form.baseURL) === form.baseURL
      const panels = {
        model: () => h(React.Fragment, {},
          card('通读模型', '逐句通读文书：拆成提及、判类型、找时间短语；也给格式识别起草。必须配置，否则不能开始批次。病历内容只发往这里配置的端点，Agent 不能更改。',
            h('div', { className: 'me-grid2' },
              field('baseURL', '端点（OpenAI 兼容）', { placeholder: 'http://127.0.0.1:11434/v1' }),
              h('div', { className: 'me-field' }, '模型', h(ModelPicker, { value: form.model, onChange: (v) => set('model', v), placeholder: '输入或从下拉选择', baseURL: form.baseURL ?? '', apiKey: form.apiKey ?? '' })),
              h('label', { className: 'me-field me-wide' }, 'API Key', h('input', { className: 'me-input', type: 'password', autoComplete: 'off', value: form.apiKey ?? '', placeholder: cfg.hasApiKey && !form.clearKey ? '已保存（留空不修改）' : '没有可不填', onChange: (e) => { set('apiKey', e.target.value); if (e.target.value) set('clearKey', false) } }))),
            cfg.hasApiKey ? h('label', { className: 'me-scheck' }, h('input', { type: 'checkbox', checked: form.clearKey === true, onChange: (e) => { set('clearKey', e.target.checked); if (e.target.checked) set('apiKey', '') } }), h('span', {}, '清除已保存的 API Key')) : null,
            testLine('read')),
          card('核验模型', '抽查一部分句子：逐条审通读结果、背靠背再判类型与时间、补漏；有分歧的两个模型轮流复查。可不配，不配就不做抽样核验。最好和通读模型不是同一个。',
            h('div', { className: 'me-grid2' },
              field('verifyBaseURL', '端点（空＝同通读模型）', { placeholder: form.baseURL || 'http://127.0.0.1:11434/v1' }),
              h('div', { className: 'me-field' }, '模型', h(ModelPicker, { value: form.verifyModel, onChange: (v) => set('verifyModel', v), placeholder: '空＝不做抽样核验', baseURL: form.verifyBaseURL || form.baseURL || '', apiKey: form.apiKey ?? '' }))),
            sameName ? h('p', { className: 'me-shint bad' }, `核验模型和通读模型都是「${form.model}」：等于自己核自己，一致率会偏高`) : null,
            form.verifyModel ? testLine('verify') : null),
          card('调用', '两个模型共用。',
            check('disableThinking', '关闭思考模式', '推理模型（如 Qwen3）更快、更省 token'),
            h('div', { className: 'me-grid2' },
              field('timeoutMs', '单次调用超时（毫秒）', { type: 'number', min: 10000 }),
              field('modelConcurrency', '通读模型并发', { type: 'number', min: 1 }, '同时进行的请求数'),
              field('verifyConcurrency', '核验模型并发', { type: 'number', min: 1 }, '和通读模型同端点同模型时共用上一项')),
            check('autoConcurrency', '自动调并发', '上面两个并发只是起始值，每 30 秒按吞吐自动加减（最多 64）；服务器排队、KV 将满或出错时降'))),
        read: () => h(React.Fragment, {},
          card('通读', null,
            h('div', { className: 'me-grid2' },
              select('readMode', '默认模式', Object.entries(MODE_LABEL), 'hybrid：模型漏的规则补上，复查仍不一致时规则投第三票；model：只用模型，仍不一致直接转人工'),
              field('specialty', '专科层规则包', { placeholder: '如 hemodialysis；空＝不装专科包' }, '多个用逗号分开；不装也能跑'))),
          card('抽样核验与复查', '需要配置核验模型。',
            h('div', { className: 'me-grid2' },
              field('verifySampleRate', '核验抽查比例（0–1）', { type: 'number', step: 0.01, min: 0, max: 1 }, '按句子内容稳定抽样；1＝全部核验'),
              field('verifyThreshold', '质检⑤一致率阈值（0–1）', { type: 'number', step: 0.01, min: 0, max: 1 }),
              field('maxRounds', '复查轮次上限（1–6）', { type: 'number', min: 1, max: 6 }, '分歧时两个模型轮流复查，仍不一致转人工')))),
        format: () => card('格式识别（非区域平台导出）', '按表识别类别、写成时间、病人、就诊与栏目：规则的方案＋通读模型、核验模型各自独立起草，一致才自动采用，有分歧的先复查，其余在「格式」页确认。只发字段名、统计和截短样例，不发正文。',
          check('borrowFormats', '借用病历文书提取插件已采用的识别结果'),
          field('elementDict', '数据元对照表', { placeholder: 'csv／xlsx／json 路径，两列：编码、名称' })),
        batch: () => h(React.Fragment, {},
          card('批次', null,
            h('div', { className: 'me-grid2' },
              field('outputRoot', '默认输出根目录', { placeholder: '空＝输入旁的 _medical-event' }),
              field('workers', '工作线程数', { type: 'number', min: 0 }, '0＝自动'),
              field('shardUnits', '每个数据块的病人数', { type: 'number', min: 1 })),
            check('compress', '事件包的大表 gzip 压缩', '每位病人约 5MB，不压缩约 40MB'),
            check('xlsx', '每位病人另导出一份 结果.xlsx', '约 15MB/人，默认关')),
          card('界面', null, check('showSidebarEntry', '在左侧栏显示「病历事件还原」入口'))),
      }
      return h('div', { className: 'me-settings' }, h('style', {}, CSS),
        inModal ? null : h('p', { className: 'me-shint', style: { margin: 0 } }, '这里只放配置。运行批次、复核，请到左侧栏的「病历事件还原」，或在聊天框使用 /event。'),
        h('div', { className: 'me-stabs', role: 'tablist' }, SET_TABS.map(([id, label, keys]) => h('button', { key: id, type: 'button', role: 'tab', 'aria-selected': tab === id ? 'true' : 'false', className: 'me-stab', onClick: () => setTab(id) }, label, keys.some((k) => dirty.has(k)) ? h('span', { className: 'me-sdot', title: '有未保存的修改' }) : null))),
        h('div', { role: 'tabpanel', className: 'me-spanel' }, panels[tab]()),
        h('div', { className: 'me-savebar' },
          h('span', { className: `me-shint ${state.tone}` }, state.text || (dirty.size ? `${dirty.size} 项未保存` : '没有未保存的修改')),
          h('span', { style: { flex: 1 } }),
          h('button', { type: 'button', className: 'me-btn', disabled: saving || !dirty.size, onClick: () => { setForm(base); setState({ text: '', tone: '' }) } }, '撤销修改'),
          h('button', { type: 'button', className: 'me-btn me-new', disabled: saving || !dirty.size, onClick: save }, saving ? '保存中…' : '保存')))
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
            try { const c = await call('config'); if (!stopped) setSidebar(c.settings?.showSidebarEntry !== false); return } catch { await new Promise((r) => setTimeout(r, 1000)) }
          }
        })()
        ctx.effect?.(() => () => { stopped = true; setSidebar(false) })
      },
    }
    return plugin
  },
})
