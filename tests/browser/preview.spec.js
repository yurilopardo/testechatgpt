import { useClassicMap } from "./helpers/classic-page.js";
import { test, expect } from "@playwright/test";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);
const preview = (page) => page.locator("#attack-preview");

test.beforeEach(async ({ page }) => {
  await useClassicMap(page);
  await page.goto("/");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
});

test("punch preview distinguishes the immediate push from the next enemy advance without spending an action", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Soco/ }).click();
  for (let i = 0; i < 3; i++) {
    await cell(page, 2, 5).hover();
    await expect(preview(page)).toContainText("2 → 1 PV");
    await expect(preview(page)).toContainText("Empurrão: C6 → D6");
    await expect(preview(page).locator(".preview-next")).toContainText(
      "D6 → C6 · 1 casa",
    );
    await expect(preview(page)).toContainText(
      "Outras jogadas mudam a previsão",
    );
    await expect(cell(page, 3, 5)).toHaveAttribute(
      "aria-description",
      /Destino do empurrão imediato/,
    );
    await expect(cell(page, 2, 5)).toHaveAttribute(
      "aria-description",
      /Destino do próximo avanço/,
    );
    await expect(cell(page, 2, 5)).toHaveAttribute(
      "aria-label",
      /Sentinela I, 2 PV/,
    );
    await expect(page.locator("#ready-count")).toHaveText("3");
    await cell(page, 7, 0).hover();
  }
  await cell(page, 2, 5).click();
  await expect(cell(page, 3, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 1 PV/,
  );
  await expect(preview(page)).not.toHaveClass(/has-preview/);
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await expect(cell(page, 2, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 1 PV/,
  );
});

test("leaving the board or pointing to an invalid cell clears the forecast and its accessible descriptions", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Soco/ }).click();
  await cell(page, 2, 5).hover();
  await expect(preview(page)).toHaveClass(/has-preview/);
  await page.locator("#phase-label").hover();
  await expect(preview(page)).not.toHaveClass(/has-preview/);
  await expect(page.locator(".cell[aria-description]")).toHaveCount(0);
  await cell(page, 2, 5).hover();
  await cell(page, 7, 0).hover();
  await expect(preview(page)).not.toHaveClass(/has-preview/);
  await expect(page.locator(".cell[aria-description]")).toHaveCount(0);
  await expect(cell(page, 2, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 2 PV/,
  );
});

test("keyboard focus previews an attack, Escape cancels it and Enter commits the predicted push", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Soco/ }).click();
  await page.keyboard.press("ArrowRight");
  await expect(cell(page, 2, 5)).toBeFocused();
  await expect(preview(page)).toContainText("Empurrão: C6 → D6");
  await page.keyboard.press("Escape");
  await expect(preview(page)).not.toHaveClass(/has-preview/);
  await expect(cell(page, 2, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 2 PV/,
  );
  await page.getByRole("button", { name: /^Soco/ }).click();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await expect(preview(page)).toContainText("2 → 1 PV");
  await page.keyboard.press("Enter");
  await expect(cell(page, 3, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 1 PV/,
  );
});

test("wave previews all affected units including allies, then predicts the displaced enemy's next position", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await cell(page, 2, 7).click();
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  await expect(preview(page)).toContainText("Empurrão: D8 → E8");
  await expect(preview(page).locator(".preview-ally")).toContainText("Taro");
  await expect(preview(page).locator(".preview-ally")).toContainText("ALIADO");
  await expect(preview(page).locator(".preview-ally")).toContainText(
    "3 → 3 PV",
  );
  await expect(preview(page)).toContainText("Empurrão: B8 → A8");
  await expect(preview(page).locator(".preview-next")).toContainText(
    "E8 → D8 · 1 casa",
  );
  await expect(cell(page, 3, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 2 PV/,
  );
  await expect(cell(page, 1, 7)).toHaveAttribute("aria-label", /Taro, 3 PV/);
  await page.keyboard.press("Enter");
  await expect(cell(page, 4, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 2 PV/,
  );
  await expect(cell(page, 0, 7)).toHaveAttribute("aria-label", /Taro, 3 PV/);
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await expect(cell(page, 3, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 2 PV/,
  );
});

test("collision preview includes lethal damage and structure damage without inventing an enemy path", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await page.getByRole("button", { name: /^Soco/ }).click();
  await cell(page, 2, 5).hover();
  await expect(preview(page)).toContainText("2 → 0 PV");
  await expect(preview(page)).toContainText("Colisão em C5");
  await expect(preview(page)).toContainText("Derrotado");
  await expect(preview(page).locator(".preview-structure")).toContainText(
    "2 → 1 PV",
  );
  await expect(preview(page).locator(".preview-next")).toHaveCount(0);
  await expect(cell(page, 2, 4)).toHaveAttribute(
    "aria-label",
    /estrutura, 2 PV/,
  );
  await cell(page, 2, 5).click();
  await expect(cell(page, 2, 4)).toHaveAttribute(
    "aria-label",
    /estrutura, 1 PV/,
  );
  await expect(page.locator("#kill-count")).toHaveText("1 de 9 derrotados");
});

test("forecasts recompute after a different ally acts instead of retaining old HP or movement", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Soco/ }).click();
  await cell(page, 2, 5).hover();
  await expect(preview(page)).toContainText("2 → 1 PV");
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /Selecionar Ígni/ }).click();
  await page.getByRole("button", { name: /^Soco/ }).click();
  await cell(page, 2, 5).hover();
  await expect(preview(page)).toContainText("1 → 0 PV");
  await expect(preview(page)).toContainText("Derrotado");
  await expect(preview(page).locator(".preview-next")).toHaveCount(0);
  await expect(cell(page, 2, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 1 PV/,
  );
});

