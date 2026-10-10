// Jediné místo, které rozhoduje o dostupnosti modulů podniku.
// Modul je aktivní pouze tehdy, je-li výslovně zapnutý (=== true).
export const isModuleEnabled = (company, key) => company?.[key] === true;

// Vrací true, pokud má uživatel modul dostupný alespoň v jednom svém podniku.
export function userHasModule(user, key, { userCompany, adminCompanies = [] } = {}) {
  if (!user) return false;
  if (user.user_type === "superAdmin") return true;
  if (user.user_type === "admin") {
    const ids = user.assigned_company_ids || [];
    return adminCompanies.some(c => ids.includes(c.id) && isModuleEnabled(c, key));
  }
  return isModuleEnabled(userCompany, key);
}