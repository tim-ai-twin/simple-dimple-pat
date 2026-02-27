import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { ParsedEndpoint } from "../../shared/types";

export function useEndpointsForApi(apiId: string) {
  return useQuery<ParsedEndpoint[]>({
    queryKey: ["endpoints", apiId],
    enabled: !!apiId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parsed_endpoints")
        .select("*")
        .eq("api_id", apiId)
        .order("display_order");

      if (error) throw error;
      return data as ParsedEndpoint[];
    },
  });
}

export function groupEndpointsByTag(
  endpoints: ParsedEndpoint[],
): Map<string, ParsedEndpoint[]> {
  const groups = new Map<string, ParsedEndpoint[]>();

  for (const ep of endpoints) {
    const tag = ep.tag ?? "Untagged";
    const group = groups.get(tag);
    if (group) {
      group.push(ep);
    } else {
      groups.set(tag, [ep]);
    }
  }

  return groups;
}
