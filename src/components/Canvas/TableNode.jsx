import { memo, useCallback, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import useStore from '../../store/useStore';

const CONSTRAINT_ICONS = {
  primaryKey: '🔑',
  unique: '◆',
  notNull: '!',
  autoIncrement: '⟳',
};

function TableNode({ id, data, selected }) {
  const { table } = data;
  const updateTable = useStore(s => s.updateTable);
  const addColumn = useStore(s => s.addColumn);
  const showContextMenu = useStore(s => s.showContextMenu);
  const setSelectedTableIds = useStore(s => s.setSelectedTableIds);
  const editMode = useStore(s => s.editMode);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(table.name);

  const handleNameDoubleClick = useCallback((e) => {
    if (!editMode) return;
    e.stopPropagation();
    setEditName(table.name);
    setIsEditingName(true);
  }, [table.name, editMode]);

  const handleNameSubmit = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== table.name) {
      updateTable(id, { name: trimmed.replace(/\s+/g, '_') });
    }
    setIsEditingName(false);
  }, [editName, id, table.name, updateTable]);

  const handleContextMenu = useCallback((e) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedTableIds([id]);
    showContextMenu(e.clientX, e.clientY, 'table', id);
  }, [id, setSelectedTableIds, showContextMenu, editMode]);

  const handleAddColumn = useCallback((e) => {
    e.stopPropagation();
    addColumn(id);
  }, [addColumn, id]);

  return (
    <div
      className={`table-node ${selected ? 'selected' : ''}`}
      onContextMenu={handleContextMenu}
    >
      {/* Header */}
      <div
        className="table-header"
        style={{ backgroundColor: table.color || '#4F46E5' }}
      >
        {isEditingName ? (
          <input
            autoFocus
            className="bg-transparent text-white outline-none border-b border-white/50 w-full text-sm font-semibold"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={e => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') setIsEditingName(false);
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className="truncate cursor-text"
            onDoubleClick={handleNameDoubleClick}
            title={table.name}
          >
            {table.name}
          </span>
        )}
        <button
          className="ml-2 text-white/70 hover:text-white text-xs flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            updateTable(id, { collapsed: !table.collapsed });
          }}
          title={table.collapsed ? 'Expand' : 'Collapse'}
        >
          {table.collapsed ? '▶' : '▼'}
        </button>
      </div>

      {/* Columns */}
      {!table.collapsed && (
        <div className="table-columns">
          {table.columns.map((col, idx) => (
            <div key={col.id} className="col-row group">
              <Handle
                type="target"
                position={Position.Left}
                id={`${col.id}-target`}
                style={{
                  top: 'auto',
                  position: 'absolute',
                  left: -4,
                }}
              />
              <span className="col-icon">
                {col.constraints.primaryKey
                  ? CONSTRAINT_ICONS.primaryKey
                  : relationships_has_fk(col.id)
                  ? '🔗'
                  : ''}
              </span>
              <span className="col-name">{col.name}</span>
              <span className="col-type">{col.type}</span>
              <span className="text-[11px] text-gray-400 flex gap-0.5">
                {col.constraints.notNull && (
                  <span title="NOT NULL" className="text-amber-500">!</span>
                )}
                {col.constraints.unique && (
                  <span title="UNIQUE" className="text-purple-500">◆</span>
                )}
                {col.constraints.autoIncrement && (
                  <span title="AUTO INCREMENT" className="text-green-500">⟳</span>
                )}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`${col.id}-source`}
                style={{
                  top: 'auto',
                  position: 'absolute',
                  right: -4,
                }}
              />
            </div>
          ))}
          {/* Add column button */}
          {editMode && (
            <button
              className="w-full px-3 py-1 text-xs text-gray-400 hover:text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
              onClick={handleAddColumn}
            >
              + Add column
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Helper: check if a column is an FK (has incoming/outgoing relationship)
function relationships_has_fk(colId) {
  const rels = useStore.getState().relationships;
  return rels.some(r => r.fromColumnId === colId || r.toColumnId === colId);
}

export default memo(TableNode);
