// Only reuse complete coverage from an uninvalidated parent query.
export default function cachedSubset(client, prefixes, ids, select) {
  if (!ids.length) return {};
  for (const prefix of prefixes) {
    for (const query of client.getQueryCache().findAll({ queryKey: [prefix] })) {
      if (!query.state.data || query.state.isInvalidated) continue;
      const key = query.queryKey[1];
      const covered = new Set(Array.isArray(key) ? key : typeof key === "string" ? key.split(",") : []);
      if (ids.every(id => covered.has(id))) return {
        initialData: select(query.state.data), initialDataUpdatedAt: query.state.dataUpdatedAt,
      };
    }
  }
  return {};
}