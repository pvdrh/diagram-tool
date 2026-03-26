import useStore from '../../store/useStore';

export default function CanvasContextMenu() {
  const contextMenu = useStore(s => s.contextMenu);
  const hideContextMenu = useStore(s => s.hideContextMenu);
  const addTable = useStore(s => s.addTable);
  const deleteTable = useStore(s => s.deleteTable);
  const duplicateTable = useStore(s => s.duplicateTable);
  const updateTable = useStore(s => s.updateTable);
  const deleteRelationship = useStore(s => s.deleteRelationship);
  const selectAll = useStore(s => s.selectAll);
  const selectedTableIds = useStore(s => s.selectedTableIds);
  const tables = useStore(s => s.tables);
  const relationships = useStore(s => s.relationships);
  const openModal = useStore(s => s.openModal);

  if (!contextMenu) return null;

  const handleAction = (fn) => () => {
    fn();
    hideContextMenu();
  };

  // Table context menu
  if (contextMenu.type === 'table') {
    const tableId = contextMenu.targetId;
    const table = tables[tableId];
    const hasRels = relationships.some(r => r.fromTableId === tableId || r.toTableId === tableId);

    return (
      <div
        className="context-menu"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onMouseLeave={hideContextMenu}
      >
        <div
          className="context-menu-item"
          onClick={handleAction(() => duplicateTable(tableId))}
        >
          📋 Duplicate Table
        </div>
        <ColorPickerItem tableId={tableId} table={table} updateTable={updateTable} hideContextMenu={hideContextMenu} />
        <div
          className="context-menu-item"
          onClick={handleAction(() => updateTable(tableId, { collapsed: !table?.collapsed }))}
        >
          {table?.collapsed ? '📂 Expand' : '📁 Collapse'}
        </div>
        <div className="context-menu-divider" />
        <div
          className="context-menu-item danger"
          onClick={handleAction(() => {
            if (hasRels) {
              openModal('confirm', {
                message: `Delete table "${table?.name}"? This will also remove its relationships.`,
                onConfirm: () => deleteTable(tableId),
              });
            } else {
              deleteTable(tableId);
            }
          })}
        >
          🗑 Delete Table
        </div>
      </div>
    );
  }

  // Canvas context menu
  return (
    <div
      className="context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onMouseLeave={hideContextMenu}
    >
      <div
        className="context-menu-item"
        onClick={handleAction(() =>
          addTable({ x: contextMenu.x - 200, y: contextMenu.y - 100 })
        )}
      >
        ➕ New Table
      </div>
      <div
        className="context-menu-item"
        onClick={handleAction(selectAll)}
      >
        ⬜ Select All
      </div>
      {selectedTableIds.length > 0 && (
        <>
          <div className="context-menu-divider" />
          <div
            className="context-menu-item danger"
            onClick={handleAction(() => {
              for (const tid of selectedTableIds) deleteTable(tid);
            })}
          >
            🗑 Delete Selected ({selectedTableIds.length})
          </div>
        </>
      )}
    </div>
  );
}

const TABLE_COLORS = [
  '#4F46E5', '#7C3AED', '#DB2777', '#DC2626',
  '#EA580C', '#CA8A04', '#16A34A', '#0891B2',
  '#2563EB', '#4B5563',
];

function ColorPickerItem({ tableId, updateTable, hideContextMenu }) {
  return (
    <div className="px-3 py-1.5">
      <div className="text-xs text-gray-500 mb-1">Header Color</div>
      <div className="flex gap-1 flex-wrap">
        {TABLE_COLORS.map(color => (
          <button
            key={color}
            className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
            style={{ backgroundColor: color }}
            onClick={() => {
              updateTable(tableId, { color });
              hideContextMenu();
            }}
          />
        ))}
      </div>
    </div>
  );
}
