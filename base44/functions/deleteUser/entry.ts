import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const roleLevels = { superAdmin: 4, admin: 3, manager: 2, technician: 1 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.user_type !== 'superAdmin' && user.user_type !== 'admin') {
      return Response.json({ error: 'Nedostatečná oprávnění' }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) return Response.json({ error: 'Chybí userId' }, { status: 400 });

    if (userId === user.id) {
      return Response.json({ error: 'Nemůžete smazat sami sebe' }, { status: 400 });
    }

    const targets = await base44.asServiceRole.entities.User.filter({ id: userId });
    const target = targets[0];
    if (!target) return Response.json({ error: 'Uživatel nenalezen' }, { status: 404 });

    // Admin může mazat pouze uživatele s nižší rolí; superAdmin kohokoliv
    if (user.user_type !== 'superAdmin') {
      const callerLevel = roleLevels[user.user_type] || 0;
      const targetLevel = roleLevels[target.user_type] || 0;
      if (targetLevel >= callerLevel) {
        return Response.json({ error: 'Nemůžete smazat uživatele se stejnou nebo vyšší rolí' }, { status: 403 });
      }
    }

    await base44.asServiceRole.entities.User.delete(userId);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});