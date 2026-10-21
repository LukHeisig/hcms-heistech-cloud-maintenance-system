import React from "react";

export default function UnbalancePrediction({ prediction: p, trendDays = 3 }) {
  if (!p) return null;
  const box = "rounded-lg p-3 text-sm";
  if (p.status === "insufficient")
    return <div className={`${box} bg-slate-50 text-slate-600`}>Málo dat pro predikci – potřeba alespoň 4 dny měření za chodu v posledních 5 dnech.</div>;
  if (p.status === "exceeded")
    return <div className={`${box} bg-red-50 text-red-700 font-medium`}>Práh je již překročen (medián posledních 6 měření, vážený {p.recent_median} %) – doporučeno čištění / vyvážení co nejdříve.</div>;
  if (p.status === "stable")
    return <div className={`${box} bg-green-50 text-green-700`}>Nevývaha neroste (trend {p.slope_per_day} %/den) – termín čištění nelze odhadnout.</div>;
  const eta = new Date(p.eta_unix * 1000).toLocaleDateString("cs-CZ");
  const alarm = p.recent_median >= 90 || (trendDays > 0 && p.days_left <= trendDays);
  const cls = alarm ? "bg-red-50 text-red-700" : p.days_left <= 14 ? "bg-yellow-50 text-yellow-800" : "bg-blue-50 text-blue-700";
  return (
    <div className={`${box} ${cls}`}>
      {alarm && <b>Upozornění aktivní – </b>}Předpokládaný termín čištění: <b>{eta}</b> (za {p.days_left} dní). Nárůst {p.slope_per_day} %/den, aktuálně {p.recent_median} % (medián posledních 6 měření, vážený), dle trendu {p.current_fit} % · {p.points} bodů.
    </div>
  );
}