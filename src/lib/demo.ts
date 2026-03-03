// Demo account constants — intentionally public.
// The demo account is a shared, unauthenticated experience by design.

export const DEMO_USER_ID = "a4f228ac-f811-494c-a9bc-5c376255d61c"; // placeholder — updated after user creation
export const DEMO_USER_EMAIL = "demo@simple-dimple-pat.local";
export const DEMO_USER_PASSWORD = "demo-account-public-password";

export function isDemoUser(userId: string): boolean {
  return userId === DEMO_USER_ID;
}
