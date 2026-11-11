import test from 'node:test'
import assert from 'node:assert/strict'
import { findTimePhrases, resolveAdverb, parseInstant, cnNumber, addMonths, relativeBack } from '../lib/engine/time.js'
import { stableId, mentionId } from '../lib/engine/ids.js'

const one = (text, ctx) => {
  const r = findTimePhrases(text, ctx)
  assert.equal(r.length, 1, `expected one phrase in ${text}: ${JSON.stringify(r)}`)
  return r[0]
}

test('parseInstant', () => {
  assert.equal(parseInstant('2016-04-18 08:14:00'), '2016-04-18 08:14')
  assert.equal(parseInstant('20160418081400'), '2016-04-18 08:14')
  assert.equal(parseInstant('2016/4/8'), '2016-04-08 00:00')
  assert.equal(parseInstant('1900-01-01 00:00'), '1900-01-01 00:00')
  assert.equal(parseInstant('2016-02-30'), null)
  assert.equal(parseInstant(''), null)
})

test('cn numbers', () => {
  assert.equal(cnNumber('三'), 3)
  assert.equal(cnNumber('十'), 10)
  assert.equal(cnNumber('十二'), 12)
  assert.equal(cnNumber('二十'), 20)
  assert.equal(cnNumber('半'), 0.5)
  assert.equal(addMonths('2021-03-31', -1), '2021-02-28')
})

test('日期 and 日期区间', () => {
  const d = one('于2020.5.8行手术', { anchor: '2021-01-01' })
  assert.deepEqual([d.kind, d.a, d.b, d.prec], ['日期', '2020-05-08', '2020-05-08', '日'])
  const r = one('住院时间2021.3.4-2021.3.9', { anchor: '2021-06-01' })
  assert.deepEqual([r.kind, r.a, r.b], ['日期区间', '2021-03-04', '2021-03-09'])
})

test('年月 whole month', () => {
  const r = one('（2019.10）开始透析', { anchor: '2020-03-02' })
  assert.deepEqual([r.kind, r.a, r.b, r.prec], ['年月', '2019-10-01', '2019-10-31', '月'])
})

test('月日 takes the written year, or the previous one when > 3 days ahead', () => {
  const r = one('1.18复查', { anchor: '2021-01-25', written: '2021-01-25' })
  assert.deepEqual([r.a, r.b], ['2021-01-18', '2021-01-18'])
  const p = one('12.30复查', { anchor: '2021-01-05', written: '2021-01-05' })
  assert.equal(p.a, '2020-12-30')
})

test('相对 with tolerance and 余', () => {
  const r = one('3天前出现气急', { anchor: '2021-06-10' })
  assert.deepEqual([r.a, r.b, r.prec], ['2021-06-07', '2021-06-07', '日'])
  const w = one('2周前住院', { anchor: '2021-06-10' })
  assert.deepEqual([w.a, w.b], ['2021-05-24', '2021-05-30'])
  const y = one('10年余前发现', { anchor: '2020-06-01' })
  assert.deepEqual([y.a, y.b], ['2005-06-01', '2010-06-01'])
})

test('起病 “N余天无诱因下”', () => {
  const r = one('5余天无诱因下出现咳嗽', { anchor: '2021-06-10' })
  assert.deepEqual([r.kind, r.a, r.b], ['起病', '2021-06-03', '2021-06-05'])
})

test('昨今', () => {
  assert.equal(one('昨起发热', { anchor: '2021-06-10' }).a, '2021-06-09')
  assert.equal(one('今日行血液透析治疗', { anchor: '2021-06-10' }).a, '2021-06-10')
})

test('时长 only when enabled; 3000年 typo is dropped', () => {
  assert.equal(findTimePhrases('反复浮肿8年余', { anchor: '2020-06-01' }).length, 0)
  const r = one('反复浮肿8年余', { anchor: '2020-06-01', durationEnabled: true })
  assert.deepEqual([r.a, r.b], ['2008-06-01', '2012-06-01'])
  assert.equal(findTimePhrases('尿毒症3000年', { anchor: '2020-06-01', durationEnabled: true }).length, 0)
  const d = one('血透2年', { anchor: '2020-01-27', durationEnabled: true })
  assert.deepEqual([d.a, d.b], ['2017-01-27', '2018-01-27'])
  const s = one('尿毒症数年', { anchor: '2020-06-01', durationEnabled: true })
  assert.deepEqual([s.a, s.b], ['2011-06-01', '2018-06-01'])
})

test('年龄 needs birth date', () => {
  const r = one('14岁初潮', { anchor: '2020-01-01', birth: '1960-03-01' })
  assert.deepEqual([r.a, r.b], ['1974-03-01', '1975-02-28'])
  assert.equal(findTimePhrases('14岁初潮', { anchor: '2020-01-01' }).length, 0)
})

test('adverbs', () => {
  assert.deepEqual(resolveAdverb('目前仍感乏力', { written: '2021-06-10' }), { kind: '目前', phrase: '目前', a: '2021-06-10', b: '2021-06-10', prec: '日' })
  assert.equal(resolveAdverb('今日行血透', { written: '2021-06-10' }), null)
  assert.deepEqual(resolveAdverb('出院后长期口服某药', { written: '2021-06-10', prev: { a: '2021-03-04', b: '2021-03-09' } }).a, '2021-03-09')
  assert.equal(resolveAdverb('既往口服阿司匹林', { written: '2021-06-10' }).prec, '无具体')
})

test('频次不是病程；同句多个短语取最精确的', async () => {
  const { bestPhrase } = await import('../lib/engine/time.js')
  assert.equal(findTimePhrases('一周三次', { anchor: '2020-06-01', durationEnabled: true }).length, 0)
  assert.equal(findTimePhrases('每周3次', { anchor: '2020-06-01', durationEnabled: true }).length, 0)
  const b = bestPhrase(findTimePhrases('患者2年余前（2017.10）因浮肿', { anchor: '2020-01-27' }))
  assert.deepEqual([b.kind, b.a, b.b], ['年月', '2017-10-01', '2017-10-31'])
})

test('relativeBack rejects absurd durations', () => {
  assert.equal(relativeBack('2020-01-01', 500, '年', false), null)
})

test('stable ids', () => {
  assert.match(stableId('G', 'a', 1), /^G-[a-z2-7]{12}$/)
  assert.equal(mentionId('G-x', 1, 5), mentionId('G-x', 1, 5))
  assert.notEqual(mentionId('G-x', 1, 5), mentionId('G-x', 1, 6))
})
