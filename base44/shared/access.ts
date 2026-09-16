// Sdílené ověření volajícího a jeho přístupu k datům podniku.

// Interní volání (workflow / asServiceRole.functions.invoke) přichází jako servisní identita.
export function isServiceCaller(user) {
  return !!user && typeof user.id === 'string' && user.id.startsWith('service_') && user.role === 'admin';
}

export function isSuperAdmin(user) {
  return !!user && user.user_type === 'superAdmin';
}

// Správce aplikace: superAdmin, admin (podnikový) nebo interní servisní volání.
export function isAppAdmin(user) {
  return isServiceCaller(user) || isSuperAdmin(user) || user?.user_type === 'admin';
}

// Vrátí null = přístup ke všem podnikům, jinak seznam ID podniků, které uživatel smí vidět.
export function allowedCompanyIds(user) {
  if (isServiceCaller(user) || isSuperAdmin(user)) return null;
  if (user?.user_type === 'admin') return user.assigned_company_ids || [];
  return user?.company_id ? [user.company_id] : [];
}

// Zjistí podnik, ke kterému senzor patří (přes přiřazení → stroj → linka).
async function resolveSensorCompanyId(db, sensorId) {
  let machineId = null;
  const assignments = await db.VibrationSensorAssignment.filter({ sensor_id: sensorId }, null, 1);
  machineId = assignments[0]?.machine_id ?? null;
  if (!machineId) {
    const sensors = await db.AissensSensor.filter({ sensor_id: sensorId }, null, 1);
    machineId = sensors[0]?.machine_id ?? null;
  }
  if (!machineId) return null;
  const machines = await db.Machine.filter({ id: machineId }, null, 1);
  const lineId = machines[0]?.line_id;
  if (!lineId) return null;
  const lines = await db.Line.filter({ id: lineId }, null, 1);
  return lines[0]?.company_id ?? null;
}

// Smí uživatel číst data daného senzoru? (superAdmin/servis vždy; ostatní jen svůj podnik)
export async function canAccessSensor(base44, user, sensorId) {
  const allowed = allowedCompanyIds(user);
  if (allowed === null) return true;
  if (!sensorId || allowed.length === 0) return false;
  const companyId = await resolveSensorCompanyId(base44.asServiceRole.entities, sensorId);
  return !!companyId && allowed.includes(companyId);
}