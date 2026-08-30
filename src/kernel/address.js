'use strict';

const MASK = (1n << 64n) - 1n;
const OFFSET = 1469598103934665603n;
const PRIME = 1099511628211n;

function hash64(...parts) {
  let hash = OFFSET;
  for (const part of parts) {
    for (const char of String(part)) {
      hash ^= BigInt(char.charCodeAt(0));
      hash = (hash * PRIME) & MASK;
    }
    hash ^= 255n;
    hash = (hash * PRIME) & MASK;
  }
  return hash & MASK;
}

function unit(seed, ...address) {
  const hash = hash64(seed, ...address);
  return Number((hash >> 11n) & ((1n << 53n) - 1n)) / 9007199254740992;
}

function pickWeighted(seed, address, weighted) {
  const entries = Object.entries(weighted).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!entries.length || total <= 0) throw new Error('weighted choice has no support');

  let cursor = unit(seed, address) * total;
  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

module.exports = { hash64, unit, pickWeighted };
