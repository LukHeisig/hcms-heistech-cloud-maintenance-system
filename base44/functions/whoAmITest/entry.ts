import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null, err = null;
    try { user = await base44.auth.me(); } catch (e) { err = e.message; }
    const isAuth = await base44.auth.isAuthenticated().catch(() => null);
    const headers = {};
    for (const [k, v] of req.headers.entries()) headers[k] = k.toLowerCase().includes('auth') || k.toLowerCase().includes('token') || k.toLowerCase().includes('key') ? `<${v.length} chars>` : v;
    const out = { user: user ? { id: user.id, email: user.email, role: user.role, user_type: user.user_type } : null, err, isAuth, headers };
    console.log(JSON.stringify(out));
    await base44.asServiceRole.entities.SystemLog.create({ type: 'info', message: 'WHOAMI_TEST ' + JSON.stringify(out), timestamp: new Date().toISOString() });
    return Response.json(out);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}