import React from "react";
import { BatteryLow, BatteryMedium, BatteryFull, Thermometer, Signal } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
export default function ServiceBoardSensor({ sensor }) {
  const level = sensor.last_battery_level;
  const Icon = level <= 1 ? BatteryLow : level <= 2 ? BatteryMedium : BatteryFull;
  return <div className="sb-sensor-row">
    <span className="sb-sensor-id">{sensor.sensor_id}</span>
    <span className="sb-seen" title={sensor.last_seen || undefined}>{sensor.last_seen ? <>{formatDistanceToNow(new Date(sensor.last_seen), { addSuffix: true, locale: cs })}<br />{format(new Date(sensor.last_seen), "yyyy-MM-dd HH:mm")}</> : "—"}</span>
    <div className="sb-metrics">
      {level != null && <span className={level <= 1 ? "sb-battery-low" : level <= 2 ? "sb-battery-mid" : "sb-battery-good"} title={`Baterie ${level}/4`}><Icon />{sensor.last_battery_voltage != null ? `${sensor.last_battery_voltage}V` : `L${level}`}</span>}
      {sensor.last_temperature != null && <span className="sb-temperature"><Thermometer />{sensor.last_temperature.toFixed(1)}°C</span>}
      {sensor.last_signal_strength != null && <span className="sb-signal"><Signal />{sensor.last_signal_strength}</span>}
      {level == null && sensor.last_temperature == null && sensor.last_signal_strength == null && <span>—</span>}
    </div>
  </div>;
}