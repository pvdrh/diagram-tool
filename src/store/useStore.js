import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { parseDBML } from '../utils/dbmlParser';
import { generateDBML } from '../utils/dbmlGenerator';
import { loadFromStorage, saveProject, deleteProjectStorage, checkEditToken, unlockEdit, lockEdit, changePassword, hashPasswordClient, loadProjectFromFile } from '../utils/storage';
import { DEFAULT_POSITIONS } from '../utils/sampleData';
import { autoArrange } from '../utils/autoLayout';
import { createShare, loadShare } from '../utils/shareLink';

const MAX_HISTORY = 30;

function findColumnId(tables, tableId, colName) {
  const t = tables[tableId];
  if (!t) return null;
  const col = t.columns.find(c => c.name === colName);
  return col ? col.id : null;
}

function resolveRelationships(parsedRels, tables, nameToId) {
  return parsedRels
    .map(rel => ({
      id: rel.id || nanoid(),
      fromTableId: nameToId[rel.fromTable],
      fromColumnId:  findColumnId(tables, nameToId[rel.fromTable], rel.fromColumn),
      toTableId: nameToId[rel.toTable],
      toColumnId: findColumnId(tables, nameToId[rel.toTable], rel.toColumn),
      cardinality: rel.cardinality || '1-many',
      label: rel.label || '',
    }))
    .filter(r => r.fromTableId && r.toTableId && r.fromColumnId && r.toColumnId);
}

// positionsByName: { tableName: {x,y} }, tablesMeta: { tableName: {color,collapsed} }
function buildTablesFromParsed(parsed, existingTables, positionsByName, tablesMeta) {
  const oldByName = {};
  for (const t of Object.values(existingTables || {})) {
    oldByName[t.name] = t;
  }
  const metaByName = tablesMeta || {};

  const tables = {};
  const positions = {};
  const nameToId = {};

  parsed.tables.forEach((pt, index) => {
    const old = oldByName[pt.name];
    const id = old ? old.id : nanoid();
    nameToId[pt.name] = id;

    const meta = metaByName[pt.name];
    tables[id] = {
      id,
      name: pt.name,
      color: old?.color || meta?.color || pt.color || '#4F46E5',
      collapsed: old?.collapsed ?? meta?.collapsed ?? false,
      note: pt.note || '',
      columns: pt.columns.map(col => {
        const oldCol = old?.columns.find(c => c.name === col.name);
        return {
          id: oldCol ? oldCol.id : col.id,
          name: col.name,
          type: col.type,
          constraints: { ...col.constraints },
          note: col.note || '',
        };
      }),
    };

    // Lookup position by table name (stable key) then fall back to defaults
    positions[id] =
      positionsByName?.[pt.name] ||
      DEFAULT_POSITIONS[pt.name] ||
      { x: (index % 3) * 350 + 50, y: Math.floor(index / 3) * 400 + 50 };
  });

  const relationships = resolveRelationships(parsed.relationships, tables, nameToId);

  return { tables, positions, relationships, nameToId };
}

// Convert id-keyed positions to name-keyed positions for persistence
function positionsToByName(tables, positions) {
  const byName = {};
  for (const [id, pos] of Object.entries(positions)) {
    const table = tables[id];
    if (table) byName[table.name] = pos;
  }
  return byName;
}

// Build tablesMeta map (name -> {color, collapsed}) for persistence
function buildTablesMeta(tables) {
  const meta = {};
  for (const t of Object.values(tables)) {
    meta[t.name] = { color: t.color, collapsed: t.collapsed };
  }
  return meta;
}

