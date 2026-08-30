'use strict';

function freeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function createDefinition(spec) {
  if (!spec?.id || !spec?.grammar) throw new Error('definition requires id and grammar');
  return freeze({
    stage: 'definition',
    id: spec.id,
    grammar: spec.grammar,
    dimensions: spec.dimensions ?? {},
    sections: spec.sections ?? [],
    slots: spec.slots ?? {},
  });
}

function createTemplate(definition, spec) {
  if (definition?.stage !== 'definition') throw new Error('template requires a definition');
  if (!spec?.id) throw new Error('template requires id');
  return freeze({
    stage: 'template',
    id: spec.id,
    definitionId: definition.id,
    grammar: definition.grammar,
    fixed: spec.fixed ?? {},
    priors: spec.priors ?? {},
    rules: spec.rules ?? {},
    slots: spec.slots ?? definition.slots,
  });
}

function createReference(template, spec = {}) {
  if (template?.stage !== 'template') throw new Error('reference requires a template');
  return freeze({
    stage: 'reference',
    id: spec.id ?? `${template.id}@reference`,
    templateId: template.id,
    definitionId: template.definitionId,
    grammar: template.grammar,
    boundary: spec.boundary ?? {},
    context: spec.context ?? {},
  });
}

function createVirtual(reference, possibility) {
  if (reference?.stage !== 'reference') throw new Error('virtual requires a reference');
  return freeze({
    stage: 'virtual',
    id: possibility.id ?? `${reference.id}@virtual`,
    referenceId: reference.id,
    templateId: reference.templateId,
    definitionId: reference.definitionId,
    grammar: reference.grammar,
    fixed: possibility.fixed ?? {},
    possibilities: possibility.possibilities ?? {},
    ranges: possibility.ranges ?? {},
    slots: possibility.slots ?? {},
    lineage: possibility.lineage ?? [],
  });
}

function createInstance(virtual, settled) {
  if (virtual?.stage !== 'virtual') throw new Error('instance requires a virtual');
  if (!settled?.id) throw new Error('instance requires id');

  // Settled payload may contribute runtime facts, but lifecycle identity remains
  // owned by this constructor and cannot be overridden by callers.
  return freeze({
    ...settled,
    stage: 'instance',
    id: settled.id,
    virtualId: virtual.id,
    referenceId: virtual.referenceId,
    templateId: virtual.templateId,
    definitionId: virtual.definitionId,
    grammar: virtual.grammar,
  });
}

module.exports = {
  createDefinition,
  createTemplate,
  createReference,
  createVirtual,
  createInstance,
};
