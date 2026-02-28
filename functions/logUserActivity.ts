import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = {
            entity_type: 'Auth',
            entity_id: user.id,
            changed_by: user.email,
            change_description: 'Aktivita v aplikaci'
        };

        const validRoles = ["technician", "manager", "admin", "superAdmin"];
        if (user.user_type && validRoles.includes(user.user_type)) {
            payload.user_type = user.user_type;
        }

        if (user.company_id) {
            payload.company_id = user.company_id;
        }

        // Use service role to bypass any potential permissions issues
        await base44.asServiceRole.entities.AuditLog.create(payload);

        return Response.json({ success: true, payload });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});