import React from "react";
import { BatteryLow, BatteryMedium, BatteryFull, Thermometer, Signal } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
export default function ServiceBoardSensor({ sensor, place, data }) {
  const measuredAt = data?.created_date || data?.recorded_at;
  const level = sensor.last_battery_level;
  const online = !!sensor.last_seen && Date.now() - new Date(sensor.last_seen).getTime() <= 12 * 3600 * 1000;
  const Icon = level <= 1 ? BatteryLow : level <= 2 ? BatteryMedium : BatteryFull;
  return <div className="sb-sensor-row">
    <span className="sb-sensor-id">{sensor.sensor_id}{place && <><br /><small style={{ color: "var(--sb-muted)", fontWeight: 500 }}>{place}</small></>}</span>
    <span className="sb-seen" title={sensor.last_seen || undefined}>{sensor.last_seen ? <>{formatDistanceToNow(new Date(sensor.last_seen), { addSuffix: true, locale: cs })}<br />{format(new Date(sensor.last_seen), "yyyy-MM-dd HH:mm")}<br /><strong style={{ color: online ? "var(--sb-green-ink)" : "var(--sb-red-ink)" }}>{online ? "ONLINE" : "OFFLINE"}</strong>{measuredAt && <><br />Měření: {format(new Date(measuredAt), "yyyy-MM-dd HH:mm")}</>}</> : "—"}</span>
    <div className="sb-metrics">
      {level != null && <span className={level <= 1 ? "sb-battery-low" : level <= 2 ? "sb-battery-mid" : "sb-battery-good"} title={`Baterie ${level}/4`}><Icon />{sensor.last_battery_voltage != null ? `${sensor.last_battery_voltage}V` : `L${level}`}</span>}
      {sensor.last_temperature != null && <span className="sb-temperature"><Thermometer />{sensor.last_temperature.toFixed(1)}°C</span>}
      {sensor.last_signal_strength != null && <span className="sb-signal"><Signal />{sensor.last_signal_strength}</span>}
      {level == null && sensor.last_temperature == null && sensor.last_signal_strength == null && <span>—</span>}
    </div>
  </div>;
}