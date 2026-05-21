import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { useHousehold } from "./household";

export type HouseholdRole = "admin" | "member" | "guest";

export function useRole() {
  const { user } = useAuth();
  const { household } = useHousehold();

  const query = useQuery({
    queryKey: ["role", household?.id, user?.id],
    enabled: !!user && !!household,
    queryFn: async (): Promise<HouseholdRole | null> => {
      const { data, error } = await supabase
        .from("household_roles")
        .select("role")
        .eq("household_id", household!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as HouseholdRole) ?? null;
    },
  });

  const role = query.data ?? null;
  return {
    role,
    isAdmin: role === "admin",
    isMember: role === "member",
    isGuest: role === "guest",
    canManageNonEconomic: role === "admin" || role === "member",
    canManageEconomic: role === "admin",
    loading: query.isLoading,
  };
}
