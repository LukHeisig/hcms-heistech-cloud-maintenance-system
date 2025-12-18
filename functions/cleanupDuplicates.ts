import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || (user.user_type !== 'admin' && user.user_type !== 'superAdmin')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const duplicateIds = [
            '691dceb8fd5dc2a90880c7ff',
            '691dce1a43551b1e8b9d979b',
            '691da05e8c8fc69efe99cdc8',
            '691d86d0b7399937c4d0c00c',
            '691d8469e878570e7c3913fa',
            '691d7e1773c9504db73d61f4'
        ];

        const results = {
            deletedMachines: [],
            deletedControlPoints: [],
            errors: [],
            otherPotentialDuplicates: []
        };

        // 1. Delete specific duplicates
        for (const machineId of duplicateIds) {
            try {
                // Find and delete associated ControlPoints first
                const points = await base44.asServiceRole.entities.ControlPoint.filter({ machine_id: machineId });
                for (const point of points) {
                    await base44.asServiceRole.entities.ControlPoint.delete(point.id);
                    results.deletedControlPoints.push(point.id);
                }

                // Delete the Machine
                await base44.asServiceRole.entities.Machine.delete(machineId);
                results.deletedMachines.push(machineId);
            } catch (err) {
                results.errors.push(`Failed to delete machine ${machineId}: ${err.message}`);
            }
        }

        // 2. Check for other duplicates
        // Get all machines
        const allMachines = await base44.asServiceRole.entities.Machine.list();
        
        // Group by name
        const nameGroups = {};
        for (const m of allMachines) {
            if (!nameGroups[m.name]) nameGroups[m.name] = [];
            nameGroups[m.name].push(m);
        }

        // Find names with > 1 machine
        for (const [name, machines] of Object.entries(nameGroups)) {
            if (machines.length > 1) {
                // Filter out the ones we just deleted
                const remaining = machines.filter(m => !duplicateIds.includes(m.id));
                if (remaining.length > 1) {
                    results.otherPotentialDuplicates.push({
                        name: name,
                        count: remaining.length,
                        ids: remaining.map(m => m.id),
                        lines: remaining.map(m => m.line_id)
                    });
                }
            }
        }

        return Response.json(results);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});