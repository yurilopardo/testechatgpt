import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { blankLevel } from "../../src/levels.js";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);
function levelFor(radial = false, allyTarget = false) {
  const level = blankLevel();
  level.units = [
    { id: "earth", team: "ally", element: "earth", x: 0, y: 3 },
    { id: "fire", team: "ally", element: "fire", x: radial ? 5 : 7, y: radial ? 3 : allyTarget ? 3 : 2 },
    { id: "water", team: "ally", element: "water", x: radial ? 0 : 3, y: radial ? 0 : 3 },
    { id: "enemy-1", team: "enemy", kind: "melee", x: radial ? 4 : 7, y: radial ? 2 : allyTarget ? 7 : 3 },
  ];
  if (radial) {
    level.objects[4][4] = "rock";
    level.objects[3][3] = "crate";
  } else {
    level.objects[3][4] = "wall";
    level.objects[3][5] = "wall";
    level.effects[3][6] = "steam";
  }
  level.rules = { maxRounds: 8, waves: [] };
  return level;
}
async function openScene(page, level, isometric) {
  await page.route("**/src/main.js*", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `import '/src/style.css'; import {createApp} from '/src/app.js';
    createApp(document.querySelector('#app'), {visualTest:${isometric},battleOptions:{level:${JSON.stringify(level)}}});`,
  }));
  await page.goto("/");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await page.locator('.squad-card[data-unit="earth"]').click();
  await page.getByRole("button", { name: /^Arremesso de Pedra/ }).click();
}
async function point(page, x, y) {
  await cell(page, x, y).focus();
}

for (const isometric of [false, true]) {
  test(`Earth hits only its target over units, walls and steam (isometric ${isometric})`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openScene(page, levelFor(), isometric);
    await expect(cell(page, 7, 3)).toHaveAttribute("aria-label", /alcance da ação/);
    await expect(cell(page, 7, 2)).not.toHaveAttribute("aria-label", /alcance da ação/);
    await point(page, 7, 3);
    await expect(page.locator("#attack-preview")).toContainText("Impacto direto: 1 PV");
    await expect(page.locator("#attack-preview")).toContainText("2 → 1 PV");
    await expect(page.locator("#attack-preview .preview-unit")).toHaveCount(2);
    await expect(page.locator("#attack-preview")).toContainText("Empurrão: H3 → H2");
    await expect(cell(page, 7, 3)).toHaveAttribute("aria-description", /Impacto da pedra/);
    await page.keyboard.press("Enter");
    await expect(cell(page, 7, 3)).toHaveAttribute("aria-label", /Sentinela 1, 1 PV/);
    await expect(cell(page, 3, 3)).toHaveAttribute("aria-label", /Nami, 3 PV/);
    await expect(cell(page, 7, 1)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
    await expect(cell(page, 7, 2)).not.toHaveAttribute("aria-label", /Ígni/);
    await expect(cell(page, 4, 3)).toHaveAttribute("aria-label", /estrutura, 2 PV/);
    await expect(page.locator("#unit-panel")).toContainText("Taro já agiu");
    expect(errors).toEqual([]);
  });

  test(`empty Earth landing previews and pushes characters and objects without direct damage (isometric ${isometric})`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openScene(page, levelFor(true), isometric);
    await point(page, 4, 3);
    await expect(page.locator("#attack-preview")).toContainText("Casa livre: empurra as 4 vizinhas");
    await expect(page.locator("#attack-preview")).toContainText("Empurrão: E3 → E2");
    await expect(page.locator("#attack-preview")).toContainText("Empurrão: E5 → E6");
    await expect(page.locator("#attack-preview")).toContainText("Empurrão: D4 → C4");
    await expect(cell(page, 4, 4)).toHaveAttribute("aria-description", /Área do empurrão/);
    await expect(cell(page, 4, 2)).toHaveAttribute("aria-label", /Sentinela 1, 2 PV/);
    await page.keyboard.press("Enter");
    await expect(cell(page, 4, 1)).toHaveAttribute("aria-label", /Sentinela 1, 2 PV/);
    await expect(cell(page, 6, 3)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
    await expect(cell(page, 4, 5)).toHaveAttribute("aria-label", /estrutura, 2 PV/);
    await expect(cell(page, 2, 3)).toHaveAttribute("aria-label", /estrutura, 1 PV/);
    await expect(cell(page, 4, 3)).not.toHaveAttribute("aria-label", /estrutura|barreira|personagem/);
    expect(errors).toEqual([]);
  });

  test(`an Earth shot at an ally damages it instead of switching selection (isometric ${isometric})`, async ({ page }) => {
    await openScene(page, levelFor(false, true), isometric);
    await point(page, 7, 3);
    await expect(page.locator("#attack-preview .preview-ally")).toContainText("3 → 2 PV");
    await page.keyboard.press("Enter");
    await expect(cell(page, 7, 3)).toHaveAttribute("aria-label", /Ígni, 2 PV/);
    await expect(page.locator("#unit-panel h3")).toHaveText("Taro");
    await expect(page.locator("#unit-panel")).toContainText("Taro já agiu");
  });
}

test("the standalone game exposes the updated Earth power offline", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.setOffline(true);
  await page.goto("about:blank");
  await page.setContent(await readFile("teste-artilheiro.html", "utf8"));
  await page.locator('.squad-card[data-unit="earth"]').click();
  await page.getByRole("button", { name: /^Arremesso de Pedra/ }).click();
  await point(page, 4, 3);
  await expect(page.locator("#attack-preview")).toContainText("Impacto direto: 1 PV");
  await expect(page.locator("#attack-preview")).toContainText("2 → 1 PV");
  await page.keyboard.press("Enter");
  await expect(cell(page, 4, 3)).toHaveAttribute("aria-label", /estrutura, 1 PV/);
  await expect(page.locator("#unit-panel")).toContainText("Taro já agiu");
  expect(errors).toEqual([]);
});
