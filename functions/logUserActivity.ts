import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Aktualizujeme last_active_at uživatele (s administrátorskými právy přes serviceRole)
        try {
            await base44.asServiceRole.entities.User.update(user.id, {
                last_active_at: new Date().toISOString()
            });
        } catch (updateErr) {
            console.error("Failed to update user last_active_at", updateErr);
        }

        // Zabránit spamu - kontrola posledního logu
        const recentLogs = await base44.asServiceRole.entities.AuditLog.filter({
            entity_type: 'Auth',
            changed_by: user.email,
        }, '-created_date', 1);
        
        if (recentLogs && recentLogs.length > 0) {
            const lastLog = recentLogs[0];
            const lastLogDate = new Date(lastLog.created_date).getTime();
            const now = new Date().getTime();
            
            // Logujeme aktivitu maximálně jednou za 5 minut (300000 ms) pro stejného uživatele
            if (now - lastLogDate < 300000) {
                return Response.json({ success: true, skipped: true, reason: 'throttled' });
            }
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
        try {
            await base44.asServiceRole.entities.AuditLog.create(payload);
        } catch (dbError) {
            // Log creation failure
            await base44.asServiceRole.entities.SystemLog.create({
                type: 'error',
                message: `[Backend Function logUserActivity] Error creating AuditLog: ${dbError.message}`,
                timestamp: new Date().toISOString(),
                user_email: user.email
            });
            return Response.json({ error: dbError.message }, { status: 500 });
        }

        return Response.json({ success: true, payload });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});