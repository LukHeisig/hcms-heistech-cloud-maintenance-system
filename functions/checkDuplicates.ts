import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Check for duplicate Machines
        const machines = await base44.entities.Machine.list({ limit: 10000 }); // Increase limit
        const machineMap = {};
        const duplicateMachines = [];

        for (const m of machines) {
            const key = `${m.line_id}_${m.name}`;
            if (machineMap[key]) {
                duplicateMachines.push({
                    name: m.name,
                    line_id: m.line_id,
                    id: m.id,
                    original_id: machineMap[key].id
                });
            } else {
                machineMap[key] = m;
            }
        }

        // 2. Check for duplicate Control Points
        const controlPoints = await base44.entities.ControlPoint.list({ limit: 10000 }); // Increase limit
        const pointMap = {};
        const duplicatePoints = [];

        for (const p of controlPoints) {
            const key = `${p.machine_id}_${p.name}`;
            if (pointMap[key]) {
                duplicatePoints.push({
                    name: p.name,
                    machine_id: p.machine_id,
                    id: p.id,
                    original_id: pointMap[key].id
                });
            } else {
                pointMap[key] = p;
            }
        }

        return Response.json({
            checkedMachines: machines.length,
            checkedPoints: controlPoints.length,
            duplicateMachinesCount: duplicateMachines.length,
            duplicatePointsCount: duplicatePoints.length,
            duplicateMachines,
            duplicatePoints
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});