import { useClassicMap } from "./helpers/classic-page.js";
import { test, expect } from "@playwright/test";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);
const preview = (page) => page.locator("#attack-preview");

test.beforeEach(async ({ page }) => {
  await useClassicMap(page);
  await page.goto("/");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
});

async function placeBarrierAndMoveWater(page) {
  await page.getByRole("button", { name: /Selecionar Taro/ }).click();
  await cell(page, 1, 6).click();
  await page.getByRole("button", { name: /^Barreira de Terra/ }).click();
  await cell(page, 1, 7).click();
  await expect(cell(page, 1, 7)).toHaveAttribute(
    "aria-label",
    /barreira, 2 PV/,
  );
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

test("one circular wave previews and pushes a summoned barrier and an enemy together without base damage", async ({
  page,
}) => {
  await placeBarrierAndMoveWater(page);
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  const barrier = preview(page).locator(".preview-structure");
  await expect(barrier).toContainText("2 → 2 PV");
  await expect(barrier).toContainText("Empurrão: B8 → A8");
  await expect(preview(page)).toContainText("Empurrão: D8 → E8");
  await expect(cell(page, 1, 7)).toHaveAttribute(
    "aria-label",
    /barreira, 2 PV/,
  );
  await expect(cell(page, 0, 7)).not.toHaveAttribute("aria-label", /barreira/);
  await expect(cell(page, 3, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 2 PV/,
  );
  await expect(page.locator("#ready-count")).toHaveText("2");

  await page.keyboard.press("Enter");
  await expect(cell(page, 0, 7)).toHaveAttribute(
    "aria-label",
    /barreira, 2 PV/,
  );
  await expect(cell(page, 1, 7)).not.toHaveAttribute("aria-label", /barreira/);
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

test("a summoned barrier receives the same punch damage and displacement as a natural rock", async ({
  page,
}) => {
  await placeBarrierAndMoveWater(page);
  await page.getByRole("button", { name: /^Soco/ }).click();
  await cell(page, 1, 7).hover();
  const barrier = preview(page).locator(".preview-structure");
  await expect(barrier).toContainText("2 → 1 PV");
  await expect(barrier).toContainText("Empurrão: B8 → A8");
  await expect(cell(page, 1, 7)).toHaveAttribute(
    "aria-label",
    /barreira, 2 PV/,
  );
  await expect(cell(page, 0, 7)).not.toHaveAttribute("aria-label", /barreira/);
  await expect(page.locator("#ready-count")).toHaveText("2");

  await cell(page, 1, 7).click();
  await expect(cell(page, 0, 7)).toHaveAttribute(
    "aria-label",
    /barreira, 1 PV/,
  );
  await expect(cell(page, 1, 7)).not.toHaveAttribute("aria-label", /barreira/);
  await expect(cell(page, 2, 7)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(cell(page, 3, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 2 PV/,
  );
  await expect(page.locator("#ready-count")).toHaveText("1");
});
