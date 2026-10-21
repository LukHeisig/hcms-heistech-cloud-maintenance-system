// Orientace snímače: 3 písmena = směr osy X, Y, Z (V = vertikální, A = axiální, H = horizontální)
export const DEFAULT_ORIENTATION = "VAH";
const NAMES = { V: "vertikální", A: "axiální", H: "horizontální" };
const LEGACY = { x_vert_y_axial: "VAH", x_axial_y_vert: "AVH" };

export const ORIENTATION_OPTIONS = ["VAH", "AVH", "VHA", "HVA", "AHV", "HAV"].map((code) => ({
  value: code,
  label: `X – ${NAMES[code[0]]}, Y – ${NAMES[code[1]]}, Z – ${NAMES[code[2]]}`,
}));
// Globální volba pro stroj: Z vždy horizontální
export const GLOBAL_ORIENTATION_OPTIONS = ORIENTATION_OPTIONS.filter((o) => o.value[2] === "H");

export const normalizeOrientation = (o) => LEGACY[o] || (o && o.length === 3 ? o : DEFAULT_ORIENTATION);

// Efektivní orientace měřicího místa podle nastavení stroje
export const effectiveOrientation = (machine, pointOrientation) =>
  machine?.sensor_orientation_mode === "per_point"
    ? normalizeOrientation(pointOrientation)
    : normalizeOrientation(machine?.sensor_orientation);

export function axisDirection(metricKey, orientation) {
  const o = normalizeOrientation(orientation);
  const i = { vel_x: 0, vel_y: 1, vel_z: 2 }[metricKey];
  return i == null ? null : NAMES[o[i]];
}