/**
 * src/utils/formatNodes.js
 *
 * Converte linhas do banco (snake_case) para o formato
 * esperado pelo cliente (camelCase).
 *
 * Centralizado aqui para evitar duplicação entre
 * src/routes/canvases.js e src/ws.js.
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

module.exports = { formatNodes };
