import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Scheduled function: runs periodically, finds users registered in the last interval
// who have no company assigned, and emails superAdmins.
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Find users without company_id created in the last 65 minutes (safe overlap)
        const since = new Date(Date.now() - 65 * 60 * 1000).toISOString();
        const allUsers = await base44.asServiceRole.entities.User.list(null, 500);

        const newUsersWithoutCompany = allUsers.filter(u =>
            !u.company_id &&
            u.created_date &&
            new Date(u.created_date) >= new Date(since)
        );

        if (newUsersWithoutCompany.length === 0) {
            return Response.json({ skipped: true, reason: 'No new users without company' });
        }

        // Get all superAdmins
        const superAdmins = allUsers.filter(u => u.user_type === 'superAdmin');
        if (superAdmins.length === 0) {
            return Response.json({ skipped: true, reason: 'No superAdmins found' });
        }

        // Build email body listing all new users
        const userRows = newUsersWithoutCompany.map(u => {
            const registeredAt = new Date(u.created_date).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });
            return `<li><strong>${u.full_name || '—'}</strong> (${u.email || '—'}) — registrace: ${registeredAt}</li>`;
        }).join('');

        const subject = newUsersWithoutCompany.length === 1
            ? `HCMS: Nový uživatel bez podniku — ${newUsersWithoutCompany[0].full_name || newUsersWithoutCompany[0].email}`
            : `HCMS: ${newUsersWithoutCompany.length} noví uživatelé bez přiřazeného podniku`;

        const emailBody = `
<p>Dobrý den,</p>
<p>Do aplikace <strong>HCMS</strong> se zaregistroval/i noví uživatelé, kteří dosud nemají přiřazený podnik:</p>
<ul>${userRows}</ul>
<p>Přihlaste se do aplikace a přiřaďte uživatelům podnik v sekci <strong>Uživatelé</strong>.</p>
<p style="color:#888;font-size:12px;">Tato zpráva byla vygenerována automaticky systémem HCMS.</p>
        `.trim();

        const results = [];
        for (const admin of superAdmins) {
            if (!admin.email) continue;
            try {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: admin.email,
                    subject,
                    body: emailBody,
                    from_name: 'HCMS Notifikace',
                });
                results.push({ email: admin.email, sent: true });
            } catch (err) {
                results.push({ email: admin.email, sent: false, error: err.message });
            }
        }

        return Response.json({ success: true, newUsers: newUsersWithoutCompany.length, notified: results });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});