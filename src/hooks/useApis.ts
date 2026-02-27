import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { ApiRegistration } from "../../shared/types";

const API_LIST_KEY = ["api-registrations"] as const;

export function useApiList() {
  return useQuery<ApiRegistration[]>({
    queryKey: API_LIST_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_registrations")
        .select("*, parsed_endpoints(count), access_tokens(count)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ApiRegistration[];
    },
  });
}

export function useApiDetail(apiId: string) {
  return useQuery<ApiRegistration>({
    queryKey: ["api-registration", apiId],
    enabled: !!apiId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_registrations")
        .select("*, parsed_endpoints(*)")
        .eq("id", apiId)
        .single();

      if (error) throw error;
      return data as ApiRegistration;
    },
  });
}

export function useDeleteApi() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (apiId: string) => {
      const { error } = await supabase
        .from("api_registrations")
        .delete()
        .eq("id", apiId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_LIST_KEY });
    },
  });
}
