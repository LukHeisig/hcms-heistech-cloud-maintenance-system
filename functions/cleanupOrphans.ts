import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || (user.user_type !== 'admin' && user.user_type !== 'superAdmin')) {
             return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Target specific orphaned company ID
        const targetCompanyId = "68fa6d6924a6ba40081a9bfe";
        
        const log = [];
        log.push(`Starting cleanup for company_id: ${targetCompanyId}`);
        
        // 1. Get Lines
        const lines = await base44.asServiceRole.entities.Line.filter({ company_id: targetCompanyId });
        log.push(`Found ${lines.length} lines associated with the missing company`);
        
        for (const line of lines) {
             // 2. Get Machines
             const machines = await base44.asServiceRole.entities.Machine.filter({ line_id: line.id });
             log.push(`Line ${line.name} (${line.id}): Found ${machines.length} machines`);
             
             for (const machine of machines) {
                 // 3. Delete PlannedMaintenance
                 const pms = await base44.asServiceRole.entities.PlannedMaintenance.filter({ machine_id: machine.id });
                 for (const pm of pms) await base44.asServiceRole.entities.PlannedMaintenance.delete(pm.id);
                 log.push(`  - Deleted ${pms.length} PlannedMaintenance records for machine ${machine.name}`);
                 
                 // 4. Delete MaintenanceRecord
                 const mrs = await base44.asServiceRole.entities.MaintenanceRecord.filter({ machine_id: machine.id });
                 for (const mr of mrs) await base44.asServiceRole.entities.MaintenanceRecord.delete(mr.id);
                 log.push(`  - Deleted ${mrs.length} MaintenanceRecords for machine ${machine.name}`);

                 // 5. Delete Issues
                 const issues = await base44.asServiceRole.entities.Issue.filter({ machine_id: machine.id });
                 for (const issue of issues) await base44.asServiceRole.entities.Issue.delete(issue.id);
                 log.push(`  - Deleted ${issues.length} Issues for machine ${machine.name}`);
                 
                 // 6. Delete Machine
                 await base44.asServiceRole.entities.Machine.delete(machine.id);
                 log.push(`  - Deleted Machine: ${machine.name}`);
             }
             
             // 7. Delete Line
             await base44.asServiceRole.entities.Line.delete(line.id);
             log.push(`Deleted Line: ${line.name}`);
        }
        
        log.push("Cleanup completed successfully");
        return Response.json({ success: true, log });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});