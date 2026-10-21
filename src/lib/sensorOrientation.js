// Směr osy podle orientace snímače (Z je vždy horizontální)
export function axisDirection(metricKey, orientation = "x_vert_y_axial") {
  const xAxial = orientation === "x_axial_y_vert";
  if (metricKey === "vel_x") return xAxial ? "axiální" : "vertikální";
  if (metricKey === "vel_y") return xAxial ? "vertikální" : "axiální";
  if (metricKey === "vel_z") return "horizontální";
  return null;
}