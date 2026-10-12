import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { throttled } from '@/lib/requestQueue';

export default function useLatestControlChecks(pointIds, scope) {
  const client = useQueryClient();
  const cached = client.getQueryCache().findAll({ queryKey: ['records', 'latestChecks'] }).find(entry => {
    if (!entry.state.data || entry.state.isInvalidated) return false;
    const covered = new Set(entry.queryKey[3] || []);
    return pointIds.length > 0 && pointIds.every(id => covered.has(id));
  });
  const query = useQuery({
    initialData: cached?.state.data,
    initialDataUpdatedAt: cached?.state.dataUpdatedAt,
    queryKey: ['records', 'latestChecks', scope, pointIds],
    queryFn: async () => {
      const latest = {};
      for (let i = 0; i < pointIds.length; i += 1000) {
        const result = await throttled(() => base44.entities.ControlRecord.aggregate({
          query: { control_point_id: { $in: pointIds.slice(i, i + 1000) } },
          groupBy: 'control_point_id', max: 'performed_at', limit: 1000,
        }), 1);
        for (const row of result.rows) latest[row.control_point_id] = row.max_performed_at;
      }
      return latest;
    },
    enabled: pointIds.length > 0,
    staleTime: 60000,
  });
  if (query.error) throw query.error;
  return { latestChecks: query.data || {}, loading: pointIds.length > 0 && query.isPending };
}