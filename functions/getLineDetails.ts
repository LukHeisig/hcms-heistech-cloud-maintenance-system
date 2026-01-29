import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            });
        }

        let lineId;
        try {
            const body = await req.json();
            lineId = body.lineId;
        } catch (e) {
            return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        if (!lineId) {
             return Response.json({ error: 'Missing lineId' }, { status: 400 });
        }

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Sequential execution to avoid 429 Rate Limit Exceeded
        
        // 1. Fetch Line
        const lines = await base44.entities.Line.filter({ id: lineId });
        const line = lines[0];
        
        if (!line) {
             return Response.json({ error: 'Line not found' }, { status: 404 });
        }

        // 2. Fetch Machines
        const machines = await base44.entities.Machine.filter({ line_id: lineId }, "order_index");
        const machineIds = machines.map(m => m.id);

        // 3. Fetch Check Sections
        const checkSections = await base44.entities.LineCheckSection.filter({ line_id: lineId }, "order_index");
        
        // 4. Fetch Check Records (limit 100)
        const checkRecords = await base44.entities.LineCheckRecord.filter({ line_id: lineId }, "-created_date", 100);

        // 5. Fetch Check Points
        // We have sections, we need check points for them. 
        // We can fetch all check points for the line if we had line_id on them, but we don't.
        // We have to iterate sections. 
        // To allow some parallelism but not too much, we'll do batches or sequential.
        // Sequential is safest.
        let checkPoints = [];
        for (const section of checkSections) {
             const points = await base44.entities.LineCheckPoint.filter({ section_id: section.id }, "order_index");
             checkPoints = [...checkPoints, ...points];
        }

        // 6. Fetch Control Points
        // Strategy: Fetch ALL control points (limit 2000) and filter in memory.
        // This is ONE call vs N calls (where N = number of machines).
        // Much safer for rate limits.
        const allControlPoints = await base44.entities.ControlPoint.list(null, 2000);
        const controlPoints = allControlPoints.filter(cp => machineIds.includes(cp.machine_id));
        const controlPointIds = controlPoints.map(cp => cp.id);

        // 7. Fetch Issues
        // Fetch reported issues (limit 1000) and filter in memory
        const allIssues = await base44.entities.Issue.filter({ status: 'reported' }, null, 1000);
        const lineIssues = allIssues.filter(i => 
            (i.machine_id && machineIds.includes(i.machine_id)) || 
            (i.control_point_id && controlPointIds.includes(i.control_point_id))
        );

        // 8. Fetch Records
        // Fetch recent records (limit 1000) and filter
        const allRecords = await base44.entities.ControlRecord.list("-performed_at", 1000);
        const lineRecords = allRecords.filter(r => controlPointIds.includes(r.control_point_id));

        // 9. Fetch Maintenance
        const allMaintenance = await base44.entities.MaintenanceRecord.list("-performed_at", 500);
        const lineMaintenance = allMaintenance.filter(m => machineIds.includes(m.machine_id));

        // 10. Fetch Planned Maintenance
        const allPlanned = await base44.entities.PlannedMaintenance.list();
        const linePlanned = allPlanned.filter(p => machineIds.includes(p.machine_id));

        // 11. Fetch Responsibilities
        const allResponsibilities = await base44.entities.MachineResponsibility.list();
        const lineResponsibilities = allResponsibilities.filter(r => machineIds.includes(r.machine_id));

        return Response.json({
            line,
            company: null,
            machines,
            checkSections,
            checkRecords,
            checkPoints,
            controlPoints,
            records: lineRecords,
            issues: lineIssues,
            maintenanceRecords: lineMaintenance,
            plannedMaintenance: linePlanned,
            responsibilities: lineResponsibilities
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});