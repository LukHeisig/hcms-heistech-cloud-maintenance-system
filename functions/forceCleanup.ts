import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Use service role for deletion to bypass potential permission issues
        const idsToDelete = [
            "68fa6c5983de8c56dad4b384",
            "68fa0c818600072e433422a0",
            "68fa6c5994995ee0e68b620b",
            "68fa0c81f95d3feb7340ac77",
            "68fa6c590afe035d36cb5a09",
            "68fa0c81ff2805534b633106",
            "69283939894ebb5e2b507686",
            "691dcefb6429b8561f1a30f9",
            "691da07ec314339d90453117"
        ];

        const results = {
            deleted: [],
            errors: []
        };

        for (const id of idsToDelete) {
            try {
                // Delete related control points first
                const controlPoints = await base44.asServiceRole.entities.ControlPoint.filter({ machine_id: id });
                for (const cp of controlPoints) {
                    await base44.asServiceRole.entities.ControlPoint.delete(cp.id);
                }
                
                // Delete the machine
                await base44.asServiceRole.entities.Machine.delete(id);
                results.deleted.push(id);
            } catch (error) {
                results.errors.push({ id, error: error.message });
            }
        }

        return Response.json(results);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});