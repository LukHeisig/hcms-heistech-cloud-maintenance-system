import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    // Funkce dočasně zakázána (spotřebovává integrační kredity)
    return Response.json({ error: 'Tato funkce je dočasně zakázána.' }, { status: 503 });

    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
             return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { machine_id } = await req.json();
        if (!machine_id) return Response.json({ error: 'Missing machine_id' }, { status: 400 });

        // 1. Fetch Machine Context
        const machine = (await base44.entities.Machine.filter({ id: machine_id }))[0];
        if (!machine) return Response.json({ error: 'Machine not found' }, { status: 404 });

        // 2. Fetch Historical Data
        const [maintenanceRecords, issues, vibrationMeasurements] = await Promise.all([
            base44.entities.MaintenanceRecord.filter({ machine_id }, "-performed_at", 15),
            base44.entities.Issue.filter({ machine_id }, "-created_date", 15),
            base44.entities.VibrationMeasurement.filter({ machine_id }, "-measurement_date", 10)
        ]);

        // 3. Prepare Data Summary for LLM
        const dataContext = JSON.stringify({
            machine: {
                name: machine.name,
                type: machine.machine_type,
                description: machine.description
            },
            recent_maintenance: maintenanceRecords.map(r => ({
                date: r.performed_at,
                type: r.maintenance_type,
                description: r.description,
                technician: r.technician
            })),
            recent_issues: issues.map(i => ({
                date: i.created_date,
                description: i.description,
                status: i.status
            })),
            vibration_measurements: vibrationMeasurements.map(v => ({
                date: v.measurement_date,
                point: v.measuring_point,
                v_rms: v.v_rms,
                a_rms: v.a_rms,
                condition: v.condition_rating
            }))
        });

        // 4. Invoke LLM
        const prompt = `
        Jsi expert na prediktivní údržbu průmyslových strojů. Analyzuj následující data o stroji a předpověz jeho zdravotní stav.
        
        Data o stroji:
        ${dataContext}
        
        Úkol:
        1. Odhadni "health_score" (0-100, kde 100 je perfektní).
        2. Odhadni pravděpodobnost selhání v následujících 30 dnech ("failure_probability" 0-100%).
        3. Identifikuj potenciální problémy ("predicted_issues").
        4. Navrhni konkrétní preventivní kroky ("recommendations").
        5. Vysvětli své uvažování na základě dat ("reasoning"). Buď stručný a technický.

        Výstup musí být JSON objekt.
        `;

        const analysisResult = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    health_score: { type: "number" },
                    failure_probability: { type: "number" },
                    predicted_issues: { type: "string" },
                    recommendations: { type: "string" },
                    reasoning: { type: "string" }
                },
                required: ["health_score", "failure_probability", "predicted_issues", "recommendations", "reasoning"]
            }
        });

        // 5. Save Analysis
        const savedAnalysis = await base44.entities.PredictiveAnalysis.create({
            machine_id: machine.id,
            analysis_date: new Date().toISOString(),
            health_score: analysisResult.health_score,
            failure_probability: analysisResult.failure_probability,
            predicted_issues: analysisResult.predicted_issues,
            recommendations: analysisResult.recommendations,
            reasoning: analysisResult.reasoning,
            status: "active"
        });

        return Response.json(savedAnalysis);

    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});