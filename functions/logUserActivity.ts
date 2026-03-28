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

        // Omezíme zápis do AuditLogu na 1x za 15 minut, abychom nezahltili historii
        // last_active_at se ale aktualizuje vždy, takže uživatel bude svítit "Online"
        let shouldCreateAuditLog = false;
        
        // Můžeme to jednoduše zjistit tak, že zkontrolujeme, kdy naposledy byla aktivita zapsána
        // Ale pro bezpečnost a rychlost raději rovnou zapíšeme AuditLog jen pokud uplynulo dost času
        // Uložíme si čas posledního zápisu AuditLogu přímo do User entity (nové pole last_audit_log_at)
        const now = new Date();
        
        // Robustní parsování data - auth.me() vrací data flat i nested, zkontrolujeme obojí
        const lastAuditLogRaw = user.last_audit_log_at ?? user.data?.last_audit_log_at ?? null;
        let lastAuditLog = new Date(0);
        if (lastAuditLogRaw && lastAuditLogRaw !== "undefined" && lastAuditLogRaw !== "null") {
            const parsedDate = new Date(lastAuditLogRaw);
            if (!isNaN(parsedDate.getTime())) {
                lastAuditLog = parsedDate;
            }
        }
        
        const minutesSinceLastLog = (now.getTime() - lastAuditLog.getTime()) / (1000 * 60);

        // Zápis bodu aktivity každých 5 minut
        if (minutesSinceLastLog >= 5) {
            shouldCreateAuditLog = true;
        }

        let payload = null;

        if (shouldCreateAuditLog) {
            payload = {
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
                
                // Uložíme si, že jsme zrovna vytvořili AuditLog
                await base44.asServiceRole.entities.User.update(user.id, {
                    last_audit_log_at: now.toISOString()
                });
            } catch (dbError) {
                console.error("Error creating AuditLog", dbError);
                await base44.asServiceRole.entities.SystemLog.create({
                    type: 'error',
                    message: `[Backend Function logUserActivity] Error creating AuditLog for ${user.email}: ${dbError.message} | Payload: ${JSON.stringify(payload)}`,
                    timestamp: new Date().toISOString(),
                    user_email: user.email
                });
            }
        }

        return Response.json({ success: true, payload, skipped: !shouldCreateAuditLog });
    } catch (error) {
        // Logujeme chybu do SystemLog, abychom věděli co přesně padlo
        try {
            const base44Fallback = createClientFromRequest(req);
            await base44Fallback.asServiceRole.entities.SystemLog.create({
                type: 'error',
                message: `[logUserActivity] Unhandled error: ${error.message} | Stack: ${error.stack?.substring(0, 500)}`,
                timestamp: new Date().toISOString(),
            });
        } catch (_) { /* ignore logging error */ }
        return Response.json({ error: error.message }, { status: 500 });
    }
});