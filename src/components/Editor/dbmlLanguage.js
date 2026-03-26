import { StreamLanguage } from '@codemirror/language';

const dbmlDef = {
  token(stream) {
    if (stream.eatSpace()) return null;

    // Line comments
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }

    // Block keywords
    if (stream.match(/^(Table|Ref|Enum)\b/i)) return 'keyword';

    // Constraint keywords
    if (stream.match(/^(pk|primary\s+key|not\s+null|null|unique|increment|auto_increment|default|Note|as)\b/i))
      return 'atom';

    // Ref operators
    if (stream.match(/^<>/) || stream.match(/^[<>\-]/)) return 'operator';

    // Backtick strings
    if (stream.match(/^`[^`]*`/)) return 'string';

    // Single-quote strings
    if (stream.match(/^'[^']*'/)) return 'string';

    // Numbers
    if (stream.match(/^\d+/)) return 'number';

    // Types
    if (
      stream.match(
        /^(INT|BIGINT|VARCHAR|TEXT|BOOLEAN|DATE|DATETIME|TIMESTAMP|FLOAT|DECIMAL|UUID|JSON|ENUM|SERIAL|INTEGER|CHAR|NUMERIC|REAL|BLOB|SMALLINT|TINYINT|MEDIUMINT|DOUBLE)\b/i
      )
    )
      return 'typeName';

    // Brackets
    if (stream.match(/^[\[\]{}()]/)) return 'bracket';

    // Punctuation
    if (stream.match(/^[,:.\-]/)) return 'punctuation';

    // Identifiers
    if (stream.match(/^\w+/)) return 'variableName';

    stream.next();
    return null;
  },
};

export const dbmlLanguage = StreamLanguage.define(dbmlDef);
