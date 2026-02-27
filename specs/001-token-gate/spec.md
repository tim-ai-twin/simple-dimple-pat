# Feature Specification: TokenGate — Personal Token Management for AI Agents

**Feature Branch**: `001-token-gate`
**Created**: 2026-02-26
**Status**: Draft
**Input**: User description: "Build a website on Netlify and Supabase for personal token management of AI agents. Use warm terracotta/cream visual theme. Master-detail layout with sidebar tree, API management, token lifecycle, endpoint permissions, parameter constraints, share links, and activity logging."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Import an API and Store Credentials (Priority: P1)

A user wants to register an external API (e.g., GitHub, Anthropic) so they can create scoped access tokens for their AI agents. They upload an OpenAPI spec, provide the base URL and their real credential, and the system parses and stores the API definition.

**Why this priority**: Without at least one API registered, no tokens can be created. This is the foundational action that enables all other functionality.

**Independent Test**: Can be fully tested by uploading an OpenAPI spec file and verifying the system displays the parsed endpoints, base URL, and credential (obscured). Delivers value as a personal API registry.

**Acceptance Scenarios**:

1. **Given** the user is logged in and on the main dashboard, **When** they click "+ Add API" and fill in the name, base URL, upload an OpenAPI spec (YAML or JSON), select an authentication method (Bearer Token or API Key), configure the auth details (header name/query param for API Key), and provide their credential, **Then** the API appears in the sidebar tree with its endpoints parsed and listed in the detail panel.
2. **Given** an API has been added, **When** the user selects it in the sidebar, **Then** the detail panel shows the API name, base URL, spec version badge, total endpoint count, number of active tokens, and a re-upload option.
3. **Given** the user uploads a malformed or invalid OpenAPI spec, **When** they click "Save API", **Then** the system displays a clear error message indicating what is wrong with the spec file.
4. **Given** the user provides credentials, **When** the credential is stored, **Then** it is persisted securely and displayed as obscured (e.g., `ghp_•••••••••••`) with a "Show" toggle.

---

### User Story 2 — Create a Scoped Access Token for an Agent (Priority: P1)

A user wants to create an access token for a specific AI agent (e.g., "cursor-agent") that is scoped to specific endpoints and parameter constraints of a registered API.

**Why this priority**: Token creation is the core value proposition — enabling per-agent scoped access. Tied with API import as the essential functionality.

**Independent Test**: Can be fully tested by creating a token under a registered API, selecting allowed endpoints, adding parameter constraints via glob patterns, setting an expiration date, and verifying the token value is generated and copyable.

**Acceptance Scenarios**:

1. **Given** an API is registered, **When** the user creates a new token with a name, reviews the endpoint list (all checked/allowed by default), unchecks any endpoints to deny, sets parameter constraints (glob patterns as removable chips), and sets an expiration date, **Then** the token is created and displayed with a copyable token value (e.g., `tg_a8f3...d92e`).
2. **Given** a token exists, **When** the user views it in the detail panel, **Then** they see: token identity (name, obscured value, copy/regenerate buttons), lifecycle controls (active/disabled toggle, expiration date picker, "Expire Now" button), endpoint permissions with checkboxes, and parameter constraint chips.
3. **Given** a token has parameter constraints, **When** the user types a glob pattern (e.g., `my-org-*`) and presses Enter, **Then** it appears as a removable chip in the parameter constraint field for that endpoint parameter.
4. **Given** an endpoint is unchecked, **When** an agent makes a request to that endpoint using this token, **Then** the proxy returns a 403 with a reason indicating the endpoint is not permitted.

---

### User Story 3 — Proxy Validates and Forwards Agent Requests (Priority: P1)

An AI agent makes an API call using a TokenGate token. The runtime proxy validates the token, checks endpoint and parameter permissions, logs the request, and either forwards it with the real credential or rejects it with a clear reason.

**Why this priority**: The proxy is the runtime enforcement layer — without it, tokens are just metadata. This is the core technical capability that makes the product functional.

