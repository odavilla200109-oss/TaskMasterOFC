/**
 * src/utils/formatNodes.js — v3
 * Converte linhas do banco para camelCase do cliente.
 * Suporta task nodes e brain nodes.
 */

function formatNodes(rows) {
  return rows.map((r) => ({
    id:        r.id,
    title:     r.title,
    x:         r.x,
    y:         r.y,
    priority:  r.priority,
    completed: r.completed === 1,
    parentId:  r.parent_id || null,
    dueDate:   r.due_date  || null,
  }));
}

function formatBrainNodes(rows) {
  return rows.map((r) => ({
    id:       r.id,
    title:    r.title,
    x:        r.x,
    y:        r.y,
    color:    r.color   || "#10b981",
    parentId: r.parent_id || null,
    isRoot:   r.is_root === 1,
  }));
}

module.exports = { formatNodes, formatBrainNodes };
