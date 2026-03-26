import { useRef, useCallback, useState } from 'react';
import useStore from '../store/useStore';
import { downloadFile, readFileAsText, exportAsPNG, exportAsSVG } from '../utils/exportUtils';
import { importSQL } from '../utils/sqlImporter';
import { generateDBML } from '../utils/dbmlGenerator';

export default function Toolbar() {
  const darkMode = useStore(s => s.darkMode);
  const toggleDarkMode = useStore(s => s.toggleDarkMode);
  const toggleSnapToGrid = useStore(s => s.toggleSnapToGrid);
  const snapToGrid = useStore(s => s.snapToGrid);
  const highlightEdges = useStore(s => s.highlightEdges);
  const toggleHighlightEdges = useStore(s => s.toggleHighlightEdges);
  const toggleSidebar = useStore(s => s.toggleSidebar);
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const dbmlContent = useStore(s => s.dbmlContent);
  const tables = useStore(s => s.tables);
  const relationships = useStore(s => s.relationships);
  const positions = useStore(s => s.positions);
  const activeProjectId = useStore(s => s.activeProjectId);
  const projects = useStore(s => s.projects);
  const setDbmlFromEditor = useStore(s => s.setDbmlFromEditor);
  const openModal = useStore(s => s.openModal);
  const saveToStorage = useStore(s => s.saveToStorage);
  const undo = useStore(s => s.undo);
  const redo = useStore(s => s.redo);
  const editMode = useStore(s => s.editMode);
  const doLock = useStore(s => s.doLock);
  const generateShareLink = useStore(s => s.generateShareLink);

  const [shareCopied, setShareCopied] = useState(false);

  const fileInputRef = useRef(null);
  const sqlInputRef = useRef(null);

  const activeProject = projects.find(p => p.id === activeProjectId);

  // --- Save DBML ---
  const handleSaveDbml = useCallback(() => {
    const name = activeProject?.name || 'diagram';
    downloadFile(dbmlContent, `${name}.dbml`, 'text/plain');
  }, [dbmlContent, activeProject]);

  // --- Open DBML ---
  const handleOpenDbml = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    setDbmlFromEditor(text);
    e.target.value = '';
  }, [setDbmlFromEditor]);

  // --- Import SQL ---
  const handleImportSQL = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    const parsed = importSQL(text);
    // Convert to DBML and set
    const tempTables = {};
    const nameToId = {};
    parsed.tables.forEach((t, i) => {
      const id = `temp_${i}`;
      nameToId[t.name] = id;
      tempTables[id] = { ...t, id, columns: t.columns };
    });
    const tempRels = parsed.relationships.map((r, i) => ({
      ...r,
      id: `rel_${i}`,
      fromTableId: nameToId[r.fromTable],
      fromColumnId: (() => {
        const tbl = tempTables[nameToId[r.fromTable]];
        return tbl?.columns.find(c => c.name === r.fromColumn)?.id;
      })(),
      toTableId: nameToId[r.toTable],
      toColumnId: (() => {
        const tbl = tempTables[nameToId[r.toTable]];
        return tbl?.columns.find(c => c.name === r.toColumn)?.id;
      })(),
    })).filter(r => r.fromTableId && r.toTableId);
    const dbml = generateDBML(tempTables, tempRels);
    setDbmlFromEditor(dbml);
    e.target.value = '';
  }, [setDbmlFromEditor]);

  // --- Export JSON ---
  const handleExportJSON = useCallback(() => {
    const data = {
      dbml: dbmlContent,
      tables,
      relationships,
      positions,
    };
    const name = activeProject?.name || 'diagram';
    downloadFile(JSON.stringify(data, null, 2), `${name}.json`, 'application/json');
  }, [dbmlContent, tables, relationships, positions, activeProject]);

  // --- Export PNG ---
  const handleExportPNG = useCallback(async () => {
    const el = document.querySelector('.react-flow__viewport');
    if (el) await exportAsPNG(el);
  }, []);

  // --- Export SVG ---
  const handleExportSVG = useCallback(async () => {
    const el = document.querySelector('.react-flow__viewport');
    if (el) await exportAsSVG(el);
  }, []);

  // --- Generate SQL ---
  const handleGenerateSQL = useCallback(() => {
    openModal('sql', null);
  }, [openModal]);

  // --- Share Link ---
  const handleShareLink = useCallback(async () => {
    const url = await generateShareLink();
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  }, [generateShareLink]);

  return (
    <div className="h-11 flex items-center px-3 gap-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
        title="Toggle projects sidebar"
      >
        {sidebarOpen ? '◀' : '☰'}
      </button>

      {/* Title */}
      <h1 className="font-bold text-sm tracking-tight mr-2">
        ER Diagram Tool
      </h1>

      {activeProjectId && (<>
      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

      {/* Undo / Redo */}
      <button onClick={undo} className="toolbar-btn" title="Undo (Ctrl+Z)" disabled={!editMode}>↶</button>
      <button onClick={redo} className="toolbar-btn" title="Redo (Ctrl+Y)" disabled={!editMode}>↷</button>

      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

      {/* File ops */}
      <button onClick={() => fileInputRef.current?.click()} className="toolbar-btn" title="Open .dbml file" disabled={!editMode}>
        📂 Open
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".dbml,.txt"
        onChange={handleOpenDbml}
        className="hidden"
      />

      {/* Import SQL */}
      <button onClick={() => sqlInputRef.current?.click()} className="toolbar-btn" title="Import SQL DDL" disabled={!editMode}>
        📥 Import SQL
      </button>
      <input
        ref={sqlInputRef}
        type="file"
        accept=".sql,.txt"
        onChange={handleImportSQL}
        className="hidden"
      />

      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

      {/* Export menu */}
      <div className="relative group">
        <button className="toolbar-btn">📤 Export ▾</button>
        <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]">
          <button onClick={handleSaveDbml} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
            Save as .dbml
          </button>
          <button onClick={handleExportJSON} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
            Export as .json
          </button>
          <button onClick={handleExportPNG} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
            Export as PNG
          </button>
          <button onClick={handleExportSVG} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
            Export as SVG
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button onClick={handleGenerateSQL} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
            Generate SQL DDL
          </button>
        </div>
      </div>

      {/* Share link */}
      <button
        onClick={handleShareLink}
        className={`toolbar-btn ${shareCopied ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : ''}`}
        title="Create a sharing link (view-only)"
      >
        {shareCopied ? '✓ Copied!' : '🔗 Share'}
      </button>

      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

      {/* Auto arrange dropdown */}
      <div className="relative group">
        <button
          className="toolbar-btn"
          title="Auto arrange tables"
          disabled={!editMode}
        >
          🔀 Arrange ▾
        </button>
        <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[260px]">
          <button
            onClick={() => useStore.getState().autoArrangePositions('left-right')}
            className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            disabled={!editMode}
          >
            <div className="text-sm font-medium">↔ Left-Right</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Left-to-right relationship direction. Suitable for ETL pipeline.</div>
          </button>
          <button
            onClick={() => useStore.getState().autoArrangePositions('snowflake')}
            className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            disabled={!editMode}
          >
            <div className="text-sm font-medium">❄ Snowflake</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Many-to-many relationships in the center, spreading outwards. Suitable for data warehouse.</div>
          </button>
          <button
            onClick={() => useStore.getState().autoArrangePositions('compact')}
            className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            disabled={!editMode}
          >
            <div className="text-sm font-medium">▦ Compact</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Compact grid layout. Suitable for fewer relationships.</div>
          </button>
        </div>
      </div>

      </>)}

      <div className="flex-1" />

      {/* Lock / Unlock — only show when a project is active */}
      {activeProjectId && (
      <button
        onClick={() => editMode ? doLock() : openModal('unlock', null)}
        className={`toolbar-btn font-semibold ${
          editMode
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
        }`}
        title={editMode ? 'Editing' : 'Locked'}
      >
        {editMode ? '🔓 Editing' : '🔒 Locked'}
      </button>
      )}

      {/* Change password (only when editing) */}
      {editMode && activeProjectId && (
        <button
          onClick={() => openModal('changePassword', null)}
          className="toolbar-btn"
          title="Change project password"
        >
          🔑
        </button>
      )}

      {/* Highlight edges */}
      <button
        onClick={toggleHighlightEdges}
        className={`toolbar-btn ${highlightEdges ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' : ''}`}
        title={highlightEdges ? 'Turn off edge highlighting' : 'Turn on edge highlighting'}
      >
        {highlightEdges ? '🔗 Edges' : '🔗'}
      </button>

      {/* Snap to grid */}
      <button
        onClick={toggleSnapToGrid}
        className={`toolbar-btn ${snapToGrid ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : ''}`}
        title={snapToGrid ? 'Turn off snap to grid' : 'Turn on snap to grid'}
      >
        ⊞ Grid
      </button>

      {/* Dark mode */}
      <button
        onClick={toggleDarkMode}
        className={`toolbar-btn ${darkMode ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : ''}`}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {darkMode ? '☀️ Light' : '🌙 Dark'}
      </button>

      {/* Auto-save indicator */}
      {activeProjectId && (
      <button
        onClick={saveToStorage}
        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        title="Save now"
      >
        Auto-saved
      </button>
      )}
    </div>
  );
}
