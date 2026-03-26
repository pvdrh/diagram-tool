import { memo, useCallback } from 'react';
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import useStore from '../../store/useStore';

const CARDINALITY_LABELS = {
  '1-1': '1 — 1',
  '1-many': '1 — *',
  'many-1': '* — 1',
  'many-many': '* — *',
};

function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}) {
  const setSelectedRelationship = useStore(s => s.setSelectedRelationship);
  const updateRelationship = useStore(s => s.updateRelationship);
  const deleteRelationship = useStore(s => s.deleteRelationship);
  const highlightEdges = useStore(s => s.highlightEdges);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    setSelectedRelationship(id);
  }, [id, setSelectedRelationship]);

  const cycleCardinality = useCallback((e) => {
    e.stopPropagation();
    const order = ['1-1', '1-many', 'many-1', 'many-many'];
    const idx = order.indexOf(data?.cardinality || '1-many');
    const next = order[(idx + 1) % order.length];
    updateRelationship(id, { cardinality: next });
  }, [id, data?.cardinality, updateRelationship]);

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation();
    deleteRelationship(id);
  }, [id, deleteRelationship]);

  return (
    <>
      {/* Glow layer when highlighted */}
      {highlightEdges && (
        <path
          d={edgePath}
          fill="none"
          stroke="#6366f1"
          strokeWidth={selected ? 8 : 6}
          strokeOpacity={0.15}
          className="edge-glow"
        />
      )}
      {/* Main edge */}
      <path
        d={edgePath}
        fill="none"
        stroke={highlightEdges
          ? (selected ? '#818cf8' : '#6366f1')
          : (selected ? '#6366f1' : '#94a3b8')}
        strokeWidth={highlightEdges
          ? (selected ? 3 : 2.5)
          : (selected ? 2.5 : 1.5)}
        opacity={highlightEdges ? 1 : 0.6}
        cursor="pointer"
        className={highlightEdges ? 'edge-highlight' : ''}
        strokeDasharray={highlightEdges ? '8 4' : 'none'}
        style={{ pointerEvents: 'stroke' }}
      />
      {/* Invisible wider interaction zone */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={15}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
      />
      <EdgeLabelRenderer>
        <div
          className="absolute pointer-events-auto flex items-center gap-1"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          <button
            className={`text-xs px-1.5 py-0.5 rounded border ${
              selected
                ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-200'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
            } hover:bg-indigo-50 dark:hover:bg-indigo-900/50 cursor-pointer`}
            onClick={handleClick}
            onDoubleClick={cycleCardinality}
            title="Click to select, double-click to change cardinality"
          >
            {CARDINALITY_LABELS[data?.cardinality] || '1 — *'}
          </button>
          {selected && (
            <button
              className="text-xs px-1 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 border border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-800"
              onClick={handleDeleteClick}
              title="Delete relationship"
            >
              ✕
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(RelationshipEdge);
