import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import useStore from '../../store/useStore';
import TableNode from './TableNode';
import RelationshipEdge from './RelationshipEdge';
import CanvasContextMenu from './CanvasContextMenu';
import SearchBar from './SearchBar';

const nodeTypes = { tableNode: TableNode };
const edgeTypes = { relationship: RelationshipEdge };

function DiagramCanvasInner() {
  const tables = useStore(s => s.tables);
  const relationships = useStore(s => s.relationships);
  const positions = useStore(s => s.positions);
  const snapToGrid = useStore(s => s.snapToGrid);
  const darkMode = useStore(s => s.darkMode);
  const editMode = useStore(s => s.editMode);
  const addTable = useStore(s => s.addTable);
  const addRelationship = useStore(s => s.addRelationship);
  const updatePositions = useStore(s => s.updatePositions);
  const showContextMenu = useStore(s => s.showContextMenu);
  const hideContextMenu = useStore(s => s.hideContextMenu);
  const clearSelection = useStore(s => s.clearSelection);
  const setSelectedTableIds = useStore(s => s.setSelectedTableIds);

  const reactFlow = useReactFlow();

  // Build nodes from store
  const storeNodes = useMemo(
    () =>
      Object.values(tables).map(table => ({
        id: table.id,
        type: 'tableNode',
        position: positions[table.id] || { x: 0, y: 0 },
        data: { table },
      })),
    [tables, positions]
  );

  // Build edges from store
  const storeEdges = useMemo(
    () =>
      relationships.map(rel => ({
        id: rel.id,
        source: rel.fromTableId,
        target: rel.toTableId,
        sourceHandle: `${rel.fromColumnId}-source`,
        targetHandle: `${rel.toColumnId}-target`,
        type: 'relationship',
        data: {
          cardinality: rel.cardinality,
          label: rel.label,
        },
      })),
    [relationships]
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(storeNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(storeEdges);

  // Sync store -> RF
  const syncRef = useRef(false);
  useEffect(() => {
    syncRef.current = true;
    setRfNodes(prev => {
      const prevMap = new Map(prev.map(n => [n.id, n]));
      return storeNodes.map(sn => {
        const existing = prevMap.get(sn.id);
        return {
          ...sn,
          selected: existing?.selected || false,
          dragging: existing?.dragging || false,
        };
      });
    });
    syncRef.current = false;
  }, [storeNodes, setRfNodes]);

  useEffect(() => {
    syncRef.current = true;
    setRfEdges(storeEdges);
    syncRef.current = false;
  }, [storeEdges, setRfEdges]);

  // Commit position on drag stop
  const onNodeDragStop = useCallback(
    (_, node, nodes) => {
      const updates = {};
      for (const n of nodes) {
        updates[n.id] = { x: n.position.x, y: n.position.y };
      }
      updates[node.id] = { x: node.position.x, y: node.position.y };
      updatePositions(updates);
    },
    [updatePositions]
  );

  // Handle new connections
  const onConnect = useCallback(
    (connection) => {
      if (!connection.sourceHandle || !connection.targetHandle) return;
      addRelationship({
        fromTableId: connection.source,
        fromColumnId: connection.sourceHandle.replace('-source', ''),
        toTableId: connection.target,
        toColumnId: connection.targetHandle.replace('-target', ''),
        cardinality: '1-many',
      });
    },
    [addRelationship]
  );

  // Double-click on canvas to create table
  const onDoubleClick = useCallback(
    (e) => {
      if (!editMode) return;
      // Only on canvas background
      if (e.target.closest('.react-flow__node')) return;
      const bounds = e.currentTarget.getBoundingClientRect();
      const position = reactFlow.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });
      addTable(position);
    },
    [addTable, reactFlow, editMode]
  );

  // Right-click on canvas background
  const onContextMenu = useCallback(
    (e) => {
      if (!editMode) return;
      if (e.target.closest('.react-flow__node')) return;
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, 'canvas', null);
    },
    [showContextMenu, editMode]
  );

  // Click on canvas to deselect
  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Selection change
  const onSelectionChange = useCallback(
    ({ nodes }) => {
      setSelectedTableIds(nodes.map(n => n.id));
    },
    [setSelectedTableIds]
  );

  // Fit view on first mount
  const initialized = useRef(false);
  useEffect(() => {
    if (Object.keys(tables).length > 0 && !initialized.current) {
      setTimeout(() => {
        reactFlow.fitView({ padding: 0.2 });
        initialized.current = true;
      }, 100);
    }
  }, [tables, reactFlow]);

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={editMode ? onConnect : undefined}
        onNodeDragStop={editMode ? onNodeDragStop : undefined}
        onDoubleClick={onDoubleClick}
        onPaneClick={onPaneClick}
        onContextMenu={onContextMenu}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={editMode}
        nodesConnectable={editMode}
        elementsSelectable={true}
        snapToGrid={snapToGrid}
        snapGrid={[15, 15]}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'relationship' }}
        connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2 }}
        selectionOnDrag
        panOnDrag={[1, 2]}
        selectNodesOnDrag={false}
        deleteKeyCode={editMode ? 'Delete' : null}
        multiSelectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={snapToGrid ? 'lines' : 'dots'}
          color={darkMode ? '#374151' : '#e5e7eb'}
          gap={snapToGrid ? 15 : 20}
          size={snapToGrid ? 0.5 : 1}
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={node => {
            const table = tables[node.id];
            return table?.color || '#4F46E5';
          }}
          maskColor={darkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.15)'}
          style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb' }}
        />
        <Panel position="top-right">
          <div className="flex gap-1">
            <SearchBar />
            <button
              className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => reactFlow.fitView({ padding: 0.2 })}
              title="Fit to screen"
            >
              ⊞ Fit
            </button>
          </div>
        </Panel>
      </ReactFlow>
      <CanvasContextMenu />
    </div>
  );
}

export default function DiagramCanvas() {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInner />
    </ReactFlowProvider>
  );
}
