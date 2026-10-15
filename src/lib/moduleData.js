import { base44 } from "@/api/base44Client";

// Data modulů se čtou a zapisují výhradně přes serverovou bránu (kontrola modulu a podniku).
const call = async (payload) => (await base44.functions.invoke("readModuleData", payload)).data;

// Skalární pole měření (bez objemných surových signálů raw_*_json)
const SENSOR_DATA_FIELDS = ["sensor_id", "report_type", "timestamp_unix", "recorded_at", "dsp_version", "temperature",
  "battery_level", "battery_voltage", "rssi", "interval", "oa_x", "oa_y", "oa_z", "oa_acc_z", "has_fft", "has_raw",
  "num_samples", "rms_z_g", "peak_z_g", "vel_rms_x_mm_s", "vel_rms_y_mm_s", "vel_rms_z_mm_s", "env_rms_z"];

export const moduleData = {
  filter: async (entity, query = {}, sort = null, limit = 100, light = false) =>
    (await call({ entity, op: "filter", query, sort, limit, light })).items,
  list: async (entity, sort = null, limit = 100) =>
    (await call({ entity, op: "filter", query: {}, sort, limit })).items,
  // Poslední záznam s předpočítanými RMS pro každý senzor – jedno volání, bez surových dat
  latestSensorData: async (sensorIds, fields = SENSOR_DATA_FIELDS) =>
    sensorIds.length === 0 ? {} : (await call({
      entity: "SensorData", op: "latest", keys: sensorIds, fields: fields.includes("id") ? fields : ["id", "created_date", ...fields],
      query: { has_fft: true, vel_rms_x_mm_s: { $ne: null } }, sort: "-created_date",
    })).map,
  // Rychlá varianta: poslední trendový bod (malé záznamy) místo plného měření
  latestTrendPoints: async (sensorIds, fields) =>
    sensorIds.length === 0 ? {} : (await call({
      entity: "SensorTrendPoint", op: "latest", keys: sensorIds, fields, sort: "-created_date",
    })).map,
  create: async (entity, data) => (await call({ entity, op: "create", data })).record,
  update: async (entity, id, data) => (await call({ entity, op: "update", id, data })).record,
};