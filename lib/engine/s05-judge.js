/**
 * S05 矛盾判断（工序4 v1.0）：在事件上判断冲突是什么性质。
 * 不删改原文、不替医生下结论；判不了的写“证据不足”。
 *
 * 判定：矛盾／改判／调整／病情变化／命名不一致／记录质量／证据不足
 * 规则：R1 时间先行 … R10 兜底（见设计文档）
 */
import { findingId } from './ids.js'
import { dayOf, diffDays, intersect } from './time.js'
import { normText } from './s04-merge.js'

const EVAL_CLASS = { 矛盾: '真冲突', 证据不足: '真冲突', 记录质量: '可以裁决', 改判: '不冲突', 调整: '不冲突', 病情变化: '不冲突', 命名不一致: '不冲突' }

/** 来源可信度：1 结构化 2 同期文书 3 同次补记 4 回顾转述 5 外院转述 6 模板化内容 */
export function tierOf(m) {
  if (m.kind === '结构化') return 1
  if (m.templated) return 6
  if (m.origin === '外院转述') return 5
  if (m.temporality === '回顾转述') {
    // 写成距所说的事不超过 14 天，仍按同期（入院记录现病史里几天前的事）
    const to = m.occurTo ?? m.occurFrom
    if (to && diffDays(to, dayOf(m.writtenAt)) <= 14) return 2
    return 4
  }
  if (m.temporality === '同次补记') return 3
  return 2
}

const TIER_NAME = { 1: '结构化记录', 2: '同期文书', 3: '同次补记', 4: '回顾转述', 5: '外院转述', 6: '模板化内容' }

function side(label, mentions) {
  const ms = mentions.filter(Boolean)
  const tier = ms.length ? Math.min(...ms.map(tierOf)) : null
  return { label, tier, tierName: tier ? TIER_NAME[tier] : null, mentions: ms.map((m) => m.id), firstWritten: ms.map((m) => m.writtenAt).sort()[0] ?? null }
}

/** 按来源可信度给建议采信；同级标需人工确认。 */
function adoptOf(sides) {
  const ranked = sides.filter((s) => s.tier != null).sort((a, b) => a.tier - b.tier)
  if (!ranked.length) return { adopt: '无法判定', reason: '各方都没有可用来源', certainty: '需人工确认' }
  if (ranked.length > 1 && ranked[0].tier === ranked[1].tier) {
    return { adopt: '无法判定', reason: `各方来源同级（${ranked[0].tierName}）`, certainty: '需人工确认' }
  }
  return { adopt: ranked[0].label, reason: `${ranked[0].tierName}（等级 ${ranked[0].tier}）优于${ranked.slice(1).map((s) => s.tierName).join('、')}`, certainty: '规则确定' }
}

