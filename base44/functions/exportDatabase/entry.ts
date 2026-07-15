import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import JSZip from "npm:jszip@3.10.1";

function toCSV(items) {
    if (!items || items.length === 0) return "";
    
    // Collect all unique keys from all items to ensure columns are consistent
    const headers = new Set();
    items.forEach(item => Object.keys(item).forEach(k => headers.add(k)));
    const headerArray = Array.from(headers);
    
    const csvRows = [
        headerArray.join(',')
    ];

    for (const item of items) {
        const values = headerArray.map(header => {
            let val = item[header];
            
            if (val === null || val === undefined) {
                val = "";
            } else if (typeof val === 'object') {
                val = JSON.stringify(val).replace(/"/g, '""'); // Escape double quotes for JSON strings
            } else {
                val = String(val).replace(/"/g, '""'); // Escape double quotes
            }
            
            // Wrap in quotes if contains comma, quote or newline
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                return `"${val}"`;
            }
            return val;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || (user.user_type !== 'admin' && user.user_type !== 'superAdmin')) {
             return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const zip = new JSZip();
        
        // List of entities to export
        const entities = [
            "Company", "Line", "Machine", "ControlPoint", 
            "PlannedMaintenance", "MaintenanceRecord", "Issue", "ControlRecord",
            "Note", "Documentation", "SparePart", "VibrationMeasurement",
            "MachineResponsibility", "AuditLog", "LineCheckSection", 
            "LineCheckPoint", "LineCheckRecord", "VibrationStandard", 
            "VibrationSchema", "VibrationJob", "User",
            // Online vibrace (MQTT senzory)
            "AissensSensor", "VibrationSensorAssignment",
            "SensorTrendPoint", "VibrationAlert", "VibrationAlertRecipient",
            "BearingType"
        ];

        // Fetch and add each entity to zip
        for (const entityName of entities) {
            try {
                // Use service role to get ALL data
                // Note: SDK might not have 'asServiceRole' property on base44 object if not using specific version/setup, 
                // but instructions say base44.asServiceRole is available.
                // If strictly typing, might need to check. Assuming it works as per guidelines.
                const data = await base44.asServiceRole.entities[entityName].list(null, 10000); // Fetch up to 10k records
                const csv = toCSV(data);
                zip.file(`${entityName}.csv`, csv);
            } catch (e) {
                console.error(`Failed to export ${entityName}:`, e);
                zip.file(`${entityName}_ERROR.txt`, `Error exporting: ${e.message}`);
            }
        }

        const content = await zip.generateAsync({ type: "base64" });

        return Response.json({ 
            success: true,
            base64: content
        });

    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});