**Independent Test**: Can be fully tested by making HTTP requests to the proxy with a valid token and verifying: allowed requests are forwarded and return upstream responses; disallowed requests are rejected with 403 and a reason; all requests are logged.

**Acceptance Scenarios**:

1. **Given** a valid, active token with an allowed endpoint, **When** an agent sends a request to the proxy with the token as bearer auth, **Then** the proxy replaces the token with the real upstream credential, forwards the request, and returns the upstream response.
2. **Given** a valid token but a disallowed endpoint, **When** an agent sends a request, **Then** the proxy returns 403 with a JSON body indicating the endpoint is not permitted for this token.
3. **Given** a valid token with parameter constraints, **When** an agent sends a request with a parameter value that does not match any allowed glob patterns, **Then** the proxy returns 403 with a reason indicating the parameter constraint violation.
4. **Given** an expired or disabled token, **When** an agent sends a request, **Then** the proxy returns 401 with a clear message.
5. **Given** any request (allowed or rejected), **When** processed by the proxy, **Then** the request is logged with: timestamp, token name, method, path, response status, and block reason (if any).

---

### User Story 4 — Manage Token Lifecycle (Priority: P2)

A user wants to manage their existing tokens — enable/disable them, change expiration dates, regenerate token values, or delete tokens entirely.

**Why this priority**: Ongoing management is essential for security but secondary to initial creation and proxy functionality.

**Independent Test**: Can be tested by toggling a token's active state, changing its expiration, regenerating its value, and verifying each change takes effect immediately on subsequent proxy requests.

**Acceptance Scenarios**:

1. **Given** an active token, **When** the user toggles it to "Disabled", **Then** the proxy immediately rejects requests using that token.
2. **Given** a token with an expiration date, **When** the user changes the expiration date to a future date, **Then** the new expiration is saved and reflected in the UI and proxy behavior.
3. **Given** a token, **When** the user clicks "Regenerate", **Then** a new token value is generated, the old value stops working immediately, and the new value is displayed for copying.
4. **Given** a token, **When** the user clicks "Delete Token", **Then** the token is permanently removed and the proxy rejects any further requests with it.

---

### User Story 5 — View Activity Log and Debug Agent Issues (Priority: P2)

A user wants to see recent API calls made through the proxy, including which token was used, what endpoint was hit, the response status, and whether any calls were blocked and why.

**Why this priority**: Debugging blocked agent calls is critical for day-to-day use but depends on the proxy and token system being functional first.

**Independent Test**: Can be tested by making several proxy requests (some allowed, some blocked) and verifying the activity log displays all calls with correct details and block reasons.

**Acceptance Scenarios**:

1. **Given** the user selects an API in the sidebar, **When** they view the detail panel, **Then** they see a "Recent Activity" section showing the most recent proxy calls across all tokens for that API.
2. **Given** the user selects a specific token, **When** they view the detail panel, **Then** they see a "Recent Calls" section filtered to that token, showing: time ago, method, path, status code, and a check/cross indicator.
3. **Given** a blocked request exists in the log, **When** displayed, **Then** it shows the block reason inline (e.g., "Blocked: DELETE not permitted").

---

### User Story 6 — Share a Token Configuration Template (Priority: P3)

A user wants to share their token configuration (which endpoints are allowed, what parameter constraints are set) with another user, so the recipient can create their own token with the same scoping — without sharing any actual credentials.

**Why this priority**: The share/virality feature adds significant value but is an enhancement on top of the core token management workflow.

**Independent Test**: Can be tested by generating a share link, opening it in a different browser session, and verifying the token creation form is pre-filled with the shared endpoint permissions and parameter constraints, but requires the recipient to supply their own credential.

**Acceptance Scenarios**:

