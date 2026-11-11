/**
 * Stable identifiers: `<prefix>-<12 base32 chars of sha256>`.
 * Derived from content, so re-running rules does not renumber unchanged
 * objects and human review decisions keep pointing at the same thing.
 */
import { createHash } from 'node:crypto'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'

function base32(buf, length) {
  let out = ''
  let bits = 0
  let value = 0
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5 && out.length < length) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    if (out.length >= length) break
  }
  return out
}

export function stableId(prefix, ...parts) {
  const hash = createHash('sha256').update(parts.map(String).join('\u001f')).digest()
  return `${prefix}-${base32(hash, 12)}`
}

/** Fragment: table + record key + field + paragraph index. */
export const fragmentId = (table, recordKey, field, paragraph = 0) => stableId('G', table, recordKey, field, paragraph)
/** Mention: fragment + offsets. */
export const mentionId = (fragment, s, e) => stableId('M', fragment, s, e)
/** Event: sorted member mentions. */
export const eventId = (mentionIds) => stableId('E', ...[...mentionIds].sort())
/** Finding: subclass + sorted events. */
export const findingId = (subclass, eventIds) => stableId('F', subclass, ...[...eventIds].sort())
