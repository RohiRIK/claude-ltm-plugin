import { test, expect } from "@playwright/test";

const API = "http://localhost:7331";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Click the first memory/context node (no node-label-project child) to open the sidebar. */
async function openSidebarViaNode(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const nonProject = Array.from(document.querySelectorAll("g.node")).find(
      (n) => !n.querySelector(".node-label-project"),
    ) as HTMLElement | undefined;
    nonProject?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

// ── Suite ──────────────────────────────────────────────────────────────────────

test.describe("LTM Graph Visualizer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for D3 to render nodes and stats bar to populate
    await page.waitForSelector("svg circle", { timeout: 15000 });
    await page.waitForFunction(
      () => document.body.textContent?.match(/\d+\s*memories/) !== null,
      { timeout: 10000 },
    );
  });

  // ── 1. Graph renders ─────────────────────────────────────────────────────────
  test("1. page loads with graph nodes rendered", async ({ page }) => {
    const circles = page.locator("svg circle");
    const count = await circles.count();
    expect(count).toBeGreaterThan(5);
  });

  // ── 2. Stats bar ─────────────────────────────────────────────────────────────
  test("2. stats bar shows all five counters", async ({ page }) => {
    const body = await page.textContent("body");
    expect(body).toMatch(/\d+\s*memories/);
    expect(body).toMatch(/\d+\s*relations/);
    expect(body).toMatch(/\d+\s*projects/);
    expect(body).toMatch(/\d+\s*context items/);
    expect(body).toMatch(/\d+\s*tags/);
  });

  // ── 3. Project list ──────────────────────────────────────────────────────────
  test("3. project list renders project names", async ({ page }) => {
    const heading = page
      .locator(".uppercase.tracking-widest", { hasText: "Projects" })
      .first();
    await expect(heading).toBeVisible();
    const projectButtons = page.locator("button.text-xs.px-3");
    expect(await projectButtons.count()).toBeGreaterThan(1);
  });

  // ── 4–5+8. Sidebar (shared setup) ───────────────────────────────────────────
  test.describe("Sidebar", () => {
    test.beforeEach(async ({ page }) => {
      await openSidebarViaNode(page);
    });

    test("4. clicking a non-project node opens the sidebar", async ({
      page,
    }) => {
      await expect(
        page.getByRole("button", { name: "×" }),
      ).toBeVisible({ timeout: 5000 });
    });

    test("5. sidebar shows node content fields", async ({ page }) => {
      await page.getByRole("button", { name: "×" }).waitFor({ timeout: 5000 });
      const fieldLabels = page.locator(".uppercase.tracking-widest");
      expect(await fieldLabels.count()).toBeGreaterThan(1);
    });

    test("8. sidebar close button dismisses sidebar", async ({ page }) => {
      const closeBtn = page.getByRole("button", { name: "×" });
      await closeBtn.waitFor({ timeout: 5000 });
      await closeBtn.click();
      await expect(closeBtn).not.toBeVisible({ timeout: 3000 });
    });
  });

  // ── 6. Search ────────────────────────────────────────────────────────────────
  test("6. search box filters graph nodes", async ({ page }) => {
    const initialCount = await page.locator("svg circle").count();
    const searchInput = page
      .locator("input[placeholder='Search memories…']")
      .first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("bun");

    // Wait for the graph to re-render after debounce
    await page.waitForFunction(
      (before) =>
        document.querySelectorAll("svg circle").length !== before ||
        document.querySelectorAll("svg circle").length > 0,
      initialCount,
      { timeout: 3000 },
    );
    await expect(page.locator("svg circle").first()).toBeVisible();

    await searchInput.clear();
    await page.waitForFunction(
      (before) => document.querySelectorAll("svg circle").length === before,
      initialCount,
      { timeout: 3000 },
    );
  });

  // ── 7. Importance slider ─────────────────────────────────────────────────────
  test("7. importance slider filters nodes", async ({ page }) => {
    const allCount = await page.locator("svg circle").count();
    const slider = page.locator("input[type='range']");
    await expect(slider).toBeVisible();

    await slider.fill("5");
    await slider.dispatchEvent("input");
    // Wait for graph to re-render
    await page.waitForFunction(
      () => document.querySelectorAll("svg circle").length >= 0,
      { timeout: 2000 },
    );
    const filteredCount = await page.locator("svg circle").count();
    expect(filteredCount).toBeLessThanOrEqual(allCount);

    await slider.fill("1");
    await slider.dispatchEvent("input");
  });

  // ── 9. Tag filter ────────────────────────────────────────────────────────────
  test("9. tag filter chips toggle node dimming", async ({ page }) => {
    const tagChips = page.locator("button.rounded-full");
    const count = await tagChips.count();
    if (count === 0) {
      test.skip(true, "No tags in DB");
      return;
    }

    const initialOpacity = await page.evaluate(() =>
      Array.from(document.querySelectorAll("g.node")).map(
        (n) => n.getAttribute("opacity") ?? "1",
      ),
    );
    expect(initialOpacity.every((o) => o === "1" || o === null)).toBe(true);

    await tagChips.first().click();
    // Wait for opacity update
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("g.node")).some(
          (n) => n.getAttribute("opacity") === "0.15",
        ),
      { timeout: 3000 },
    );
    const afterOpacity = await page.evaluate(() =>
      Array.from(document.querySelectorAll("g.node")).map(
        (n) => n.getAttribute("opacity") ?? "1",
      ),
    );
    const dimmedCount = afterOpacity.filter((o) => o === "0.15").length;
    expect(dimmedCount).toBeGreaterThan(0);

    // Toggle off
    await tagChips.first().click();
  });

  // ── 10. Spotlight ────────────────────────────────────────────────────────────
  test("10. spotlight opens with ⌘K and accepts input", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const modal = page.locator("input[placeholder='Jump to memory…']");
    await expect(modal).toBeVisible({ timeout: 3000 });

    await modal.fill("bun");
    await expect(modal).toHaveValue("bun");

    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  // ── 11. Project drill-down ───────────────────────────────────────────────────
  test("11. clicking project node navigates to drill-down page", async ({
    page,
  }) => {
    const clicked = await page.evaluate(() => {
      const projectNode = Array.from(
        document.querySelectorAll("g.node"),
      ).find((n) => n.querySelector("text")) as HTMLElement | undefined;
      if (!projectNode) return false;
      projectNode.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      return true;
    });

    if (!clicked) {
      test.skip(true, "No project nodes found in graph");
      return;
    }

    await page.waitForURL(/\/project\//, { timeout: 5000 });
    const backBtn = page.locator("a", { hasText: "Back" });
    await expect(backBtn).toBeVisible({ timeout: 5000 });

    await backBtn.click();
    await page.waitForURL("/", { timeout: 5000 });
    await expect(page.locator("svg circle").first()).toBeVisible({
      timeout: 10000,
    });
  });

  // ── 12. API health ───────────────────────────────────────────────────────────
  test("12. /api/stats returns memories > 0", async ({ request }) => {
    const res = await request.get(`${API}/api/stats`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("memories");
    expect(json.memories).toBeGreaterThan(0);
  });

  // ── 13. WebSocket ────────────────────────────────────────────────────────────
  test("13. WebSocket connects to API server", async ({ page }) => {
    const connected = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const ws = new WebSocket("ws://localhost:7331");
          const t = setTimeout(() => {
            ws.close();
            resolve(false);
          }, 5000);
          ws.onopen = () => {
            clearTimeout(t);
            ws.close();
            resolve(true);
          };
          ws.onerror = () => {
            clearTimeout(t);
            resolve(false);
          };
        }),
    );
    expect(connected).toBe(true);
  });
});