const useStore = create((set, get) => ({
  // --- Projects ---
  projects: [],
  activeProjectId: null,

  // --- Diagram ---
  tables: {},
  relationships: [],
  positions: {},
  dbmlContent: '',

  // --- UI ---
  darkMode: false,
  snapToGrid: false,
  highlightEdges: true,
  sidebarOpen: false,
  editMode: false, // false = view-only, true = can edit
  selectedTableIds: [],
  selectedRelationshipId: null,
  contextMenu: null, // { x, y, type, targetId }
  modal: null, // { type, data }

  // --- Sync ---
  _isSyncing: false,

  // --- Undo/Redo ---
  _history: [],
  _future: [],

  _getSnapshot() {
    const { tables, relationships, positions, dbmlContent } = get();
    return {
      tables: structuredClone(tables),
      relationships: structuredClone(relationships),
      positions: structuredClone(positions),
      dbmlContent,
    };
  },

  _pushUndo() {
    const snap = get()._getSnapshot();
    set(s => ({
      _history: [...s._history.slice(-(MAX_HISTORY - 1)), snap],
      _future: [],
    }));
  },

  undo() {
    const { _history, _future } = get();
    if (_history.length === 0) return;
    const current = get()._getSnapshot();
    const prev = _history[_history.length - 1];
    set({
      ...prev,
      _history: _history.slice(0, -1),
      _future: [..._future, current],
    });
  },

  redo() {
    const { _history, _future } = get();
    if (_future.length === 0) return;
    const current = get()._getSnapshot();
    const next = _future[_future.length - 1];
    set({
      ...next,
      _history: [..._history, current],
      _future: _future.slice(0, -1),
    });
  },

  // --- Initialize ---
  async initialize() {
    const saved = await loadFromStorage();
    if (saved && saved.projects && saved.projects.length > 0) {
      const activeId = saved.activeProjectId || saved.projects[0].id;
      const project = saved.projects.find(p => p.id === activeId) || saved.projects[0];
      const parsed = parseDBML(project.dbmlContent || '');
      const { tables, positions, relationships } = buildTablesFromParsed(
        parsed,
        {},
        project.positionsByName || project.positions || {},
        project.tablesMeta || {}
      );
      set({
        projects: saved.projects,
        activeProjectId: project.id,
        tables,
        relationships,
        positions,
        dbmlContent: project.dbmlContent || '',
        darkMode: project.darkMode || false,
      });
    } else {
      // No saved data — start with empty project list
      set({
        projects: [],
        activeProjectId: null,
        tables: {},
        relationships: [],
        positions: {},
        dbmlContent: '',
      });
    }
  },

  // --- Save to storage ---
  async saveToStorage() {
    const { projects, activeProjectId, tables, relationships, positions, dbmlContent, darkMode, editMode } = get();
    if (!activeProjectId) return;

    const localProject = projects.find(p => p.id === activeProjectId);
    if (!localProject) return;

    // If in edit mode, check if the project's password was changed externally
    if (editMode && localProject.passwordHash) {
      const fresh = await loadProjectFromFile(activeProjectId);
      if (fresh && fresh.passwordHash && fresh.passwordHash !== localProject.passwordHash) {
        await lockEdit();
        set({ editMode: false });
        return;
      }
    }

    const posByName = positionsToByName(tables, positions);
    const meta = buildTablesMeta(tables);
    const updatedProject = { ...localProject, dbmlContent, darkMode, positionsByName: posByName, tablesMeta: meta };
    const updatedProjects = projects.map(p =>
      p.id === activeProjectId ? updatedProject : p
    );
    await saveProject(activeProjectId, updatedProject);
    set({ projects: updatedProjects });
  },

  // --- Projects ---
  async createProject(name) {
    // Open set-password modal instead of creating directly
    get().openModal('setPassword', null);
  },

  async createProjectWithPassword(name, password) {
    const id = nanoid();
    const passwordHash = await hashPasswordClient(password);
    const newProject = { id, name: name || 'Untitled', dbmlContent: '', positionsByName: {}, tablesMeta: {}, passwordHash };

    // Save to file first so the server knows about this project (bootstrap: no token needed for new file)
    await saveProject(id, newProject);

    const { projects, darkMode } = get();
    set({
      projects: [...projects, newProject],
      activeProjectId: id,
      tables: {},
      relationships: [],
      positions: {},
      dbmlContent: '',
      _history: [],
      _future: [],
    });

    // Now unlock with the password
    await unlockEdit(password, id);
    set({ editMode: true });
  },

  async switchProject(id) {
    await get().saveToStorage();
    // Lock current session before switching
    if (get().editMode) {
      await lockEdit();
    }
    const project = get().projects.find(p => p.id === id);
    if (!project) return;
    const parsed = parseDBML(project.dbmlContent || '');
    const { tables, positions, relationships } = buildTablesFromParsed(
      parsed, {}, project.positionsByName || project.positions || {}, project.tablesMeta || {}
    );
    set({
      activeProjectId: id,
      tables,
      relationships,
      positions,
      dbmlContent: project.dbmlContent || '',
      darkMode: project.darkMode || false,
      editMode: false,
      _history: [],
      _future: [],
    });
  },

  renameProject(id, name) {
    set(s => ({
      projects: s.projects.map(p => (p.id === id ? { ...p, name } : p)),
    }));
  },

  async deleteProject(id) {
    const { projects, activeProjectId } = get();
    await deleteProjectStorage(id);
    const remaining = projects.filter(p => p.id !== id);
    if (remaining.length === 0) {
      set({
        projects: [],
        activeProjectId: null,
        tables: {},
        relationships: [],
        positions: {},
        dbmlContent: '',
        editMode: false,
        _history: [],
        _future: [],
      });
    } else if (id === activeProjectId) {
      const next = remaining[0];
      const parsed = parseDBML(next.dbmlContent || '');
      const { tables, positions, relationships } = buildTablesFromParsed(
        parsed, {}, next.positionsByName || next.positions || {}, next.tablesMeta || {}
      );
      set({
        projects: remaining,
        activeProjectId: next.id,
        tables,
        relationships,
        positions,
        dbmlContent: next.dbmlContent || '',
        editMode: false,
        _history: [],
        _future: [],
      });
    } else {
      set({ projects: remaining });
    }
  },

  // --- DBML sync from editor ---
  setDbmlFromEditor(dbml) {
    if (get()._isSyncing) return;
    set({ _isSyncing: true });
    get()._pushUndo();

    const parsed = parseDBML(dbml);
    const { tables, positions, relationships } = buildTablesFromParsed(
      parsed,
      get().tables,
      get().positions
    );

    set({
      tables,
      relationships,
      positions,
      dbmlContent: dbml,
      _isSyncing: false,
    });
  },

  // --- Sync DBML from diagram ---
  _syncDbmlFromDiagram() {
    if (get()._isSyncing) return;
    set({ _isSyncing: true });
    const dbml = generateDBML(get().tables, get().relationships);
    set({ dbmlContent: dbml, _isSyncing: false });
  },

  // --- Tables ---
  addTable(position) {
    get()._pushUndo();
    const id = nanoid();
    const name = `new_table_${Object.keys(get().tables).length + 1}`;
    const table = {
      id,
      name,
      color: '#4F46E5',
      collapsed: false,
      note: '',
      columns: [
        {
          id: nanoid(),
          name: 'id',
          type: 'INT',
          constraints: { primaryKey: true, notNull: false, unique: false, autoIncrement: true, default: null },
          note: '',
        },
      ],
    };
    set(s => ({
      tables: { ...s.tables, [id]: table },
      positions: { ...s.positions, [id]: position || { x: 100, y: 100 } },
    }));
    get()._syncDbmlFromDiagram();
    return id;
  },

  updateTable(id, updates) {
    get()._pushUndo();
    set(s => ({
      tables: {
        ...s.tables,
        [id]: { ...s.tables[id], ...updates },
      },
    }));
    get()._syncDbmlFromDiagram();
  },

  deleteTable(id) {
    get()._pushUndo();
    set(s => {
      const { [id]: _, ...rest } = s.tables;
      const { [id]: __, ...restPos } = s.positions;
      return {
        tables: rest,
        positions: restPos,
        relationships: s.relationships.filter(r => r.fromTableId !== id && r.toTableId !== id),
        selectedTableIds: s.selectedTableIds.filter(sid => sid !== id),
      };
    });
    get()._syncDbmlFromDiagram();
  },

  duplicateTable(id) {
    const table = get().tables[id];
    const pos = get().positions[id];
    if (!table) return;
    get()._pushUndo();

    const newId = nanoid();
    const newTable = {
      ...structuredClone(table),
      id: newId,
      name: table.name + '_copy',
      columns: table.columns.map(c => ({ ...c, id: nanoid() })),
    };
    set(s => ({
      tables: { ...s.tables, [newId]: newTable },
      positions: { ...s.positions, [newId]: { x: (pos?.x || 0) + 40, y: (pos?.y || 0) + 40 } },
    }));
    get()._syncDbmlFromDiagram();
    return newId;
  },

  // --- Columns ---
  addColumn(tableId) {
    get()._pushUndo();
    const table = get().tables[tableId];
    if (!table) return;
    const col = {
      id: nanoid(),
      name: `column_${table.columns.length + 1}`,
      type: 'INT',
      constraints: { primaryKey: false, notNull: false, unique: false, autoIncrement: false, default: null },
      note: '',
    };
    set(s => ({
      tables: {
        ...s.tables,
        [tableId]: {
          ...s.tables[tableId],
          columns: [...s.tables[tableId].columns, col],
        },
      },
    }));
    get()._syncDbmlFromDiagram();
  },

  updateColumn(tableId, columnId, updates) {
    get()._pushUndo();
    set(s => ({
      tables: {
        ...s.tables,
        [tableId]: {
          ...s.tables[tableId],
          columns: s.tables[tableId].columns.map(c =>
            c.id === columnId ? { ...c, ...updates } : c
          ),
        },
      },
    }));
    get()._syncDbmlFromDiagram();
  },

  deleteColumn(tableId, columnId) {
    get()._pushUndo();
    set(s => ({
      tables: {
        ...s.tables,
        [tableId]: {
          ...s.tables[tableId],
          columns: s.tables[tableId].columns.filter(c => c.id !== columnId),
        },
      },
      relationships: s.relationships.filter(
        r => !(r.fromColumnId === columnId || r.toColumnId === columnId)
      ),
    }));
    get()._syncDbmlFromDiagram();
  },

  reorderColumns(tableId, fromIndex, toIndex) {
    get()._pushUndo();
    set(s => {
      const cols = [...s.tables[tableId].columns];
      const [moved] = cols.splice(fromIndex, 1);
      cols.splice(toIndex, 0, moved);
      return {
        tables: {
          ...s.tables,
          [tableId]: { ...s.tables[tableId], columns: cols },
        },
      };
    });
    get()._syncDbmlFromDiagram();
  },

  // --- Relationships ---
  addRelationship(rel) {
    const existing = get().relationships.find(
      r =>
        r.fromTableId === rel.fromTableId &&
        r.fromColumnId === rel.fromColumnId &&
        r.toTableId === rel.toTableId &&
        r.toColumnId === rel.toColumnId
    );
    if (existing) return;
    if (rel.fromTableId === rel.toTableId) return;

    get()._pushUndo();
    const newRel = {
      id: nanoid(),
      fromTableId: rel.fromTableId,
      fromColumnId: rel.fromColumnId,
      toTableId: rel.toTableId,
      toColumnId: rel.toColumnId,
      cardinality: rel.cardinality || '1-many',
      label: rel.label || '',
    };
    set(s => ({ relationships: [...s.relationships, newRel] }));
    get()._syncDbmlFromDiagram();
  },

  updateRelationship(id, updates) {
    get()._pushUndo();
    set(s => ({
      relationships: s.relationships.map(r => (r.id === id ? { ...r, ...updates } : r)),
    }));
    get()._syncDbmlFromDiagram();
  },

  deleteRelationship(id) {
    get()._pushUndo();
    set(s => ({
      relationships: s.relationships.filter(r => r.id !== id),
      selectedRelationshipId: s.selectedRelationshipId === id ? null : s.selectedRelationshipId,
    }));
    get()._syncDbmlFromDiagram();
  },

  // --- Positions ---
  updatePositions(newPositions) {
    set(s => ({
      positions: { ...s.positions, ...newPositions },
    }));
  },

  autoArrangePositions(mode = 'left-right') {
    get()._pushUndo();
    const { tables, relationships } = get();
    const newPositions = autoArrange(tables, relationships, mode);
    set({ positions: newPositions });
  },

  // --- Selection ---
  setSelectedTableIds(ids) {
    set({ selectedTableIds: ids, selectedRelationshipId: null });
  },

  toggleTableSelection(id) {
    set(s => {
      const has = s.selectedTableIds.includes(id);
      return {
        selectedTableIds: has
          ? s.selectedTableIds.filter(sid => sid !== id)
          : [...s.selectedTableIds, id],
        selectedRelationshipId: null,
      };
    });
  },

  setSelectedRelationship(id) {
    set({ selectedRelationshipId: id, selectedTableIds: [] });
  },

  clearSelection() {
    set({ selectedTableIds: [], selectedRelationshipId: null, contextMenu: null });
  },

  selectAll() {
    set(s => ({ selectedTableIds: Object.keys(s.tables) }));
  },

  // --- Context Menu ---
  showContextMenu(x, y, type, targetId) {
    set({ contextMenu: { x, y, type, targetId } });
  },

  hideContextMenu() {
    set({ contextMenu: null });
  },

  // --- Modal ---
  openModal(type, data) {
    set({ modal: { type, data } });
  },

  closeModal() {
    set({ modal: null });
  },

  // --- UI ---
  toggleDarkMode() {
    set(s => ({ darkMode: !s.darkMode }));
  },

  toggleSnapToGrid() {
    set(s => ({ snapToGrid: !s.snapToGrid }));
  },

  toggleHighlightEdges() {
    set(s => ({ highlightEdges: !s.highlightEdges }));
  },

  toggleSidebar() {
    set(s => ({ sidebarOpen: !s.sidebarOpen }));
  },

  // --- Edit mode ---
  setEditMode(val) {
    set({ editMode: val });
  },

  async tryUnlock(password) {
    const projectId = get().activeProjectId;
    const ok = await unlockEdit(password, projectId);
    if (ok) set({ editMode: true });
    return ok;
  },

  async doLock() {
    await lockEdit();
    set({ editMode: false });
  },

  async checkAuth() {
    const valid = await checkEditToken();
    set({ editMode: valid });
    return valid;
  },

  async changeProjectPassword(oldPassword, newPassword) {
    const projectId = get().activeProjectId;
    const ok = await changePassword(oldPassword, newPassword, projectId);
    if (ok) {
      // Re-read the project from file to get the server-computed hash
      const fresh = await loadProjectFromFile(projectId);
      if (fresh && fresh.passwordHash) {
        set(s => ({
          projects: s.projects.map(p =>
            p.id === projectId ? { ...p, passwordHash: fresh.passwordHash } : p
          ),
        }));
      }
    }
    return ok;
  },

  // --- Share Link ---
  async generateShareLink() {
    const { dbmlContent, tables, positions, relationships } = get();
    const posByName = positionsToByName(tables, positions);
    const meta = buildTablesMeta(tables);
    const shareData = {
      dbmlContent,
      positionsByName: posByName,
      tablesMeta: meta,
    };
    const shareId = await createShare(shareData);
    if (!shareId) return null;
    const url = `${window.location.origin}${window.location.pathname}#share=${shareId}`;
    return url;
  },

  async loadSharedData() {
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return false;
    const shareId = hash.slice(7);
    if (!shareId) return false;
    const data = await loadShare(shareId);
    if (!data || !data.dbmlContent) return false;

    const parsed = parseDBML(data.dbmlContent);
    const { tables, positions, relationships } = buildTablesFromParsed(
      parsed, {}, data.positionsByName || {}, data.tablesMeta || {}
    );

    // Create a temporary read-only project
    const id = nanoid();
    const project = {
      id,
      name: 'Shared Diagram',
      dbmlContent: data.dbmlContent,
      positionsByName: data.positionsByName || {},
      tablesMeta: data.tablesMeta || {},
    };

    set({
      projects: [project],
      activeProjectId: id,
      tables,
      relationships,
      positions,
      dbmlContent: data.dbmlContent,
      editMode: false,
    });

    // Clean the URL hash
    history.replaceState(null, '', window.location.pathname);
    return true;
  },
}));

export default useStore;
