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
.me{--mono:"SF Mono","JetBrains Mono",Menlo,monospace;
  height:100%;box-sizing:border-box;background:var(--bg);color:var(--ink);font:12.5px -apple-system,"PingFang SC","Helvetica Neue",sans-serif;display:flex;flex-direction:column;gap:8px;padding:8px 10px 10px;color-scheme:dark;overflow:hidden}
.me.me-dark{--bg:#0c0b12;--panel:#12111b;--panel2:#181624;--panel3:#201d2e;--line:#221f31;--line2:#332e48;--ink:#ebe8f4;--ink2:#a49fba;--ink3:#6b6683;--teal:#8f6ef5;--teal2:#c9b8ff;--tealdim:rgba(143,110,245,.14);--fill:#6d4ae0;--ok:#62c27e;--warn:#f0a63a;--bad:#e5484d;--badink:#ff8a8d;--vio:#4cc9e0;--fact:#6cb4ff;--judge:#f38bc8;--decide:#4fd1a5;--visit:#8681a0;--tick:#514c68;--arrow:#423d58;--cell-ok:#62c27e;--top:#100f18;--st1:#161423;--st2:#100f18;--shade:rgba(12,11,18,.65);--sel:#ebe8f4;color-scheme:dark}
.me.me-light{--bg:#f1eff6;--panel:#fcfbfe;--panel2:#f5f3fa;--panel3:#eae6f3;--line:#e2dfec;--line2:#cdc7dc;--ink:#221d33;--ink2:#625b78;--ink3:#958fa9;--teal:#5b3cc4;--teal2:#45289e;--tealdim:rgba(91,60,196,.1);--fill:#5b3cc4;--ok:#2f9a55;--warn:#c27a12;--bad:#cf3a3f;--badink:#b83034;--vio:#0f8ea3;--fact:#1f7fd0;--judge:#c23d8c;--decide:#0f9d78;--visit:#8a84a2;--tick:#b3adc5;--arrow:#bcb6cc;--cell-ok:#3fb27a;--top:#f8f7fb;--st1:#faf9fd;--st2:#f2f0f7;--shade:rgba(241,239,246,.72);--sel:#221d33;color-scheme:light}
.me *{box-sizing:border-box}
.me-frame{border:1px solid var(--line);background:var(--panel);border-radius:6px}
.me-top{display:flex;align-items:center;gap:14px;padding:6px 12px;background:linear-gradient(90deg,color-mix(in srgb,var(--teal) 10%,transparent),transparent 40%),var(--panel);flex:none}
.me-logo{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#9a7bff,#4a27b0);display:grid;place-items:center;flex:none}
.me-brand{display:flex;align-items:center;gap:10px;flex:none}.me-brand b{display:block;font-size:15px;letter-spacing:2px}.me-brand span{font-family:var(--mono);font-size:10px;color:var(--ink2);letter-spacing:1px}
.me-status{display:flex;align-items:center;gap:8px;padding:4px 12px 4px 10px;border-radius:8px;border:1px solid var(--line2);min-width:170px;max-width:340px}
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
.me-clock.ver{margin-right:6px}.me-clock.ver b{font-size:12.5px;font-weight:500;letter-spacing:0;color:var(--ink2)}
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
.me-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
/* ---- 产线：等轴测工厂＋HUD 面板（参考工业监控大屏） ---- */
.me.me-dark{--lift:0 1px 0 rgba(255,255,255,.025) inset,0 12px 26px -22px #000}
.me.me-light{--lift:0 1px 0 rgba(255,255,255,.8) inset,0 10px 22px -20px rgba(40,20,80,.32)}
.me-frame{box-shadow:var(--lift);border-radius:4px}
.me-tab.on{color:var(--teal2);border-bottom-color:var(--teal)}
.me-tab i{color:var(--ink3)}.me-tab.on i{color:var(--teal)}
.me-stack{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:6px 0 4px;background:var(--line2)}.me-stack span{display:block;height:100%}
.me-scene{display:block;width:100%;height:auto;overflow:visible;margin:0 auto}
.me-scene text{pointer-events:none}
.me-hero{position:relative;padding:10px 12px 8px;min-height:560px;background:radial-gradient(120% 90% at 45% 55%,var(--panel2),var(--bg) 75%);display:flex;flex-direction:column;min-height:420px}
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
.me-hud.br{right:14px;top:36px;display:flex;flex-direction:column;gap:4px;font-size:10px;color:var(--ink3)}
.me-hud.br div{display:flex;align-items:center;gap:6px;justify-content:flex-end}
.me-hud .sw{width:12px;height:8px;display:inline-block;border-radius:1px}
.me-hud .sw.hot{background:var(--teal);box-shadow:0 0 5px var(--teal)}.me-hud .sw.clay{background:#c9c4d6}
.me-hud .sw.sel{border:1.5px solid var(--teal);border-right:0;border-bottom:0;background:transparent}
.me-hud .sw.box{background:#e9e6f0;border-top:2px solid var(--teal)}.me-hud .sw.red{background:var(--bad)}.me-hud .sw.vio{background:var(--vio);box-shadow:0 0 5px var(--vio)}
.me-hud .sw.flow{height:2px;background:repeating-linear-gradient(90deg,var(--ink2) 0 4px,transparent 4px 7px)}
.me-act{position:relative}
.me-new{border-color:var(--fill);background:var(--fill);color:#fff;font-weight:600}
.me-new:hover:not(:disabled){filter:brightness(1.06)}
.me-new:disabled{background:transparent;color:var(--ink2);border-color:var(--line2);font-weight:400}
.me-caret{font-size:9px;opacity:.7;margin-left:5px}
.me-shade{position:fixed;inset:0;z-index:940;background:rgba(0,0,0,.35)}
.me-pop{position:absolute;right:0;top:36px;z-index:950;width:460px;padding:14px 16px;border:1px solid color-mix(in srgb,var(--teal) 50%,transparent);border-radius:8px;background:var(--panel);box-shadow:0 20px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:10px;text-align:left}
.me-pop-h{display:flex;justify-content:space-between;align-items:center}.me-pop-h b{font-size:12px;letter-spacing:2px;color:var(--teal2);font-weight:600}
.me-pop .me-field{gap:4px}
.me-pick{display:flex;gap:8px;align-items:center;font-size:10.5px}
.me-pop-act{display:flex;gap:8px;margin-top:2px}
.me-pop-act .me-btn{height:32px}
.me-hero-cap{display:flex;align-items:center;gap:10px}
.me-live{font-family:var(--mono);font-size:10.5px;letter-spacing:1px;color:var(--teal);display:inline-flex;align-items:center;gap:6px}
.me-live i{width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 6px currentColor;animation:me-pulse 1.6s ease-in-out infinite}
.me-live.ok{color:var(--ok)}.me-live.bad{color:var(--bad)}
.me-hero-err{margin:8px 0 0;align-self:flex-start;max-width:720px;font-size:12px}
.me-hero-legend{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
.me-bay{font-size:11px;color:var(--ink2);background:transparent;border:1px solid var(--line2);border-radius:3px;padding:2px 8px;cursor:pointer;display:flex;gap:6px;align-items:center}
.me-bay b{font-family:var(--mono);font-weight:500;font-size:10px;color:var(--ink3)}
.me-bay.hold,.me-bay.run{border-color:color-mix(in srgb,var(--teal) 45%,transparent)}.me-bay.hold b,.me-bay.run b{color:var(--teal)}
.me-bay.on{background:var(--tealdim);border-color:var(--teal);color:var(--ink)}
.me-side{width:300px;flex:none;padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.me-side-h{display:flex;align-items:center;gap:8px}.me-side-h b{font-size:14px;letter-spacing:1px}.me-side-h span:nth-child(2){font-weight:600;flex:1}
.me-side-sub{font-family:var(--mono);font-size:10.5px;color:var(--teal);margin-top:4px;line-height:1.5}
.me-side-big{display:flex;align-items:baseline;gap:6px;margin:2px 0 6px}.me-side-big .me-num{font-size:28px;font-weight:300;letter-spacing:-.5px}.me-side-big small{color:var(--ink3);font-size:11px}
.me-kvrow{display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink3);padding:3px 0;border-top:1px solid var(--line)}.me-kvrow b{color:var(--ink);font-weight:500}
.me-side-sec{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;letter-spacing:.5px;color:var(--ink3);margin-top:12px;padding-top:8px;border-top:1px solid var(--line2)}
.me-hbars{display:flex;align-items:flex-end;gap:2px;height:64px;margin-top:8px}
.me-hbars i{flex:1;min-width:2px;background:var(--line2);cursor:pointer;border-radius:1px 1px 0 0}
.me-hbars i.hi{background:var(--ink3)}.me-hbars i.pk{background:var(--teal);box-shadow:0 0 8px color-mix(in srgb,var(--teal) 60%,transparent)}
.me-hbars i:hover{background:var(--ink)}
.me-side-foot{display:flex;justify-content:space-between;font-family:var(--mono);font-size:9.5px;color:var(--ink3);margin-top:4px}
.me-ticks{display:flex;gap:2px;height:13px;margin-top:5px}
.me-ticks i{flex:1;max-width:3px;background:var(--line2);border-radius:.5px}
.me-ticks i.on{background:var(--ink2)}.me-ticks.hot i.on{background:var(--teal)}
.me-grid4{display:grid;grid-template-columns:1fr 1.15fr 1.1fr 1.2fr;gap:8px;flex:none}
@media (max-width:1250px){.me-grid4{grid-template-columns:1fr 1fr}}
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
`

    /* -------------------------------------------------------------- helpers */
    const TYPE_CLS = { 事实: 'f', 判断: 'j', 决策: 'd' }
    const VERDICT_CLS = { 矛盾: 'b', 记录质量: 'w', 改判: 'v', 病情变化: 'v', 调整: 'ok', 命名不一致: '', 证据不足: '' }
    // SVG 用的调色板（与 CSS 的 .me-dark / .me-light 对应）
    const PAL = {
      dark: { fact: '#6cb4ff', judge: '#f38bc8', decide: '#4fd1a5', visit: '#8681a0', grid: '#1c1a28', lane: '#2b273c', ink: '#ebe8f4', ink2: '#a49fba', ink3: '#6b6683', tick: '#514c68', bad: '#e5484d', warn: '#f0a63a', vio: '#4cc9e0', ok: '#62c27e', shade: 'rgba(12,11,18,.65)', teal: '#8f6ef5', halo: '#0c0b12', band: '#12111b' },
      light: { fact: '#1f7fd0', judge: '#c23d8c', decide: '#0f9d78', visit: '#8a84a2', grid: '#e2dfec', lane: '#cdc7dc', ink: '#221d33', ink2: '#625b78', ink3: '#958fa9', tick: '#b3adc5', bad: '#cf3a3f', warn: '#c27a12', vio: '#0f8ea3', ok: '#2f9a55', shade: 'rgba(241,239,246,.72)', teal: '#5b3cc4', halo: '#fcfbfe', band: '#f5f3fa' },
    }
    /** 调亮（k>0，混白）或调暗（k<0，混黑）一个 #rrggbb 颜色。 */
    function shade(hex, k) {
      const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '')
      if (!m) return hex
      const n = parseInt(m[1], 16)
      const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)))
      return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`
    }
    const pts = (a) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const verdictColor = (pal) => ({ 矛盾: pal.bad, 记录质量: pal.warn, 改判: pal.vio, 病情变化: pal.vio, 调整: pal.ok, 命名不一致: pal.ink2, 证据不足: pal.ink3 })
    const VERDICT_COLOR = verdictColor(PAL.dark)

    /** 跟随 DSH 主题：读宿主的背景色亮度；读不到时看系统偏好。 */
    function hostIsDark() {
      try {
        let color = getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-base').trim()
        if (!color) color = getComputedStyle(document.body).backgroundColor
        const probe = document.createElement('span')
        probe.style.color = color
        document.body.appendChild(probe)
        const rgb = getComputedStyle(probe).color
        probe.remove()
        const parts = (rgb.match(/[\d.]+/g) ?? []).map(Number)
        if (parts.length < 3) throw new Error('no colour')
        const scale = rgb.startsWith('color(') ? 255 : 1
        const [r, g, b] = parts
        if (/rgba\(0, 0, 0, 0\)|transparent/.test(rgb)) throw new Error('transparent')
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) * scale / 255 < 0.5
      } catch {
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
      }
    }
    function useHostDark() {
      const [dark, setDark] = useState(() => hostIsDark())
      useEffect(() => {
        const check = () => setDark(hostIsDark())
        const obs = new MutationObserver(check)
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'] })
        if (document.body) obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
        const media = window.matchMedia?.('(prefers-color-scheme: dark)')
        media?.addEventListener?.('change', check)
        return () => { obs.disconnect(); media?.removeEventListener?.('change', check) }
      }, [])
      return dark
    }
    const ThemeCtx = React.createContext(PAL.dark)
    const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString())
    const fmtTime = (s) => { if (!s) return '—'; try { return new Date(s).toLocaleString() } catch { return String(s) } }
    const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
    const statusChip = (s) => h('span', { className: `me-chip ${s === 'completed' ? 'ok' : s === 'running' ? '' : s === 'review' ? 'w' : 'b'}` }, { completed: '完成', running: '运行中', review: '待复核', failed: '失败', cancelled: '已取消' }[s] ?? s)
    const STATUS_LABEL = { completed: '完成', running: '运行中', review: '待复核', failed: '失败', cancelled: '已取消' }
    const SOURCE_LABEL = { panel: '面板启动', agent: 'Agent 启动', command: '/event 命令' }
    const clock = (ms) => { if (ms == null) return '00:00'; const t = Math.floor(ms / 1000); const hh = Math.floor(t / 3600); const mm = Math.floor(t / 60) % 60; const ss = t % 60; const p = (n) => String(n).padStart(2, '0'); return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}` }
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
      const [runsOpen, setRunsOpen] = useState(false)
      const [modal, setModal] = useState(null) // 'settings'
      const [version, setVersion] = useState(null)
      const [now, setNow] = useState(Date.now())
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
            setPatient((p) => p ?? v.run?.patients?.[0]?.patient ?? null)
            if (v.run?.status === 'running') timer = setTimeout(load, 2000)
            else if (v.active === null) refreshList()
          } catch (e) { if (alive) setError(msg(e)) }
        }
        load()
        return () => { alive = false; clearTimeout(timer) }
      }, [runId])

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
      const openPatient = (p, next = 'timeline', f = null) => { setPatient(p); setFocus(f); setTab(next) }
      const selectRun = (id) => { setRunId(id); setRun(null); setPatient(null); setRunsOpen(false); setTab('line') }
      const elapsed = run?.startedAt ? Math.max(0, (run.status === 'running' ? now : Date.parse(run.finishedAt ?? run.startedAt)) - Date.parse(run.startedAt)) : null
      const percent = run?.totals?.patients ? Math.round(run.totals.done / run.totals.patients * 100) : null
      const lineStatus = run?.status ?? 'idle'
      const review = run?.totals?.review ?? 0
      const dark = useHostDark()
      const heldFormats = run?.format?.held ?? 0
      const tabs = [['line', '◈ 产线'], ...(run?.format?.kind === 'recognized' ? [['formats', '格式', heldFormats]] : []), ['patients', '患者', run?.totals?.patients], ['timeline', '时间线'], ['source', '原文标注'], ['review', '复核', review], ['improve', '规则改进'], ['calls', '模型调用'], ['rules', '规则包'], ['report', '报告']]
      return h(ThemeCtx.Provider, { value: dark ? PAL.dark : PAL.light }, h('div', { className: `me ${dark ? 'me-dark' : 'me-light'}` },
        h('style', {}, CSS),
        // ── 顶栏（与匿名化插件同一布局）：品牌 · 批次状态 · 用时 · 完成 · 版本 · 新批次 · 记录 · 设置 ──
        h('header', { className: 'me-frame me-top' },
          h('div', { className: 'me-brand' },
            h('div', { className: 'me-logo' }, h('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 2.4, strokeLinecap: 'round' }, h('path', { d: 'M3 12h4l2-6 4 12 2-6h6' }))),
            h('div', {}, h('b', {}, '病历事件还原'), h('span', {}, 'MEDICAL EVENT RECONSTRUCTION'))),
          h('div', { className: `me-status s-${lineStatus}` },
            h('span', { className: 'me-lamp' }),
            h('div', {},
              h('b', {}, lineStatus === 'idle' ? '空闲' : STATUS_LABEL[lineStatus] ?? lineStatus),
              h('span', { className: 'me-num' }, run?.id ?? '—'),
              run?.status === 'running' && run.current
                ? h('span', { className: 'me-tl' }, `${String(run.current.patient).split('/').pop()} · ${run.current.step}`)
                : run ? h('span', {}, [SOURCE_LABEL[run.source?.kind], run.asOf ? `截至 ${run.asOf}` : null, run.inputName ?? run.input?.split('/').pop()].filter(Boolean).join(' · ')) : null)),
          h('span', { className: 'me-sp' }),
          h('div', { className: 'me-clock sep' }, h('span', {}, '用时'), h('b', {}, clock(elapsed))),
          run ? h('div', { className: 'me-clock sep pct', title: `${run.totals.done} / ${run.totals.patients} 位病人` }, h('span', {}, '完成'), h('b', {}, percent == null ? '—' : String(percent), h('small', {}, '%'))) : null,
          version ? h('div', { className: 'me-clock ver' }, h('span', {}, '版本'), h('b', {}, `v${version}`)) : null,
          h('div', { className: 'me-act' },
            run?.status === 'running'
              ? h('button', { className: 'me-btn me-stop', onClick: () => call('cancel', { runId: run.id }).catch((e) => setError(msg(e))) }, '■ 停止批次')
              : h('button', { className: 'me-btn me-new', disabled: !!activeId, title: activeId ? '已有批次在运行，结束或取消后再开新批次' : undefined, onClick: () => setShowNew((x) => !x) },
                activeId ? '正在处理…' : h(React.Fragment, {}, '＋ 新批次', h('span', { className: 'me-caret' }, '▾'))),
            showNew && !activeId ? h('div', { className: 'me-shade', onMouseDown: () => setShowNew(false) }) : null,
            showNew && !activeId ? h(NewRun, {
              resumable: run && ['cancelled', 'failed'].includes(run.status) ? run : null,
              onClose: () => setShowNew(false),
              onStarted: (id) => { setShowNew(false); setRunId(id); setRun(null); setPatient(null); refreshList(); setTab('line') },
              onError: setError,
            }) : null),
          h('div', { className: 'me-act' },
            h('button', { className: 'me-btn me-hbtn', 'aria-expanded': runsOpen ? 'true' : 'false', title: '切换批次：查看历史批次', onClick: () => { if (!runsOpen) refreshList(); setRunsOpen(!runsOpen) } },
              '记录', runs.length ? h('i', { className: 'me-hcount' }, String(runs.length)) : null),
            runsOpen ? h('div', { className: 'me-shade', onMouseDown: () => setRunsOpen(false) }) : null,
            runsOpen ? h('div', { className: 'me-pop me-runs-pop', role: 'dialog', 'aria-label': '批次记录' },
              h('div', { className: 'me-pop-h' }, h('b', {}, '批次记录'), h('span', { className: 'me-sp' }), h('button', { className: 'me-btn sm', onClick: refreshList }, '刷新')),
              !runs.length ? h('div', { className: 'me-faint' }, '还没有批次。')
                : h('div', { className: 'me-runs' }, runs.map((r) => h('div', {
                  key: r.id, role: 'button', tabIndex: 0, className: `me-run${r.id === runId ? ' on' : ''}`,
                  onClick: () => selectRun(r.id), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRun(r.id) } },
                },
                  h('div', { className: 'me-run-top' }, h('span', { className: 'me-run-name', title: r.outputRoot }, r.input || r.id), statusChip(r.status)),
                  h('div', { className: 'me-run-meta' }, h('span', {}, fmtTime(r.startedAt)), h('span', { className: 'me-num' }, `${r.patients ?? 0} 人 · 发现 ${r.findings ?? 0}${r.review ? ` · 待复核 ${r.review}` : ''}`)))))) : null),
          h('button', { className: 'me-icon', title: '设置', 'aria-label': '设置', onClick: () => setModal('settings') }, '⚙')),
        h('div', { className: 'me-frame me-tabs' }, tabs.map(([k, label, n]) => h('button', { key: k, className: `me-tab${tab === k ? ' on' : ''}`, onClick: () => setTab(k) }, label, n ? h('i', {}, String(n)) : null))),
        error ? h('div', { className: 'me-err', onClick: () => setError('') }, error) : null,
        h('div', { className: 'me-body' },
          !run ? h('div', { className: 'me-frame me-empty', style: { flex: 1 } }, runs.length ? '加载中…' : '还没有批次。点右上角「＋ 新批次」选择病人导出目录开始。')
            : tab === 'line' ? h(Pipeline, { run, openPatient, goto: setTab })
              : tab === 'patients' ? h(Patients, { run, openPatient })
                : tab === 'timeline' ? h(Timeline, { run, patient, setPatient, focus, setFocus, gotoSource: (fragmentId) => { setFocus({ kind: 'fragment', id: fragmentId }); setTab('source') }, gotoReview: (fid) => { setFocus({ kind: 'finding', id: fid }); setTab('review') } })
                  : tab === 'source' ? h(Source, { run, patient, setPatient, focus })
                    : tab === 'review' ? h(Review, { run, focus, gotoSource: (p, fragmentId) => { setPatient(p); setFocus({ kind: 'fragment', id: fragmentId }); setTab('source') } })
                      : tab === 'improve' ? h(Improve, { run })
                        : tab === 'calls' ? h(Calls, { run })
                          : tab === 'formats' ? h(Formats, { run, busy: !!activeId, onRerun: (id) => { setRunId(id); setRun(null); setPatient(null); refreshList(); setTab('formats') }, onError: setError })
                          : tab === 'rules' ? h(Rules, { run })
                            : h(Report, { run })),
        modal === 'settings' ? h('div', { className: 'me-modal-back', onMouseDown: (e) => { if (e.target === e.currentTarget) setModal(null) } },
          h('div', { className: 'me-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '设置' },
            h('div', { className: 'me-modal-head' }, h('h3', {}, '设置 · 病历事件还原'), h('button', { className: 'me-btn sm', onClick: () => setModal(null), 'aria-label': '关闭' }, '✕')),
            h('div', { className: 'me-modal-body' }, activeId ? h('div', { className: 'me-err', style: { marginBottom: 10 } }, '有批次在运行：改动从下一个批次起生效。') : null, h(SettingsSection, { inModal: true })))) : null))
    }

    /* --------------------------------------------------------------- new run */
    /** 新批次：挂在右上角按钮下的浮层（和匿名化插件一致），点暗处或按 Esc 关闭。 */
    function NewRun({ onStarted, onError, onClose, resumable }) {
      const [inputDir, setInput] = useState('')
      const [outputRoot, setOut] = useState('')
      const [asOf, setAsOf] = useState('')
      const [busy, setBusy] = useState(false)
      useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [])
      // 先用系统的“选择文件夹”对话框（macOS，由插件服务端弹出）；不行再用宿主的目录选择器
      const [picking, setPicking] = useState(false)
      const pick = async () => {
        setPicking(true)
        try {
          const v = await call('pickFolder')
          if (v.path) setInput(v.path)
        } catch (cause) {
          try {
            const ws = services.ctx?.get('uiWorkspace')
            if (!ws?.pickDirectory) throw cause
            const picked = await ws.pickDirectory()
            if (picked) setInput(picked)
          } catch (e) { onError(msg(e)) }
        } finally { setPicking(false) }
      }
      const go = async (payload) => {
        setBusy(true)
        try { const v = await call('start', payload); onStarted(v.runId) } catch (e) { onError(msg(e)) } finally { setBusy(false) }
      }
      return h('div', { className: 'me-pop', role: 'dialog', 'aria-label': '新批次' },
        h('div', { className: 'me-pop-h' }, h('b', {}, '新批次'), h('button', { className: 'me-btn sm', onClick: onClose, 'aria-label': '关闭' }, '✕')),
        h('label', { className: 'me-field' }, '病人导出目录',
          h('input', { className: 'me-input', value: inputDir, onChange: (e) => setInput(e.target.value), placeholder: '/path/to/_medical-anonymizer/…', title: inputDir, autoFocus: true }),
          h('div', { className: 'me-pick' }, h('button', { className: 'me-btn sm', onClick: pick, disabled: picking }, picking ? '请在弹出的窗口里选择…' : '选择文件夹…'), h('span', { className: 'me-faint' }, '一位病人，或包含多位病人的上级目录；通常是匿名化插件的交付目录'))),
        h('label', { className: 'me-field' }, '输出根目录', h('input', { className: 'me-input', value: outputRoot, onChange: (e) => setOut(e.target.value), placeholder: '空＝设置里的默认值，再缺省为输入旁的 _medical-event' })),
        h('label', { className: 'me-field' }, '截至时刻（可空）', h('input', { className: 'me-input', value: asOf, onChange: (e) => setAsOf(e.target.value), placeholder: 'YYYY-MM-DD HH:mm · 只用此刻以前写成的记录' })),
        h('div', { className: 'me-pop-act' },
          h('button', { className: 'me-btn me-new', style: { flex: 1 }, disabled: !inputDir || busy, onClick: () => go({ inputDir, outputRoot: outputRoot || undefined, asOf: asOf || undefined }) }, busy ? '启动中…' : '▶ 开始'),
          resumable ? h('button', { className: 'me-btn', disabled: busy, title: `继续批次 ${resumable.id}：已完成的病人和模型调用直接复用`, onClick: () => go({ resumeFrom: resumable.id }) }, '↻ 继续') : null))
    }

    /* --------------------------------------------------------------- pipeline */
    const MONO = 'SF Mono,JetBrains Mono,Menlo,monospace'
    const STATE_LABEL = { run: '运行中', part: '进行中', hold: '待复核', done: '完成', idle: '未开始' }
    // 每道工序在右侧面板里按病人展示的指标
    const STATION_METRIC = [
      ['片段', (p) => p.counts.fragments, fmt],
      ['提及', (p) => p.counts.mentions, fmt],
      ['兜底率', (p) => p.fallbackRate, pct],
      ['事件', (p) => p.counts.events, fmt],
      ['发现', (p) => p.counts.findings, fmt],
      ['待确认', (p) => p.review.findings, fmt],
      ['用时', (p) => p.ms / 1000, (v) => `${(v ?? 0).toFixed(1)}s`],
    ]

    function Pipeline({ run, openPatient, goto }) {
      const P = run.patients
      const t = run.totals
      const gatePass = (g) => P.filter((p) => !p.failedGates.includes(g)).length
      const sum = (f) => P.reduce((s, p) => s + (f(p) ?? 0), 0)
      const running = run.status === 'running'
      const doneFrac = t.patients ? t.done / t.patients : 0
      const fb = P.length ? sum((p) => p.fallbackRate ?? 0) / P.length : null
      // 逐站进度：当前病人所在的那一站是“运行中”，其余已开工的是“进行中”
      const stage = running ? run.current?.stage : null
      // 失败或取消、且一个病人都没跑完：各站都是“未开始”
      const broken = !running && ['failed', 'cancelled'].includes(run.status) && !P.length
      const stOf = (no) => (broken ? 'idle' : !running ? 'done' : stage === no || (no === 'S01' && stage === 'S00') ? 'run' : 'part')
      const fmtRow = run.format?.kind === 'recognized' ? ['格式', `识别 ${run.format.adopted}/${run.format.tables} 表${run.format.held ? ` · 待确认 ${run.format.held}` : ''}`, run.format.held ? 'warn' : 'ok'] : null
      const reviewN = t.review
      const verdicts = {}
      for (const p of P) for (const [k, v] of Object.entries(p.verdicts ?? {})) { const vk = k.split('·')[0]; verdicts[vk] = (verdicts[vk] ?? 0) + v }
      const types = {}
      for (const p of P) for (const [k, v] of Object.entries(p.types ?? p.summary?.types ?? {})) types[k] = (types[k] ?? 0) + v
      const typeTotal = Object.values(types).reduce((a, b) => a + b, 0)
      const gateRow = (g) => [`验收${g}`, `${gatePass(g)}/${P.length}`, gatePass(g) === P.length ? 'ok' : 'warn']
      const st = (no, nm, sub, big, unit, rows, state, frac) => ({ no, nm, sub, big, unit, rows, state, frac: frac ?? doneFrac })
      const stations = [
        st('S01', '读入·片段', '切片段、挂可见时间、剔除作废记录', fmt(sum((p) => p.counts.fragments)), '片段', [...(fmtRow ? [fmtRow] : []), ['病人', `${t.done}/${t.patients}`, '']], stOf('S01')),
        st('S02', '提及抽取', '栏目→句→分句→顿号；两个时间', fmt(t.mentions), '提及', [gateRow('①')], stOf('S02')),
        st('S03', '类型切分', '事实／判断／决策 → 细分 → 细项', typeTotal ? `${Math.round((types['事实'] ?? 0) / typeTotal * 100)}%` : '—', '事实', [['兜底率', pct(fb), '']], stOf('S03')),
        st('S04', '事件归并·印证', '同概念＋时间相容＋同就诊；前后印证', fmt(t.events), '事件', [gateRow('③')], stOf('S04')),
        st('S05', '矛盾判断', 'R1–R10；七类判定、建议采信', fmt(t.findings), '发现', [gateRow('④')], stOf('S05')),
        st('S06', '人工复核', '需人工确认的发现、药名映射、模型分歧', fmt(reviewN), '项待办', [['模型建议', fmt(t.suggestions), '']], reviewN ? 'hold' : broken ? 'idle' : running ? 'part' : 'done', broken ? 0 : 1),
        st('S07', '交付', '生成事件包 → 整批汇总表 → 只读核对 → 移交', run.output ? '已交付' : `${t.done}/${t.patients}`, run.output ? '' : '事件包', [['输出', run.output ? '已写出' : '未交付', run.output ? 'ok' : '']], running ? stOf('S07') : run.output ? 'done' : 'idle', run.output ? 1 : doneFrac),
      ]
      const defSel = Math.max(1, stations.findIndex((s) => s.state === 'run' || s.state === 'hold'))
      const [selK, setSelK] = useState(null)
      const k = selK ?? defSel
      const hot = stations.filter((s) => s.state === 'run' || s.state === 'hold')
      return h('div', { className: 'me-col me-scroll', style: { flex: 1 } },
        h('div', { style: { display: 'flex', gap: 8, flex: 'none' } },
          h('div', { className: 'me-frame me-hero', style: { flex: 1, minWidth: 0 } },
            h('div', { className: 'me-hero-cap' },
              h('span', { className: 'me-cap', style: { color: 'var(--ink2)' } }, '处理流程 · PLANT'),
              h('span', { className: 'me-faint me-num', style: { fontSize: 10.5 } }, run.input),
              h('span', { className: 'me-sp' }),
              run.status === 'failed' ? h('span', { className: 'me-live bad' }, h('i'), '批次失败') : run.status === 'cancelled' ? h('span', { className: 'me-live bad' }, h('i'), '已取消') : hot.length ? h('span', { className: 'me-live' }, h('i'), hot.map((s) => `${s.no} ${STATE_LABEL[s.state]}`).join(' · ')) : h('span', { className: 'me-live ok' }, h('i'), '全部完成')),
            run.status === 'failed' && run.error ? h('div', { className: 'me-err me-hero-err' }, h('b', {}, '批次失败：'), String(run.error).split('\n')[0].replace(/^Error:\s*/, '')) : null,
            h(PlantScene, {
              stations, sel: k, onSel: setSelK, running, done: t.done, total: t.patients, current: run.current,
              reviewPatients: P.filter((p) => p.review.findings > 0).length,
              gates: Object.fromEntries(['①', '③', '④'].map((g) => [g, { n: gatePass(g), of: P.length }])), fallback: pct(fb),
              failed: P.filter((p) => p.failedGates.length).map((p) => ({ patient: p.patient, gate: p.failedGates[0] })),
              model: run.model ? { name: run.model.model, calls: t.modelCalls, sugg: t.suggestions } : null, goto, openPatient,
            }),
            h('div', { className: 'me-hud br' },
              h('div', {}, h('i', { className: 'sw hot' }), '运行中／待复核'), h('div', {}, h('i', { className: 'sw clay' }), '已完成'),
              h('div', {}, h('i', { className: 'sw box' }), '箱子＝一位病人'), h('div', {}, h('i', { className: 'sw red' }), '红箱＝验收门未过，带红标交付'),
              h('div', {}, h('i', { className: 'sw vio' }), '青灯＝模型补充（旁路）'), h('div', {}, h('i', { className: 'sw flow' }), '虚线：裁定回流，重跑沿用')),
            h('div', { className: 'me-hero-legend' }, stations.map((s, i) => h('button', { key: s.no, className: `me-bay${i === k ? ' on' : ''} ${s.state}`, onClick: () => setSelK(i) }, h('b', {}, s.no), s.nm)))),
          h(StationPanel, { s: stations[k], k, patients: P, openPatient })),
        h('div', { className: 'me-grid4' },
          h(GatesPanel, { P, gatePass, fb, types, typeTotal, run }),
          h(BatchPanel, { run, P, fb, openPatient }),
          h(FindingsPanel, { P, t, verdicts }),
          h(AlertsPanel, { run, P, t, fb, goto })))
    }

    /* ----------------------------------------------------------- 2.5D scenes */
    // 等轴测投影：i 轴向右下、j 轴向左下、z 向上（30°）
    // 投影（与匿名化插件的产线一致）：i 轴向右、略向下（约 15°），j 轴向左下；流程沿 i 轴，读起来接近水平
    const IX = [0.94, 0.26]; const JX = [-0.66, 0.58]
    const iso = (i, j, z = 0) => [i * IX[0] + j * JX[0], i * IX[1] + j * JX[1] - z]
    /** 地面上的远近（越大越靠前），用来排画的先后。 */
    const depthOf = (i, j) => i * IX[1] + j * JX[1]
    /** 等轴测长方体：底面从 (i, j) 起、沿 i 长 a、沿 j 长 b、高 hh，底在 z。返回 [左面, 右面, 顶面]。 */
    function isoBox(key, i, j, z, a, b, hh, { top, left, right, edge, roofClass, props } = {}) {
      const s = edge ? { stroke: edge, strokeWidth: 0.6, strokeLinejoin: 'round' } : {}
      return [
        h('polygon', { key: `${key}l`, points: pts([iso(i, j + b, z), iso(i + a, j + b, z), iso(i + a, j + b, z + hh), iso(i, j + b, z + hh)]), fill: left, ...s, ...props }),
        h('polygon', { key: `${key}r`, points: pts([iso(i + a, j, z), iso(i + a, j + b, z), iso(i + a, j + b, z + hh), iso(i + a, j, z + hh)]), fill: right, ...s, ...props }),
        h('polygon', { key: `${key}t`, className: roofClass, points: pts([iso(i, j, z + hh), iso(i + a, j, z + hh), iso(i + a, j + b, z + hh), iso(i, j + b, z + hh)]), fill: top, ...s, ...props }),
      ]
    }
    /** 左面（j＝常数）上的贴片：i 从 i0 到 i1、z 从 z0 到 z1。 */
    const leftPatch = (key, i0, i1, j, z0, z1, props) => h('polygon', { key, points: pts([iso(i0, j, z0), iso(i1, j, z0), iso(i1, j, z1), iso(i0, j, z1)]), ...props })
    /** 右面（i＝常数）上的贴片。 */
    const rightPatch = (key, i, j0, j1, z0, z1, props) => h('polygon', { key, points: pts([iso(i, j0, z0), iso(i, j1, z0), iso(i, j1, z1), iso(i, j0, z1)]), ...props })
    /** 竖直圆柱（烟囱、储罐）。 */
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
    // 黏土模型配色（偏冷的紫灰，与主色薰衣草紫同调）
    const CLAY = {
      dark: { top: '#d8d5e2', left: '#b0abc0', right: '#88839a', edge: 'rgba(0,0,0,.28)', top2: '#e5e2ec', left2: '#bfbacd', right2: '#9a95ab', win: '#34303f', hole: '#433e50', pad: '#24212e', padL: '#1a1822', padR: '#15131c', grid: '#e8e5f0', floorShadow: '#000', card: 'rgba(12,11,18,.88)', cardLine: '#433d58', lamp: '#ece4ff' },
      light: { top: '#e9e6f0', left: '#c9c4d6', right: '#a8a2b8', edge: 'rgba(40,25,80,.2)', top2: '#f3f1f8', left2: '#d6d1e2', right2: '#b6b0c5', win: '#625b74', hole: '#827b96', pad: '#dcd8e5', padL: '#cac5d6', padR: '#b8b2c7', grid: '#5f5878', floorShadow: '#2c2050', card: 'rgba(253,252,255,.94)', cardLine: '#cdc7dc', lamp: '#d9c9ff' },
    }
    function useClay() { const P = React.useContext(ThemeCtx); return [P, P === PAL.light ? CLAY.light : CLAY.dark] }

    /**
     * 产线主视图：一座黏土质感的等轴测小工厂，按阅读顺序从左上走到右下。
     * S01 进料楼 → S02–S06 主厂房的五个跨（屋顶设备：运行中的跨按进度点亮、待复核的跨整跨发光）
     * → S07 交付堆场；厂房前有管廊，运行时管廊上的灯流动。点任意一跨看右侧详情。
     */
    function PlantScene({ stations, sel, onSel, running, done = 0, total = 0, current = null, reviewPatients = 0, gates = {}, fallback = '—', failed = [], model = null, goto = () => {}, openPatient = () => {} }) {
      const [P, C] = useClay()
      const A = P.teal
      const tone = (s) => (s.state === 'hold' ? A : s.state === 'run' ? A : null)
      const L = 150; const bw = 72; const D = 104; const H = 50 // 工序间距、每栋长、进深、高（间隔处是走廊）
      const h0 = 84 + (L - bw) // S02 起点 i（S01 楼到 i=84，中间留走廊）
      const bay0 = (k) => h0 + (k - 1) * L // S02–S06 各栋起点
      const hallEnd = bay0(5) + bw
      const yard = hallEnd + (L - bw) // 堆场起点
      const els = []; const defs = []; const bb = []
      const click = (k) => ({ onClick: () => onSel(k), style: { cursor: 'pointer' } })
      const halo = { stroke: C.card, strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }
      const AMB = { top: shade(A, 0.3), left: A, right: shade(A, -0.32) }
      const RED = { top: shade(P.bad, 0.3), left: P.bad, right: shade(P.bad, -0.35) }
      const CL2 = { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }

      // 地面网格（中心清晰、四周渐隐）
      const gi0 = -120; const gi1 = yard + 220; const gj0 = -90; const gj1 = D + 170
      const grid = []
      for (let i = gi0; i <= gi1; i += 40) { const a = iso(i, gj0); const b = iso(i, gj1); grid.push(h('line', { key: `gi${i}`, x1: a[0], y1: a[1], x2: b[0], y2: b[1] })) }
      for (let j = gj0; j <= gj1; j += 40) { const a = iso(gi0, j); const b = iso(gi1, j); grid.push(h('line', { key: `gj${j}`, x1: a[0], y1: a[1], x2: b[0], y2: b[1] })) }
      defs.push(h('radialGradient', { key: 'rg', id: 'me-fade', cx: '50%', cy: '55%', r: '55%' }, h('stop', { offset: 0, stopColor: '#fff', stopOpacity: 1 }), h('stop', { offset: 1, stopColor: '#fff', stopOpacity: 0 })))
      defs.push(h('filter', { key: 'bl', id: 'me-blur', x: '-30%', y: '-30%', width: '160%', height: '160%' }, h('feGaussianBlur', { stdDeviation: 9 })))
      defs.push(h('filter', { key: 'gl', id: 'me-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, h('feGaussianBlur', { stdDeviation: 3.5, result: 'b' }), h('feMerge', {}, h('feMergeNode', { in: 'b' }), h('feMergeNode', { in: 'SourceGraphic' }))))
      defs.push(h('marker', { key: 'ar', id: 'me-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, h('path', { d: 'M0 0L10 5L0 10z', fill: P.ink2 })))
      defs.push(h('linearGradient', { key: 'cy', id: 'me-cyl', x1: 0, x2: 1, y1: 0, y2: 0 }, h('stop', { offset: 0, stopColor: C.left2 }), h('stop', { offset: 0.55, stopColor: C.left }), h('stop', { offset: 1, stopColor: C.right })))
      els.push(h('g', { key: 'grid', stroke: C.grid, strokeOpacity: 0.07, strokeWidth: 0.8, mask: 'url(#me-gridmask)' }, grid))

      // 落地阴影（光从左上来，影子落向右前）
      const shadow = (key, i, j, a, b, push = 26) => h('polygon', { key, points: pts([iso(i + 6, j + 4), iso(i + a + push, j + 4), iso(i + a + push, j + b + push * 0.5), iso(i + 6, j + b + push * 0.5)]), fill: C.floorShadow, opacity: 0.55, filter: 'url(#me-blur)' })
      els.push(shadow('sh1', 0, 8, 84, 100), shadow('sh3', yard, 6, 150, 130, 14))
      for (let k = 1; k <= 5; k++) els.push(shadow(`sb${k}`, bay0(k), 0, bw, D, 24))

      // 选中跨的地面高亮
      const footprint = (k) => (k === 0 ? [0, 8, 84, 100] : k === 6 ? [yard, 6, 150, 130] : [bay0(k), 0, bw, D])
      {
        const [fi, fj, fa, fb] = footprint(sel)
        const m = 10
        const corners = [[fi - m, fj - m], [fi + fa + m, fj - m], [fi + fa + m, fj + fb + m], [fi - m, fj + fb + m]]
        els.push(h('polygon', { key: 'selfloor', points: pts(corners.map(([a, b]) => iso(a, b))), fill: A, opacity: 0.07 }))
        // 四角括号
        corners.forEach(([ci, cj], q) => {
          const di = q === 0 || q === 3 ? 1 : -1; const dj = q < 2 ? 1 : -1
          els.push(h('polyline', { key: `br${q}`, points: pts([iso(ci + di * 16, cj), iso(ci, cj), iso(ci, cj + dj * 16)]), fill: 'none', stroke: A, strokeWidth: 1.6, opacity: 0.9 }))
        })
      }

      // S01 进料楼（较高的独立楼，左侧有进料坡道）
      {
        const s = stations[0]; const g = []
        g.push(...isoBox('ramp', -60, 44, 0, 60, 24, 8, { top: C.top, left: C.left, right: C.right, edge: C.edge }))
        g.push(...isoBox('b', 0, 8, 0, 84, 100, 88, { top: C.top, left: C.left, right: C.right, edge: C.edge }))
        g.push(...isoBox('cap', 8, 18, 88, 50, 40, 10, { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }))
        g.push(...isoBox('vent', 56, 70, 88, 18, 22, 14, { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }))
        // 窗户＝病人：已读入的比例点亮（运行中用主色紫，完成后是浅紫白）
        const wins = []
        for (let z = 66; z >= 14; z -= 13) for (let i = 8; i < 78; i += 12) wins.push([i, z])
        const litN = Math.round((total ? done / total : 0) * wins.length)
        wins.forEach(([i, z], q) => {
          const lit = q < litN
          const col = lit ? (s.state === 'run' ? A : C.lamp) : C.win
          g.push(leftPatch(`w${z}-${i}`, i, i + 7, 108, z, z + 6, { fill: col, opacity: lit ? 0.95 : 0.55, filter: lit && s.state === 'run' ? 'url(#me-glow)' : undefined }))
        })
        els.push(h('g', { key: 's01', ...click(0) }, h('title', {}, `${s.no} ${s.nm}`), g))
      }

      // 走廊：工序之间一段带窗的连廊，灯点沿它流动（运行时主色紫、快）
      // 验收门：门①③④有人没过就是红色，门②只报兜底率（灰色，不拦人）
      const GATE_AFTER = { 2: '①', 3: '②', 4: '③', 5: '④' } // 通往第 k 栋的走廊上，是前一道工序的出口门
      const corridor = (key, i0, i1, k) => {
        const cj = D - 30 // 贴着楼的前沿，楼与楼之间看得见
        const a = iso(i0, cj + 24, 24); const b = iso(i1, cj + 24, 24)
        const g = GATE_AFTER[k]
        let gate = null
        if (g) {
          const info = gates[g]
          const gc = g === '②' || !info?.of ? P.ink2 : info.n < info.of ? P.bad : P.ok
          const gi = (i0 + i1) / 2
          const label = g === '②' ? `② 兜底 ${fallback}` : `${g} ${info ? `${info.n}/${info.of}` : '—'}`
          const lt = iso(gi, cj + 12, 54)
          gate = h('g', { key: 'gate' },
            h('polyline', { points: pts([iso(gi, cj - 2, 32), iso(gi, cj - 2, 46), iso(gi, cj + 26, 46), iso(gi, cj + 26, 32)]), fill: 'none', stroke: gc, strokeWidth: 2.2, strokeLinejoin: 'round' }),
            h('text', { x: lt[0], y: lt[1], textAnchor: 'middle', fill: gc, fontSize: 10, fontFamily: MONO, ...halo }, h('title', {}, g === '②' ? '验收门②：兜底命中率，供抽样核对，不拦人' : `验收门${g}：不过就停在这一步，后续工序不算`), label))
        }
        return h('g', { key },
          isoBox('c', i0, cj, 14, i1 - i0, 24, 18, { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }),
          leftPatch('cw', i0 + 2, i1 - 2, cj + 24, 19, 29, { fill: C.win, opacity: 0.6 }),
          h('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: running ? A : P.ink3, strokeWidth: 2.4, strokeLinecap: 'round', strokeDasharray: '2 8', className: 'me-flow', style: { animationDuration: running ? '0.9s' : '3.2s' }, filter: running ? 'url(#me-glow)' : undefined, opacity: running ? 1 : 0.7 }),
          gate)
      }

      // S02–S06：每道工序一栋小楼
      for (let k = 1; k <= 5; k++) {
        const s = stations[k]; const i0 = bay0(k)
        const c = tone(s)
        const lit = !!c
        els.push(corridor(`co${k}`, k === 1 ? 84 : bay0(k - 1) + bw, i0, k))
        const g = []
        g.push(...isoBox('b', i0, 0, 0, bw, D, H, { top: C.top, left: C.left, right: C.right, edge: C.edge }))
        g.push(leftPatch('plinth', i0, i0 + bw, D, 0, 5, { fill: C.right, opacity: 0.6 }))
        for (let w = 0; w < 3; w++) {
          const wi = i0 + 8 + w * 20
          g.push(leftPatch(`hw${w}`, wi, wi + 12, D, 20, 36, { fill: lit ? A : C.win, opacity: lit ? 0.85 : 0.6, filter: lit ? 'url(#me-glow)' : undefined }))
        }
        // 屋顶设备：运行中按进度点亮，待复核整栋点亮
        const roof = []
        for (let a = 0; a < 4; a++) for (let b2 = 0; b2 < 2; b2++) {
          if (k === 4 && b2 === 1) continue
          if (k === 5 && b2 === 1 && a >= 2) continue
          roof.push([b2, a])
        }
        roof.sort((p, q) => depthOf(p[0] * 30, p[1] * 24) - depthOf(q[0] * 30, q[1] * 24))
        const litN = s.state === 'hold' ? roof.length : s.state === 'run' ? Math.round((s.frac ?? 0) * roof.length) : 0
        roof.forEach(([b2, a], idx) => {
          const ui = i0 + 8 + b2 * 30; const uj = 8 + a * 24
          const on = idx < litN && c
          g.push(...isoBox(`u${a}${b2}`, ui, uj, H, 20, 18, 7, on ? { top: shade(c, 0.25), left: c, right: shade(c, -0.3), props: { filter: 'url(#me-glow)' } } : { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }))
          const f = iso(ui + 10, uj + 9, H + 7)
          g.push(h('ellipse', { key: `f${a}${b2}`, cx: f[0], cy: f[1], rx: 7.5, ry: 4, fill: on ? shade(c, -0.45) : C.hole, opacity: 0.85 }))
        })
        if (k === 4) [[i0 + 50, 20], [i0 + 54, 50], [i0 + 50, 80]].forEach(([ci, cj], q) => g.push(...isoCyl(`st${q}`, ci, cj, H, 5, 30 + q * 6, C)))
        if (k === 5) g.push(...isoBox('ctl', i0 + 36, 56, H, 26, 36, 16, { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }), leftPatch('ctlw', i0 + 39, i0 + 59, 92, H + 6, H + 12, { fill: c ?? C.win, opacity: c ? 0.9 : 0.6 }))
        if (sel === k) g.push(h('polygon', { key: 'selroof', points: pts([iso(i0 + 2, 2, H + 0.5), iso(i0 + bw - 2, 2, H + 0.5), iso(i0 + bw - 2, D - 2, H + 0.5), iso(i0 + 2, D - 2, H + 0.5)]), fill: 'none', stroke: A, strokeWidth: 1.4, strokeDasharray: '5 4', opacity: 0.9 }))
        els.push(h('g', { key: `bay${k}`, className: s.state === 'hold' ? 'me-breathe' : undefined, ...click(k) }, h('title', {}, `${s.no} ${s.nm}：${s.sub}`),
          h('polygon', { points: pts([iso(i0, 0, H), iso(i0 + bw, 0, H), iso(i0 + bw, D, H), iso(i0 + bw, D, 0), iso(i0, D, 0), iso(i0, D, H)]), fill: 'transparent' }), g))
      }
      els.push(corridor('co6', hallEnd, yard, 6))

      // S07 交付堆场：地坪＋三台出货单元
      {
        const s = stations[6]; const g = []
        g.push(...isoBox('pad', yard, 6, 0, 150, 130, 4, { top: C.pad, left: C.padL, right: C.padR }))
        const delivered = s.state === 'done'
        const unit = (key, ui, uj) => {
          g.push(...isoBox(key, ui, uj, 4, 34, 34, 22, { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }))
          const f = iso(ui + 17, uj + 17, 26)
          g.push(h('ellipse', { key: `${key}f`, cx: f[0], cy: f[1], rx: 13, ry: 7.5, fill: C.hole }), h('ellipse', { key: `${key}g`, cx: f[0], cy: f[1], rx: 9, ry: 5, fill: 'none', stroke: C.left, strokeWidth: 1 }))
        }
        // 后排两台出货单元；前面每只箱子＝一位已交付的病人（最多画 12 只）
        unit('du0', yard + 18, 14); unit('du1', yard + 98, 14)
        const crates = delivered ? Math.min(done, 12) : 0
        const cells = []
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) cells.push([yard + 12 + c * 34, 58 + r * 24])
        const redN = Math.min(crates, failed.length)
        cells.slice(0, crates).map((c, q) => [...c, q < redN]).sort((a, b) => depthOf(a[0], a[1]) - depthOf(b[0], b[1])).forEach(([ci, cj, red], q) => {
          g.push(...isoBox(`cr${q}`, ci, cj, 4, 22, 18, 13, red ? RED : { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }))
          const a = iso(ci, cj + 9, 17); const b = iso(ci + 22, cj + 9, 17)
          g.push(h('line', { key: `ct${q}`, x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: A, strokeWidth: 1.4, opacity: 0.85 }))
        })
        if (delivered) {
          const m = [[yard + 4, 10], [yard + 146, 10], [yard + 146, 132], [yard + 4, 132]]
          m.forEach(([ci, cj], q) => {
            const di = q === 0 || q === 3 ? 1 : -1; const dj = q < 2 ? 1 : -1
            g.push(h('polyline', { key: `dk${q}`, points: pts([iso(ci + di * 12, cj, 4), iso(ci, cj, 4), iso(ci, cj + dj * 12, 4)]), fill: 'none', stroke: A, strokeWidth: 1.8, filter: 'url(#me-glow)' }))
          })
        }
        els.push(h('g', { key: 's07', opacity: s.state === 'idle' ? 0.6 : 1, ...click(6) }, h('title', {}, `${s.no} ${s.nm}`), g))
      }

      {
        const [x, y] = iso(yard + 6, 150)
        els.push(h('g', { key: 'yardcap', transform: `matrix(${IX[0]} ${IX[1]} ${JX[0]} ${JX[1]} ${x.toFixed(1)} ${y.toFixed(1)})`, pointerEvents: 'none' },
          h('text', { x: 0, y: 0, fill: P.ink3, fontSize: 9.5 }, '生成事件包 → 整批汇总表 → 只读核对 → 移交')))
      }

      // 每道工序门前的排队：箱子＝病人，堆得越高等得越多（和匿名化插件的产线一致）
      {
        const waiting = Math.max(0, total - done - (current ? 1 : 0))
        const loads = [waiting, 0, 0, 0, 0, reviewPatients, running ? done : 0]
        const what = ['人等待读入', '', '', '', '', '人待复核', '人等待交付']
        const pileAt = (k) => (k === 0 ? [12, 116] : k === 6 ? [yard + 14, 92] : [bay0(k) + 14, D + 12])
        const pileZ = (k) => (k === 6 ? 4 : 0)
        // 画布范围按每个排队位都可能有箱子来算，不随数据和选中变化
        loads.forEach((_, k) => { const [pi, pj] = pileAt(k); bb.push(iso(pi, pj + 24), iso(pi + 39, pj, 70)) })
        loads.forEach((n, k) => {
          if (!n) return
          const [pi, pj] = pileAt(k)
          const hot = k === 5 || stations[k].state === 'run'
          const shown = Math.min(36, n)
          const g = []
          for (let q = 0; q < shown; q++) {
            const lv = Math.floor(q / 6); const a = q % 3; const c = Math.floor((q % 6) / 3)
            const ci = pi + a * 13; const cj = pj + c * 12; const z = pileZ(k) + lv * 9
            g.push(...isoBox(`p${q}`, ci, cj, z, 11, 10, 8, hot ? { top: shade(A, 0.3), left: A, right: shade(A, -0.32) } : { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }))
            if (!hot) { const t1 = iso(ci, cj + 5, z + 8); const t2 = iso(ci + 11, cj + 5, z + 8); g.push(h('line', { key: `pt${q}`, x1: t1[0], y1: t1[1], x2: t2[0], y2: t2[1], stroke: A, strokeWidth: 1, opacity: 0.8 })) }
          }
          const top = iso(pi + 19, pj + 11, pileZ(k) + Math.ceil(shown / 6) * 9 + 10)
          els.push(h('g', { key: `q${k}`, ...click(k) }, h('title', {}, `${stations[k].no} 门前排队：${n} ${what[k]}`), g,
            h('text', { x: top[0], y: top[1], textAnchor: 'middle', fill: A, fontSize: 17, fontWeight: 700, fontFamily: MONO, stroke: C.card, strokeWidth: 3.5, paintOrder: 'stroke' }, String(n)),
            h('text', { x: top[0], y: top[1] + 13, textAnchor: 'middle', fill: P.ink, fontSize: 10, stroke: C.card, strokeWidth: 3, paintOrder: 'stroke' }, what[k] ? `排队 · ${what[k].replace(/^人/, '')}` : '排队')))
        })
      }

      // 验收门未过的病人：红箱停在那道门后面（后续工序不算），照样带红标交付
      {
        const byGate = {}
        for (const f of failed) (byGate[f.gate] = byGate[f.gate] ?? []).push(f)
        const after = { '①': 2, '②': 3, '③': 4, '④': 5 }
        Object.entries(byGate).forEach(([g, list]) => {
          const k = after[g]; if (!k) return
          const gi = (bay0(k - 1) + bw + bay0(k)) / 2 - 7
          const gg = []
          list.slice(0, 6).forEach((f, q) => gg.push(h('g', { key: f.patient, onClick: () => openPatient(f.patient), style: { cursor: 'pointer' } }, h('title', {}, `${f.patient}：验收门${g}未过`), isoBox(`rc${q}`, gi + (q % 2) * 15 - 4, D + 6 + Math.floor(q / 2) * 13, 0, 13, 12, 11, RED))))
          const lp = iso(gi - 30, D + 30)
          gg.push(h('text', { key: 't', x: lp[0], y: lp[1] + 16, textAnchor: 'end', fill: P.bad, fontSize: 10, ...halo }, `${list.length} 人未过${g} · 后续不算，带红标交付`))
          els.push(h('g', { key: `red${g}` }, gg))
        })
      }

      // 正在处理的病人：一只发光的箱子停在它所在那一站的门口
      if (running && current?.stage) {
        const k = { S00: 0, S01: 0, S02: 1, S03: 2, S04: 3, S05: 4, S07: 6 }[current.stage]
        const at = current.stage === 'model' ? [bay0(4) + 2, D + 112] : k === 0 ? [44, 110] : k === 6 ? [yard + 8, 140] : k != null ? [bay0(k) + 30, D + 6] : null
        if (at) {
          const tp = iso(at[0] + 8, at[1] + 7, 34)
          els.push(h('g', { key: 'cur' }, h('g', { filter: 'url(#me-glow)', className: 'me-pulse' }, isoBox('cc', at[0], at[1], 0, 16, 14, 13, AMB)),
            h('text', { x: tp[0], y: tp[1], textAnchor: 'middle', fill: A, fontSize: 10.5, fontWeight: 700, ...halo }, `处理中 ${String(current.patient).split('/').pop()}`)))
        }
      }

      // 模型补充（旁路）：S05 之后取一份结果，只出建议，送到 S06；没配模型时灯是暗的
      {
        const on = !!model; const V = P.vio
        const mi = bay0(4) + 2; const mj = D + 118; const ma = 70; const mb = 42; const mh = 28
        const g = []
        g.push(...isoBox('mp', mi - 6, mj - 6, -3, ma + 12, mb + 12, 3, { top: C.pad, left: C.padL, right: C.padR }))
        const pipe = (key, from, to) => { const a = iso(...from); const b = iso(...to); return h('line', { key, x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: on ? V : C.left2, strokeWidth: on ? 1.8 : 1.4, strokeDasharray: '3 6', className: on ? 'me-flow' : undefined, filter: on ? 'url(#me-glow)' : undefined, opacity: on ? 1 : 0.5 }) }
        g.push(pipe('p1', [bay0(4) + 22, D, 22], [mi + 14, mj, mh - 4]), pipe('p2', [mi + ma - 14, mj, mh - 4], [bay0(5) + 22, D, 22]))
        g.push(...isoBox('mb', mi, mj, 0, ma, mb, mh, { top: C.top, left: C.left, right: C.right, edge: C.edge }))
        for (let w = 0; w < 3; w++) g.push(leftPatch(`mw${w}`, mi + 8 + w * 20, mi + 20 + w * 20, mj + mb, 9, 19, { fill: on ? V : C.win, opacity: on ? 0.9 : 0.55, filter: on ? 'url(#me-glow)' : undefined }))
        g.push(...isoBox('mbk', mi + 48, mj + 14, mh, 10, 10, 7, on ? { top: shade(V, 0.3), left: V, right: shade(V, -0.3) } : CL2))
        const lt = iso(mi - 10, mj + mb + 10)
        g.push(h('text', { key: 't1', x: lt[0], y: lt[1] + 6, textAnchor: 'end', fill: on ? V : P.ink3, fontSize: 11, fontWeight: 600, ...halo }, '模型补充（旁路）'),
          h('text', { key: 't2', x: lt[0], y: lt[1] + 20, textAnchor: 'end', fill: P.ink2, fontSize: 9.5, ...halo }, on ? `调用 ${fmt(model.calls)} · 建议 ${fmt(model.sugg)} · 不改规则结果` : '未配置模型 · 只跑规则'))
        els.push(h('g', { key: 'model', onClick: () => goto('calls'), style: { cursor: 'pointer' } }, h('title', {}, on ? `模型补充：${model.name}` : '未配置模型'), g))
        bb.push(iso(mi - 6, mj + mb + 6), iso(mi - 160, mj + mb + 40), iso(mi + ma, mj + mb + 6))
      }

      // 人工复核的回流：裁定写入裁定表，重跑时沿用到 S05
      {
        const a = iso(bay0(5) + 40, D + 40); const b = iso(bay0(4) + 50, D + 40)
        const mx = (a[0] + b[0]) / 2; const my = Math.max(a[1], b[1]) + 34
        els.push(h('g', { key: 'loop', pointerEvents: 'none' },
          h('path', { d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`, fill: 'none', stroke: P.ink2, strokeWidth: 1.4, strokeDasharray: '5 5', markerEnd: 'url(#me-arr)' }),
          h('text', { x: mx, y: my - 8, textAnchor: 'middle', fill: P.ink2, fontSize: 10, ...halo }, '裁定写入裁定表 · 重跑沿用')))
      }

      // 每道工序的标签卡（选中的那张在下面单独画大卡）
      const anchor = (k) => (k === 0 ? iso(42, 58, 112) : k === 6 ? iso(yard + 75, 70, 40) : iso(bay0(k) + bw / 2, D / 2, H + 30))
      const gateFill = { ok: P.ok, warn: P.warn, '': P.ink3 }
      // 画布范围与选中无关：每一站的小标签和（按最高行数算的）大卡都算进去，点哪一站画面都不动
      const cardRows = (s) => 3 + s.rows.length
      const maxCh = 34 + Math.max(...stations.map(cardRows)) * 18
      stations.forEach((s, k) => {
        const [x, y] = anchor(k)
        bb.push([x + 30, y - 106], [x + 142, y - 70], [x + 70, y - 80 - maxCh], [x + 266, y - 80])
      })
      stations.forEach((s, k) => {
        if (k === sel) return
        const [x, y] = anchor(k)
        const hotS = s.state === 'hold' || s.state === 'run'
        const cw = 112; const ch = 36; const cx = x + 30; const cy = y - 70 - ch
        const [gl, gv, gc] = s.rows[0] ?? []
        els.push(h('g', { key: `tag${k}`, ...click(k) },
          h('polyline', { points: pts([[x, y], [x, y - 20], [cx, cy + ch]]), fill: 'none', stroke: hotS ? A : C.grid, strokeOpacity: hotS ? 0.8 : 0.35 }),
          h('circle', { cx: x, cy: y, r: 1.8, fill: hotS ? A : C.grid, opacity: hotS ? 1 : 0.5 }),
          h('rect', { x: cx, y: cy, width: cw, height: ch, rx: 2, fill: C.card, stroke: hotS ? A : C.cardLine, strokeOpacity: hotS ? 0.8 : 1 }),
          h('text', { x: cx + 7, y: cy + 13, fill: hotS ? A : P.ink3, fontSize: 8.5, fontFamily: MONO, letterSpacing: 0.5 }, s.no, h('tspan', { fill: P.ink2, dx: 5, fontFamily: 'inherit' }, s.nm)),
          h('text', { x: cx + 7, y: cy + 29, fill: P.ink, fontSize: 12.5, fontWeight: 600, fontFamily: MONO }, s.big, s.unit ? h('tspan', { fontSize: 8.5, fontWeight: 400, fill: P.ink3, dx: 3 }, s.unit) : null),
          gv ? h('text', { x: cx + cw - 7, y: cy + 29, textAnchor: 'end', fill: gateFill[gc] ?? P.ink3, fontSize: 9, fontFamily: MONO }, gv) : null))
      })
      // 选中跨的信息卡
      {
        const s = stations[sel]; const [x, y] = anchor(sel)
        const rows = [[s.unit || '状态', s.big, ''], ...s.rows, ['完成', `${Math.round((s.frac ?? 0) * 100)}%`, ''], ['状态', STATE_LABEL[s.state], s.state === 'done' ? 'ok' : s.state === 'idle' ? '' : 'warn']]
        const cw = 196; const ch = 34 + rows.length * 18
        const cx = x + 70; const cy = y - 80 - ch
        const fill = { ok: P.ok, warn: P.warn, '': P.ink }
        els.push(h('g', { key: 'card', className: 'me-cardin' },
          h('polyline', { points: pts([[x, y], [x, y - 22], [cx, cy + ch]]), fill: 'none', stroke: A, strokeWidth: 1 }),
          h('circle', { cx: x, cy: y, r: 3, fill: A, filter: 'url(#me-glow)' }),
          h('rect', { x: cx, y: cy, width: cw, height: ch, rx: 3, fill: C.card, stroke: C.cardLine }),
          h('rect', { x: cx, y: cy, width: 2, height: ch, fill: A }),
          h('text', { x: cx + 14, y: cy + 20, fill: P.ink, fontSize: 12, fontWeight: 700, fontFamily: MONO, letterSpacing: 1 }, s.no, h('tspan', { fill: P.ink2, fontWeight: 400, dx: 8, fontSize: 11.5, fontFamily: 'inherit' }, s.nm)),
          rows.map(([l, v, cls], i) => h('g', { key: i },
            h('text', { x: cx + 14, y: cy + 42 + i * 18, fill: P.ink3, fontSize: 10.5 }, l),
            h('text', { x: cx + cw - 12, y: cy + 42 + i * 18, textAnchor: 'end', fill: fill[cls] ?? P.ink, fontSize: 12, fontFamily: MONO }, v)))))
      }

      // 画布范围：建筑、贴字与信息卡（网格自然出血）
      for (const [i, j, a, b, z] of [[-60, 44, 60, 24, 8], [0, 8, 84, 100, 112], [h0, 0, hallEnd - h0, D, H + 70], [yard, 6, 150, 160, 30], [bay0(4) - 10, D + 110, 90, 60, 30]]) {
        for (const [di, dj] of [[0, 0], [a, 0], [a, b], [0, b]]) bb.push(iso(i + di, j + dj, 0), iso(i + di, j + dj, z))
      }
      const xs = bb.map((p) => p[0]); const ys = bb.map((p) => p[1])
      const x0 = Math.min(...xs) - 24; const y0 = Math.min(...ys) - 16; const x1 = Math.max(...xs) + 24; const y1 = Math.max(...ys) + 16
      defs.push(h('mask', { key: 'mk', id: 'me-gridmask', maskUnits: 'userSpaceOnUse', x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, h('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'url(#me-fade)' })))
      return h('svg', { className: 'me-scene', viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, preserveAspectRatio: 'xMidYMin meet', style: { maxHeight: 620, overflow: 'hidden' } }, h('defs', {}, defs), els)
    }

    /** 右侧：选中工序的详情——小模型、按病人的指标柱、关键数字。 */
    function StationPanel({ s, k, patients, openPatient }) {
      const [P, C] = useClay()
      const [label, get, show] = STATION_METRIC[k]
      const vals = patients.map((p) => ({ p, v: get(p) ?? 0 }))
      const max = Math.max(0, ...vals.map((x) => x.v))
      const peak = vals.find((x) => x.v === max)
      const avg = vals.length ? vals.reduce((a, x) => a + x.v, 0) / vals.length : 0
      const peakN = vals.filter((x) => x.v === max).length
      const flat = max === Math.min(...vals.map((x) => x.v))
      const stateCls = s.state === 'hold' ? 'w' : s.state === 'run' ? 'w' : s.state === 'done' ? 'ok' : ''
      const hotTone = s.state === 'run' || s.state === 'hold' ? P.teal : null
      // 小模型：一个跨的特写
      const model = []
      model.push(...isoBox('pd', -8, -8, -4, 116, 96, 4, { top: C.pad, left: C.padL, right: C.padR }))
      model.push(...isoBox('m', 0, 0, 0, 100, 80, 42, { top: C.top, left: C.left, right: C.right, edge: C.edge }))
      for (let w = 0; w < 4; w++) model.push(leftPatch(`w${w}`, 10 + w * 22, 24 + w * 22, 80, 16, 30, { fill: hotTone ?? C.win, opacity: hotTone ? 0.85 : 0.6 }))
      const roof = []
      for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) roof.push([b, a])
      roof.sort((p, q) => depthOf(p[0] * 30, p[1] * 32) - depthOf(q[0] * 30, q[1] * 32)).forEach(([b, a], q) => {
        const lit = hotTone && q < Math.max(1, Math.round((s.frac ?? 0) * 6))
        model.push(...isoBox(`u${a}${b}`, 10 + b * 30, 12 + a * 32, 42, 22, 22, 9, lit ? { top: shade(hotTone, 0.25), left: hotTone, right: shade(hotTone, -0.3) } : { top: C.top2, left: C.left2, right: C.right2, edge: C.edge }))
        const f = iso(21 + b * 30, 23 + a * 32, 51)
        model.push(h('ellipse', { key: `f${a}${b}`, cx: f[0], cy: f[1], rx: 8, ry: 4.6, fill: lit ? shade(hotTone, -0.45) : C.hole }))
      })
      return h('div', { className: 'me-frame me-side' },
        h('div', { className: 'me-side-h' }, h('b', { className: 'me-num' }, s.no), h('span', {}, s.nm), h('span', { className: `me-chip ${stateCls}` }, STATE_LABEL[s.state])),
        h('div', { className: 'me-side-sub' }, s.sub),
        h('svg', { className: 'me-scene', viewBox: '-74 -74 186 158', style: { maxHeight: 160, margin: '6px 0' } }, model),
        h('div', { className: 'me-side-big' }, h('span', { className: 'me-num' }, s.big), h('small', {}, s.unit)),
        s.rows.map(([l, v, cls]) => h('div', { key: l, className: 'me-kvrow' }, h('span', {}, l), h('b', { className: `me-num ${cls === 'ok' ? 'me-ok' : cls === 'warn' ? 'me-warn' : ''}` }, v))),
        h('div', { className: 'me-kvrow' }, h('span', {}, '完成'), h('b', { className: 'me-num' }, `${Math.round((s.frac ?? 0) * 100)}%`)),
        h('div', { className: 'me-side-sec' }, h('span', {}, `${s.no} · 每位病人 · ${label}`), h('span', { className: 'me-tl' }, `峰值 ${show(max)}`)),
        h('div', { className: 'me-hbars' }, vals.map(({ p, v }) => h('i', {
          key: p.patient, title: `${p.patient}：${label} ${show(v)}`, onClick: () => openPatient(p.patient),
          className: max > 0 && v === max && (peakN <= 3 || flat === false) && !flat ? 'pk' : v > avg || flat ? 'hi' : '', style: { height: `${max ? Math.max(4, v / max * 100) : 4}%` },
        }))),
        h('div', { className: 'me-side-foot' }, h('span', {}, `均值 ${show(avg)}`), h('span', {}, peak && max > 0 ? `峰值 ${peak.p.patient.split('/').pop()}` : '')))
    }

    /** 刻度条：n 根竖线，按比例点亮。 */
    function Ticks({ v, n = 46, hot }) {
      const on = Math.round(Math.max(0, Math.min(1, v ?? 0)) * n)
      return h('div', { className: `me-ticks${hot ? ' hot' : ''}` }, Array.from({ length: n }, (_, i) => h('i', { key: i, className: i < on ? 'on' : '' })))
    }

    function GatesPanel({ P, gatePass, fb, types, typeTotal, run }) {
      const n = P.length || 1
      const rows = [
        ['①', '原文逐字一致 · 区间不倒置', gatePass('①') / n],
        ['③', '每条提及恰属一个事件', gatePass('③') / n],
        ['④', '每条发现可回溯原始提及', gatePass('④') / n],
        ['②', '兜底命中率', fb ?? 0, true],
      ]
      return h('div', { className: 'me-frame me-panel' },
        h('div', { className: 'me-panel-h' }, h('b', {}, '验收门'), h('span', { className: 'me-cap' }, 'GATES'), h('span', { className: 'me-sp' }), h('span', { className: 'me-live' }, h('i'), `${P.length} 人`)),
        rows.map(([g, label, v, rate, share]) => {
          const bad = !rate && !share && v < 1
          return h('div', { key: label, className: 'me-gl' },
            h('div', { className: 'me-gl-h' }, h('span', {}, h('em', {}, g), label), h('b', { className: `me-num${bad ? ' me-warn' : ''}` }, rate || share ? pct(v) : v >= 1 ? '全部通过' : pct(v))),
            h(Ticks, { v, hot: bad || (rate && v > 0.15) }))
        }),
        typeTotal ? h('div', { className: 'me-gl' },
          h('div', { className: 'me-gl-h' }, h('span', {}, h('em', {}, '类'), '提及类型'), h('b', { className: 'me-num', style: { fontSize: 10.5 } }, ['事实', '判断', '决策'].map((k) => `${k[0]} ${Math.round((types[k] ?? 0) / typeTotal * 100)}`).join(' · '))),
          h('div', { className: 'me-stack' }, ['事实', '判断', '决策'].map((k) => h('span', { key: k, style: { width: `${(types[k] ?? 0) / typeTotal * 100}%`, background: `var(--${{ 事实: 'fact', 判断: 'judge', 决策: 'decide' }[k]})` } })))) : null,
        h('div', { className: 'me-panel-foot' }, run.sourceCheck ? (run.sourceCheck.changed ? h('span', { className: 'me-warn' }, `⚠ 源文件有 ${run.sourceCheck.changed} 个变化`) : h('span', {}, '◇ 源文件只读核对一致')) : h('span', { className: 'me-faint' }, '源文件只读核对 —')))
    }

    function BatchPanel({ run, P, fb, openPatient }) {
      const t = run.totals
      const cell = (label, v, unit, hot) => h('div', { className: 'me-met' }, h('small', {}, label), h('div', {}, h('span', { className: `me-num${hot ? ' me-tl' : ''}` }, v), unit ? h('em', {}, unit) : null))
      const shown = P.slice(0, 16)
      const failN = P.filter((p) => p.failedGates.length).length
      const revN = P.filter((p) => !p.failedGates.length && p.review.findings).length
      return h('div', { className: 'me-frame me-panel' },
        h('div', { className: 'me-panel-h' }, h('b', {}, '批次'), h('span', { className: 'me-tagbox' }, run.status === 'running' ? 'RUN' : 'DONE'), h('span', { className: 'me-sp' }), statusChip(run.status)),
        h('div', { className: 'me-mets' },
          cell('完成', Math.round((t.patients ? t.done / t.patients : 0) * 100), '%', true), cell('提及', fmt(t.mentions), ''), cell('事件', fmt(t.events), ''),
          cell('发现', fmt(t.findings), '条'), cell('待复核', fmt(t.review), '项', t.review > 0), cell('兜底率', fb == null ? '—' : (fb * 100).toFixed(1), '%')),
        h('div', { className: 'me-panel-sec' }, h('span', {}, `病人 · ${P.length}`), h('span', {}, `${P.length - failN - revN} 通过 · ${revN} 待确认 · ${failN} 未过`)),
        h('div', { className: 'me-pchips' }, shown.map((p) => h('button', { key: p.patient, title: p.patient, className: p.failedGates.length ? 'x' : p.review.findings ? 'w' : '', onClick: () => openPatient(p.patient) }, p.patient.split('/').pop().slice(-4))),
          P.length > shown.length ? h('span', { className: 'me-faint' }, `+${P.length - shown.length}`) : null))
    }

    function FindingsPanel({ P, t, verdicts }) {
      const P_ = React.useContext(ThemeCtx)
      const vs = P.map((p) => p.counts.findings ?? 0)
      const W = 300; const Hh = 92
      const max = Math.max(1, ...vs); const avg = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0
      const X = (i) => (vs.length > 1 ? i / (vs.length - 1) * W : W / 2)
      const Y = (v) => Hh - 6 - v / max * (Hh - 16)
      const line = vs.map((v, i) => [X(i), Y(v)])
      const top = Object.entries(verdicts).sort((a, b) => b[1] - a[1])
      return h('div', { className: 'me-frame me-panel' },
        h('div', { className: 'me-panel-h' }, h('b', {}, '发现'), h('span', { className: 'me-cap' }, 'FINDINGS'), h('span', { className: 'me-sp' }), h('span', { className: 'me-faint me-num' }, `均 ${avg.toFixed(1)} / 人`)),
        h('div', { className: 'me-hero-num' }, h('span', { className: 'me-num' }, fmt(t.findings)), h('div', {}, h('small', {}, '条发现'), h('small', { className: 'me-tl' }, `▲ 待复核 ${fmt(t.review)}`))),
        vs.length ? h('svg', { className: 'me-scene', viewBox: `-4 0 ${W + 8} ${Hh + 14}`, style: { maxHeight: 130 } },
          h('defs', {}, h('linearGradient', { id: 'me-fa', x1: 0, x2: 0, y1: 0, y2: 1 }, h('stop', { offset: 0, stopColor: P_.teal, stopOpacity: 0.28 }), h('stop', { offset: 1, stopColor: P_.teal, stopOpacity: 0 }))),
          h('line', { x1: 0, x2: W, y1: Y(avg), y2: Y(avg), stroke: P_.ink3, strokeDasharray: '2 4', strokeWidth: 0.8 }),
          h('text', { x: W, y: Y(avg) - 4, textAnchor: 'end', fill: P_.ink3, fontSize: 8.5, fontFamily: MONO }, 'AVG'),
          h('polygon', { points: pts([[0, Hh], ...line, [W, Hh]]), fill: 'url(#me-fa)' }),
          h('polyline', { points: pts(line), fill: 'none', stroke: P_.teal, strokeWidth: 1.4, strokeLinejoin: 'round' }),
          h('circle', { cx: line.at(-1)[0], cy: line.at(-1)[1], r: 3, fill: P_.teal, style: { filter: `drop-shadow(0 0 4px ${P_.teal})` } }),
          [0, Math.floor((vs.length - 1) / 2), vs.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => h('text', { key: i, x: X(i), y: Hh + 12, textAnchor: i === 0 ? 'start' : i === vs.length - 1 ? 'end' : 'middle', fill: P_.ink3, fontSize: 8.5, fontFamily: MONO }, P[i].patient.split('/').pop().slice(-4)))) : null,
        h('div', { className: 'me-vchips' }, top.map(([k, v]) => h('span', { key: k, className: `me-chip ${VERDICT_CLS[k] ?? ''}` }, `${k} ${v}`))))
    }

    function AlertsPanel({ run, P, t, fb, goto }) {
      const items = []
      const failed = P.filter((p) => p.failedGates.length)
      if (run.error) items.push(['crit', 'S0?', '批次出错', run.error.split('\n')[0], null])
      if (failed.length) items.push(['crit', '验收', `${failed.length} 人验收门未过`, failed.slice(0, 2).map((p) => p.patient.split('/').pop()).join('、'), 'patients'])
      if (run.sourceCheck?.changed) items.push(['crit', '源文件', `源文件有 ${run.sourceCheck.changed} 个变化`, '只读核对不一致', null])
      if (run.format?.held) items.push(['warn', 'S00', `格式识别：${run.format.held} 张表待确认`, '暂扣，没有用来生成事件；确认后重新运行', 'formats'])
      if (t.review) items.push(['warn', 'S06', `待复核 ${fmt(t.review)} 项`, `涉及 ${P.filter((p) => p.review.findings).length} 位病人`, 'review'])
      for (const w of run.warnings ?? []) items.push(['warn', '提示', w, '', null])
      if (fb != null && fb > 0.15) items.push(['warn', 'S03', `兜底率 ${pct(fb)}`, '超过 15%，建议抽样核对', 'improve'])
      items.push(run.model ? ['info', '模型', `${run.model.model}${run.model.verifyModel ? ' ＋ 核验' : ''}`, `调用 ${fmt(t.modelCalls)} 次 · 建议 ${fmt(t.suggestions)} 条`, 'calls'] : ['info', '模型', '未配置模型：只跑规则', '设置 → 病历事件还原', null])
      if (run.output) items.push(['ok', 'S07', '事件包已交付', run.output.split('/').slice(-2).join('/'), 'report'])
      if (run.sourceCheck && !run.sourceCheck.changed) items.push(['ok', '源文件', '只读核对一致', '输入未被修改', null])
      const crit = items.filter((x) => x[0] === 'crit').length
      const tag = { crit: 'CRIT', warn: 'WARN', info: 'INFO', ok: 'OK' }
      const level = { crit: 1, warn: 0.75, info: 0.4, ok: 0.15 }
      return h('div', { className: 'me-frame me-panel' },
        h('div', { className: 'me-panel-h' }, h('b', {}, '提醒'), h('span', { className: 'me-cap' }, 'ALERTS'), h('span', { className: 'me-sp' }), h('span', { className: 'me-faint me-num' }, `${items.length} 条`), crit ? h('span', { className: 'me-bad me-num' }, ` · ${crit} CRIT`) : null),
        h('div', { className: 'me-alerts' }, items.map(([lv, src, title, sub, to], i) => h('div', { key: i, className: `me-al ${lv}${to ? ' click' : ''}`, onClick: to ? () => goto(to) : undefined },
          h('span', { className: 'me-al-bar' }), h('span', { className: 'me-al-src me-num' }, src),
          h('div', { className: 'me-al-t' }, h('b', {}, title), sub ? h('small', {}, sub) : null),
          h(Ticks, { v: level[lv], n: 12, hot: lv === 'crit' || lv === 'warn' }),
          h('span', { className: 'me-al-tag' }, tag[lv])))))
    }


    /* --------------------------------------------------------------- formats */
    const FMT_STATUS = { agreed: ['自动采用', 'ok'], confirmed: ['已确认', 'ok'], disputed: ['有分歧', 'w'], invalid: ['校验未过', 'w'], pending: ['待确认', 'w'], failed: ['调用失败', 'b'], rejected: ['已跳过', ''] }
    const FMT_ORIGIN = { model: '建议模型', verify: '核验模型', rule: '规则', user: '人工' }
    const DRAFT_LABEL = { model: '建议模型草稿', verify: '核验模型草稿', rule: '规则草稿' }

    /** 规格的一句话小结。 */
    function specLine(spec) {
      if (!spec) return '—'
      const parts = [spec.recordType ?? '（未定类别）']
      if (spec.written?.length) parts.push(`写成：${spec.written.join(' › ')}`)
      if (spec.sections?.length) parts.push(`栏目：${spec.sections.map(([f, n]) => `${n}←${f}`).join('，')}`)
      const roles = Object.entries(spec.roles ?? {})
      if (roles.length) parts.push(`角色：${roles.map(([r, f]) => `${r}←${[].concat(f).join('+')}`).join('，')}`)
      if (spec.measures?.length) parts.push(`测量：${spec.measures.map((m) => m[1]).join('、')}`)
      return parts.join('｜')
    }

    function Formats({ run, busy, onRerun, onError }) {
      const data = useAsync(() => call('formats', { runId: run.id }), [run.id])
      const [sel, setSel] = useState(null)
      const [filter, setFilter] = useState('held')
      const [rerunning, setRerunning] = useState(false)
      const entries = data.value?.entries ?? []
      const rec = run.recognition?.tables ?? []
      const bySig = new Map(entries.map((e) => [e.signature, e]))
      // 当前状态以格式库为准（人工裁定后立即反映），行数等取本批次
      const rows = rec.map((t) => ({ ...t, ...(bySig.get(t.signature) ? { status: bySig.get(t.signature).status, entry: bySig.get(t.signature) } : {}) }))
      const held = (r) => !['agreed', 'confirmed', 'rejected'].includes(r.status)
      const shown = rows.filter((r) => filter === 'all' || (filter === 'held' ? held(r) : !held(r)))
      const counts = { held: rows.filter(held).length, ok: rows.filter((r) => !held(r)).length, all: rows.length }
      const decide = async (payload) => {
        try { await call('formatDecide', payload); data.reload() } catch (e) { onError(msg(e)) }
      }
      const rerun = async () => {
        setRerunning(true)
        try { const v = await call('start', { inputDir: run.input, outputRoot: run.outputRoot, asOf: run.asOf || undefined }); onRerun(v.runId) } catch (e) { onError(msg(e)) } finally { setRerunning(false) }
      }
      const changed = rows.some((r) => (r.entry?.status ?? r.status) !== (rec.find((x) => x.signature === r.signature)?.status))
      const current = sel ? rows.find((r) => r.signature === sel) : null
      return h('div', { className: 'me-body', style: { flex: 1 } },
        h('div', { className: 'me-frame me-col', style: { flex: 1, minWidth: 0 } },
          h('div', { className: 'me-pad', style: { borderBottom: '1px solid var(--line)' } },
            h('div', { className: 'me-h' }, h('b', {}, '格式识别'), h('span', { className: 'me-cap' }, 'S00 · FORMAT'),
              h('span', { className: 'me-sp' }),
              h('button', { className: `me-btn ${changed ? 'me-new' : ''}`, disabled: busy || rerunning, title: busy ? '有批次在运行' : '用格式库里的最新结果重新跑这个输入', onClick: rerun }, rerunning ? '启动中…' : '↻ 按确认结果重新运行')),
            h('div', { className: 'me-muted', style: { lineHeight: 1.7 } },
              `${run.format?.tables ?? rows.length} 张表：自动采用或已确认 ${run.format?.adopted ?? 0}，待确认 ${run.format?.held ?? 0}，跳过 ${run.format?.ignored ?? 0}。`,
              h('br'), '两方一致（建议模型＋核验模型；只配了一个模型时第二票是规则草稿）才自动采用；有分歧、校验未过、没配模型的表先暂扣。确认后点右上角重新运行。识别结果存在本机格式库，同样的表以后直接复用。'),
            h('div', { style: { display: 'flex', gap: 6, marginTop: 8 } },
              [['held', '待确认'], ['ok', '已采用／跳过'], ['all', '全部']].map(([k, l]) => h('button', { key: k, className: `me-btn sm${filter === k ? ' on' : ''}`, onClick: () => setFilter(k) }, `${l} ${counts[k]}`)))),
          h('div', { className: 'me-scroll', style: { flex: 1 } },
            !shown.length ? h('div', { className: 'me-empty' }, filter === 'held' ? '没有待确认的表。' : '—')
              : h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, '表'), h('th', {}, '行'), h('th', {}, '状态'), h('th', {}, '类别'), h('th', {}, '依据'))),
                h('tbody', {}, shown.map((r) => {
                  const [label, cls] = FMT_STATUS[r.status] ?? [r.status, '']
                  const spec = r.entry?.spec
                  return h('tr', { key: r.signature, className: `click${sel === r.signature ? ' sel' : ''}`, onClick: () => setSel(r.signature) },
                    h('td', { className: 'me-num', style: { maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.table }, r.table),
                    h('td', { className: 'me-num' }, fmt(r.rows)),
                    h('td', {}, h('span', { className: `me-chip ${cls}` }, label)),
                    h('td', {}, spec?.recordType ?? r.recordType ?? '—', spec?.origin ? h('span', { className: 'me-faint', style: { marginLeft: 6, fontSize: 10.5 } }, FMT_ORIGIN[spec.origin] ?? spec.origin) : null),
                    h('td', { className: 'me-muted', style: { fontSize: 11.5 } }, [r.reason, ...(r.diffs ?? []), ...(r.problems ?? []).slice(0, 2)].filter(Boolean).join('；') || '—'))
                }))))),
        h('div', { className: 'me-frame me-scroll me-pad', style: { width: 460, flex: 'none' } },
          !current ? h('div', { className: 'me-faint' }, '点左边的一张表，查看识别规格和各方草稿，并确认、修改或跳过。')
            : h(FormatDetail, { key: current.signature, row: current, entry: current.entry, canon: data.value?.canon, decide })))
    }

    function FormatDetail({ row, entry, canon, decide }) {
      const [editing, setEditing] = useState(false)
      const [text, setText] = useState(() => JSON.stringify(stripSpec(entry?.spec), null, 1))
      const [jsonErr, setJsonErr] = useState('')
      const [label, cls] = FMT_STATUS[entry?.status ?? row.status] ?? [row.status, '']
      const drafts = entry?.drafts ?? {}
      return h('div', {},
        h('div', { className: 'me-h' }, h('b', { className: 'me-num', style: { wordBreak: 'break-all' } }, row.table), h('span', { className: `me-chip ${cls}` }, label)),
        h('div', { className: 'me-muted', style: { fontSize: 11.5, marginBottom: 8 } }, `${fmt(row.rows)} 行 · ${row.files} 个文件 · 字段 ${entry?.fields?.length ?? '—'}（空 ${entry?.fields?.filter((f) => f.kind === 'empty').length ?? '—'}）`),
        row.reason ? h('div', { className: 'me-mo' }, row.reason, ...(row.diffs ?? []).map((d, i) => h('div', { key: i }, `· ${d}`)), ...(row.problems ?? []).map((d, i) => h('div', { key: `p${i}`, className: 'me-warn' }, `· ${d}`))) : null,
        h('div', { className: 'me-sec' }, h('b', {}, '当前规格'), h('span', { className: 'me-cap' }, FMT_ORIGIN[entry?.spec?.origin] ?? '')),
        h('div', { style: { fontSize: 12, lineHeight: 1.7 } }, specLine(entry?.spec)),
        entry?.spec?.note ? h('div', { className: 'me-faint', style: { fontSize: 11, marginTop: 4 } }, `依据：${entry.spec.note}`) : null,
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 } },
          h('button', { className: 'me-btn me-new', onClick: () => decide({ signature: row.signature, action: 'confirm' }) }, '✓ 采用当前规格'),
          h('button', { className: 'me-btn', onClick: () => decide({ signature: row.signature, action: 'reject' }) }, '跳过这张表'),
          h('button', { className: 'me-btn', title: '从格式库删掉，下次运行重新起草', onClick: () => decide({ signature: row.signature, action: 'reset' }) }, '重新起草'),
          h('button', { className: `me-btn${editing ? ' on' : ''}`, onClick: () => setEditing(!editing) }, '编辑…')),
        editing ? h('div', { style: { marginTop: 8 } },
          h('textarea', { className: 'me-input', style: { width: '100%', height: 260, fontFamily: 'var(--mono)', fontSize: 11.5 }, value: text, onChange: (e) => setText(e.target.value) }),
          h('div', { className: 'me-faint', style: { fontSize: 10.5, margin: '4px 0 6px' } }, `类别：${(canon?.recordTypes ?? []).join('、')}。字段名必须是这张表里有的；保存时插件会校验。`),
          jsonErr ? h('div', { className: 'me-err', style: { marginBottom: 6 } }, jsonErr) : null,
          h('button', { className: 'me-btn me-new', onClick: () => { let spec; try { spec = JSON.parse(text) } catch (e) { return setJsonErr(`不是合法的 JSON：${msg(e)}`) } setJsonErr(''); decide({ signature: row.signature, action: 'confirm', spec }) } }, '校验并确认')) : null,
        h('div', { className: 'me-sec' }, h('b', {}, '各方草稿'), h('span', { className: 'me-cap' }, 'DRAFTS')),
        Object.entries(DRAFT_LABEL).filter(([k]) => drafts[k]).map(([k, l]) => h('div', { key: k, className: 'me-mrow' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } }, h('b', { style: { fontSize: 12 } }, l), h('span', { className: 'me-sp' }),
            h('button', { className: 'me-btn sm', onClick: () => decide({ signature: row.signature, action: 'confirm', use: k }) }, '采用这份')),
          h('div', { className: 'me-muted', style: { marginTop: 3 } }, specLine(drafts[k])))),
        entry?.fields?.length ? h(React.Fragment, {},
          h('div', { className: 'me-sec' }, h('b', {}, '字段'), h('span', { className: 'me-cap' }, 'FIELDS')),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } }, entry.fields.filter((f) => f.kind !== 'empty').map((f) => h('span', { key: f.name, className: 'me-chip', title: `${f.kind} · 填充 ${f.fill}%` }, `${f.name}·${FIELD_KIND[f.kind] ?? f.kind}`)))) : null)
    }
    const FIELD_KIND = { time: '时间', number: '数', code: '代码', text: '短文', long: '长文', embedded: '嵌入文书', pseudonym: '假名' }
    const stripSpec = (s) => { if (!s) return {}; const { origin, accept, ...rest } = s; return rest }

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
                  Object.values(tl.manifest.gates).every((g) => g.pass) ? h('span', { className: 'me-chip ok' }, '四道验收门全部通过') : h('span', { className: 'me-chip b' }, '有验收门未过')),
                h('div', { className: 'me-muted', style: { marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' } },
                  [`片段 ${fmt(tl.counts.fragments)}`, `提及 ${fmt(tl.counts.mentions)}`, `事件 ${fmt(tl.counts.events)}`, `发现 ${fmt(tl.counts.findings)}`].map((x) => h('span', { key: x }, x)),
                  h('span', { className: 'me-sp' }),
                  h('span', { className: 'me-chip f' }, '● 事实'), h('span', { className: 'me-chip j' }, '● 判断'), h('span', { className: 'me-chip d' }, '● 决策'),
                  h('button', { className: `me-btn sm${depth ? ' on' : ''}`, title: '切换立体（2.5D）／平面显示', onClick: toggleDepth }, depth ? '◆ 2.5D' : '▭ 平面'),
                  h('label', {}, '可见截断 ', h('input', { className: 'me-input', type: 'date', value: cutoff, onChange: (e) => setCutoff(e.target.value), style: { padding: '1px 4px' } })))),
              h('div', { className: 'me-scroll', style: { flex: 1 } }, h(TimelineSvg, { tl, cutoff, sel, depth, onSelect: (x) => { setSel(x); setFocus(x) } })))),
        h('div', { className: 'me-frame me-scroll me-pad', style: { width: 380, flex: 'none' } },
          !sel ? h('div', { className: 'me-faint' }, '点时间线上的条、点或发现标记查看详情。')
            : sel.kind === 'event' ? h(EventDetail, { run, patient, eventId: sel.id, gotoSource, onFinding: (id) => setSel({ kind: 'finding', id }), onEvent: (id) => setSel({ kind: 'event', id }) })
              : h(FindingDetail, { run, patient, findingId: sel.id, gotoSource, gotoReview })))
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
        h('div', { className: 'me-faint', style: { fontSize: 10.5, marginTop: 6 } }, '裁定按稳定编号写入记录库（_records/records.sqlite），每次改动留痕，下次重跑沿用；不改原文。'))
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
              g ? h('div', { className: 'me-faint', style: { padding: '8px 8px 3px', display: 'flex', justifyContent: 'space-between' } }, h('span', {}, h('span', { style: { color: `var(--${{ 矛盾: 'bad', 记录质量: 'warn', 改判: 'vio', 病情变化: 'vio', 调整: 'ok' }[g] ?? 'ink3'})` } }, '● '), g), h('span', { className: 'me-num' }, sub.length)) : null,
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
    function SettingsSection({ inModal = false } = {}) {
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
        inModal ? null : h('p', { style: { margin: 0, color: 'var(--dsw-alias-label-secondary)' } }, '这里只放配置。运行批次、看时间线与复核，请到左侧栏的「病历事件还原」，或在聊天框使用 /event。'),
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
