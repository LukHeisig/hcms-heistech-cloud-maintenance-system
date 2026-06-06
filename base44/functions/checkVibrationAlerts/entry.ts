import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Tato funkce je volána z automatizace — použijeme service role
    // Načteme všechna přiřazení senzorů
    const assignments = await base44.asServiceRole.entities.VibrationSensorAssignment.list(null, 2000);
    if (!assignments.length) return Response.json({ checked: 0, created: 0 });

    // Načteme všechny normy
    const standards = await base44.asServiceRole.entities.VibrationStandard.list(null, 500);
    const standardsById = Object.fromEntries(standards.map(s => [s.id, s]));

    // Načteme stroje
    const machines = await base44.asServiceRole.entities.Machine.list(null, 2000);
    const machinesById = Object.fromEntries(machines.map(m => [m.id, m]));

    // Načteme schémata vibrací
    const schemas = await base44.asServiceRole.entities.VibrationSchema.list(null, 500);
    const schemasById = Object.fromEntries(schemas.map(s => [s.id, s]));

    // Načteme aktivní alarmy pro deduplikaci (sensor_id + metric_key + status=active)
    const activeAlerts = await base44.asServiceRole.entities.VibrationAlert.filter({ status: "active" }, null, 5000);
    // Klíč pro kontrolu duplicity: sensor_id|metric_key
    const activeAlertKeys = new Set(activeAlerts.map(a => `${a.sensor_id}|${a.metric_key}`));

    let createdCount = 0;
    const now = Date.now();

    // Pro každé přiřazení zkontrolujeme nejnovější data
    for (const assignment of assignments) {
      if (!assignment.sensor_id) continue;

      const machine = machinesById[assignment.machine_id];
      if (!machine) continue;

      // Načteme poslední DSP záznam (má vyplněné RMS hodnoty)
      const recentData = await base44.asServiceRole.entities.SensorData.filter(
        { sensor_id: assignment.sensor_id, has_fft: true },
        "-created_date",
        5
      );
      const latest = recentData.find(r => r.vel_rms_x_mm_s != null) ?? null;

      // Načteme senzor pro teplotu a baterii
      const sensorRecords = await base44.asServiceRole.entities.AissensSensor.filter(
        { sensor_id: assignment.sensor_id },
        null, 1
      );
      const sensor = sensorRecords[0] ?? null;

      // Určit label měřicího místa ze schématu
      let measurementPoint = `Bod ${assignment.schema_row_index + 1}`;
      const schema = machine.vibration_schema_id ? schemasById[machine.vibration_schema_id] : null;
      if (schema?.rows_definition) {
        try {
          const rows = JSON.parse(schema.rows_definition);
          const row = rows[assignment.schema_row_index];
          if (row) measurementPoint = row.label || row.name || measurementPoint;
        } catch (_) {}
      }

      const velStd = standardsById[assignment.vel_standard_id];
      const accStd = standardsById[assignment.acc_standard_id];
      const tempStd = standardsById[assignment.temp_standard_id];

      const createAlert = async (alertDef) => {
        const key = `${assignment.sensor_id}|${alertDef.metric_key}`;
        if (activeAlertKeys.has(key)) return; // Deduplication — aktivní alarm stejného typu již existuje
        activeAlertKeys.add(key); // optimistická přidání pro tento run

        await base44.asServiceRole.entities.VibrationAlert.create({
          sensor_id: assignment.sensor_id,
          machine_id: assignment.machine_id,
          machine_name: machine.name,
          measurement_point: measurementPoint,
          alert_type: alertDef.alert_type,
          metric_key: alertDef.metric_key,
          metric_label: alertDef.metric_label,
          metric_unit: alertDef.metric_unit,
          value: alertDef.value,
          limit_ab: alertDef.limit_ab ?? null,
          limit_bc: alertDef.limit_bc ?? null,
          limit_cd: alertDef.limit_cd ?? null,
          severity: alertDef.severity,
          status: "active",
          sensor_data_id: alertDef.sensor_data_id ?? null,
        });
        createdCount++;
      };

      const getSeverity = (val, ab, bc, cd) => {
        if (val == null || ab == null) return null;
        if (val >= cd && cd != null) return "D";
        if (val >= bc && bc != null) return "C";
        if (val >= ab) return "B";
        return null;
      };

      // Kontrola rychlosti vibrací (velocity)
      if (latest && velStd) {
        const velMetrics = [
          { key: "vel_rms_x_mm_s", label: "Vel X", value: latest.vel_rms_x_mm_s },
          { key: "vel_rms_y_mm_s", label: "Vel Y", value: latest.vel_rms_y_mm_s },
          { key: "vel_rms_z_mm_s", label: "Vel Z", value: latest.vel_rms_z_mm_s },
        ];
        for (const m of velMetrics) {
          const severity = getSeverity(m.value, velStd.limit_ab, velStd.limit_bc, velStd.limit_cd);
          if (severity) {
            await createAlert({
              alert_type: "velocity",
              metric_key: m.key,
              metric_label: m.label,
              metric_unit: "mm/s",
              value: m.value,
              limit_ab: velStd.limit_ab,
              limit_bc: velStd.limit_bc,
              limit_cd: velStd.limit_cd,
              severity,
              sensor_data_id: latest.id,
            });
          }
        }
      }

      // Kontrola zrychlení (acceleration)
      if (latest && accStd) {
        const accVal = latest.rms_z_g ?? latest.oa_acc_z;
        const accSeverity = getSeverity(accVal, accStd.acc_limit_ab, accStd.acc_limit_bc, accStd.acc_limit_cd);
        if (accSeverity) {
          await createAlert({
            alert_type: "acceleration",
            metric_key: "rms_z_g",
            metric_label: "Acc Z",
            metric_unit: "g",
            value: accVal,
            limit_ab: accStd.acc_limit_ab,
            limit_bc: accStd.acc_limit_bc,
            limit_cd: accStd.acc_limit_cd,
            severity: accSeverity,
            sensor_data_id: latest.id,
          });
        }

        // Kontrola obálky (envelope)
        const envSeverity = getSeverity(latest.env_rms_z, accStd.acc_limit_ab, accStd.acc_limit_bc, accStd.acc_limit_cd);
        if (envSeverity && latest.env_rms_z != null) {
          await createAlert({
            alert_type: "envelope",
            metric_key: "env_rms_z",
            metric_label: "Obálka Z",
            metric_unit: "g",
            value: latest.env_rms_z,
            limit_ab: accStd.acc_limit_ab,
            limit_bc: accStd.acc_limit_bc,
            limit_cd: accStd.acc_limit_cd,
            severity: envSeverity,
            sensor_data_id: latest.id,
          });
        }
      }

      // Kontrola teploty
      if (sensor && tempStd) {
        const temp = sensor.last_temperature;
        const tempSeverity = getSeverity(temp, tempStd.temp_limit_ab, tempStd.temp_limit_bc, tempStd.temp_limit_cd);
        if (tempSeverity) {
          await createAlert({
            alert_type: "temperature",
            metric_key: "temperature",
            metric_label: "Teplota",
            metric_unit: "°C",
            value: temp,
            limit_ab: tempStd.temp_limit_ab,
            limit_bc: tempStd.temp_limit_bc,
            limit_cd: tempStd.temp_limit_cd,
            severity: tempSeverity,
          });
        }
      }

      // Kontrola baterie (level <= 1 = alarm)
      if (sensor && sensor.last_battery_level != null && sensor.last_battery_level <= 1) {
        const key = `${assignment.sensor_id}|battery_level`;
        if (!activeAlertKeys.has(key)) {
          activeAlertKeys.add(key);
          await base44.asServiceRole.entities.VibrationAlert.create({
            sensor_id: assignment.sensor_id,
            machine_id: assignment.machine_id,
            machine_name: machine.name,
            measurement_point: measurementPoint,
            alert_type: "battery",
            metric_key: "battery_level",
            metric_label: "Baterie",
            metric_unit: "",
            value: sensor.last_battery_level,
            severity: sensor.last_battery_level === 0 ? "D" : "C",
            status: "active",
          });
          createdCount++;
        }
      }
    }

    return Response.json({ checked: assignments.length, created: createdCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});