test("Earth empty landing previews radial displacement without placing a persistent object", async ({ page }) => {
  await page.getByRole("button", { name: /Selecionar Taro/ }).click();
  await page.getByRole("button", { name: /^Arremesso de Pedra/ }).click();
  await cell(page, 2, 7).hover();
  await expect(preview(page)).toContainText("Casa livre: empurra as 4 vizinhas");
  await expect(preview(page)).toContainText("Empurrão: D8 → E8");
  await expect(cell(page, 3, 7)).toHaveAttribute("aria-label", /Sentinela III, 2 PV/);
  await cell(page, 2, 7).click();
  await expect(cell(page, 2, 7)).not.toHaveAttribute("aria-label", /estrutura|barreira/);
  await expect(cell(page, 4, 7)).toHaveAttribute("aria-label", /Sentinela III, 2 PV/);
  await expect(cell(page, 0, 7)).toHaveAttribute("aria-label", /Taro, 3 PV/);
});

test("an ally pushed into a tree takes the same collision damage shown in the preview", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Selecionar Taro/ }).click();
  await cell(page, 1, 6).click();
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  await expect(preview(page).locator(".preview-ally")).toContainText(
    "3 → 2 PV",
  );
  await expect(preview(page).locator(".preview-ally")).toContainText(
    "Colisão em A7",
  );
  await expect(
    preview(page).locator(".preview-structure").filter({ hasText: "Árvore" }),
  ).toContainText("2 → 1 PV");
  await expect(cell(page, 1, 6)).toHaveAttribute("aria-label", /Taro, 3 PV/);
  await expect(cell(page, 0, 6)).toHaveAttribute(
    "aria-label",
    /estrutura, 2 PV/,
  );
  await page.keyboard.press("Enter");
  await expect(cell(page, 1, 6)).toHaveAttribute("aria-label", /Taro, 2 PV/);
  await expect(cell(page, 0, 6)).toHaveAttribute(
    "aria-label",
    /estrutura, 1 PV/,
  );
  await expect(page.locator("#battle-log")).toContainText(
    "Taro colidiu com Árvore",
  );
  await page.getByRole("button", { name: /Selecionar Taro/ }).click();
  await expect(page.getByRole("button", { name: /^Soco/ })).toBeEnabled();
});

test("punching an enemy into an ally previews and applies damage to both characters", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await cell(page, 3, 5).click();
  await page.getByRole("button", { name: /Selecionar Ígni/ }).click();
  await page.getByRole("button", { name: /^Soco/ }).click();
  await cell(page, 2, 5).hover();
  await expect(preview(page)).toContainText("2 → 0 PV");
  await expect(preview(page)).toContainText("Colisão em D6 · Nami");
  await expect(preview(page).locator(".preview-ally")).toContainText(
    "3 → 2 PV",
  );
  await expect(preview(page).locator(".preview-ally")).toContainText(
    "Atingido pela colisão",
  );
  await expect(preview(page).locator(".preview-next")).toHaveCount(0);
  await expect(cell(page, 3, 5)).toHaveAttribute(
    "aria-description",
    /Colisão prevista contra personagem/,
  );
  await expect(cell(page, 3, 5)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(cell(page, 2, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 2 PV/,
  );
  await cell(page, 2, 5).click();
  await expect(cell(page, 2, 5)).not.toHaveAttribute("aria-label", /Sentinela/);
  await expect(cell(page, 3, 5)).toHaveAttribute("aria-label", /Nami, 2 PV/);
  await expect(cell(page, 4, 5)).not.toHaveAttribute("aria-label", /Nami/);
  await expect(page.locator("#kill-count")).toHaveText("1 de 9 derrotados");
});
