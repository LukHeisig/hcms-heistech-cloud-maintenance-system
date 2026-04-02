import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export const handler = async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.user_type === 'technician') {
             return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { type, id } = await req.json();

        if (!id || !type) {
            return Response.json({ error: 'Missing type or id' }, { status: 400 });
        }

        const client = base44.asServiceRole;

        if (user.user_type === 'manager') {
            let itemCompanyId = null;
            if (type === 'machine') {
                const machines = await client.entities.Machine.filter({ id });
                if (machines.length > 0) {
                    const lines = await client.entities.Line.filter({ id: machines[0].line_id });
                    if (lines.length > 0) itemCompanyId = lines[0].company_id;
                }
            } else if (type === 'line') {
                const lines = await client.entities.Line.filter({ id });
                if (lines.length > 0) itemCompanyId = lines[0].company_id;
            }

            if (itemCompanyId && itemCompanyId !== user.company_id) {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const log = [];

        if (type === 'machine') {
            await deleteMachineCascade(client, id, log);
        } else if (type === 'line') {
            await deleteLineCascade(client, id, log);
        } else {
            return Response.json({ error: 'Invalid type' }, { status: 400 });
        }

        return Response.json({ success: true, log });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
};

async function deleteMachineCascade(client, machineId, log) {
    log.push(`Deleting machine ${machineId}...`);

    // 1. Delete Control Points
    const points = await client.entities.ControlPoint.filter({ machine_id: machineId });
    for (const point of points) {
        // Delete related ControlRecords
        const records = await client.entities.ControlRecord.filter({ control_point_id: point.id });
        for (const r of records) await client.entities.ControlRecord.delete(r.id);
        
        // Delete related Documentation
        const docs = await client.entities.Documentation.filter({ control_point_id: point.id });
        for (const d of docs) await client.entities.Documentation.delete(d.id);

        // Delete related Issues
        const pIssues = await client.entities.Issue.filter({ control_point_id: point.id });
        for (const i of pIssues) await client.entities.Issue.delete(i.id);

        await client.entities.ControlPoint.delete(point.id);
    }
    log.push(`Deleted ${points.length} control points.`);

    // 2. Delete Machine related entities
    // PlannedMaintenance
    const pms = await client.entities.PlannedMaintenance.filter({ machine_id: machineId });
    for (const pm of pms) await client.entities.PlannedMaintenance.delete(pm.id);

    // MaintenanceRecord
    const mrs = await client.entities.MaintenanceRecord.filter({ machine_id: machineId });
    for (const mr of mrs) await client.entities.MaintenanceRecord.delete(mr.id);

    // Machine Issues (not linked to control point)
    const mIssues = await client.entities.Issue.filter({ machine_id: machineId });
    for (const i of mIssues) await client.entities.Issue.delete(i.id);

    // Vibration/Thermo stuff could be here too, but ControlPoint is most critical for orphans

    // 3. Delete Machine itself
    await client.entities.Machine.delete(machineId);
    log.push(`Deleted machine ${machineId}.`);
}

async function deleteLineCascade(client, lineId, log) {
    log.push(`Deleting line ${lineId}...`);
    
    // 1. Find all machines
    const machines = await client.entities.Machine.filter({ line_id: lineId });
    
    // 2. Delete each machine (cascading)
    for (const machine of machines) {
        await deleteMachineCascade(client, machine.id, log);
    }

    // 3. Delete Line
    await client.entities.Line.delete(lineId);
    log.push(`Deleted line ${lineId}.`);
}

Deno.serve(handler);