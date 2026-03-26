import { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import useStore from '../../store/useStore';

export default function SearchBar() {
  const tables = useStore(s => s.tables);
  const setSelectedTableIds = useStore(s => s.setSelectedTableIds);
  const reactFlow = useReactFlow();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // Results: tables matching by name or column name
  const results = query.trim()
    ? Object.values(tables).filter(t => {
        const q = query.toLowerCase();
        if (t.name.toLowerCase().includes(q)) return true;
        return t.columns.some(c => c.name.toLowerCase().includes(q));
      })
    : [];

  const handleOpen = useCallback(() => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const handleSelect = useCallback((tableId) => {
    setSelectedTableIds([tableId]);
    const pos = useStore.getState().positions[tableId];
    if (pos) {
      reactFlow.setCenter(pos.x + 130, pos.y + 80, { zoom: 1.2, duration: 400 });
    }
    handleClose();
  }, [setSelectedTableIds, reactFlow, handleClose]);

  // Ctrl+F to open
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const tag = e.target.tagName;
        const isEditor = e.target.closest('.cm-editor');
        if (isEditor || tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        handleOpen();
      }
      if (e.key === 'Escape' && open) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handleOpen, handleClose]);

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        title="Search tables (Ctrl+F)"
      >
        🔍 Search
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
        <span className="pl-2 text-gray-400">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="w-48 px-2 py-1.5 text-sm bg-transparent outline-none text-gray-900 dark:text-gray-100"
          placeholder="Search something..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') handleClose();
            if (e.key === 'Enter' && results.length > 0) handleSelect(results[0].id);
          }}
        />
        <button
          onClick={handleClose}
          className="px-2 py-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Results dropdown */}
      {query.trim() && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Không tìm thấy</div>
          ) : (
            results.map(t => {
              const q = query.toLowerCase();
              const matchedCols = t.columns.filter(c => c.name.toLowerCase().includes(q));
              return (
                <button
                  key={t.id}
                  className="block w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  onClick={() => handleSelect(t.id)}
                >
                  <div className="text-sm font-medium" style={{ color: t.color || '#4F46E5' }}>
                    {t.name}
                  </div>
                  {matchedCols.length > 0 && !t.name.toLowerCase().includes(q) && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      Columns: {matchedCols.map(c => c.name).join(', ')}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
