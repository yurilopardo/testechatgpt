import { useClassicMap } from "./helpers/classic-page.js";
import { test, expect } from "@playwright/test";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);
const undo = (page) => page.locator("#undo-move");
const select = (page, name) =>
  page.getByRole("button", { name: new RegExp(`Selecionar ${name}`) }).click();

test.beforeEach(async ({ page }) => {
  await useClassicMap(page);
  await page.goto("/");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
});

test("undo: mouse restores the origin and allows a different destination", async ({
  page,
}) => {
  await select(page, "Nami");
  await expect(undo(page)).toBeDisabled();
  await cell(page, 3, 6).click();
  await expect(cell(page, 3, 6)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(undo(page)).toBeEnabled();
  await expect(page.locator('[data-mode="move"]')).toBeDisabled();
  await undo(page).click();
  await expect(cell(page, 2, 6)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(cell(page, 3, 6)).not.toHaveAttribute("aria-label", /Nami/);
  await expect(page.locator('[data-mode="move"]')).toBeEnabled();
  await expect(undo(page)).toBeDisabled();
  await cell(page, 2, 7).click();
  await expect(cell(page, 2, 7)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(undo(page)).toBeEnabled();
  await expect(page.locator("#ready-count")).toHaveText("3");
});

test("undo: Z works during special previews and ignores modifiers and key repeat", async ({
  page,
}) => {
  await select(page, "Nami");
  await cell(page, 3, 6).click();
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  await expect(page.locator("#attack-preview")).toHaveClass(/has-preview/);
  await cell(page, 0, 0).click(); // Invalid attack must leave the move reversible.
  await expect(undo(page)).toBeEnabled();
  await cell(page, 3, 6).hover();
  await expect(page.locator("#attack-preview")).toHaveClass(/has-preview/);
  await page.keyboard.press("Control+z");
  await expect(cell(page, 3, 6)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(undo(page)).toBeEnabled();
  await page.keyboard.down("z");
  await expect(cell(page, 2, 6)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(page.locator("#attack-preview")).not.toHaveClass(/has-preview/);
  await cell(page, 2, 7).click();
  await page.keyboard.down("z"); // Holding Z produces a repeated keydown.
  await expect(cell(page, 2, 7)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(undo(page)).toBeEnabled();
  await page.keyboard.up("z");
  await page.keyboard.press("z");
  await expect(cell(page, 2, 6)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(page.locator("#ready-count")).toHaveText("3");
});

test("undo: each ally retains its move and an occupied origin prevents return", async ({
  page,
}) => {
  await select(page, "Nami");
  await cell(page, 3, 6).click();
  await select(page, "Taro");
  await cell(page, 2, 6).click();
  await expect(cell(page, 2, 6)).toHaveAttribute("aria-label", /Taro, 3 PV/);
  await select(page, "Nami");
  await expect(undo(page)).toBeDisabled();
  await page.keyboard.press("z");
  await expect(cell(page, 3, 6)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(cell(page, 2, 6)).toHaveAttribute("aria-label", /Taro, 3 PV/);
  await select(page, "Taro");
  await expect(undo(page)).toBeEnabled();
  await undo(page).click();
  await expect(cell(page, 1, 7)).toHaveAttribute("aria-label", /Taro, 3 PV/);
  await select(page, "Nami");
  await expect(undo(page)).toBeEnabled();
  await undo(page).click();
  await expect(cell(page, 2, 6)).toHaveAttribute("aria-label", /Nami, 3 PV/);
});

test("undo: attacking, waiting and ending the turn commit movement", async ({
  page,
}) => {
  await select(page, "Nami");
  await cell(page, 3, 6).click();
  await expect(undo(page)).toBeEnabled();
  await cell(page, 3, 7).click();
  await expect(cell(page, 3, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 1 PV/,
  );
  await expect(undo(page)).toBeDisabled();
  await page.keyboard.press("z");
  await expect(cell(page, 3, 6)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await select(page, "Ígni");
  await cell(page, 1, 4).click();
  await expect(undo(page)).toBeEnabled();
  await page.getByRole("button", { name: /^Esperar/ }).click();
  await expect(undo(page)).toBeDisabled();
  await select(page, "Taro");
  await cell(page, 2, 7).click();
  await expect(undo(page)).toBeEnabled();
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  for (const name of ["Taro", "Nami", "Ígni"]) {
    await select(page, name);
    await expect(undo(page)).toBeDisabled();
  }
});

test("undo: restart discards history and the confirmation dialog blocks Z", async ({
  page,
}) => {
  await cell(page, 1, 4).click();
  await expect(undo(page)).toBeEnabled();
  await page
    .getByRole("button", { name: "Reiniciar missão", exact: true })
    .click();
  await page.keyboard.press("z");
  await page.getByRole("button", { name: "Continuar missão" }).click();
  await expect(cell(page, 1, 4)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
  await expect(undo(page)).toBeEnabled();
  await page
    .getByRole("button", { name: "Reiniciar missão", exact: true })
    .click();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await expect(cell(page, 1, 5)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
  await expect(cell(page, 1, 4)).not.toHaveAttribute("aria-label", /Ígni/);
  await expect(undo(page)).toBeDisabled();
  await expect(page.locator("#round-number")).toHaveText("TURNO 01");
  await expect(page.locator("#ready-count")).toHaveText("3");
});
