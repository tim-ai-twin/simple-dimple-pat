# Feature Specification: Demo Account

**Feature Branch**: `002-demo-account`
**Created**: 2026-03-02
**Status**: Draft
**Input**: User description: "Let's add a demo account. The demo account doesn't actually connect to Google OAuth, but it is still an account on our system. The goal of the demo account is that a user can discover what the system is and orient to its capabilities risk free, without even signing up. The downside is that it's completely unauthenticated so multiple users will see the same data. On the landing page, below the button that says to Login with Google, there is second button that says 'demo account'."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter Demo Mode from Landing Page (Priority: P1)

A first-time visitor arrives at the landing page and wants to explore the system before committing to creating an account. They see a "Demo Account" button below the Google sign-in button. They click it and are immediately taken into the dashboard as the shared demo user, where they can see pre-loaded sample data (APIs, tokens, activity logs) and interact with all features.

**Why this priority**: This is the core value proposition — removing the sign-up barrier so users can evaluate the product risk-free. Without this, the feature has no purpose.

**Independent Test**: Can be fully tested by clicking the "Demo Account" button on the landing page and verifying the user lands on the dashboard with demo data visible.

**Acceptance Scenarios**:

1. **Given** a visitor is on the landing page (not signed in), **When** they click the "Demo Account" button, **Then** they are signed into a shared demo account and redirected to the dashboard.
2. **Given** a visitor clicks "Demo Account", **When** the dashboard loads, **Then** they see pre-existing sample API registrations, tokens, and activity data that demonstrate the system's capabilities.
3. **Given** a visitor is on the landing page, **When** they look at the login options, **Then** they see "Sign in with Google" as the primary button and "Demo Account" as a secondary button below it.

---

### User Story 2 - Explore Features as Demo User (Priority: P2)

A demo user navigates through the dashboard and interacts with the system's features: viewing registered APIs, browsing parsed endpoints, viewing tokens, and checking activity logs. They can perform read operations and some write operations (creating tokens, etc.) to understand the full workflow. Since this is a shared account, any changes they make are visible to all other demo users.

**Why this priority**: Once a user enters demo mode, they need meaningful data and working interactions to evaluate the product. Without this, the demo is an empty shell.

**Independent Test**: Can be tested by entering demo mode and verifying that all dashboard sections (APIs, tokens, activity log) display data and that interactive features (creating a token, viewing endpoints) function correctly.

**Acceptance Scenarios**:

1. **Given** a user is signed in as the demo account, **When** they navigate to the dashboard, **Then** they see at least one sample API registration with parsed endpoints.
2. **Given** a user is signed in as the demo account, **When** they attempt to create a token for a sample API, **Then** the token creation flow works the same as for a regular user.
3. **Given** a user is signed in as the demo account, **When** they view the activity log, **Then** they see request history from all demo users (shared data).

---

### User Story 3 - Reset Demo Data (Priority: P3)

A demo user (or someone who finds the demo in a messy state from previous users) wants to restore the demo to its original clean state. In the left sidebar, they see a "Reset Demo" button (only visible when signed in as the demo user). Clicking it clears all data for the demo account and re-provisions the original seed data, giving a fresh experience.

**Why this priority**: Since the demo account is shared and users can create/delete data freely, the demo can degrade over time. A self-service reset ensures any visitor can get a clean experience without manual intervention.

**Independent Test**: Can be tested by modifying demo data (e.g., deleting an API, creating extra tokens), clicking "Reset Demo", and verifying the dashboard returns to the original seed data state.

**Acceptance Scenarios**:

1. **Given** a user is signed in as the demo account, **When** they look at the left sidebar, **Then** they see a "Reset Demo" button.
2. **Given** a user is signed in as a regular (non-demo) account, **When** they look at the left sidebar, **Then** they do NOT see a "Reset Demo" button.
3. **Given** a demo user clicks "Reset Demo", **When** a confirmation prompt appears and they confirm, **Then** all demo account data (API registrations, tokens, endpoints, activity logs) is deleted and the original seed data is re-provisioned.
4. **Given** a demo user clicks "Reset Demo" and confirms, **When** the reset completes, **Then** the dashboard refreshes and displays the original seed data.

---

### User Story 4 - Exit Demo and Sign Up (Priority: P4)

A demo user who has explored the system decides they want their own account. They can sign out of the demo account (or click a prompt/banner) and return to the landing page where they can sign in with Google to create their own private account.

**Why this priority**: Converting demo users to real users is the business goal, but the demo experience must work first (P1, P2, P3) before conversion matters.

**Independent Test**: Can be tested by signing out from demo mode and verifying the user returns to the landing page with the Google sign-in option available.

**Acceptance Scenarios**:

1. **Given** a user is in demo mode, **When** they click sign out, **Then** they are returned to the landing page.
2. **Given** a user returns to the landing page after demo mode, **When** they click "Sign in with Google", **Then** they go through normal OAuth and get their own private account with no data leakage from the demo account.

---

### Edge Cases

- What happens when demo seed data is accidentally deleted by a demo user? The user can click "Reset Demo" to restore the original seed data.
- What happens if multiple demo users perform conflicting write operations simultaneously? Since the account is shared, writes are visible to all — this is an accepted trade-off documented in the UI.
- What happens if the demo account's pre-loaded API credential is invalid or expired? The demo should still showcase the UI and token management features even if upstream API calls fail.
- What happens when a demo user tries to use the share link feature? It should work normally since share links are tied to tokens, not authentication.
- What happens if someone tries to change the demo account's password or email? This should not be possible from the application UI since there is no account settings page.
- What happens if one demo user clicks "Reset Demo" while another is actively using the demo? The reset proceeds — the other user will see the refreshed seed data on their next navigation or page load. This is an accepted trade-off of the shared account model.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "Demo Account" button on the landing page, positioned below the "Sign in with Google" button.
- **FR-002**: Clicking the "Demo Account" button MUST sign the user into a pre-existing shared demo account without requiring any credentials or OAuth flow from the user's perspective.
- **FR-003**: The demo account MUST be a real user account in the auth system so that all existing access control, server functions, and application logic work without modification.
- **FR-004**: The demo account MUST have pre-loaded sample data including at least one API registration with parsed endpoints, at least one scoped access token, and sample activity log entries.
- **FR-005**: The demo user MUST have the same feature access as a regular authenticated user (view APIs, create tokens, view activity, use share links).
- **FR-006**: The system MUST visually indicate when the user is in demo mode (e.g., a banner or badge) so they understand they are in a shared, non-private environment.
- **FR-007**: The demo user MUST be able to sign out and return to the landing page at any time.
- **FR-008**: The system MUST NOT require any changes to existing access control policies, server functions, or proxy logic to support the demo account — it should behave as a normal authenticated user.
- **FR-009**: The system MUST display a "Reset Demo" button in the left sidebar, visible only when signed in as the demo account.
- **FR-010**: Clicking "Reset Demo" MUST prompt for confirmation before proceeding.
- **FR-011**: The reset operation MUST delete all data owned by the demo account (API registrations, tokens, parsed endpoints, activity logs, vault credentials) and re-provision the original seed data.
- **FR-012**: The "Reset Demo" button MUST NOT be visible to regular (non-demo) users.

### Key Entities

- **Demo User Account**: A single, shared user account designated as the demo account. Has a fixed email identifier. Owns the demo seed data.
- **Demo Seed Data**: Pre-loaded API registrations, parsed endpoints, scoped tokens, and activity log entries that showcase the system's capabilities. Owned by the demo user account.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can go from landing page to a fully populated dashboard in under 5 seconds by clicking "Demo Account".
- **SC-002**: The demo dashboard displays at least one complete API registration with endpoints, one active token, and activity history.
- **SC-003**: 100% of existing features (API viewing, token creation, token revocation, activity log, share links) work correctly when accessed through the demo account.
- **SC-004**: The demo mode indicator is visible on every page while in demo mode, clearly communicating the shared nature of the account.
- **SC-005**: A demo user can sign out and sign in with Google to create their own private account with zero data leakage from the demo account.
- **SC-006**: After clicking "Reset Demo" and confirming, the dashboard displays the original seed data within 5 seconds.

## Assumptions

- The demo account will be created as a real user account with a known, fixed email address (e.g., `demo@simple-dimple-pat.local`).
- The sign-in mechanism for the demo account will use email/password authentication with pre-set credentials embedded in the client, avoiding any OAuth flow.
- Demo seed data will be manually provisioned and tied to the demo user's ID.
- Multiple concurrent demo users sharing the same account is an accepted trade-off — they will see each other's changes. This is clearly communicated in the UI.
- The "Reset Demo" button provides self-service data reset. No automated/scheduled reset is included.

## Scope Boundaries

**In scope**:
- "Demo Account" button on landing page
- Demo mode sign-in flow (password-based, no OAuth)
- Demo mode visual indicator (banner/badge)
- Demo account creation (one-time setup)
- Demo seed data provisioning
- "Reset Demo" button in sidebar (demo user only)
- Self-service demo data reset with seed re-provisioning

**Out of scope**:
- Automated/scheduled demo data reset (only manual via button)
- Restricting write operations for demo users (they have full access)
- Separate demo environment or isolated data
- Analytics tracking of demo-to-signup conversion
- Rate limiting for demo account usage