1. **Given** a configured token, **When** the user clicks "Share Link", **Then** a URL is generated that encodes the API spec reference and endpoint/constraint selections entirely in the URL (no database lookup required).
2. **Given** a share link URL, **When** a recipient opens it, **Then** they see a pre-filled token creation form showing the selected endpoints and parameter constraints, with empty fields for their own API name, base URL, and credential.
3. **Given** a share link, **When** the recipient fills in their credential and saves, **Then** a new token is created under their account with the same endpoint permissions and parameter constraints as the original.

---

### Edge Cases

- What happens when an uploaded OpenAPI spec has no tags? Endpoints are displayed in a flat list without grouping.
- What happens when an agent makes a request to an endpoint not defined in the OpenAPI spec? The proxy rejects with 404 indicating the endpoint is not recognized.
- What happens when a token expires while an agent is mid-request? The request that was already authenticated completes; subsequent requests are rejected.
- What happens when the upstream API returns an error? The proxy forwards the upstream error response as-is to the agent.
- What happens when the upstream API is unreachable or times out? The proxy returns 502 Bad Gateway with a descriptive error message after a default timeout period. The failed request is logged with the timeout/connection error as the reason.
- What happens when the user deletes an API that has active tokens? The user is warned and must confirm; deletion removes the API and all associated tokens.
- What happens when the OpenAPI spec is re-uploaded with different endpoints? Existing tokens retain their current endpoint selections; removed endpoints are flagged as "endpoint no longer in spec" in the token view.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to register external APIs by providing a name, base URL, OpenAPI spec file (YAML or JSON), authentication method (Bearer Token or API Key with configurable header name/query param), and authentication credential.
- **FR-002**: System MUST parse uploaded OpenAPI specs and extract endpoints (operation ID, method, path, parameters, tags) into a queryable format.
- **FR-003**: System MUST allow users to create named access tokens scoped to a specific registered API with a configurable expiration date. The default expiration MUST be 12 months from creation date, editable by the user.
- **FR-004**: System MUST allow users to select which endpoints (from the parsed spec) are permitted for each token, displayed as checkboxes grouped by OpenAPI tags. All endpoints MUST default to allowed (checked) when creating a new token — user unchecks endpoints to deny.
- **FR-005**: System MUST allow users to set parameter constraints on permitted endpoints using glob patterns (e.g., `my-org-*`, `src/*`), displayed as removable chips.
- **FR-006**: System MUST provide a runtime proxy that validates incoming requests against token permissions (endpoint allowlist, parameter constraints, token status/expiration) before forwarding with the real upstream credential. The proxy MUST enforce a default timeout on upstream requests and return 502 Bad Gateway with a descriptive error message if the upstream is unreachable or times out.
- **FR-007**: System MUST log all proxy requests with: timestamp, token identifier, HTTP method, request path, response status code, and block reason (if rejected). Logs MUST be retained for 30 days and automatically purged thereafter.
- **FR-008**: System MUST allow users to toggle tokens between active and disabled states, with changes taking effect immediately on the proxy.
- **FR-009**: System MUST allow users to change token expiration dates, regenerate token values, and delete tokens.
- **FR-010**: System MUST generate shareable links that encode API spec reference and token configuration (endpoint selections, parameter constraints) entirely in the URL without requiring a database lookup.
- **FR-011**: System MUST display a master-detail layout with a collapsible sidebar tree (APIs as parent nodes, tokens as children) and a context-sensitive detail panel.
- **FR-012**: System MUST store API credentials securely and display them in obscured form with a "Show" toggle.
- **FR-013**: System MUST support per-user data isolation — each user only sees and manages their own APIs and tokens.
- **FR-014**: System MUST authenticate users before granting access to the management UI.

### Key Entities

