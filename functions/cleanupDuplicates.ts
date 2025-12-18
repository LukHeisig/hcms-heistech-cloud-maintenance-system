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

        // 2. Auto-cleanup remaining duplicates
        // Fetch necessary data
        const [allMachines, allLines, allControlPoints] = await Promise.all([
            base44.asServiceRole.entities.Machine.list(),
            base44.asServiceRole.entities.Line.list(),
            base44.asServiceRole.entities.ControlPoint.list() // Used for scoring
        ]);

        // Map Line ID -> Line Name
        const lineMap = new Map();
        allLines.forEach(l => lineMap.set(l.id, l.name));

        // Count Control Points per Machine
        const machineCpCounts = new Map();
        allControlPoints.forEach(cp => {
            const count = machineCpCounts.get(cp.machine_id) || 0;
            machineCpCounts.set(cp.machine_id, count + 1);
        });

        // Group Machines by "MachineName:::LineName"
        const groups = new Map();
        
        for (const m of allMachines) {
            // Skip already deleted specific IDs
            if (duplicateIds.includes(m.id)) continue;

            const lineName = lineMap.get(m.line_id) || "UnknownLine";
            const key = `${m.name}:::${lineName}`;
            
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(m);
        }

        // Process Groups
        for (const [key, machines] of groups.entries()) {
            if (machines.length > 1) {
                // Determine Winner
                // Sort by: 1. CP Count (Desc), 2. Created Date (Asc - oldest first)
                machines.sort((a, b) => {
                    const countA = machineCpCounts.get(a.id) || 0;
                    const countB = machineCpCounts.get(b.id) || 0;
                    if (countA !== countB) return countB - countA; // More data wins
                    
                    const dateA = new Date(a.created_date).getTime();
                    const dateB = new Date(b.created_date).getTime();
                    return dateA - dateB; // Older wins
                });

                // First is Winner, rest are Losers
                const winner = machines[0];
                const losers = machines.slice(1);

                for (const loser of losers) {
                    try {
                        // Delete related ControlPoints
                        // We can filter from allControlPoints in memory to save API calls for list, 
                        // but we need to delete them one by one or by filter query
                        const loserPoints = allControlPoints.filter(cp => cp.machine_id === loser.id);
                        for (const cp of loserPoints) {
                            await base44.asServiceRole.entities.ControlPoint.delete(cp.id);
                            results.deletedControlPoints.push(cp.id);
                        }

                        // Delete Machine
                        await base44.asServiceRole.entities.Machine.delete(loser.id);
                        results.deletedMachines.push(loser.id);
                    } catch (err) {
                        results.errors.push(`Failed to auto-cleanup machine ${loser.id} (${loser.name}): ${err.message}`);
                    }
                }
            }
        }

        return Response.json(results);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});