import { nanoid } from 'nanoid';

function opToCardinality(op) {
  switch (op) {
    case '>': return '1-many';
    case '<': return 'many-1';
    case '-': return '1-1';
    case '<>': return 'many-many';
    default: return '1-many';
  }
}

function parseConstraints(str) {
  const constraints = {
    primaryKey: false,
    notNull: false,
    unique: false,
    autoIncrement: false,
    default: null,
  };
  if (!str) return constraints;

  const lower = str.toLowerCase();
  if (/\bpk\b/.test(lower) || /\bprimary key\b/.test(lower)) constraints.primaryKey = true;
  if (/\bnot null\b/.test(lower)) constraints.notNull = true;
  if (/\bunique\b/.test(lower)) constraints.unique = true;
  if (/\bincrement\b/.test(lower) || /\bauto_increment\b/.test(lower)) constraints.autoIncrement = true;

  const defMatch = str.match(/default:\s*`([^`]*)`/i) || str.match(/default:\s*'([^']*)'/i);
  if (defMatch) constraints.default = defMatch[1];

  return constraints;
}

export function parseDBML(dbml) {
  const lines = dbml.split('\n');
  const tables = [];
  const relationships = [];
  let currentTable = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Table definition
    const tableMatch = trimmed.match(/^Table\s+["']?(\w+)["']?(?:\s+as\s+\w+)?\s*\{/i);
    if (tableMatch) {
      currentTable = {
        name: tableMatch[1],
        columns: [],
        note: '',
        color: '#4F46E5',
        collapsed: false,
      };
      continue;
    }

    // End block
    if (trimmed === '}') {
      if (currentTable) {
        tables.push(currentTable);
        currentTable = null;
      }
      continue;
    }

    // Inside table
    if (currentTable) {
      // Table note
      const noteMatch = trimmed.match(/^Note:\s*'([^']*)'/i);
      if (noteMatch) {
        currentTable.note = noteMatch[1];
        continue;
      }

      // Column: name TYPE [constraints]
      const colMatch = trimmed.match(/^(\w+)\s+(\w+(?:\([^)]*\))?)(?:\s*\[(.*)\])?$/);
      if (colMatch) {
        const [, name, type, constraintStr] = colMatch;
        const column = {
          id: nanoid(),
          name,
          type: type.toUpperCase(),
          constraints: parseConstraints(constraintStr || ''),
          note: '',
        };

        // Inline ref
        if (constraintStr) {
          const refMatch = constraintStr.match(/ref:\s*([<>\-]+)\s*(\w+)\.(\w+)/i);
          if (refMatch) {
            column._inlineRef = {
              op: refMatch[1].trim(),
              table: refMatch[2],
              column: refMatch[3],
            };
          }
          const colNoteMatch = constraintStr.match(/note:\s*'([^']*)'/i);
          if (colNoteMatch) {
            column.note = colNoteMatch[1];
          }
        }

        currentTable.columns.push(column);
        continue;
      }
    }

    // Standalone Ref
    const refMatch = trimmed.match(/^Ref(?:\s+\w+)?:\s*(\w+)\.(\w+)\s*([<>\-]+)\s*(\w+)\.(\w+)/i);
    if (refMatch) {
      const [, fromTable, fromCol, op, toTable, toCol] = refMatch;
      relationships.push({
        id: nanoid(),
        fromTable,
        fromColumn: fromCol,
        toTable,
        toColumn: toCol,
        cardinality: opToCardinality(op.trim()),
        label: '',
      });
    }
  }

  // Resolve inline refs
  for (const table of tables) {
    for (const col of table.columns) {
      if (col._inlineRef) {
        relationships.push({
          id: nanoid(),
          fromTable: table.name,
          fromColumn: col.name,
          toTable: col._inlineRef.table,
          toColumn: col._inlineRef.column,
          cardinality: opToCardinality(col._inlineRef.op),
          label: '',
        });
        delete col._inlineRef;
      }
    }
  }

  return { tables, relationships };
}
