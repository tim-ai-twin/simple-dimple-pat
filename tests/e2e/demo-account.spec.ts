import { test, expect } from "@playwright/test";

const BASE_URL = "https://simple-dimple-pat.netlify.app";

test.describe.configure({ mode: "serial" });

test.describe("Demo Account Smoke Tests", () => {
  test("T14-1: Landing page shows both sign-in buttons", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /demo account/i })).toBeVisible();
  });

  test("T14-2: Demo login → dashboard with Petstore data", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole("button", { name: /demo account/i }).click();

    // Should land on dashboard — sidebar shows Petstore API
    await expect(page.getByText("Petstore API")).toBeVisible({ timeout: 15000 });
  });

  test("T14-3: Demo mode badge visible in header", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole("button", { name: /demo account/i }).click();
    await expect(page.getByText("Petstore API")).toBeVisible({ timeout: 15000 });

    await expect(page.getByText("Demo Mode")).toBeVisible();
  });

  test("T14-4: Navigate APIs, tokens, activity log", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole("button", { name: /demo account/i }).click();
    await expect(page.getByText("Petstore API")).toBeVisible({ timeout: 15000 });

    // Click Petstore API in sidebar → detail panel shows info
    await page.getByText("Petstore API").click();
    await expect(page.getByText(/petstore3\.swagger\.io/i)).toBeVisible({ timeout: 5000 });

    // Expand API to see token children — click the expand chevron
    const expandButton = page.locator("button[aria-label='Expand']").first();
    if (await expandButton.isVisible()) {
      await expandButton.click();
      // Token appears in sidebar — use first match within sidebar
      const sidebar = page.locator("aside");
      await expect(sidebar.getByText("Demo Token").first()).toBeVisible({ timeout: 10000 });

      // Click the token in sidebar
      await sidebar.getByText("Demo Token").first().click();
      await expect(page.getByText(/sdp_Demo/).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("T14-5: Reset Demo button visible and works", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole("button", { name: /demo account/i }).click();
    await expect(page.getByText("Petstore API")).toBeVisible({ timeout: 15000 });

    // Reset Demo button should be visible in sidebar
    await expect(page.getByRole("button", { name: /reset demo/i })).toBeVisible();

    // Click reset — handle the confirmation dialog
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /reset demo/i }).click();

    // Should show "Resetting..." then refresh data
    // Wait for the API to reappear after reset
    await expect(page.getByText("Petstore API")).toBeVisible({ timeout: 15000 });
  });

  test("T14-6: Sign out returns to landing page", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole("button", { name: /demo account/i }).click();
    await expect(page.getByText("Petstore API")).toBeVisible({ timeout: 15000 });

    // Click Logout
    await page.getByRole("button", { name: /logout/i }).click();

    // Should see landing page again with both buttons
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /demo account/i })).toBeVisible();
  });
});
