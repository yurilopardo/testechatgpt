import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);
const unit = (page, id) =>
  page.locator(`.isometric-unit-target[data-unit-id="${id}"]`);
async function ready(page) {
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
}

test("isometric scene preserves the interface and selects all three units by their visible sprite", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/isometrico.html");
  await ready(page);
  await expect(page.locator("#battle-canvas")).toHaveAttribute(
    "data-projection",
    "isometric",
  );
  await expect(page.locator(".cell")).toHaveCount(64);
  await expect(page.locator(".squad-card")).toHaveCount(3);
  await expect(page.locator(".intent-row")).toHaveCount(1);
  await expect(page.locator("#kill-count")).toHaveText("0 de 1 derrotados");
  await expect(page.locator("#pending-enemies")).toHaveText("0");
  await expect(page.locator("#team-dialog")).not.toBeVisible();
  for (const [id, name] of [
    ["water", "Nami"],
    ["earth", "Taro"],
    ["fire", "Ígni"],
  ]) {
    await unit(page, id).click();
    await expect(page.locator("#unit-panel h3")).toHaveText(name);
  }
  await page.keyboard.press("2");
  await expect(page.locator("#unit-panel h3")).toHaveText("Nami");
  await expect(page.locator('[data-command="new-map"]')).toBeDisabled();
  expect(errors).toEqual([]);
});
test("isometric movement, undo, preview, lethal collision and reset use the original combat rules", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/isometrico.html");
  await ready(page);
  await cell(page, 3, 4).click();
  await expect(cell(page, 3, 4)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
  await page.locator("#undo-move").click();
  await expect(cell(page, 2, 4)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
  await cell(page, 3, 4).click();
  await unit(page, "enemy-1").hover();
  await expect(page.locator("#attack-preview")).toContainText("2 → 0 PV");
  await expect(page.locator("#attack-preview")).toContainText("Pedra");
  await unit(page, "enemy-1").click();
  await expect(page.locator("#kill-count")).toHaveText("1 de 1 derrotados");
  await expect(cell(page, 5, 4)).toHaveAttribute(
    "aria-label",
    /estrutura, 1 PV/,
  );
  await expect(page.locator("#result-overlay")).toBeVisible();
  await page.getByRole("button", { name: "Jogar novamente" }).click();
  await ready(page);
  await expect(cell(page, 5, 4)).toHaveAttribute(
    "aria-label",
    /estrutura, 2 PV/,
  );
  await expect(page.locator(".intent-row")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("an enemy advances and arms its attack without additional waves", async ({
  page,
}) => {
  await page.goto("/isometrico.html");
  await page.locator("#end-turn").click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await ready(page);
  await expect(unit(page, "enemy-1")).toHaveAttribute("data-x", "3");
  await expect(unit(page, "enemy-1")).toHaveAttribute("data-y", "4");
  await expect(page.locator(".intent-row")).toHaveCount(1);
  await expect(page.locator("#pending-enemies")).toHaveText("0");
  await expect(page.locator("#intent-list")).toContainText("Avançou 1 casa");
});
test("isometric clicking stays aligned after resize at HiDPI and the diamond does not overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 2,
    }),
    page = await context.newPage();
  await page.goto("/isometrico.html");
  await ready(page);
  await page.setViewportSize({ width: 900, height: 1000 });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
  await unit(page, "earth").click();
  await expect(page.locator("#unit-panel h3")).toHaveText("Taro");
  await cell(page, 1, 6).click();
  await expect(cell(page, 1, 6)).toHaveAttribute("aria-label", /Taro, 3 PV/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#undo-move").click();
  await expect(cell(page, 1, 5)).toHaveAttribute("aria-label", /Taro, 3 PV/);
  // A tall sprite can cover the ground behind it; keyboard navigation still
  // reaches that logical tile without selecting the foreground character.
  await page.keyboard.press("w");
  await page.keyboard.press("Enter");
  await expect(cell(page, 1, 4)).toHaveAttribute("aria-label", /Taro, 3 PV/);
  await context.close();
});
test("reduced standalone experiment works offline and keeps the full game export separate", async ({
  page,
  context,
}) => {
  const requests = [],
    errors = [];
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await context.setOffline(true);
  await page.goto(pathToFileURL(resolve("teste-isometrico.html")).href);
  await ready(page);
  await expect(page.locator("#battle-canvas")).toHaveAttribute(
    "data-projection",
    "isometric",
  );
  await expect(page.locator(".intent-row")).toHaveCount(1);
  await cell(page, 3, 4).click();
  await expect(cell(page, 3, 4)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
  await page.goto(
    `${pathToFileURL(resolve("jogar.html")).href}?map=separate-iso-test`,
  );
  await expect(page.locator("#team-dialog")).toBeVisible();
  await page.locator("#team-start").click();
  await ready(page);
  await expect(page.locator("#battle-canvas")).not.toHaveAttribute(
    "data-projection",
    "isometric",
  );
  await expect(page.locator(".intent-row")).toHaveCount(3);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
