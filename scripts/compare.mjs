#!/usr/bin/env node
/**
 * 与老结果对照（老结果不一定对）。按“记录类型＋栏目＋原文”做多重集合比对，
 * 输出各栏目条数差异与只在一边出现的样例。报告写到仓库外。
 *
 *   node scripts/compare.mjs mentions <老 step1_mentions.jsonl> <新 mentions.jsonl> <报告.md> [--samples 8]
 */
import { readFile, writeFile } from 'node:fs/promises'

const args = process.argv.slice(2)
const si = args.indexOf('--samples')
const SAMPLES = si >= 0 ? Number(args.splice(si, 2)[1]) : 8
const [what, oldPath, newPath, outPath] = args
if (what !== 'mentions' || !outPath) {
  console.error('usage: node scripts/compare.mjs mentions <old.jsonl> <new.jsonl> <report.md>')
  process.exit(1)
}

const OLD_TYPE = {
  检验结果: '检验', 收费项目: '门诊收费', '入院记录（第二版）': '入院记录', '入院记录·出院诊断': '入院记录', '入院记录·补充诊断': '入院记录',
}
const norm = (s) => String(s).replace(/(化名|医生|医院|地址|证件|电话|病历|住院|就诊)-[0-9A-F]{6}/g, '＊').replace(/\s+/g, '')

const readJsonl = async (p) => (await readFile(p, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l))
const oldRows = (await readJsonl(oldPath)).map((m) => ({ type: OLD_TYPE[m.doc_type] ?? m.doc_type, sec: m.sec, text: m.text, src: m.src, a: m.a?.slice(0, 10) || null, b: m.b?.slice(0, 10) || null, kind: m.kind }))
const newRows = (await readJsonl(newPath)).map((m) => ({ type: m.recordType, sec: m.section, text: m.text, src: m.timeSource, a: m.occurFrom, b: m.occurTo, kind: m.kind }))

const group = (rows) => {
  const g = new Map()
  for (const r of rows) {
    const k = `${r.type}／${r.sec}`
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(r)
  }
  return g
}
const go = group(oldRows); const gn = group(newRows)
const keys = [...new Set([...go.keys(), ...gn.keys()])]
const lines = ['# 提及对照（老 vs 新）', '', `老 ${oldRows.length} 条，新 ${newRows.length} 条。原文比对时把假名、空白归一。`, '',
  '| 记录类型／栏目 | 老 | 新 | 差 | 只在老 | 只在新 |', '|---|---:|---:|---:|---:|---:|']
const detail = []
let sameTotal = 0
const timeStats = { same: 0, diff: 0 }
const timeDiff = new Map()
for (const k of keys.sort((a, b) => Math.abs((gn.get(b)?.length ?? 0) - (go.get(b)?.length ?? 0)) - Math.abs((gn.get(a)?.length ?? 0) - (go.get(a)?.length ?? 0)))) {
  const o = go.get(k) ?? []; const n = gn.get(k) ?? []
  const bag = new Map()
  for (const r of o) { const t = norm(r.text); if (!bag.has(t)) bag.set(t, []); bag.get(t).push(r) }
  const onlyNew = []
  for (const r of n) {
    const t = norm(r.text)
    const list = bag.get(t)
    if (list?.length) {
      const old = list.shift(); sameTotal++
      if (r.kind === '文书') {
        const same = old.a === r.a && old.b === r.b
        timeStats[same ? 'same' : 'diff']++
        if (!same) { const k = `${old.src} → ${r.src}`; timeDiff.set(k, [...(timeDiff.get(k) ?? []), { old, r }]) }
      }
    } else onlyNew.push(r)
  }
  const onlyOld = []
  const bag2 = new Map()
  for (const r of n) { const t = norm(r.text); bag2.set(t, (bag2.get(t) ?? 0) + 1) }
  for (const r of o) { const t = norm(r.text); if (bag2.get(t) > 0) bag2.set(t, bag2.get(t) - 1); else onlyOld.push(r) }
  lines.push(`| ${k} | ${o.length} | ${n.length} | ${n.length - o.length} | ${onlyOld.length} | ${onlyNew.length} |`)
  if (onlyOld.length || onlyNew.length) {
    detail.push(`\n## ${k}\n`)
    if (onlyOld.length) detail.push('只在老：', ...onlyOld.slice(0, SAMPLES).map((r) => `- \`${r.text.slice(0, 60)}\``))
    if (onlyNew.length) detail.push('只在新：', ...onlyNew.slice(0, SAMPLES).map((r) => `- \`${r.text.slice(0, 60)}\``))
  }
}
lines.splice(3, 0, `原文完全对上 ${sameTotal} 条；其中文书提及发生时间一致 ${timeStats.same}、不一致 ${timeStats.diff}。`, '')
detail.push('\n# 发生时间不一致（老来源 → 新来源）\n')
for (const [k, v] of [...timeDiff.entries()].sort((a, b) => b[1].length - a[1].length)) {
  detail.push(`\n## ${k}：${v.length}\n`, ...v.slice(0, SAMPLES).map(({ old, r }) => `- \`${r.text.slice(0, 40)}\` 老 ${old.a}～${old.b}｜新 ${r.a}～${r.b}`))
}
await writeFile(outPath, [...lines, ...detail].join('\n') + '\n')
console.log(lines.slice(0, 40).join('\n'))
