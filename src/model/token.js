'use strict';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createToken(spec) {
  if (!spec?.id || !spec?.text) throw new Error('Token requires id and text');
  return freeze({
    kind: 'Token',
    id: spec.id,
    text: spec.text,
    role: spec.role ?? 'noun',
    tags: Object.freeze([...(spec.tags ?? [])]),
  });
}

function createTokenPack(spec) {
  if (!spec?.id || !spec?.accepts) throw new Error('TokenPack requires id and accepts grammar');
  if (!Array.isArray(spec.entries) || !spec.entries.length) throw new Error('TokenPack requires entries');
  const entries = spec.entries.map((entry, index) => {
    if (!entry?.token?.id) throw new Error(`TokenPack entry ${index} requires a Token`);
    if (!Array.isArray(entry.when) || !entry.when.length) throw new Error(`TokenPack entry ${entry.token.id} requires threshold clauses`);
    return freeze({
      token: entry.token,
      stages: Object.freeze([...(entry.stages ?? ['instance'])]),
      weight: Number(entry.weight ?? 1),
      when: Object.freeze(entry.when.map((clause) => freeze(clone(clause)))),
    });
  });
  return freeze({
    kind: 'TokenPack',
    id: spec.id,
    family: spec.family ?? 'theme',
    accepts: spec.accepts,
    entries: Object.freeze(entries),
  });
}

function atPath(value, path) {
  if (!path) return value;
  return String(path).split('.').reduce((current, part) => current == null ? undefined : current[part], value);
}

function tier(value) {
  if (typeof value === 'string' && /^T\d+$/.test(value)) return Number(value.slice(1));
  return Number(value);
}

function compare(actual, clause) {
  const expected = clause.value;
  switch (clause.op ?? 'eq') {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'gte': return tier(actual) >= tier(expected);
    case 'gt': return tier(actual) > tier(expected);
    case 'lte': return tier(actual) <= tier(expected);
    case 'lt': return tier(actual) < tier(expected);
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'contains': return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? '').includes(String(expected));
    case 'exists': return expected === false ? actual === undefined : actual !== undefined;
    default: throw new Error(`unsupported Token threshold operator: ${clause.op}`);
  }
}

function clauseSatisfied(subject, clause) {
  return compare(atPath(subject, clause.path), clause);
}

function matchTokenPack(subject, pack) {
  if (!subject?.grammar || !subject?.stage) throw new Error('Token matching requires lifecycle subject with grammar and stage');
  if (subject.grammar !== pack.accepts) return Object.freeze([]);
  const matches = pack.entries
    .filter((entry) => entry.stages.includes(subject.stage))
    .map((entry) => {
      const satisfied = entry.when.filter((clause) => clauseSatisfied(subject, clause));
      return freeze({
        token: entry.token,
        packId: pack.id,
        weight: entry.weight,
        satisfied: satisfied.length,
        required: entry.when.length,
        matched: satisfied.length === entry.when.length,
      });
    })
    .filter((result) => result.matched)
    .sort((left, right) => right.satisfied - left.satisfied || right.weight - left.weight || left.token.id.localeCompare(right.token.id));
  return Object.freeze(matches);
}

function tokenize(subject, packs) {
  const assignments = [];
  for (const pack of packs ?? []) {
    for (const match of matchTokenPack(subject, pack)) assignments.push(match);
  }
  return Object.freeze(assignments.sort((left, right) => {
    if (left.token.role !== right.token.role) return left.token.role.localeCompare(right.token.role);
    return right.satisfied - left.satisfied || right.weight - left.weight || left.token.id.localeCompare(right.token.id);
  }));
}

function preferredToken(assignments, role = 'noun') {
  return assignments.find((assignment) => assignment.token.role === role)?.token ?? null;
}

function renderTokenName(assignments, { fallback = 'Unnamed Artifact' } = {}) {
  const noun = preferredToken(assignments, 'noun');
  const modifiers = assignments
    .filter((assignment) => assignment.token.role === 'modifier')
    .map((assignment) => assignment.token.text);
  if (!noun) return modifiers.length ? `${modifiers.join(' ')} ${fallback}` : fallback;
  return [...modifiers, noun.text].join(' ');
}

module.exports = {
  createToken,
  createTokenPack,
  atPath,
  clauseSatisfied,
  matchTokenPack,
  tokenize,
  preferredToken,
  renderTokenName,
};