export function judgeFindings({ events, mentions, clues, fragments }, pack) {
  const P = pack.params
  const byId = new Map(mentions.map((m) => [m.id, m]))
  const evById = new Map(events.map((e) => [e.id, e]))
  const fragById = new Map(fragments.map((f) => [f.id, f]))
  const M = (e) => e.mentions.map((id) => byId.get(id)).filter(Boolean)
  const findings = []
  const add = (f) => {
    f.id = findingId(`${f.verdict}/${f.subclass ?? ''}`, f.events)
    f.evalClass = EVAL_CLASS[f.verdict] ?? null
    if (!findings.some((x) => x.id === f.id)) findings.push(f)
  }

  /* R3 一次性事件或同一事件有互不相交的日期 */
  for (const c of clues.filter((x) => x.kind === '时间不一致')) {
    const e = evById.get(c.events[0])
    const ms = M(e).filter((m) => m.occurFrom || m.occurTo)
    // 按月份聚成几方
    const groups = new Map()
    for (const m of ms) {
      const k = (m.occurFrom ?? m.occurTo).slice(0, 7)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(m)
    }
    // 复制漂移：同一句带相对时间的话出现在多份文书、推算日期互不相交
    const byText = new Map()
    for (const m of ms.filter((x) => /相对|病程/.test(x.timeSource))) {
      const k = normText(m.text)
      if (!byText.has(k)) byText.set(k, [])
      byText.get(k).push(m)
    }
    const drift = [...byText.values()].some((list) => new Set(list.map((m) => m.fragmentId)).size > 1
      && list.some((x) => list.some((y) => !intersect({ a: x.occurFrom, b: x.occurTo }, { a: y.occurFrom, b: y.occurTo }))))
    if (drift && ms.every((m) => /相对|病程/.test(m.timeSource))) {
      const earliest = [...ms].sort((a, b) => a.writtenAt.localeCompare(b.writtenAt))[0]
      add({ verdict: '记录质量', subclass: '复制漂移', rule: 'R3 一次性事件多日期', events: [e.id],
        why: `同一句带相对时间的话被抄进 ${new Set(ms.map((m) => m.fragmentId)).size} 份不同日期的文书，推算日期随写成日漂移（${e.concept}）`,
        sides: [...groups.entries()].map(([k, list]) => side(`${k}（${list.length} 条）`, list)),
        adopt: `最早成文的一条（${dayOf(earliest.writtenAt)}）`, adoptReason: '复制的源头最接近原始记载', certainty: '需人工确认', timeRelation: '无交集', impact: ['时间线'] })
      continue
    }
    const sides = [...groups.entries()].map(([k, list]) => side(`${k}（${list.length} 条）`, list))
    const a = adoptOf(sides)
    const best = sides.find((s) => s.label === a.adopt)
    const others = sides.filter((s) => s !== best)
    const quality = best?.tier === 2 && others.every((s) => s.tier >= 4) ? '回顾转述与同期记录不一致，以同期为准（记录质量·转述误差）' : null
    add({ verdict: '矛盾', subclass: '时间矛盾', rule: 'R3 一次性事件多日期', events: [e.id],
      why: `同一事件「${e.concept}」的发生时间互不相交`, qualityNote: quality,
      sides, adopt: a.adopt, adoptReason: a.reason, certainty: a.certainty, timeRelation: '无交集', impact: ['时间线'] })
  }

  /* R4 阳性与否认并存（含否认上位概念）；R8 文书内自相矛盾、版本冲突 */
  const dx = events.filter((e) => e.conceptGroup === '诊断' && e.polarity === '阳性' && e.concept)
  const children = new Map((pack.hypernyms ?? []).map((h) => [h.name, h.children]))
  const negEvents = events.filter((e) => e.conceptGroup === '病史否认' && e.concept)
  const versionConflicts = new Map()
  for (const ng of negEvents) {
    const targets = new Set([ng.concept, ...(children.get(ng.concept) ?? [])])
    const pos = dx.filter((e) => targets.has(e.concept))
    if (!pos.length) continue
    const posMs = pos.flatMap(M)
    const span = { a: dayOf(posMs.map((m) => m.writtenAt).sort()[0]), b: dayOf(posMs.map((m) => m.writtenAt).sort().at(-1)) }
    const negMs = M(ng)
    // R8（不看时期）文书内自相矛盾：同一份文书里既写了阳性、又否认
    const posByFrag = new Map()
    for (const m of posMs) if (m.kind === '文书') posByFrag.set(m.fragmentId, m)
    for (const m of negMs) {
      const p = posByFrag.get(m.fragmentId)
      if (!p) continue
      add({ verdict: '矛盾', subclass: '文书内自相矛盾', rule: 'R8 文书内与版本冲突', events: [ng.id, p.eventId],
        why: `同一份文书（${m.recordType}，写成 ${dayOf(m.writtenAt)}）既写了${evById.get(p.eventId)?.concept}，又否认${ng.concept}`,
        sides: [side(`同文书里的阳性`, [p]), side(`同文书里的否认「${ng.concept}」`, [m])],
        adopt: '阳性一方', adoptReason: '否认多为模板残留', certainty: '需人工确认', timeRelation: '同一文书', impact: ['诊断'] })
    }
    // R8 版本冲突：同一次住院两版入院记录，一版否认、一版记有（按住院汇总，见循环后）
    for (const m of negMs) {
      const f = fragById.get(m.fragmentId)
      if (!f?.encounterId || f.table !== 'admission') continue
      const other = posMs.find((p) => {
        const g = fragById.get(p.fragmentId)
        return g && g.table === 'admission' && g.encounterId === f.encounterId && (g.version ?? 1) !== (f.version ?? 1)
      })
      if (!other) continue
      const k = f.encounterId
      if (!versionConflicts.has(k)) versionConflicts.set(k, { neg: [], pos: [], concepts: new Set(), events: new Set(), laterIsPositive: (fragById.get(other.fragmentId).version ?? 1) > (f.version ?? 1) })
      const vc = versionConflicts.get(k)
      vc.neg.push(m); vc.pos.push(other); vc.concepts.add(ng.concept); vc.events.add(ng.id); vc.events.add(other.eventId)
    }
    const inPeriod = negMs.filter((m) => dayOf(m.writtenAt) >= span.a && dayOf(m.writtenAt) <= span.b)
    const label = pos.map((e) => e.concept).join('、')
    if (!inPeriod.length) {
      if (negMs.every((m) => dayOf(m.writtenAt) < span.a)) {
        add({ verdict: '病情变化', subclass: '新出现', rule: 'R1 时间先行', events: [ng.id, ...pos.map((e) => e.id)],
          why: `否认「${ng.concept}」都写在阳性记录出现之前，时间上不重叠`, sides: [side(`否认「${ng.concept}」`, negMs), side(`阳性（${label}）`, posMs.slice(0, 50))],
          adopt: '—', adoptReason: '不是冲突', certainty: '规则确定', timeRelation: '先后', impact: ['诊断'] })
      }
      continue
    }
    const tmpl = inPeriod.filter((m) => m.templated)
    const real = inPeriod.filter((m) => !m.templated)
    const posSide = side(`阳性（${label}，${posMs.length} 条）`, posMs.slice(0, 50))
    if (real.length) {
      const s2 = side(`非模板的否认「${ng.concept}」（${real.length} 条）`, real)
      add({ verdict: '矛盾', subclass: '存在矛盾', rule: 'R4 阳性与否认并存', events: [ng.id, ...pos.map((e) => e.id)],
        why: `同一时期（${span.a}～${span.b}）既记有「${label}」又有非模板的否认${ng.concept !== label ? `（否认上位概念「${ng.concept}」）` : ''}`,
        sides: [posSide, s2], ...rename(adoptOf([posSide, s2])), timeRelation: '重叠', impact: ['诊断'] })
    }
    if (tmpl.length) {
      add({ verdict: '记录质量', subclass: '模板化否认', rule: 'R4 阳性与否认并存', events: [ng.id, ...pos.map((e) => e.id)],
        why: `模板里的“否认${ng.concept}”与同期阳性记录并存`,
        sides: [posSide, side(`模板化否认「${ng.concept}」（${tmpl.length} 条）`, tmpl)],
        adopt: posSide.label, adoptReason: '模板化内容（等级 6）可信度最低', certainty: '规则确定', timeRelation: '重叠', impact: ['诊断'] })
    }
  }
  for (const [, vc] of versionConflicts) {
    add({ verdict: '矛盾', subclass: '版本冲突', rule: 'R8 文书内与版本冲突', events: [...vc.events],
      why: `同一次住院的两版入院记录：一版否认${[...vc.concepts].join('、')}，另一版记有`,
      sides: [side('否认的一版', vc.neg), side('记有的一版', vc.pos)],
      adopt: vc.laterIsPositive ? '第二版（需人工确认补写依据）' : '第一版（需人工确认）', adoptReason: '版本先后', certainty: '需人工确认', timeRelation: '同一就诊', impact: ['诊断'] })
  }

  /* R5 互斥用药；R6 停用后仍记在用 */
  const drugs = events.filter((e) => e.conceptGroup === '用药')
  const segOf = (name) => drugs.filter((e) => e.concept === name && e.segment)
  const pointsOf = (name, act) => drugs.filter((e) => e.concept === name && e.drugAction === act)
  const day = (e) => dayOf(e.firstWritten)
  for (const g of pack.exclusive ?? []) {
    for (const a of g.drugs) for (const b of g.drugs) {
      if (a === b) continue
      // 换药：停 A 后 窗口内启动 B
      const switched = new Set()
      for (const stop of pointsOf(a, '停止').sort((x, y) => day(y).localeCompare(day(x)))) {
        const start = pointsOf(b, '启动／执行').find((s) => diffDays(day(stop), day(s)) >= 0 && diffDays(day(stop), day(s)) <= P.switchWindowDays)
        if (start && !switched.has(start.id)) {
          switched.add(start.id)
          add({ verdict: '调整', subclass: '换药', rule: 'R5 互斥用药', events: [stop.id, start.id],
            why: `${g.name}：原文记载停 ${a}、改 ${b}，属有记载的方案调整`, sides: [side(`${a} 停用（${day(stop)}）`, M(stop)), side(`${b} 启动（${day(start)}）`, M(start))],
            adopt: '—', adoptReason: '不是冲突', certainty: '规则确定', timeRelation: '先后', impact: ['用药片段'] })
          // B 启动后无 B 停用，之后又记 A 在用（超过换药窗口）
          const bStopped = pointsOf(b, '停止').some((s) => day(s) >= day(start))
          const aLater = segOf(a).filter((s) => diffDays(day(start), s.segment.to) > P.switchWindowDays)
          if (!bStopped && aLater.length) {
            const later = aLater.flatMap(M).filter((m) => diffDays(day(start), dayOf(m.anchor ?? m.writtenAt)) > P.switchWindowDays)
            add({ verdict: '证据不足', subclass: '用药矛盾（待定）', rule: 'R5 互斥用药', events: [start.id, ...aLater.map((s) => s.id)],
              why: `${g.name}：${b} 启动后没有停用记载，${a} 又被记为在用。若两者确在同期使用即为用药矛盾；也可能是换回 ${a} 未记载`,
              sides: [side(`${b} 启动（${day(start)}），之后无停用记载`, M(start)), side(`${a} 在换药窗口（${P.switchWindowDays} 天）之后仍记在用（${later.length} 条）`, later.slice(0, 50))],
              adopt: '无法判定', adoptReason: '缺停用或恢复记载', certainty: '需人工确认', timeRelation: '先后', impact: ['用药片段'] })
          }
        }
      }
      // 两药在用片段重叠超过窗口、且无停用/改用记载 → 用药矛盾
      if (a < b) {
        for (const sa of segOf(a)) for (const sb of segOf(b)) {
          const ov = intersect({ a: sa.segment.from, b: sa.segment.to }, { a: sb.segment.from, b: sb.segment.to })
          if (!ov || diffDays(ov.a, ov.b) <= P.switchWindowDays) continue
          const changed = [...pointsOf(a, '停止'), ...pointsOf(b, '停止'), ...pointsOf(a, '启动／执行'), ...pointsOf(b, '启动／执行')].some((p) => day(p) >= ov.a && day(p) <= ov.b)
          if (changed) continue
          add({ verdict: '矛盾', subclass: '用药矛盾', rule: 'R5 互斥用药', events: [sa.id, sb.id],
            why: `${g.name}：${a} 与 ${b} 的在用片段重叠 ${diffDays(ov.a, ov.b)} 天（${ov.a}～${ov.b}），超过换药窗口 ${P.switchWindowDays} 天，且无停用／改用记载`,
            sides: [side(`${a} 在用`, M(sa).slice(0, 50)), side(`${b} 在用`, M(sb).slice(0, 50))], adopt: '无法判定', adoptReason: '用药片段是“文书称在用”，不等于实际服药', certainty: '需人工确认', timeRelation: '重叠', impact: ['用药片段'] })
        }
      }
    }
  }
  for (const name of new Set(drugs.map((e) => e.concept))) {
    const stops = pointsOf(name, '停止').sort((x, y) => day(x).localeCompare(day(y)))
    for (const seg of segOf(name)) {
      const before = stops.filter((st) => day(st) < seg.segment.from)
      if (!before.length) continue
      const stop = before.at(-1)
      // 恢复用药的记载：启动，或调整剂量（调整说明仍在用）
      const resumed = [...pointsOf(name, '启动／执行'), ...pointsOf(name, '调整')].some((p) => day(p) >= day(stop) && day(p) <= seg.segment.from)
      if (resumed) continue
      add({ verdict: '证据不足', subclass: '停用后仍记在用', rule: 'R6 停用后仍记在用', events: [stop.id, seg.id],
        why: `${name} 在 ${day(stop)} 有停用记载，${seg.segment.from} 起又记在用，中间没有恢复用药的记载；可能是恢复用药未记，也可能是复制旧文书`,
        sides: [side(`${name} 停用（${day(stop)}）`, M(stop)), side(`${name} 之后又记在用（${seg.mentionCount} 条）`, M(seg).slice(0, 50))],
        adopt: '无法判定', adoptReason: '缺恢复记载', certainty: '需人工确认', timeRelation: '先后', impact: ['用药片段'] })
    }
  }

  /* R2 数值：文书写明日期的检验值与检验表对照 */
  const labEv = new Map(events.filter((e) => e.conceptGroup === '检验结果').map((e) => [e.id, e]))
  const structByConcept = new Map()
  for (const m of mentions) {
    if (m.kind !== '结构化' || m.recordType !== '检验') continue
    const e = labEv.get(m.eventId)
    if (!e) continue
    if (!structByConcept.has(e.concept)) structByConcept.set(e.concept, [])
    structByConcept.get(e.concept).push({ m, value: Number(e.value), day: m.occurFrom })
  }
  const seenLab = new Set()
  const lineConflicts = new Map()
  for (const m of mentions) {
    if (m.kind !== '文书' || m.subdivision !== '患者状态' || m.item !== '检验指标') continue
    if (!/原文日期|行首日期/.test(m.timeSource) || m.occurFrom !== m.occurTo) continue
    // 原文数值与检验表数量级不同（单位不同或项目解析不准）时不判数值矛盾
    const ratioOk = (a, b) => a > 0 && b > 0 && a / b <= 2 && b / a <= 2
    const e = labEv.get(m.eventId)
    if (!e) continue
    const d = m.occurFrom; const v = Number(e.value)
    if (!Number.isFinite(v)) continue
    const cand = (structByConcept.get(e.concept) ?? []).filter((x) => Math.abs(diffDays(d, x.day)) <= P.labDayTolerance)
    if (!cand.length || cand.some((x) => x.value === v && x.day === d)) continue
    const k = `${e.concept}\u0000${d}\u0000${v}`
    if (seenLab.has(k)) continue
    seenLab.add(k)
    const sameValue = cand.find((x) => x.value === v)
    const sameDay = cand.filter((x) => x.day === d)
    if (sameValue && sameDay.length) {
      add({ verdict: '记录质量', subclass: '转述误差', rule: 'R1 时间先行', events: [e.id, ...new Set(sameDay.map((x) => x.m.eventId))],
        why: `文书注明的检验日期与检验表差 ${Math.abs(diffDays(d, sameValue.day))} 天：检验表 ${sameValue.day} 有 ${e.concept} ${e.value}，${d} 为 ${sameDay.map((x) => x.value).join('、')}`,
        sides: [side(`文书写 ${e.concept} ${e.value}（注明 ${d}）`, [m]), side(`检验表 ${sameValue.day} 有 ${e.concept} ${e.value}`, [sameValue.m])],
        adopt: '检验表（结构化）', adoptReason: '结构化记录（等级 1）', certainty: '规则确定', timeRelation: '相邻', impact: ['检验'] })
    } else if (!sameValue && sameDay.length && sameDay.every((x) => ratioOk(v, x.value))) {
      const gk = `${m.fragmentId}\u0000${d}`
      if (!lineConflicts.has(gk)) lineConflicts.set(gk, [])
      lineConflicts.get(gk).push({ m, e, sameDay })
    }
  }
  // 同一行（同一份文书、同一个注明日期）里多项都对不上：多半是日期写错或指另一次采样，合成一条记录质量发现
  for (const [, list] of lineConflicts) {
    if (list.length >= 3) {
      const d = list[0].m.occurFrom
      add({ verdict: '记录质量', subclass: '转述误差', rule: 'R1 时间先行', events: [...new Set(list.flatMap((x) => [x.e.id, ...x.sameDay.map((y) => y.m.eventId)]))],
        why: `文书注明 ${d} 的 ${list.length} 项检验与检验表当天的值都对不上（${list.slice(0, 4).map((x) => `${x.e.concept} ${x.e.value}/${x.sameDay[0].value}`).join('，')}…）：多半是注明的日期不对，或指另一次采样`,
        sides: [side(`文书（注明 ${d}）`, list.map((x) => x.m)), side(`检验表 ${d}`, list.flatMap((x) => x.sameDay.map((y) => y.m)))],
        adopt: '检验表（结构化）', adoptReason: '结构化记录（等级 1）', certainty: '需人工确认', timeRelation: '同日', impact: ['检验'] })
      continue
    }
    for (const { m, e, sameDay } of list) {
      add({ verdict: '矛盾', subclass: '数值矛盾', rule: 'R2 按类型配对', events: [e.id, ...new Set(sameDay.map((x) => x.m.eventId))],
        why: `同一天 ${e.concept}：文书写 ${e.value}，检验表为 ${sameDay.map((x) => x.value).join('、')}；同日多次采样（如透前透后）时可能误报`,
        sides: [side('文书', [m]), side('检验表', sameDay.map((x) => x.m))], adopt: '检验表（结构化）', adoptReason: '结构化记录（等级 1）', certainty: '需人工确认', timeRelation: '同日', impact: ['检验'] })
    }
  }

  /* R7 同对象判断改变（影像改判候选） */
  const img = pack.imaging
  if (img) {
    const concl = mentions.filter((m) => m.recordType === '检查报告' || m.item === '检查结论')
      .sort((a, b) => a.writtenAt.localeCompare(b.writtenAt))
    // 不确定措辞看整句（“两侧肺动脉区致密影，请结合临床”被分成两条）
    const sentText = new Map()
    for (const m of concl) { const k = `${m.fragmentId}\u0000${m.sentence}`; sentText.set(k, (sentText.get(k) ?? '') + m.text) }
    const sentenceOf = (m) => sentText.get(`${m.fragmentId}\u0000${m.sentence}`) ?? m.text
    const seen = new Set()
    // 发现名词必须紧跟检查对象（12 字内），避免“肺动脉…心影增大”这种跨对象误配
    const near = (text, obj) => {
      const out = new Set()
      for (let at = text.indexOf(obj); at >= 0; at = text.indexOf(obj, at + 1)) {
        const win = text.slice(at, at + obj.length + 12)
        for (const f of img.findings) if (win.includes(f)) out.add(f)
      }
      return out
    }
    const seenImg = new Set()
    for (let i = 0; i < concl.length; i++) {
      const a = concl[i]
      if (!img.uncertain.test(sentenceOf(a))) continue
      for (const obj of img.objects) {
        const fas = near(a.text, obj)
        if (!fas.size) continue
        const b = concl.slice(i + 1).find((x) => x.fragmentId !== a.fragmentId && [...near(x.text, obj)].some((f) => !fas.has(f)) && ![...fas].some((f) => near(x.text, obj).has(f)))
        if (!b) continue
        const fa = [...fas][0]
        const fb = [...near(b.text, obj)].find((f) => !fas.has(f))
        const k = `${obj}\u0000${fa}\u0000${fb}`
        if (seenImg.has(k)) continue
        seenImg.add(k)
        add({ verdict: '改判', subclass: '改判候选', rule: 'R7 同对象判断改变', events: [a.eventId, b.eventId],
          why: `「${obj}」先前的结论带不确定措辞（${fa}），后来同类检查改为${fb}`,
          sides: [side(`先前（${dayOf(a.writtenAt)}）`, [a]), side(`后来（${dayOf(b.writtenAt)}）`, [b])],
          adopt: '后来的判断（需人工确认）', adoptReason: '后来的检查信息更多', certainty: '需人工确认', timeRelation: '先后', impact: ['诊断'] })
      }
    }
  }

  /* R9 候选同义 → 命名不一致 */
  for (const c of clues.filter((x) => x.kind === '候选同义')) {
    add({ verdict: '命名不一致', subclass: '候选同义', rule: 'R9 候选同义', events: c.events,
      why: `相关但不同名的说法并存：${c.concept}；交医生确认是否同指`, sides: c.events.map((id) => { const e = evById.get(id); return side(`${e.concept} ${dayOf(e.firstWritten)}～${dayOf(e.lastWritten)}`, M(e).slice(0, 20)) }),
      adopt: '—', adoptReason: '不判矛盾', certainty: '需人工确认', timeRelation: '重叠', impact: ['诊断'] })
  }

  /* 病情变化：分期分级（不进矛盾表，单列） */
  const stageChanges = []
  const stagePat = /^(.*?)([0-9一二三四五]|[ⅠⅡⅢⅣⅤ])(期|级)/
  const byBase = new Map()
  for (const e of dx) {
    const m = e.concept.match(stagePat)
    if (!m) continue
    const base = `${m[1]}×${m[3]}`
    if (!byBase.has(base)) byBase.set(base, new Map())
    const stage = `${m[1]}${m[2]}${m[3]}`
    const cur = byBase.get(base).get(stage) ?? { stage, from: dayOf(e.firstWritten), to: dayOf(e.lastWritten), events: [], n: 0 }
    cur.from = [cur.from, dayOf(e.firstWritten)].sort()[0]
    cur.to = [cur.to, dayOf(e.lastWritten)].sort()[1]
    cur.events.push(e.id); cur.n += e.mentionCount
    byBase.get(base).set(stage, cur)
  }
  for (const [pattern, m] of byBase) if (m.size >= 2) stageChanges.push({ pattern, seq: [...m.values()].sort((a, b) => a.from.localeCompare(b.from)) })

  // 验收门④：每条发现都能回溯到原始提及
  const problems = []
  for (const f of findings) {
    for (const s of f.sides) for (const id of s.mentions) if (!byId.has(id)) problems.push({ gate: '④提及不存在', findingId: f.id })
    if (!f.sides.some((s) => s.mentions.length)) problems.push({ gate: '④无原始提及', findingId: f.id })
  }
  findings.sort((a, b) => (a.verdict + a.subclass).localeCompare(b.verdict + b.subclass))
  return { findings, stageChanges, problems }
}

function rename({ adopt, reason, certainty }) { return { adopt, adoptReason: reason, certainty } }
