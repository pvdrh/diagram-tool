/**
 * Auto-arrange tables with multiple layout strategies.
 * Modes: 'left-right', 'snowflake', 'compact'
 */

const TABLE_WIDTH = 260;
const TABLE_HEIGHT_BASE = 60;
const COL_HEIGHT = 28;
const H_GAP = 100;
const V_GAP = 80;

function estimateHeight(table) {
  if (!table) return TABLE_HEIGHT_BASE;
  if (table.collapsed) return TABLE_HEIGHT_BASE;
  return TABLE_HEIGHT_BASE + table.columns.length * COL_HEIGHT;
}

// ─── Shared graph helpers ───────────────────────────────────────

function buildGraph(tableIds, relationships) {
  const children = new Map();
  const adj = new Map();
  const inDegree = new Map();
  const degree = new Map();

  for (const id of tableIds) {
    children.set(id, new Set());
    adj.set(id, new Set());
    inDegree.set(id, 0);
    degree.set(id, 0);
  }

  for (const rel of relationships) {
    const from = rel.fromTableId;
    const to = rel.toTableId;
    if (!adj.has(from) || !adj.has(to) || from === to) continue;
    children.get(from).add(to);
    adj.get(from).add(to);
    adj.get(to).add(from);
    inDegree.set(to, (inDegree.get(to) || 0) + 1);
    degree.set(from, (degree.get(from) || 0) + 1);
    degree.set(to, (degree.get(to) || 0) + 1);
  }

  return { children, adj, inDegree, degree };
}

