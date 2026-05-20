import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export interface Household {
  id: string;
  name: string;
  invite_code: string;
}

export function useHousehold() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["household", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Household | null> => {
      const { data, error } = await supabase
        .from("household_members")
        .select("household:households(id, name, invite_code)")
        .eq("user_id", user!.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.household as unknown as Household) ?? null;
    },
  });

  return {
    household: query.data ?? null,
    loading: authLoading || query.isLoading,
    refetch: query.refetch,
  };
}
