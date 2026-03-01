import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch user
        const users = await base44.asServiceRole.entities.User.filter({email: 'lukas.heisig@heistech.cz'});
        const user = users[0];
        
        const payload = {
                entity_type: 'Auth',
                entity_id: user.id,
                changed_by: user.email,
                change_description: 'Aktivita v aplikaci',
                user_type: user.user_type || 'user'
            };

        if (user.company_id) {
            payload.company_id = user.company_id;
        }

        try {
            await base44.asServiceRole.entities.AuditLog.create(payload);
        } catch(e) {
            return Response.json({ ERROR_IN_CREATE: e.message, payload })
        }

        const now = new Date();
        
        let lastAuditLog = new Date(0);
        if (user.last_audit_log_at && user.last_audit_log_at !== "undefined" && user.last_audit_log_at !== "null") {
            const parsedDate = new Date(user.last_audit_log_at);
            if (!isNaN(parsedDate.getTime())) {
                lastAuditLog = parsedDate;
            }
        }
        
        const minutesSinceLastLog = (now.getTime() - lastAuditLog.getTime()) / (1000 * 60);

        let shouldCreateAuditLog = false;
        if (minutesSinceLastLog >= 5) {
            shouldCreateAuditLog = true;
        }

        return Response.json({
            user: user,
            now: now.toISOString(),
            lastAuditLog: lastAuditLog.toISOString(),
            minutesSinceLastLog,
            shouldCreateAuditLog
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});