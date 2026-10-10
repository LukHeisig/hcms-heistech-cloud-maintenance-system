import { base44 } from "@/api/base44Client";

// Data modulů se čtou a zapisují výhradně přes serverovou bránu (kontrola modulu a podniku).
const call = async (payload) => (await base44.functions.invoke("readModuleData", payload)).data;

export const moduleData = {
  filter: async (entity, query = {}, sort = null, limit = 100) =>
    (await call({ entity, op: "filter", query, sort, limit })).items,
  list: async (entity, sort = null, limit = 100) =>
    (await call({ entity, op: "filter", query: {}, sort, limit })).items,
  create: async (entity, data) => (await call({ entity, op: "create", data })).record,
  update: async (entity, id, data) => (await call({ entity, op: "update", id, data })).record,
};