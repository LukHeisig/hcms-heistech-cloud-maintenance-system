export async function getPointDeletionContext(client, point) {
  const machine = point.machine_id ? (await client.entities.Machine.filter({ id: point.machine_id }, null, 1))[0] : null;
  const line = machine?.line_id ? (await client.entities.Line.filter({ id: machine.line_id }, null, 1))[0] : null;
  const company = line?.company_id ? (await client.entities.Company.filter({ id: line.company_id }, null, 1))[0] : null;
  return { machine, line, company };
}

export async function deleteControlPointWithAudit(client, point, user, source, context) {
  const { machine, line, company } = context || await getPointDeletionContext(client, point);
  const details = `kontrolní bod: ${point.name} (ID: ${point.id}); stroj: ${machine?.name || 'Nedohledán'} (ID: ${point.machine_id || 'nepřiřazen'}); linka: ${line?.name || 'Nedohledána'}; podnik: ${company?.name || line?.company_id || 'Nedohledán'}; způsob: ${source}`;
  // Persist the original relationship before deleting. If this fails, the point stays intact.
  const audit = await client.entities.AuditLog.create({
    entity_type: 'ControlPoint', entity_id: point.id, action: 'delete',
    changed_by: user.email, user_type: user.user_type,
    company_id: line?.company_id || undefined, company_name: company?.name,
    line_id: machine?.line_id, line_name: line?.name,
    machine_id: point.machine_id, machine_name: machine?.name,
    point_name: point.name, point_type: point.type, point_number: point.number,
    first_confirmation_date: point.first_confirmation_date || undefined,
    deletion_source: source, operation_status: 'pending',
    change_description: `Zahájeno mazání – ${details}`,
  });
  try {
    await client.entities.ControlPoint.delete(point.id);
  } catch (error) {
    await client.entities.AuditLog.update(audit.id, {
      operation_status: 'failed', change_description: `Mazání selhalo – ${details}`,
    });
    throw error;
  }
  await client.entities.AuditLog.update(audit.id, {
    operation_status: 'completed', deleted_at: new Date().toISOString(),
    change_description: `Smazán ${details}`,
  });
}