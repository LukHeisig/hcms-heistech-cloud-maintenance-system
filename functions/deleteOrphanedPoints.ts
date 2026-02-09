import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (user && user.user_type !== 'admin' && user.user_type !== 'superAdmin') {
             return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const log = [];
        log.push("Starting optimized orphan cleanup...");

        // 1. Fetch all reference data (Lines and Machines)
        // Assuming < 5000 for now, should use pagination for larger datasets
        const lines = await base44.asServiceRole.entities.Line.list(null, 5000);
        const lineIds = new Set(lines.map(l => l.id));
        log.push(`Loaded ${lines.length} lines`);

        const machines = await base44.asServiceRole.entities.Machine.list(null, 5000);
        const machineMap = new Map(machines.map(m => [m.id, m]));
        log.push(`Loaded ${machines.length} machines`);

        // 2. Fetch Control Points
        const points = await base44.asServiceRole.entities.ControlPoint.list(null, 5000);
        log.push(`Checked ${points.length} control points`);

        const idsToDelete = [];

        for (const point of points) {
            // Check Machine existence
            if (!point.machine_id) {
                 idsToDelete.push({ id: point.id, reason: "No machine_id" });
                 continue;
            }

            const machine = machineMap.get(point.machine_id);
            if (!machine) {
                idsToDelete.push({ id: point.id, reason: `Missing machine ${point.machine_id}` });
                continue;
            }

            // Check Line existence
            if (!machine.line_id) {
                 idsToDelete.push({ id: point.id, reason: `Machine ${machine.name} has no line_id` });
                 continue;
            }

            if (!lineIds.has(machine.line_id)) {
                idsToDelete.push({ id: point.id, reason: `Machine ${machine.name} references missing line ${machine.line_id}` });
                continue;
            }
        }

        log.push(`Found ${idsToDelete.length} orphaned points to delete`);

        // 3. Delete in batches to avoid rate limits
        let deletedCount = 0;
        const batchSize = 5;
        
        for (let i = 0; i < idsToDelete.length; i += batchSize) {
            const batch = idsToDelete.slice(i, i + batchSize);
            const results = await Promise.all(batch.map(item => 
                base44.asServiceRole.entities.ControlPoint.delete(item.id)
                    .then(() => {
                        log.push(`Deleted point ${item.id}: ${item.reason}`);
                        return true;
                    })
                    .catch(e => {
                        log.push(`Failed to delete ${item.id}: ${e.message}`);
                        return false;
                    })
            ));
            deletedCount += results.filter(r => r).length;
            // Larger delay between batches
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return Response.json({ success: true, deletedCount, log });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});