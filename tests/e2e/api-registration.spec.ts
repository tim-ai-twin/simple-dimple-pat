import { test, expect } from "@playwright/test";
import path from "path";

test.describe("API Registration (US1)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (assumes user is authenticated via test setup)
    await page.goto("/");
  });

  test("should show + Add API button in sidebar", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /add api/i });
    await expect(addButton).toBeVisible();
  });

  test("should show Add API form when clicking + Add API", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /add api/i }).click();

    // Form fields should be visible
    await expect(page.getByPlaceholder(/api name/i).or(page.getByLabel(/name/i))).toBeVisible();
    await expect(
      page.getByPlaceholder(/https:\/\/api\.example\.com/i).or(page.getByLabel(/base url/i)),
    ).toBeVisible();
  });

  test("should register an API with valid spec and see it in sidebar", async ({
    page,
  }) => {
    // Click Add API
    await page.getByRole("button", { name: /add api/i }).click();

    // Fill form
    const nameInput = page.getByPlaceholder(/api name/i).or(page.getByLabel(/name/i));
    await nameInput.fill("Test Petstore");

    const urlInput = page.getByPlaceholder(/https:\/\/api\.example\.com/i).or(page.getByLabel(/base url/i));
    await urlInput.fill("https://petstore.example.com");

    // Upload spec file
    const specFixture = path.join(
      __dirname,
      "../fixtures/petstore-minimal.yaml",
    );
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(specFixture);

    // Fill credential
    const credInput = page.getByPlaceholder(/credential/i).or(page.getByLabel(/credential/i));
    await credInput.fill("test-api-key-12345");

    // Submit
    await page.getByRole("button", { name: /save api/i }).click();

    // Verify API appears in sidebar
    await expect(page.getByText("Test Petstore")).toBeVisible({ timeout: 10000 });
  });

  test("should show error for malformed spec upload", async ({ page }) => {
    await page.getByRole("button", { name: /add api/i }).click();

    // Fill minimum required fields
    const nameInput = page.getByPlaceholder(/api name/i).or(page.getByLabel(/name/i));
    await nameInput.fill("Bad Spec API");

    const urlInput = page.getByPlaceholder(/https:\/\/api\.example\.com/i).or(page.getByLabel(/base url/i));
    await urlInput.fill("https://example.com");

    // TODO: Upload an invalid spec file and verify error message is shown
    // This test will be refined when the upload component supports inline validation
  });

  test("should display credential as obscured with show toggle", async ({
    page,
  }) => {
    // This test requires an API to already be registered
    // Will be filled in during Playwright MCP verification (T049)
  });
});
