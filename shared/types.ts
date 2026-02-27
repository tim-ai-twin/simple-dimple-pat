export interface ApiRegistration {
  id: string;
  user_id: string;
  name: string;
  base_url: string;
  auth_method: "bearer_token" | "api_key_header" | "api_key_query";
  auth_header_name: string | null;
  auth_query_param: string | null;
  credential_vault_id: string;
  spec_raw: string;
  spec_version: string | null;
  created_at: string;
  updated_at: string;
  parsed_endpoints?: ParsedEndpoint[];
  access_tokens?: { count: number }[];
}

export interface ParsedEndpoint {
  id: string;
  api_id: string;
  operation_id: string | null;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  path_template: string;
  tag: string | null;
  summary: string | null;
  parameters: EndpointParameter[];
  display_order: number;
}

export interface EndpointParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  type: string;
  required: boolean;
  enum?: string[];
}

export interface AccessToken {
  id: string;
  api_id: string;
  user_id: string;
  name: string;
  token_hash: string;
  token_prefix: string;
  status: "active" | "disabled" | "expired";
  created_at: string;
  expires_at: string;
  token_endpoint_permissions?: TokenEndpointPermission[];
}

export interface TokenEndpointPermission {
  id: string;
  token_id: string;
  endpoint_id: string;
  is_allowed: boolean;
  parameter_constraints?: ParameterConstraint[];
  parsed_endpoint?: ParsedEndpoint;
}

export interface ParameterConstraint {
  id: string;
  permission_id: string;
  param_name: string;
  allowed_patterns: string[];
}

export interface RequestLog {
  id: string;
  token_id: string | null;
  api_id: string | null;
  user_id: string;
  method: string;
  path: string;
  status_code: number | null;
  blocked: boolean;
  block_reason: string | null;
  created_at: string;
  token?: { name: string } | null;
}

export interface ShareTemplate {
  spec_reference: string;
  endpoint_permissions: Array<{
    method: string;
    path_template: string;
    is_allowed: boolean;
  }>;
  parameter_constraints: Array<{
    method: string;
    path_template: string;
    param_name: string;
    allowed_patterns: string[];
  }>;
}