- **User**: A person who manages APIs and tokens. Has their own isolated set of APIs and tokens. Authenticated via the system's auth layer.
- **API Registration**: An external API a user has registered. Contains: name, base URL, OpenAPI spec (raw and parsed), authentication method (Bearer Token or API Key), authentication credential (encrypted), auth header name or query parameter name (for API Key method), and a list of parsed endpoints.
- **Endpoint**: A parsed operation from an OpenAPI spec. Contains: operation ID, HTTP method, path template, parameters (with types), and tag grouping.
- **Access Token**: A scoped credential issued to an AI agent. Contains: name, token value (hashed), parent API reference, status (active/disabled/expired), creation date, expiration date (defaults to 12 months from creation), allowed endpoints, and parameter constraints per endpoint.
- **Parameter Constraint**: A glob-pattern restriction on a specific parameter of a specific endpoint. Multiple patterns can be defined per parameter (any match = allowed).
- **Request Log**: An audit record of every proxy request. Contains: timestamp, token reference, HTTP method, path, response status, and block reason (if any). Retained for 30 days, then automatically purged.
- **Share Template**: An encoded representation of a token's endpoint permissions and parameter constraints, serialized into a URL-safe format for sharing without database dependency.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can register a new API (upload spec, configure credentials) in under 3 minutes.
- **SC-002**: Users can create a new scoped token with endpoint permissions and parameter constraints in under 2 minutes.
- **SC-003**: The proxy validates and forwards an allowed request with less than 200ms of added latency beyond the upstream response time.
- **SC-004**: Blocked requests return a clear, actionable rejection reason that allows users to identify and fix the misconfiguration on first attempt.
- **SC-005**: Users can diagnose a blocked agent call by viewing the activity log within 30 seconds.
- **SC-006**: Share links successfully pre-fill token configuration for recipients 100% of the time without any database lookup.
- **SC-007**: Token lifecycle changes (disable, expire, regenerate) take effect on the proxy within 5 seconds.
- **SC-008**: The system supports at least 20 users, each managing up to 20 APIs with up to 3 tokens per API, without performance degradation.

## Clarifications

### Session 2026-02-26

- Q: Which upstream authentication methods should the proxy support? → A: Bearer Token + API Key (header or query param)
- Q: Should new tokens default to all endpoints allowed or all denied? → A: All allowed by default (denylist model — user unchecks endpoints to deny)
- Q: How should the proxy handle upstream failures/timeouts? → A: Enforce a default timeout (e.g., 30s), return 502 Bad Gateway with clear error message
- Q: How long should request logs be retained? → A: 30 days, then automatically purged
- Q: What should the default token expiration be? → A: 12 months from creation date

## Assumptions

- Users are technical (developers, DevOps) comfortable with OpenAPI specs and API credentials.
- The system is deployed for small-scale personal/team use (fewer than 20 users), not enterprise-scale.
- Users bring their own OpenAPI specs; the system does not discover or generate specs.
- The warm terracotta (#8B3A2A) and cream (#FAF3EB) color palette from the Monte Cafe visual theme will be applied to all UI components, with rounded input fields and a serif/sans-serif font pairing.
- Authentication will use a standard session-based auth flow appropriate for the hosting platform.
- The runtime proxy runs as a Netlify Edge Function (Deno-based, near-zero cold start) at the `/proxy/*` path, co-located with the static frontend on Netlify CDN.
- Parameter constraint matching uses standard glob/wildcard patterns (e.g., `*` matches any characters, `?` matches single character).
- The system is desktop-first; mobile responsiveness is not a priority for the initial release.

## Visual Theme

The UI adopts a warm, artisanal aesthetic inspired by the provided reference images:

- **Primary color**: Deep terracotta/rust (#8B3A2A) — used for headings, buttons, accent elements, and the footer background
- **Background color**: Warm cream (#FAF3EB) — used for page backgrounds and content areas
- **Text color**: Dark brown on cream backgrounds; white/cream on terracotta backgrounds
- **Input fields**: Rounded pill-shaped inputs with thin terracotta borders on cream backgrounds
- **Buttons**: Rounded pill-shaped with terracotta borders, uppercase tracking on labels (e.g., "SUBSCRIBE")
- **Typography**: Bold uppercase serif for headings; clean sans-serif for body text and UI elements
- **Footer**: Full-width terracotta background with white text, three-column layout
- **Overall feel**: Warm, approachable, handcrafted — not cold/corporate
