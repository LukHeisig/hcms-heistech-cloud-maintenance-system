import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        // 1. Ověření metody
        if (req.method !== "POST") {
            return Response.json({ error: "Method not allowed" }, { status: 405 });
        }

        // 2. Ověření API klíče (Bearer token)
        const authHeader = req.headers.get("Authorization");
        const expectedToken = Deno.env.get("VIBRATION_API_TOKEN");
        
        // Pokud není nastavený secret na serveru, logujeme warning, ale odmítneme
        if (!expectedToken) {
            console.error("Missing VIBRATION_API_TOKEN env var");
            return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 3. Parse payloadu
        const payload = await req.json();
        const { device_id, timestamp, values } = payload;

        if (!device_id || !values) {
            return Response.json({ error: "Invalid payload" }, { status: 400 });
        }

        // 4. Inicializace Base44 klienta
        const base44 = createClientFromRequest(req);

        // 5. Najít stroj podle sensor_id (používáme service role, protože webhook nemá uživatelskou session)
        const machines = await base44.asServiceRole.entities.Machine.filter({ sensor_id: device_id });
        
        if (machines.length === 0) {
            console.warn(`No machine found for sensor_id: ${device_id}`);
            return Response.json({ 
                status: "ignored", 
                message: `No machine linked to device_id ${device_id}` 
            }, { status: 200 });
        }

        const machine = machines[0];

        // 6. Vytvořit záznam měření
        // Spočítáme max RMS pro v_rms a a_rms jako základní hodnotu pro grafy
        const maxVel = Math.max(
            values.vel_rms_x || 0, 
            values.vel_rms_y || 0, 
            values.vel_rms_z || 0
        );
        
        const maxAcc = Math.max(
            values.acc_rms_x || 0, 
            values.acc_rms_y || 0, 
            values.acc_rms_z || 0
        );

        // Automatické hodnocení stavu (zjednodušené - ideálně podle normy stroje)
        // Zde jen placeholder logika, v reálu by se načetla VibrationStandard
        let condition = "good";
        // Příklad: pokud rychlost > 7 mm/s -> warning (obecná ISO norma pro velké stroje)
        if (maxVel > 11) condition = "unacceptable";
        else if (maxVel > 7) condition = "unsatisfactory";
        else if (maxVel > 3) condition = "acceptable";

        await base44.asServiceRole.entities.VibrationMeasurement.create({
            machine_id: machine.id,
            measurement_type: "online",
            measurement_date: timestamp || new Date().toISOString(),
            measuring_point: "Online Senzor", // Defaultní název bodu
            v_rms: maxVel,
            a_rms: maxAcc,
            temperature: values.temp,
            
            // Detailní osy
            vel_rms_x: values.vel_rms_x,
            vel_rms_y: values.vel_rms_y,
            vel_rms_z: values.vel_rms_z,
            acc_rms_x: values.acc_rms_x,
            acc_rms_y: values.acc_rms_y,
            acc_rms_z: values.acc_rms_z,
            
            condition_rating: condition,
            measured_by: "System (AISSENS)",
            findings: `Automatické měření ze senzoru ${device_id}`
        });

        return Response.json({ status: "success", machine_id: machine.id });

    } catch (error) {
        console.error("Error processing webhook:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});