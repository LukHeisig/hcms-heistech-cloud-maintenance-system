const MS_PER_HOUR = 3600000;

// Vrátí počet "efektivních" hodin mezi lastPerformed a now,
// přičemž hodiny spadající do vyloučených dnů (excludedDays: 0=Ne..6=So) se nepočítají.
export function getEffectiveHoursSince(lastPerformed, now, excludedDays) {
  if (!excludedDays || excludedDays.length === 0) {
    return (now - lastPerformed) / MS_PER_HOUR;
  }
  if (excludedDays.length >= 7) return 0;

  let total = 0;
  const cursor = new Date(lastPerformed);
  while (cursor < now) {
    const dayEnd = new Date(cursor);
    dayEnd.setHours(24, 0, 0, 0);
    const segmentEnd = dayEnd < now ? dayEnd : now;
    if (!excludedDays.includes(cursor.getDay())) {
      total += (segmentEnd - cursor) / MS_PER_HOUR;
    }
    cursor.setTime(dayEnd.getTime());
  }
  return total;
}

// Vrátí datum další kontroly – interval "běží" jen v pracovních dnech,
// vyloučené dny (excludedDays: 0=Ne..6=So) se přeskakují.
export function getNextDueDate(lastPerformed, intervalHours, excludedDays) {
  if (!excludedDays || excludedDays.length === 0) {
    return new Date(lastPerformed.getTime() + intervalHours * MS_PER_HOUR);
  }
  if (excludedDays.length >= 7) return null;

  let remaining = intervalHours;
  const cursor = new Date(lastPerformed);
  for (let i = 0; i < 3660; i++) {
    const dayEnd = new Date(cursor);
    dayEnd.setHours(24, 0, 0, 0);
    if (!excludedDays.includes(cursor.getDay())) {
      const available = (dayEnd - cursor) / MS_PER_HOUR;
      if (remaining <= available) {
        return new Date(cursor.getTime() + remaining * MS_PER_HOUR);
      }
      remaining -= available;
    }
    cursor.setTime(dayEnd.getTime());
  }
  return new Date(cursor);
}