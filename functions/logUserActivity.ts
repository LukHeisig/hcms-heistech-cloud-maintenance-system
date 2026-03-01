import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const authUser = await base44.auth.me();

        if (!authUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Nucený log pro debugging, abychom viděli, jestli se request vůbec dostane na server
        if (user.email === 'lukas.heisig@heistech.cz') {
            await base44.asServiceRole.entities.SystemLog.create({
                type: 'info',
                message: `[DEBUG] logUserActivity zavoláno pro ${user.email}`,
                timestamp: new Date().toISOString(),
                user_email: user.email
            });
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
        const lastAuditLog = user.last_audit_log_at ? new Date(user.last_audit_log_at) : new Date(0);
        const minutesSinceLastLog = (now - lastAuditLog) / (1000 * 60);

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
        return Response.json({ error: error.message }, { status: 500 });
    }
});