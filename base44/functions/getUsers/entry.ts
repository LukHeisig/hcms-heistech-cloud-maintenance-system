import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Service role to bypass ACL and fetch all users
        const allUsers = await base44.asServiceRole.entities.User.list("-created_date", 1000);

        let visibleUsers = [];

        if (user.user_type === 'superAdmin') {
            visibleUsers = allUsers;
        } else if (user.user_type === 'admin') {
            const assignedIds = user.assigned_company_ids || [];
            visibleUsers = allUsers.filter(u => {
                if (u.id === user.id) return true;
                
                // Users in assigned companies (e.g. technicians, managers)
                if (u.company_id && assignedIds.includes(u.company_id)) return true;
                
                // Users assigned to these companies (e.g. other admins)
                if (u.assigned_company_ids && Array.isArray(u.assigned_company_ids)) {
                    return u.assigned_company_ids.some(id => assignedIds.includes(id));
                }
                
                return false;
            });
        } else if (user.user_type === 'manager') {
             if (user.company_id) {
                 visibleUsers = allUsers.filter(u => 
                     u.id === user.id || 
                     u.company_id === user.company_id ||
                     (u.assigned_company_ids && u.assigned_company_ids.includes(user.company_id))
                 );
             } else {
                 visibleUsers = [user];
             }
        } else {
            // Default: see self
            visibleUsers = [user];
        }

        // Filter out users with higher role level than current user (except for superAdmin)
        if (user.user_type !== 'superAdmin') {
            const roleLevels = {
                superAdmin: 4,
                admin: 3,
                manager: 2,
                technician: 1
            };
            const currentUserLevel = roleLevels[user.user_type] || 0;
            
            visibleUsers = visibleUsers.filter(u => {
                const uLevel = roleLevels[u.user_type] || 0;
                return uLevel <= currentUserLevel;
            });
        }

        return Response.json(visibleUsers);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});