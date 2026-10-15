// Stroj stojí, pokud všechny online snímače (data mladší 12 h) hlásí rychlost vibrací pod prahem chodu.
const ONLINE_MS = 12 * 3600 * 1000;

const tsOf = d => d.timestamp_unix ? d.timestamp_unix * 1000 : d.recorded_at ? new Date(d.recorded_at).getTime() : 0;

export function isMachineStopped(machine, dataList = []) {
  const now = Date.now();
  const online = dataList.filter(d => d && now - tsOf(d) <= ONLINE_MS);
  if (!online.length) return false;
  const thr = machine?.motohours_threshold_mm_s ?? 0.3;
  return online.every(d => Math.max(d.vel_rms_x_mm_s || 0, d.vel_rms_y_mm_s || 0, d.vel_rms_z_mm_s || 0) <= thr);
}

export const STOPPED_LABEL = "Stroj nejede";
export const STOPPED_DETAIL = "Vibrace jsou pod prahem chodu, hodnocení stavu se neprovádí.";