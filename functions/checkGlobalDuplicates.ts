import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch all data using service role (bypasses permissions)
        const companies = await base44.asServiceRole.entities.Company.list(null, 1000);
        const lines = await base44.asServiceRole.entities.Line.list(null, 5000);
        const machines = await base44.asServiceRole.entities.Machine.list(null, 10000);
        const points = await base44.asServiceRole.entities.ControlPoint.list(null, 20000);

        const report = {
            scanned: {
                companies: companies.length,
                lines: lines.length,
                machines: machines.length,
                points: points.length
            },
            duplicates: []
        };

        // Helper to identify duplicates
        const findDuplicates = (items, scopeIdField, nameField, type) => {
            const map = {};
            const dups = [];
            
            for (const item of items) {
                if (!item[scopeIdField]) continue;
                
                // Key is ScopeID + Name (case insensitive trimmed)
                const nameKey = (item[nameField] || "").trim().toLowerCase();
                if (!nameKey) continue;

                const key = `${item[scopeIdField]}_${nameKey}`;
                
                if (map[key]) {
                    dups.push({
                        type,
                        id: item.id,
                        name: item[nameField],
                        scopeId: item[scopeIdField],
                        originalId: map[key].id,
                        originalName: map[key][nameField]
                    });
                } else {
                    map[key] = item;
                }
            }
            return dups;
        };

        // Check Duplicates
        const dupLines = findDuplicates(lines, 'company_id', 'name', 'Line');
        const dupMachines = findDuplicates(machines, 'line_id', 'name', 'Machine');
        const dupPoints = findDuplicates(points, 'machine_id', 'name', 'ControlPoint');

        // Enrich with Company Info
        const enrich = (dups) => {
            return dups.map(d => {
                let companyName = "Unknown";
                let context = "";

                if (d.type === 'Line') {
                    const c = companies.find(x => x.id === d.scopeId);
                    if (c) companyName = c.name;
                    context = `Company: ${companyName}`;
                } else if (d.type === 'Machine') {
                    const l = lines.find(x => x.id === d.scopeId);
                    if (l) {
                        const c = companies.find(x => x.id === l.company_id);
                        if (c) companyName = c.name;
                        context = `Line: ${l.name}`;
                    }
                } else if (d.type === 'ControlPoint') {
                    const m = machines.find(x => x.id === d.scopeId);
                    if (m) {
                        const l = lines.find(x => x.id === m.line_id);
                        if (l) {
                            const c = companies.find(x => x.id === l.company_id);
                            if (c) companyName = c.name;
                            context = `Machine: ${m.name} (Line: ${l.name})`;
                        }
                    }
                }
                
                return {
                    companyName,
                    type: d.type,
                    name: d.name,
                    context,
                    id: d.id
                };
            });
        };

        report.duplicates = [
            ...enrich(dupLines),
            ...enrich(dupMachines),
            ...enrich(dupPoints)
        ];

        // Also return list of companies checked for verification
        report.companiesChecked = companies.map(c => c.name);

        return Response.json(report);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});