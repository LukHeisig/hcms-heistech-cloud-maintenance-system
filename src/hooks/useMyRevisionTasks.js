import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { throttled } from "@/lib/requestQueue";

// Nové úkoly v revizních závadách: přidělené mně (k převzetí) + u vedoucích/adminů závady čekající na ověření
export default function useMyRevisionTasks(user, enabled) {
  const canConfirm = ["superAdmin", "admin", "manager"].includes(user?.user_type);
  const { data = [] } = useQuery({
    queryKey: ["myRevisionTasks", user?.email, canConfirm],
    queryFn: async () => {
      const assigned = await throttled(() => base44.entities.RevisionDefect.filter({ assigned_to: user.email, status: "assigned" }, "due_date", 200));
      if (!canConfirm) return assigned.map((d) => ({ ...d, task: "take" }));
      const toVerify = await throttled(() => base44.entities.RevisionDefect.filter({ status: "awaiting_verification" }, "-updated_date", 200));
      return [...assigned.map((d) => ({ ...d, task: "take" })), ...toVerify.map((d) => ({ ...d, task: "verify" }))];
    },
    enabled: !!user?.email && enabled,
    staleTime: 120000,
    refetchInterval: 300000,
  });
  return data;
}