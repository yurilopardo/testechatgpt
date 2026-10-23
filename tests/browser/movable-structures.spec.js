import { useClassicMap } from "./helpers/classic-page.js";
import { initialTerrain } from "../../src/engine.js";
import { test, expect } from "@playwright/test";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);
const preview = (page) => page.locator("#attack-preview");

test.beforeEach(async ({ page }) => {
  await useClassicMap(page);
  await page.goto("/");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
});

async function placeRockAndMoveWater(page) {
  const terrain = initialTerrain();
  terrain[7][1] = "rock";
  await useClassicMap(page, { terrain, spawns: { earth: { x: 1, y: 6 } }, preparedEnemies: { "enemy-3": { x: 3, y: 7, intent: { x: 2, y: 7 } } } });
  await page.goto("/");
  await page.getByRole("button", { name: /Selecionar Taro/ }).click();
  await page.getByRole("button", { name: /^Esperar/ }).click();
  await expect(cell(page, 1, 7)).toHaveAttribute("aria-label", /estrutura, 2 PV/);
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await cell(page, 2, 7).click();
  await expect(cell(page, 2, 7)).toHaveAttribute("aria-label", /Nami, 3 PV/);
}

test("punch previews a natural rock's damage and displacement, then opens its old movement cell", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await cell(page, 3, 4).click();
  await page.getByRole("button", { name: /^Soco/ }).click();
  await cell(page, 2, 4).hover();
  const rock = preview(page).locator(".preview-structure");
  await expect(rock).toContainText("2 → 1 PV");
  await expect(rock).toContainText("Empurrão: C5 → B5");
  await expect(cell(page, 2, 4)).toHaveAttribute(
    "aria-label",
    /estrutura, 2 PV/,
  );
  await expect(cell(page, 1, 4)).not.toHaveAttribute("aria-label", /estrutura/);
  await expect(cell(page, 3, 4)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(page.locator("#ready-count")).toHaveText("3");

  await cell(page, 2, 4).click();
  await expect(cell(page, 2, 4)).not.toHaveAttribute("aria-label", /estrutura/);
  await expect(cell(page, 1, 4)).toHaveAttribute(
    "aria-label",
    /estrutura, 1 PV/,
  );
  await expect(page.locator("#ready-count")).toHaveText("2");
  await expect(preview(page)).not.toHaveClass(/has-preview/);
  await page.getByRole("button", { name: /Selecionar Ígni/ }).click();
  await expect(cell(page, 1, 4)).not.toHaveAttribute(
    "aria-label",
    /movimento disponível/,
  );
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await expect(cell(page, 2, 4)).toHaveAttribute(
    "aria-label",
    /movimento disponível/,
  );
  await expect(cell(page, 1, 4)).not.toHaveAttribute(
    "aria-label",
    /movimento disponível/,
  );
});

test("one circular wave previews and pushes a placed rock and an enemy together without base damage", async ({
  page,
}) => {
  await placeRockAndMoveWater(page);
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  const rock = preview(page).locator(".preview-structure");
  await expect(rock).toContainText("2 → 2 PV");
  await expect(rock).toContainText("Empurrão: B8 → A8");
  await expect(preview(page)).toContainText("Empurrão: D8 → E8");
  await expect(cell(page, 1, 7)).toHaveAttribute(
    "aria-label",
    /estrutura, 2 PV/,
  );
  await expect(cell(page, 0, 7)).not.toHaveAttribute("aria-label", /estrutura/);
  await expect(cell(page, 3, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 2 PV/,
  );
  await expect(page.locator("#ready-count")).toHaveText("2");

  await page.keyboard.press("Enter");
  await expect(cell(page, 0, 7)).toHaveAttribute(
    "aria-label",
    /estrutura, 2 PV/,
  );
  await expect(cell(page, 1, 7)).not.toHaveAttribute("aria-label", /estrutura/);
  await expect(cell(page, 4, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 2 PV/,
  );
  await expect(cell(page, 3, 7)).not.toHaveAttribute("aria-label", /Sentinela/);
  await expect(cell(page, 2, 7)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(page.locator("#ready-count")).toHaveText("1");

  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await expect(cell(page, 1, 7)).toHaveAttribute(
    "aria-label",
    /movimento disponível/,
  );
  await expect(cell(page, 0, 7)).not.toHaveAttribute(
    "aria-label",
    /movimento disponível/,
  );
});

test("a placed rock receives the same punch damage and displacement as a natural rock", async ({
  page,
}) => {
  await placeRockAndMoveWater(page);
  await page.getByRole("button", { name: /^Soco/ }).click();
  await cell(page, 1, 7).hover();
  const rock = preview(page).locator(".preview-structure");
  await expect(rock).toContainText("2 → 1 PV");
  await expect(rock).toContainText("Empurrão: B8 → A8");
  await expect(cell(page, 1, 7)).toHaveAttribute(
    "aria-label",
    /estrutura, 2 PV/,
  );
  await expect(cell(page, 0, 7)).not.toHaveAttribute("aria-label", /estrutura/);
  await expect(page.locator("#ready-count")).toHaveText("2");

  await cell(page, 1, 7).click();
  await expect(cell(page, 0, 7)).toHaveAttribute(
    "aria-label",
    /estrutura, 1 PV/,
  );
  await expect(cell(page, 1, 7)).not.toHaveAttribute("aria-label", /estrutura/);
  await expect(cell(page, 2, 7)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(cell(page, 3, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 2 PV/,
  );
  await expect(page.locator("#ready-count")).toHaveText("1");
});
