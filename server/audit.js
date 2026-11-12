export async function audit(db, actor, action, entity, id, before, after) {
  await db.run('INSERT INTO audit_log(actor_id,actor_email,action,entity,entity_id,before_json,after_json) VALUES(?,?,?,?,?,?,?)',
    actor.id, actor.email, action, entity, String(id),
    before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after));
}

// Registra várias ações numa única ida ao banco. A importação em lote gera
// centenas de entradas, e uma por linha custava minutos neste host.
export async function auditBulk(db, actor, action, entity, entradas) {
  if (!entradas.length) return;
  const marcadores = entradas.map(() => '(?,?,?,?,?,?,?)').join(',');
  const valores = [];
  for (const { id, before = null, after = null } of entradas) {
    valores.push(actor.id, actor.email, action, entity, String(id),
      before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after));
  }
  await db.run(`INSERT INTO audit_log(actor_id,actor_email,action,entity,entity_id,before_json,after_json) VALUES ${marcadores}`, ...valores);
}
