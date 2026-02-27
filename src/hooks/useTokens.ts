import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { AccessToken } from "../../shared/types";

export function useTokensForApi(apiId: string) {
  return useQuery<AccessToken[]>({
    queryKey: ["tokens", apiId],
    enabled: !!apiId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_tokens")
        .select(
          "*, token_endpoint_permissions(*, parameter_constraints(*), parsed_endpoint:parsed_endpoints(*))",
        )
        .eq("api_id", apiId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AccessToken[];
    },
  });
}

export function useTokenDetail(tokenId: string) {
  return useQuery<AccessToken>({
    queryKey: ["token", tokenId],
    enabled: !!tokenId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_tokens")
        .select(
          "*, token_endpoint_permissions(*, parameter_constraints(*), parsed_endpoint:parsed_endpoints(*))",
        )
        .eq("id", tokenId)
        .single();

      if (error) throw error;
      return data as AccessToken;
    },
  });
}

export function useCreateToken() {
  const queryClient = useQueryClient();

  return useMutation<
    { token_id: string; raw_token: string; token_prefix: string; name: string; expires_at: string },
    Error,
    {
      api_id: string;
      name: string;
      expires_at?: string;
      endpoint_permissions?: Array<{ endpoint_id: string; is_allowed: boolean }>;
      parameter_constraints?: Array<{
        endpoint_id: string;
        param_name: string;
        allowed_patterns: string[];
      }>;
    }
  >({
    mutationFn: async (body) => {
      const { data, error } = await supabase.functions.invoke("generate-token", {
        body,
      });

      if (error) throw new Error(error.message || "Failed to create token");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tokens", variables.api_id] });
      queryClient.invalidateQueries({ queryKey: ["api-registrations"] });
    },
  });
}

export function useToggleTokenStatus() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { tokenId: string; status: "active" | "disabled" }>({
    mutationFn: async ({ tokenId, status }) => {
      const { error } = await supabase
        .from("access_tokens")
        .update({ status })
        .eq("id", tokenId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tokens"] });
      queryClient.invalidateQueries({ queryKey: ["token"] });
    },
  });
}

export function useUpdateExpiration() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { tokenId: string; expiresAt: string }>({
    mutationFn: async ({ tokenId, expiresAt }) => {
      const { error } = await supabase
        .from("access_tokens")
        .update({ expires_at: expiresAt })
        .eq("id", tokenId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tokens"] });
      queryClient.invalidateQueries({ queryKey: ["token"] });
    },
  });
}

export function useRegenerateToken() {
  const queryClient = useQueryClient();

  return useMutation<
    { raw_token: string; token_prefix: string },
    Error,
    string
  >({
    mutationFn: async (tokenId) => {
      const { data, error } = await supabase.functions.invoke("regenerate-token", {
        body: { token_id: tokenId },
      });

      if (error) throw new Error(error.message || "Failed to regenerate token");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tokens"] });
      queryClient.invalidateQueries({ queryKey: ["token"] });
    },
  });
}

export function useDeleteToken() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (tokenId) => {
      const { error } = await supabase
        .from("access_tokens")
        .delete()
        .eq("id", tokenId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tokens"] });
      queryClient.invalidateQueries({ queryKey: ["api-registrations"] });
    },
  });
}
