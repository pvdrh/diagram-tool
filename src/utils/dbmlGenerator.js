function cardinalityToOp(c) {
  switch (c) {
    case '1-many': return '>';
    case 'many-1': return '<';
    case '1-1': return '-';
    case 'many-many': return '<>';
    default: return '>';
  }
}

export function generateDBML(tables, relationships) {
  let dbml = '';

  const tableList = Object.values(tables);
  for (const table of tableList) {
    dbml += `Table ${table.name} {\n`;
    for (const col of table.columns) {
      let line = `  ${col.name} ${col.type}`;
      const parts = [];
      if (col.constraints.primaryKey) parts.push('pk');
      if (col.constraints.autoIncrement) parts.push('increment');
      if (col.constraints.notNull) parts.push('not null');
      if (col.constraints.unique) parts.push('unique');
      if (col.constraints.default != null && col.constraints.default !== '') {
        parts.push(`default: \`${col.constraints.default}\``);
      }
      if (col.note) parts.push(`note: '${col.note}'`);
      if (parts.length > 0) line += ` [${parts.join(', ')}]`;
      dbml += line + '\n';
    }
    if (table.note) {
      dbml += `  Note: '${table.note}'\n`;
    }
    dbml += '}\n\n';
  }

  // Standalone refs — deduplicate against inline refs
  const inlineRefs = new Set();
  for (const table of tableList) {
    for (const col of table.columns) {
      const rels = relationships.filter(
        r => r.fromTableId === table.id && r.fromColumnId === col.id
      );
      for (const r of rels) {
        inlineRefs.add(r.id);
      }
    }
  }

  for (const rel of relationships) {
    const fromTable = tables[rel.fromTableId];
    const toTable = tables[rel.toTableId];
    if (!fromTable || !toTable) continue;
    const fromCol = fromTable.columns.find(c => c.id === rel.fromColumnId);
    const toCol = toTable.columns.find(c => c.id === rel.toColumnId);
    if (!fromCol || !toCol) continue;
    const op = cardinalityToOp(rel.cardinality);
    dbml += `Ref: ${fromTable.name}.${fromCol.name} ${op} ${toTable.name}.${toCol.name}\n`;
  }

  return dbml.trimEnd() + '\n';
}
