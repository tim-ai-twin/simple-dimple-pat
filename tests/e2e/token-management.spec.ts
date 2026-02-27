import { test, expect } from "@playwright/test";

test.describe("Token Management (US2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should create a new token with scoped permissions", async ({ page }) => {
    // Select an API from the sidebar (assumes API already registered)
    // Click "Create Token" button in the API detail view
    // Fill token name
    // Set expiration date
    // Uncheck some endpoints in the permissions list
    // Add parameter constraint glob chips
    // Click "Create Token" submit button
    // Verify show-once modal appears with token value starting with sdp_
    // Verify copy button works
    // Dismiss modal
    // Verify token appears in sidebar under the API
  });

  test("should show endpoint permissions with all endpoints checked by default", async ({ page }) => {
    // Navigate to Create Token form
    // Verify all endpoint checkboxes are checked
    // Uncheck an endpoint
    // Verify it's visually marked as denied
  });

  test("should add and remove parameter constraint chips", async ({ page }) => {
    // Navigate to Create Token form
    // Find a parameter constraint input for a checked endpoint
    // Type "my-org-*" and press Enter
    // Verify chip appears with "my-org-*" text
    // Click remove (x) on the chip
    // Verify chip is removed
  });

  test("should display token show-once modal with copy button", async ({ page }) => {
    // After creating a token
    // Verify modal is visible
    // Verify token value starts with sdp_
    // Verify warning text about "not shown again"
    // Click copy button
    // Verify "Copied!" confirmation
    // Click "Done" to dismiss
  });
});
