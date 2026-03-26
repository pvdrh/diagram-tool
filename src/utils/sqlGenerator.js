const TYPE_MAP = {
  postgresql: {
    INT: 'INTEGER', BIGINT: 'BIGINT', VARCHAR: 'VARCHAR(255)', TEXT: 'TEXT',
    BOOLEAN: 'BOOLEAN', DATE: 'DATE', DATETIME: 'TIMESTAMP', TIMESTAMP: 'TIMESTAMP',
    FLOAT: 'REAL', DECIMAL: 'DECIMAL', UUID: 'UUID', JSON: 'JSONB', SERIAL: 'SERIAL',
    ENUM: 'TEXT', INTEGER: 'INTEGER', CHAR: 'CHAR(1)', NUMERIC: 'NUMERIC',
    REAL: 'REAL', BLOB: 'BYTEA', SMALLINT: 'SMALLINT', TINYINT: 'SMALLINT',
    MEDIUMINT: 'INTEGER', DOUBLE: 'DOUBLE PRECISION',
  },
  mysql: {
    INT: 'INT', BIGINT: 'BIGINT', VARCHAR: 'VARCHAR(255)', TEXT: 'TEXT',
    BOOLEAN: 'TINYINT(1)', DATE: 'DATE', DATETIME: 'DATETIME', TIMESTAMP: 'TIMESTAMP',
    FLOAT: 'FLOAT', DECIMAL: 'DECIMAL', UUID: 'CHAR(36)', JSON: 'JSON', SERIAL: 'INT',
    ENUM: 'TEXT', INTEGER: 'INT', CHAR: 'CHAR(1)', NUMERIC: 'NUMERIC',
    REAL: 'DOUBLE', BLOB: 'BLOB', SMALLINT: 'SMALLINT', TINYINT: 'TINYINT',
    MEDIUMINT: 'MEDIUMINT', DOUBLE: 'DOUBLE',
  },
  sqlite: {
    INT: 'INTEGER', BIGINT: 'INTEGER', VARCHAR: 'TEXT', TEXT: 'TEXT',
    BOOLEAN: 'INTEGER', DATE: 'TEXT', DATETIME: 'TEXT', TIMESTAMP: 'TEXT',
    FLOAT: 'REAL', DECIMAL: 'REAL', UUID: 'TEXT', JSON: 'TEXT', SERIAL: 'INTEGER',
    ENUM: 'TEXT', INTEGER: 'INTEGER', CHAR: 'TEXT', NUMERIC: 'NUMERIC',
    REAL: 'REAL', BLOB: 'BLOB', SMALLINT: 'INTEGER', TINYINT: 'INTEGER',
    MEDIUMINT: 'INTEGER', DOUBLE: 'REAL',
  },
};

function mapType(type, dialect) {
  const base = type.replace(/\(.*\)/, '').toUpperCase();
  const mapped = TYPE_MAP[dialect]?.[base];
  if (mapped) return mapped;
  return type;
}

function autoIncrementSyntax(dialect) {
  switch (dialect) {
    case 'postgresql': return '';
    case 'mysql': return ' AUTO_INCREMENT';
    case 'sqlite': return '';
    default: return '';
  }
}

export function generateSQL(tables, relationships, dialect = 'postgresql') {
  const lines = [];
  const tableList = Object.values(tables);

  for (const table of tableList) {
    const colDefs = [];
    const pkCols = [];
    const uniqueCols = [];

    for (const col of table.columns) {
      let colType = mapType(col.type, dialect);

      // Handle auto-increment for PostgreSQL
      if (col.constraints.autoIncrement && dialect === 'postgresql') {
        colType = 'SERIAL';
      }

      let def = `  "${col.name}" ${colType}`;

      if (col.constraints.notNull) def += ' NOT NULL';
      if (col.constraints.unique && !col.constraints.primaryKey) uniqueCols.push(col.name);
      if (col.constraints.autoIncrement && dialect !== 'postgresql') {
        def += autoIncrementSyntax(dialect);
      }
      if (col.constraints.default != null && col.constraints.default !== '') {
        def += ` DEFAULT ${col.constraints.default}`;
      }

      colDefs.push(def);
      if (col.constraints.primaryKey) pkCols.push(col.name);
    }

    // PK constraint
    if (pkCols.length > 0) {
      colDefs.push(`  PRIMARY KEY (${pkCols.map(c => `"${c}"`).join(', ')})`);
    }

    // Unique constraints
    for (const u of uniqueCols) {
      colDefs.push(`  UNIQUE ("${u}")`);
    }

    // FK constraints
    for (const rel of relationships) {
      if (rel.fromTableId !== table.id) continue;
      const fromCol = table.columns.find(c => c.id === rel.fromColumnId);
      const toTable = tables[rel.toTableId];
      const toCol = toTable?.columns.find(c => c.id === rel.toColumnId);
      if (fromCol && toTable && toCol) {
        colDefs.push(`  FOREIGN KEY ("${fromCol.name}") REFERENCES "${toTable.name}" ("${toCol.name}")`);
      }
    }

    lines.push(`CREATE TABLE "${table.name}" (`);
    lines.push(colDefs.join(',\n'));
    lines.push(');\n');
  }

  return lines.join('\n');
}
