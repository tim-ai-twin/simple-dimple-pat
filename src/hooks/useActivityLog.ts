import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { RequestLog } from "../../shared/types";

/**
 * Fetch activity logs for a specific API registration.
 * Orders by created_at DESC, limited to 50 rows, auto-refreshes every 30s.
 */
export function useApiActivityLog(apiId: string) {
  return useQuery<RequestLog[]>({
    queryKey: ["activity-log", "api", apiId],
    enabled: !!apiId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_logs")
        .select("*, token:access_tokens(name)")
        .eq("api_id", apiId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as RequestLog[];
    },
  });
}

/**
 * Fetch activity logs for a specific access token.
 * Orders by created_at DESC, limited to 50 rows, auto-refreshes every 30s.
 */
export function useTokenActivityLog(tokenId: string) {
  return useQuery<RequestLog[]>({
    queryKey: ["activity-log", "token", tokenId],
    enabled: !!tokenId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_logs")
        .select("*, token:access_tokens(name)")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as RequestLog[];
    },
  });
}
