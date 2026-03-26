import { nanoid } from 'nanoid';

export function importSQL(sql) {
  const tables = [];
  const relationships = [];

  // Split by CREATE TABLE
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*;/gi;
  let match;

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns = [];

    const lines = body.split(',').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Skip constraints
      if (/^\s*(PRIMARY\s+KEY|UNIQUE|INDEX|KEY|CONSTRAINT|FOREIGN\s+KEY|CHECK)\b/i.test(line)) {
        // Parse FK
        const fkMatch = line.match(/FOREIGN\s+KEY\s*\(\s*["`]?(\w+)["`]?\s*\)\s*REFERENCES\s+["`]?(\w+)["`]?\s*\(\s*["`]?(\w+)["`]?\s*\)/i);
        if (fkMatch) {
          relationships.push({
            id: nanoid(),
            fromTable: tableName,
            fromColumn: fkMatch[1],
            toTable: fkMatch[2],
            toColumn: fkMatch[3],
            cardinality: '1-many',
            label: '',
          });
        }
        continue;
      }

      // Column: name TYPE [constraints...]
      const colMatch = line.match(/^\s*["`]?(\w+)["`]?\s+(\w+(?:\([^)]*\))?)\s*(.*)?$/i);
      if (!colMatch) continue;

      const [, name, type, rest = ''] = colMatch;
      const upper = rest.toUpperCase();
      const constraints = {
        primaryKey: /PRIMARY\s+KEY/.test(upper),
        notNull: /NOT\s+NULL/.test(upper),
        unique: /\bUNIQUE\b/.test(upper),
        autoIncrement: /AUTO_INCREMENT|AUTOINCREMENT|SERIAL/i.test(upper) || /SERIAL/i.test(type),
        default: null,
      };

      const defMatch = rest.match(/DEFAULT\s+(.+?)(?:\s+|$)/i);
      if (defMatch) constraints.default = defMatch[1].replace(/^['"`]|['"`]$/g, '');

      // Inline REFERENCES
      const refMatch = rest.match(/REFERENCES\s+["`]?(\w+)["`]?\s*\(\s*["`]?(\w+)["`]?\s*\)/i);
      if (refMatch) {
        relationships.push({
          id: nanoid(),
          fromTable: tableName,
          fromColumn: name,
          toTable: refMatch[1],
          toColumn: refMatch[2],
          cardinality: '1-many',
          label: '',
        });
      }

      columns.push({
        id: nanoid(),
        name,
        type: type.replace(/\(.*\)/, '').toUpperCase(),
        constraints,
        note: '',
      });
    }

    tables.push({
      name: tableName,
      columns,
      note: '',
      color: '#4F46E5',
      collapsed: false,
    });
  }

  return { tables, relationships };
}