function findComponents(tableIds, adj) {
  const visited = new Set();
  const components = [];

  for (const id of tableIds) {
    if (visited.has(id)) continue;
    const component = [];
    const queue = [id];
    visited.add(id);
    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);
      for (const neighbor of adj.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function assignDepths(component, children) {
  const depths = new Map();
  const componentSet = new Set(component);

  const localInDegree = new Map();
  for (const id of component) localInDegree.set(id, 0);
  for (const id of component) {
    for (const child of children.get(id) || []) {
      if (componentSet.has(child)) {
        localInDegree.set(child, (localInDegree.get(child) || 0) + 1);
      }
    }
  }

  let roots = component.filter(id => localInDegree.get(id) === 0);
  if (roots.length === 0) roots = [component[0]];

  const queue = roots.map(id => ({ id, depth: 0 }));
  const visited = new Set();
  for (const r of roots) { depths.set(r, 0); visited.add(r); }

  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    for (const child of children.get(id) || []) {
      if (!componentSet.has(child)) continue;
      const newDepth = depth + 1;
      if (!visited.has(child) || newDepth > (depths.get(child) || 0)) {
        depths.set(child, newDepth);
        if (!visited.has(child)) {
          visited.add(child);
          queue.push({ id: child, depth: newDepth });
        }
      }
    }
  }

  for (const id of component) {
    if (!depths.has(id)) depths.set(id, 0);
  }
  return depths;
}

// ─── MODE 1: Left-Right ─────────────────────────────────────────
// Columns = depth levels flowing left→right, rows within each column.

function layoutLeftRight(tables, relationships) {
  const tableIds = Object.keys(tables);
  if (tableIds.length === 0) return {};
  if (tableIds.length === 1) return { [tableIds[0]]: { x: 100, y: 100 } };

  const { children, adj, degree } = buildGraph(tableIds, relationships);
  const components = findComponents(tableIds, adj);
  components.sort((a, b) => b.length - a.length);

  const allPositions = {};
  let globalY = 50;

  for (const component of components) {
    const depths = assignDepths(component, children);

    // Group by depth → columns
    const cols = new Map();
    for (const id of component) {
      const d = depths.get(id) || 0;
      if (!cols.has(d)) cols.set(d, []);
      cols.get(d).push(id);
    }

    const sortedDepths = [...cols.keys()].sort((a, b) => a - b);
    for (const d of sortedDepths) {
      cols.get(d).sort((a, b) => (degree.get(b) || 0) - (degree.get(a) || 0));
    }

    // Place columns left-to-right
    let x = 50;
    let compMaxY = 0;

    for (const d of sortedDepths) {
      const ids = cols.get(d);
      let y = globalY;

      for (const id of ids) {
        allPositions[id] = { x, y };
        y += estimateHeight(tables[id]) + V_GAP;
      }
      compMaxY = Math.max(compMaxY, y);
      x += TABLE_WIDTH + H_GAP;
    }

    globalY = compMaxY + V_GAP;
  }

  return allPositions;
}

// ─── MODE 2: Snowflake ──────────────────────────────────────────
// Most-connected tables in the center, radiating outward in concentric rings.

function layoutSnowflake(tables, relationships) {
  const tableIds = Object.keys(tables);
  if (tableIds.length === 0) return {};
  if (tableIds.length === 1) return { [tableIds[0]]: { x: 100, y: 100 } };

  const { adj, degree } = buildGraph(tableIds, relationships);
  const components = findComponents(tableIds, adj);
  components.sort((a, b) => b.length - a.length);

  const allPositions = {};
  let globalOffsetX = 0;

  for (const component of components) {
    // Sort by degree descending — most connected first
    const sorted = [...component].sort((a, b) => (degree.get(b) || 0) - (degree.get(a) || 0));

    // BFS from center node to assign rings
    const center = sorted[0];
    const ring = new Map();
    ring.set(center, 0);
    const bfsQueue = [center];
    const visited = new Set([center]);

    while (bfsQueue.length > 0) {
      const current = bfsQueue.shift();
      for (const neighbor of adj.get(current) || []) {
        if (!visited.has(neighbor) && component.includes(neighbor)) {
          visited.add(neighbor);
          ring.set(neighbor, (ring.get(current) || 0) + 1);
          bfsQueue.push(neighbor);
        }
      }
    }
    // Assign unvisited (isolated within component) to outermost ring
    const maxRing = Math.max(0, ...ring.values());
    for (const id of component) {
      if (!ring.has(id)) ring.set(id, maxRing + 1);
    }

    // Group by ring
    const rings = new Map();
    for (const [id, r] of ring) {
      if (!rings.has(r)) rings.set(r, []);
      rings.get(r).push(id);
    }

    const sortedRings = [...rings.keys()].sort((a, b) => a - b);
    const ringRadius = TABLE_WIDTH + H_GAP;
    let compMaxExtent = 0;

    // Center of this component
    const cx = globalOffsetX + (sortedRings.length) * ringRadius;
    const cy = (sortedRings.length) * ringRadius;

    for (const r of sortedRings) {
      const ids = rings.get(r);
      if (r === 0) {
        // Center node
        allPositions[ids[0]] = { x: cx, y: cy };
        compMaxExtent = Math.max(compMaxExtent, cx + TABLE_WIDTH);
      } else {
        const radius = r * ringRadius;
        const angleStep = (2 * Math.PI) / ids.length;
        // Start from top (-PI/2) for nicer visual
        const startAngle = -Math.PI / 2;

        for (let i = 0; i < ids.length; i++) {
          const angle = startAngle + i * angleStep;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          allPositions[ids[i]] = { x, y };
          compMaxExtent = Math.max(compMaxExtent, x + TABLE_WIDTH);
        }
      }
    }

    globalOffsetX = compMaxExtent + H_GAP * 2;
  }

  return allPositions;
}

// ─── MODE 3: Compact ────────────────────────────────────────────
// Simple grid: tables packed into a rectangle, sorted by name.

function layoutCompact(tables, relationships) {
  const tableIds = Object.keys(tables);
  if (tableIds.length === 0) return {};
  if (tableIds.length === 1) return { [tableIds[0]]: { x: 100, y: 100 } };

  // Sort tables alphabetically by name for predictable layout
  const sorted = [...tableIds].sort((a, b) => {
    const nameA = tables[a]?.name || '';
    const nameB = tables[b]?.name || '';
    return nameA.localeCompare(nameB);
  });

  // Calculate optimal grid columns: aim for a roughly square grid
  const cols = Math.max(2, Math.ceil(Math.sqrt(sorted.length)));

  const positions = {};
  let x = 50;
  let y = 50;
  let col = 0;
  let rowMaxH = 0;

  for (const id of sorted) {
    positions[id] = { x, y };
    rowMaxH = Math.max(rowMaxH, estimateHeight(tables[id]));
    col++;

    if (col >= cols) {
      col = 0;
      x = 50;
      y += rowMaxH + V_GAP;
      rowMaxH = 0;
    } else {
      x += TABLE_WIDTH + H_GAP * 0.6;
    }
  }

  return positions;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Auto-arrange tables with the given mode.
 * @param {Object} tables
 * @param {Array} relationships
 * @param {'left-right'|'snowflake'|'compact'} mode
 * @returns {Object} positions { id: { x, y } }
 */
export function autoArrange(tables, relationships, mode = 'left-right') {
  switch (mode) {
    case 'snowflake':
      return layoutSnowflake(tables, relationships);
    case 'compact':
      return layoutCompact(tables, relationships);
    case 'left-right':
    default:
      return layoutLeftRight(tables, relationships);
  }
}
