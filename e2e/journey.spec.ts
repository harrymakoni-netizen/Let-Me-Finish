import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("first session without a voice sample, then a typed conversation that waits", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Let Me Finish." })).toBeVisible();
  await page.getByRole("link", { name: "Start as a guest" }).click();
  await page.getByLabel(/I’m 18 or over/).check();
  await page.getByLabel(/I understand and agree/).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Go to Home" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)|Still up/ })).toBeVisible();

  await page.goto("/talk/session?scenario=coffee-order");
  await page.getByRole("button", { name: "Start the conversation" }).click();
  await page.getByRole("textbox").fill("A flat white please");
  // Waiting does not send anything: the partner only replies after "I'm finished".
  await page.waitForTimeout(1500);
  await expect(page.getByText("What size would you like")).toHaveCount(0);
  await page.getByRole("button", { name: "I’m finished" }).click();
  await expect(page.getByText("What size would you like")).toBeVisible();
});

test("keyboard-only: skip link and main navigation", async ({ page }) => {
  await page.goto("/support");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
});

for (const path of ["/", "/privacy", "/start"]) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const r = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"), JSON.stringify(r.violations.map((v) => v.id))).toEqual([]);
  });
}

test("privacy controls: export and delete everything", async ({ page }) => {
  const now = new Date().toISOString();
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("lmf:data:v1", JSON.stringify({ version: 1, state: { data: { schema: 1, createdAt: n, onboardedAt: n, ageConfirmedAt: n, goals: [{ id: "g", text: "ring the GP", createdAt: n, updatedAt: n, status: "active" }] } } }));
  }, now);
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export everything" }).click()]);
  expect(download.suggestedFilename()).toMatch(/let-me-finish-export/);
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.getByRole("button", { name: "Delete it all" }).click();
  await page.waitForURL("**/");
  // A fresh, empty default may be written on reload; the person's data must be gone.
  const left = await page.evaluate(() => localStorage.getItem("lmf:data:v1"));
  expect(left ?? "").not.toContain("ring the GP");
});
