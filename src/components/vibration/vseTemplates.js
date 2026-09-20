// Pevně definované struktury šablon vizualizace pro VSE jednotky.
// Konkrétní proměnné (countery) z VSE jednotky se k slotům mapují až na kartě stroje.

export const COUNTER_BANDS = [
  { key: "ok", label: "OK (pod warning)", color: "#2e7d4f" },
  { key: "warning", label: "Nad warning", color: "#d4a017" },
  { key: "damage", label: "Nad damage", color: "#c0392b" },
];

export const VSE_TEMPLATES = {
  spindle_energy: {
    key: "spindle_energy",
    label: "Energie vibrací vřetene",
    description:
      "Monitoring v_RMS ve třech osách. Countery z jednotky (ObjectState) počítají, jak dlouho vřeteno za chodu běží v pásmu OK, nad warning a nad damage. Pro každou osu 3 countery.",
    buildDefault: () => ({
      template: "spindle_energy",
      axes: ["X", "Y", "Z"].map((a) => ({
        key: a,
        label: `osa ${a}`,
        counters: COUNTER_BANDS.map((b) => ({ key: b.key, label: b.label })),
      })),
    }),
  },
};

export function parseVseDefinition(raw) {
  try {
    const parsed = JSON.parse(raw || "null");
    if (parsed && !Array.isArray(parsed) && parsed.template && VSE_TEMPLATES[parsed.template]) {
      return parsed;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function describeVseDefinition(raw) {
  const def = parseVseDefinition(raw);
  if (!def) return "Neplatná / stará definice";
  const tpl = VSE_TEMPLATES[def.template];
  const counters = (def.axes || []).reduce((s, a) => s + (a.counters?.length || 0), 0);
  return `${tpl.label} · ${def.axes?.length || 0} osy · ${counters} counterů`;
}