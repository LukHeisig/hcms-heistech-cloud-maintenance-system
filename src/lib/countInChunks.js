import { throttled } from "@/lib/requestQueue";

// Rozdělí velký $in dotaz na menší dávky (velké $in způsobují chybu 500 a pomalé načítání)
export async function countInChunks(entity, field, ids, extraQuery = {}, chunkSize = 150) {
  if (!ids.length) return 0;
  const chunks = [];
  for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));
  const counts = await Promise.all(chunks.map(chunk =>
    throttled(() => entity.count({ ...extraQuery, [field]: { $in: chunk } }))
  ));
  return counts.reduce((a, b) => a + b, 0);
}