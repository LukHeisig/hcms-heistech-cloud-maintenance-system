// Reuse a record already fetched by a parent screen, preserving its age.
export function cachedRecord(client, id, prefixes) {
  if (!id) return {};
  for (const prefix of prefixes) {
    for (const query of client.getQueryCache().findAll({ queryKey: prefix })) {
      if (query.state.isInvalidated) continue;
      const data = query.state.data;
      const records = Array.isArray(data) ? data : data?.items || (data?.id ? [data] : undefined);
      const record = records?.find(item => item.id === id);
      if (record) return { initialData: record, initialDataUpdatedAt: query.state.dataUpdatedAt };
    }
  }
  return {};
}