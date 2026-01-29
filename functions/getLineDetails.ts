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

        const { lineId } = await req.json();

        if (!lineId) {
             return Response.json({ error: 'Missing lineId' }, { status: 400 });
        }

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parallelize initial fetches
        const [lines, machines, checkSections, checkRecords] = await Promise.all([
            base44.entities.Line.filter({ id: lineId }),
            base44.entities.Machine.filter({ line_id: lineId }, "order_index"),
            base44.entities.LineCheckSection.filter({ line_id: lineId }, "order_index"),
            base44.entities.LineCheckRecord.filter({ line_id: lineId }, "-created_date", 100)
        ]);

        const line = lines[0];
        if (!line) {
             return Response.json({ error: 'Line not found' }, { status: 404 });
        }

        const machineIds = machines.map(m => m.id);

        // Fetch control points for machines
        const controlPointsPromises = machines.map(m => base44.entities.ControlPoint.filter({ machine_id: m.id }));
        const controlPointsArrays = await Promise.all(controlPointsPromises);
        const controlPoints = controlPointsArrays.flat();
        const controlPointIds = controlPoints.map(cp => cp.id);

        // Fetch check points for sections
        const checkPointsPromises = checkSections.map(s => base44.entities.LineCheckPoint.filter({ section_id: s.id }, "order_index"));
        const checkPointsArrays = await Promise.all(checkPointsPromises);
        const checkPoints = checkPointsArrays.flat();

        // Fetch global data needed for filtering (optimized)
        // We fetch reported issues
        const issues = await base44.entities.Issue.filter({ status: 'reported' });
        
        // Fetch recent records - limit to recent 2000 to be safe
        const [records, maintenance, planned, responsibilities] = await Promise.all([
            base44.entities.ControlRecord.list("-performed_at", 2000), 
            base44.entities.MaintenanceRecord.list("-performed_at", 500),
            base44.entities.PlannedMaintenance.list(),
            base44.entities.MachineResponsibility.list()
        ]);

        // Filter relevant data
        const lineIssues = issues.filter(i => 
            (i.machine_id && machineIds.includes(i.machine_id)) || 
            (i.control_point_id && controlPointIds.includes(i.control_point_id))
        );

        const lineRecords = records.filter(r => controlPointIds.includes(r.control_point_id));
        const lineMaintenance = maintenance.filter(m => machineIds.includes(m.machine_id));
        const linePlanned = planned.filter(p => machineIds.includes(p.machine_id));
        const lineResponsibilities = responsibilities.filter(r => machineIds.includes(r.machine_id));

        return Response.json({
            line,
            company: null, // Fetched in frontend or we can fetch it here if needed
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