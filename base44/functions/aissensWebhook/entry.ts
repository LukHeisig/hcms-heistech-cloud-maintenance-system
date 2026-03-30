import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// AISSENS Report Type mapping
const REPORT_TYPES = {
  0: "Raw Data",
  1: "FFT",
  2: "Feature",
  3: "Battery",
  4: "Hibernate/Wakeup",
  5: "Real Time Raw Data",
  6: "Real Time FFT",
  71: "Raw Data + FFT",
  72: "Raw Data + FFT (2)",
  81: "Real Time Raw+FFT",
  82: "Real Time Raw+FFT (2)",
  9: "OA Only",
  10: "Real Time OA Only",
  11: "Ask Command",
  12: "Heart Beat"
};

// Parse battery voltage from ADC value
function adcToVoltage(adc) {
  return (adc - 1400) * 0.001547 + 2.7;
}

// Parse temperature from raw 2-byte big-endian value
function parseTemperature(rawValue) {
  return rawValue / 256.0 + 28;
}

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Token validation disabled - accept all requests
  // To re-enable, set VIBRATION_API_TOKEN secret and send it as x-webhook-token header

  const base44 = createClientFromRequest(req);

  const body = await req.json();

  // Expected payload: { sensor_id: string, report_type: number, data: object, raw_hex?: string }
  const { sensor_id, report_type, data, raw_hex } = body;

  if (!sensor_id) {
    return Response.json({ error: "Missing sensor_id" }, { status: 400 });
  }

  const reportTypeName = REPORT_TYPES[report_type] ?? `Unknown (${report_type})`;
  const now = new Date().toISOString();

  // Extract metadata from parsed data
  let batteryLevel = data?.battery_level ?? null;
  let batteryVoltage = null;
  let temperature = null;
  let signalStrength = null;

  if (data?.last_adc != null) {
    batteryVoltage = Math.round(adcToVoltage(data.last_adc) * 1000) / 1000;
  }
  if (data?.average_adc != null && batteryVoltage == null) {
    batteryVoltage = Math.round(adcToVoltage(data.average_adc) * 1000) / 1000;
  }
  if (data?.temp != null) {
    temperature = Math.round(parseTemperature(data.temp) * 100) / 100;
  }
  if (data?.signal_strength != null) {
    signalStrength = data.signal_strength;
  }

  // Find or create sensor record
  const existing = await base44.asServiceRole.entities.AissensSensor.filter({ sensor_id });

  let sensorRecord;
  if (existing.length > 0) {
    sensorRecord = existing[0];
    const updateData = {
      last_seen: now,
      last_report_type: report_type ?? null,
      messages_total: (sensorRecord.messages_total || 0) + 1,
    };
    if (batteryLevel !== null) updateData.last_battery_level = batteryLevel;
    if (batteryVoltage !== null) updateData.last_battery_voltage = batteryVoltage;
    if (temperature !== null) updateData.last_temperature = temperature;
    if (signalStrength !== null) updateData.last_signal_strength = signalStrength;
    if (data?.firmware_version) updateData.firmware_version = data.firmware_version;
    if (data?.model) updateData.model = data.model;
    if (data?.mac_address) updateData.mac_address = data.mac_address;

    await base44.asServiceRole.entities.AissensSensor.update(sensorRecord.id, updateData);
  } else {
    // Auto-register new sensor
    sensorRecord = await base44.asServiceRole.entities.AissensSensor.create({
      sensor_id,
      name: sensor_id,
      last_seen: now,
      last_report_type: report_type ?? null,
      last_battery_level: batteryLevel,
      last_battery_voltage: batteryVoltage,
      last_temperature: temperature,
      last_signal_strength: signalStrength,
      firmware_version: data?.firmware_version || null,
      model: data?.model || null,
      mac_address: data?.mac_address || null,
      messages_total: 1,
      is_active: true,
    });
  }

  // Save raw message to SystemLog for traceability
  await base44.asServiceRole.entities.SystemLog.create({
    level: "info",
    message: `AISSENS [${sensor_id}] report type ${report_type} (${reportTypeName})`,
    details: JSON.stringify({ sensor_id, report_type, report_type_name: reportTypeName, data: data || {}, raw_hex: raw_hex || null }),
    source: "aissensWebhook",
  });

  return Response.json({
    ok: true,
    sensor_id,
    report_type,
    report_type_name: reportTypeName,
    sensor_record_id: sensorRecord.id,
    auto_registered: existing.length === 0,
  });
});