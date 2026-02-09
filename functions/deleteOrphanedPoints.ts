import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // Allow admin/superAdmin or service role
        if (user && user.user_type !== 'admin' && user.user_type !== 'superAdmin') {
             return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const log = [];
        log.push("Starting orphan cleanup...");

        // 1. Get all Control Points
        const points = await base44.asServiceRole.entities.ControlPoint.list(null, 5000);
        log.push(`Checked ${points.length} control points`);

        let deletedCount = 0;

        for (const point of points) {
            // Check Machine
            if (!point.machine_id) {
                 log.push(`Point ${point.name} (${point.id}) has no machine_id. Deleting...`);
                 await base44.asServiceRole.entities.ControlPoint.delete(point.id);
                 deletedCount++;
                 continue;
            }

            const machines = await base44.asServiceRole.entities.Machine.filter({ id: point.machine_id });
            const machine = machines[0];

            if (!machine) {
                log.push(`Point ${point.name} (${point.id}) references missing machine ${point.machine_id}. Deleting...`);
                await base44.asServiceRole.entities.ControlPoint.delete(point.id);
                deletedCount++;
                continue;
            }

            // Check Line
            if (!machine.line_id) {
                 log.push(`Machine ${machine.name} (${machine.id}) has no line_id. Deleting point ${point.id}...`);
                 await base44.asServiceRole.entities.ControlPoint.delete(point.id);
                 deletedCount++;
                 continue;
            }

            const lines = await base44.asServiceRole.entities.Line.filter({ id: machine.line_id });
            const line = lines[0];

            if (!line) {
                log.push(`Machine ${machine.name} references missing line ${machine.line_id}. Deleting point ${point.id}...`);
                await base44.asServiceRole.entities.ControlPoint.delete(point.id);
                deletedCount++;
                continue;
            }
        }
        
        log.push(`Cleanup completed. Deleted ${deletedCount} orphaned points.`);
        return Response.json({ success: true, deletedCount, log });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});