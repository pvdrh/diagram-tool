import { useState, useCallback } from 'react';
import useStore from '../../store/useStore';
import { generateSQL } from '../../utils/sqlGenerator';

const DIALECTS = [
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'mysql', label: 'MySQL' },
  { id: 'sqlite', label: 'SQLite' },
];

export default function SQLGeneratorModal() {
  const tables = useStore(s => s.tables);
  const relationships = useStore(s => s.relationships);
  const closeModal = useStore(s => s.closeModal);

  const [dialect, setDialect] = useState('postgresql');
  const [copied, setCopied] = useState(false);

  const sql = generateSQL(tables, relationships, dialect);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = sql;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [sql]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeModal}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-lg">Generate SQL DDL</h2>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Dialect selector */}
        <div className="flex gap-2 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          {DIALECTS.map(d => (
            <button
              key={d.id}
              className={`px-3 py-1 text-sm rounded-lg border ${
                dialect === d.id
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              onClick={() => setDialect(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* SQL output */}
        <div className="flex-1 overflow-auto p-5">
          <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200 overflow-auto max-h-[50vh]">
            {sql || '-- No tables to generate'}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCopy}
            className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
          </button>
          <button
            onClick={closeModal}
            className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
