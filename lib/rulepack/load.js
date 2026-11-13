/**
 * Load and merge rule-pack layers: source → general → specialty.
 * Packs must be plain data (no functions); checked here.
 */
const DEFAULT_LAYERS = {
  source: '../../rules/source/zj-regional/index.mjs',
  general: '../../rules/general/index.mjs',
  specialty: ['../../rules/specialty/hemodialysis/index.mjs'],
}

function assertPlainData(value, path) {
  if (typeof value === 'function') throw new Error(`规则包不能包含函数：${path}`)
  if (value instanceof RegExp || value === null || typeof value !== 'object') return
  for (const [k, v] of Object.entries(value)) assertPlainData(v, `${path}.${k}`)
}

async function importPack(spec) {
  const url = spec.startsWith('.') ? new URL(spec, import.meta.url) : spec
  try {
    const mod = await import(url)
    const pack = mod.default
    assertPlainData(pack, pack?.id ?? spec)
    return pack
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') return null
    throw e
  }
}

/**
 * Merge: vocab entries are concatenated into alternations when both layers
 * define the same name with `extend: true`; arrays (concepts, exclusive …)
 * are appended; classify rules may be inserted `before`/`after` an id;
 * params override; `disable` lists rule ids to switch off.
 */
export function mergePacks(source, layers) {
  const merged = { source, layers: [], vocab: {}, params: {}, sections: [], classify: [], concepts: [], exclusive: [], hypernyms: [], candidateSynonyms: [], disabled: [] }
  for (const pack of layers) {
    if (!pack) continue
    merged.layers.push({ id: pack.id, layer: pack.layer, version: pack.version, basedOn: pack.basedOn })
    for (const [k, v] of Object.entries(pack.vocab ?? {})) {
      const prev = merged.vocab[k]
      if (prev && v?.extend) merged.vocab[k] = new RegExp(`${prev.source}|${v.re.source}`, prev.flags)
      else merged.vocab[k] = v?.re ?? v
    }
    Object.assign(merged.params, pack.params ?? {})
    if (pack.imaging) merged.imaging = pack.imaging
    merged.sections.push(...(pack.sections ?? []))
    for (const rule of pack.classify ?? []) {
      if (rule.before || rule.after) {
        const i = merged.classify.findIndex((r) => r.id === (rule.before ?? rule.after))
        if (i < 0) throw new Error(`规则 ${rule.id} 要插入的位置 ${rule.before ?? rule.after} 不存在`)
        merged.classify.splice(rule.before ? i : i + 1, 0, rule)
      } else merged.classify.push(rule)
    }
    for (const k of ['concepts', 'exclusive', 'hypernyms', 'candidateSynonyms']) merged[k].push(...(pack[k] ?? []))
    merged.disabled.push(...(pack.disable ?? []))
  }
  merged.classify = merged.classify.filter((r) => !merged.disabled.includes(r.id))
  return merged
}

export async function loadRulepack(layers = DEFAULT_LAYERS, { sourcePack = null } = {}) {
  // sourcePack：格式识别层组装出的数据源层（对象），代替默认的数据源规则包
  const source = sourcePack ?? await importPack(layers.source)
  if (!source) throw new Error('缺少数据源层规则包')
  const general = await importPack(layers.general)
  const specialty = []
  for (const s of [].concat(layers.specialty ?? [])) specialty.push(await importPack(s))
  const merged = mergePacks(source, [general, ...specialty])
  merged.layers.unshift({ id: source.id, layer: source.layer, version: source.version, basedOn: source.basedOn })
  return merged
}
