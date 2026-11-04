import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const roleLevels = { superAdmin: 4, admin: 3, manager: 2, technician: 1 };
const allowedFields = [
  'user_type', 'department', 'phone', 'company_id', 'assigned_company_ids',
  'custom_display_name', 'auto_logout_enabled', 'auto_logout_minutes', 'access_until',
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId, data } = await req.json();
    if (!userId || !data) return Response.json({ error: 'Chybí userId nebo data' }, { status: 400 });

    const targets = await base44.asServiceRole.entities.User.filter({ id: userId });
    const target = targets[0];
    if (!target) return Response.json({ error: 'Uživatel nenalezen' }, { status: 404 });

    const isSelf = userId === user.id;
    const callerLevel = roleLevels[user.user_type] || 0;
    const targetLevel = roleLevels[target.user_type] || 0;
    const newLevel = roleLevels[data.user_type] || 0;

    if (user.user_type !== 'superAdmin') {
      if (!isSelf && !['admin', 'manager'].includes(user.user_type)) {
        return Response.json({ error: 'Nedostatečná oprávnění' }, { status: 403 });
      }
      if (!isSelf && targetLevel >= callerLevel) {
        return Response.json({ error: 'Nemůžete upravovat uživatele se stejnou nebo vyšší rolí' }, { status: 403 });
      }
      if (!isSelf && data.user_type && newLevel > callerLevel) {
        return Response.json({ error: 'Nemůžete přidělit vyšší roli, než máte sami' }, { status: 403 });
      }
      if (isSelf) {
        // Sám sobě nelze měnit roli ani podniky
        delete data.user_type;
        delete data.company_id;
        delete data.assigned_company_ids;
        delete data.access_until;
      }
      if (user.user_type === 'admin' && data.company_id) {
        const assigned = user.assigned_company_ids || [];
        if (!assigned.includes(data.company_id)) {
          return Response.json({ error: 'Nemáte přístup k vybranému podniku' }, { status: 403 });
        }
      }
      if (user.user_type === 'admin') delete data.assigned_company_ids;
      if (user.user_type === 'manager') {
        delete data.user_type;
        delete data.company_id;
        delete data.assigned_company_ids;
        delete data.access_until;
      }
    }

    const payload = {};
    for (const key of allowedFields) {
      if (key in data) payload[key] = data[key];
    }

    const updated = await base44.asServiceRole.entities.User.update(userId, payload);

    // Aktivační email — poprvé přiřazen podnik
    const hadCompany = !!target.company_id || (target.assigned_company_ids || []).length > 0;
    const newCompanyId = payload.company_id || (payload.assigned_company_ids || [])[0];
    if (!hadCompany && newCompanyId && target.email) {
      const companies = await base44.asServiceRole.entities.Company.filter({ id: newCompanyId });
      const roleLabels = { superAdmin: 'Super administrátor', admin: 'Administrátor', manager: 'Vedoucí', technician: 'Technik' };
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: target.email,
        template_name: 'AccountActivated',
        category: 'transactional',
        variables: {
          first_name: target.custom_display_name || target.full_name || '',
          company_name: companies[0]?.name || '',
          role_label: roleLabels[payload.user_type || target.user_type] || 'Technik',
        },
      });
    }
    return Response.json({ success: true, user: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}