import { test, expect } from "@playwright/test";
import { blankLevel } from "../../src/levels.js";
import { Battle } from "../../src/engine.js";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);
const special = (page) =>
  page.locator('[data-command="mode"][data-mode="special"]');
async function fixture(page, element, obstacles = []) {
  const level = blankLevel();
  level.units = [
    { id: element, element, team: "ally", x: 1, y: 3 },
    { id: "fire", element: "fire", team: "ally", x: 2, y: 3 },
    { id: "water", element: "water", team: "ally", x: 4, y: 3 },
    { id: "enemy-1", kind: "melee", team: "enemy", x: 5, y: 3 },
    { id: "enemy-2", kind: "melee", team: "enemy", x: 4, y: 2 },
  ];
  if (element === "lightning") {
    level.units[1].y = 6;
    level.units[2].y = 6;
  }
  for (const [x, y, type] of obstacles) level.objects[y][x] = type;
  await page.route("**/src/main.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `import "/src/style.css";import {createApp} from "/src/app.js";const app=createApp(document.querySelector("#app"),{battleOptions:{level:${JSON.stringify(level)}}});if(import.meta.hot) import.meta.hot.dispose(()=>app.dispose());`,
    }),
  );
  await page.goto("/");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
}

test("initial selection builds exactly three of the five ninjas and keyboard shortcuts follow the chosen order", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?map=five-ui");
  await expect(page.locator("#team-dialog")).toBeVisible();
  await expect(page.locator(".team-option")).toHaveCount(5);
  await expect(page.locator('.team-option[aria-pressed="true"]')).toHaveCount(
    3,
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#team-dialog")).toBeVisible();
  await expect(page.locator('.team-option[data-unit="wind"]')).toBeDisabled();
  await page.locator('.team-option[data-unit="fire"]').click();
  await expect(page.locator("#team-start")).toBeDisabled();
  await page.locator('.team-option[data-unit="lightning"]').click();
  await page.locator('.team-option[data-unit="water"]').click();
  await page.locator('.team-option[data-unit="wind"]').click();
  await page.locator("#team-start").click();
  await expect(page.locator("#team-dialog")).not.toBeVisible();
  await expect(page.locator(".squad-card")).toHaveCount(3);
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await expect(page.locator("#unit-panel h3")).toHaveText("Taro");
  await expect(page.locator(".unit-stats")).toContainText("3casas");
  await page.keyboard.press("2");
  await expect(page.locator("#unit-panel h3")).toHaveText("Rai");
  await expect(special(page)).toContainText("Dash Relâmpago");
  await page.keyboard.press("3");
  await expect(page.locator("#unit-panel h3")).toHaveText("Sora");
  await expect(special(page)).toContainText("Rajada de Vento");
  await page.getByRole("button", { name: "Trocar equipe" }).click();
  await expect(page.locator('.team-option[aria-pressed="true"]')).toHaveCount(
    3,
  );
  await page.locator("#team-cancel").click();
  await expect(page.locator("#unit-panel h3")).toHaveText("Sora");
  await page
    .getByRole("button", { name: "Reiniciar missão", exact: true })
    .click();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(
    page.locator('.squad-card[data-unit="lightning"]'),
  ).toBeVisible();
  await expect(page.locator('.squad-card[data-unit="wind"]')).toBeVisible();
  await page.getByRole("button", { name: "Novo mapa", exact: true }).click();
  await page
    .getByRole("button", { name: "Gerar novo mapa", exact: true })
    .click();
  await expect(
    page.locator('.squad-card[data-unit="lightning"]'),
  ).toBeVisible();
  await expect(page.locator('.squad-card[data-unit="wind"]')).toBeVisible();
  expect(errors).toEqual([]);
});
test("dash preview and execution include base damage, collision, self cost and movement animation", async ({
  page,
}) => {
  await fixture(page, "lightning", [[6, 3, "tree"]]);
  await special(page).click();
  await cell(page, 5, 3).hover();
  await expect(page.locator("#attack-preview")).toContainText("Dash Relâmpago");
  await expect(page.locator("#attack-preview")).toContainText("custo: 1 PV");
  await expect(page.locator("#attack-preview")).toContainText(
    "1 PV do Dash + 1 PV da colisão",
  );
  await expect(cell(page, 4, 3)).toHaveAttribute(
    "aria-description",
    /Destino do dash/,
  );
  await cell(page, 5, 3).click();
  await expect(page.locator("#phase-label")).toHaveText("Dash em execução");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await expect(cell(page, 4, 3)).toHaveAttribute("aria-label", /Rai, 2 PV/);
  await expect(cell(page, 6, 3)).toHaveAttribute(
    "aria-label",
    /estrutura, 1 PV/,
  );
  await expect(cell(page, 5, 3)).not.toHaveAttribute("aria-label", /Sentinela/);
  await expect(page.locator("#kill-count")).toHaveText("1 de 2 derrotados");
  await expect(page.locator("#undo-move")).toBeDisabled();
  await expect(special(page)).toBeDisabled();
});
test("wind flies over an ally, can center on another ally and moves four neighbors with structure collision", async ({
  page,
}) => {
  await fixture(page, "wind", [
    [4, 4, "rock"],
    [4, 5, "wall"],
  ]);
  await special(page).click();
  await cell(page, 4, 3).hover();
  await expect(page.locator("#attack-preview")).toContainText(
    "Rajada de Vento",
  );
  await expect(page.locator("#attack-preview")).toContainText("Pedra");
  await expect(page.locator("#attack-preview")).toContainText("Muralha");
  await cell(page, 4, 3).click();
  await expect(page.locator("#unit-panel h3")).toHaveText("Sora");
  await expect(special(page)).toBeDisabled();
  await expect(cell(page, 6, 3)).toHaveAttribute(
    "aria-label",
    /Sentinela 1, 2 PV/,
  );
  await expect(cell(page, 4, 1)).toHaveAttribute(
    "aria-label",
    /Sentinela 2, 2 PV/,
  );
  await expect(cell(page, 4, 3)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(cell(page, 2, 3)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
  await expect(cell(page, 4, 4)).toHaveAttribute(
    "aria-label",
    /estrutura, 1 PV/,
  );
  await expect(cell(page, 4, 5)).toHaveAttribute(
    "aria-label",
    /estrutura, 1 PV/,
  );
});
test("wind preview warns of damage to its own caster when the chosen center pushes it into a tree", async ({
  page,
}) => {
  await fixture(page, "wind", [[0, 3, "tree"]]);
  await special(page).click();
  await cell(page, 2, 3).hover();
  await expect(page.locator("#attack-preview")).toContainText("Sora");
  await expect(page.locator("#attack-preview")).toContainText("3 → 2 PV");
  await cell(page, 2, 3).click();
  await expect(cell(page, 1, 3)).toHaveAttribute("aria-label", /Sora, 2 PV/);
  await expect(cell(page, 0, 3)).toHaveAttribute(
    "aria-label",
    /estrutura, 1 PV/,
  );
});
test("editor paints new ninjas and tests a three-element team including lightning and wind", async ({
  page,
}) => {
  await page.goto("/editor.html");
  await page.locator('[data-category="Personagens"]').click();
  await expect(page.locator('[data-brush="unit:lightning"]')).toBeVisible();
  await expect(page.locator('[data-brush="unit:wind"]')).toBeVisible();
  await page.locator("#editor-erase-layer").selectOption("units");
  await page.locator('[data-mode="erase"]').click();
  await page.getByTestId("edit-cell-1-6").click();
  await page.getByTestId("edit-cell-2-6").click();
  await page.locator('[data-mode="paint"]').click();
  await page.locator('[data-brush="unit:lightning"]').click();
  await page.getByTestId("edit-cell-1-6").click();
  await page.locator('[data-brush="unit:wind"]').click();
  await page.getByTestId("edit-cell-2-6").click();
  await expect(page.locator("#editor-counts")).toContainText("3/3 aliados");
  await page.locator('[data-edit="test"]').click();
  await expect(
    page.locator('.squad-card[data-unit="lightning"]'),
  ).toBeVisible();
  await expect(page.locator('.squad-card[data-unit="wind"]')).toBeVisible();
  await expect(page.locator('.squad-card[data-unit="earth"]')).toBeVisible();
});
test("new ninja sprites have distinct silhouettes and dash animation interpolates before impact", async ({
  page,
}) => {
  await page.goto("/?map=visual-elements");
  const result = await page.evaluate(async () => {
    const { Battle } = await import("/src/engine.js"),
      { drawUnit, BoardRenderer } = await import("/src/art.js");
    const sprites = Object.fromEntries(
      ["fire", "earth", "lightning", "wind"].map((element) => {
        const c = document.createElement("canvas");
        c.width = c.height = 80;
        drawUnit(c.getContext("2d"), { team: "ally", element }, 40, 42, 1.7);
        return [element, c.toDataURL()];
      }),
    );
    const b = new Battle({
      waves: false,
      terrain: Array.from({ length: 8 }, () => Array(8).fill("grass")),
      team: ["lightning", "wind", "earth"],
    });
    const rai = b.allies.find((u) => u.id === "lightning"),
      e = b.enemies[0];
    Object.assign(rai, { x: 1, y: 3 });
    Object.assign(e, { x: 5, y: 3, hp: 3 });
    b.units = [rai, e];
    b.visualEvents = [];
    b.selectedId = "lightning";
    b.lightning(5, 3);
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const r = new BoardRenderer(c, b);
    r.dispose();
    r.reducedMotion = false;
    const duration = r.consumeEvents(1000),
      position = r.positionFor(rai, 1150),
      impact = r.positionFor(rai, 1300);
    r.trigger(b.lastEffect);
    r.draw(performance.now());
    return {
      sprites,
      duration,
      position,
      impact,
      damageStart: r.feedback.find((e) => e.type === "damage").start,
    };
  });
  expect(new Set(Object.values(result.sprites)).size).toBe(4);
  expect(result.duration).toBe(480);
  expect(result.position.x).toBeCloseTo(160);
  expect(result.impact.x).toBe(256);
  expect(result.damageStart).toBe(1300);
});
test("selection remains usable within a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?map=mobile-team");
  await expect(page.locator("#team-dialog")).toBeVisible();
  await page.locator('.team-option[data-unit="earth"]').click();
  await page.locator('.team-option[data-unit="wind"]').click();
  await page.locator("#team-start").click();
  await expect(page.locator(".squad-card")).toHaveCount(3);
  const size = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(size.content).toBeLessThanOrEqual(size.width);
});


test("offline HTML selects and plays lightning and wind with no network access", async ({page,context}) => {
  const requests=[];
  page.on("request",request=>{if(/^https?:/.test(request.url())) requests.push(request.url());});
  await context.setOffline(true);
  await page.goto(`${pathToFileURL(resolve("jogar.html")).href}?map=offline-five`);
  await page.locator('.team-option[data-unit="fire"]').click();
  await page.locator('.team-option[data-unit="lightning"]').click();
  await page.locator('.team-option[data-unit="water"]').click();
  await page.locator('.team-option[data-unit="wind"]').click();
  await page.locator("#team-start").click();
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  const battle=new Battle({seed:"offline-five",team:["earth","lightning","wind"]});
  battle.select("lightning");
  let dash=null;
  for(const move of [null,...battle.reachable().values()]) {
    const candidate=battle.fork(); if(move)candidate.move(move.x,move.y);
    const target=candidate.targets("special")[0];
    if(target) {dash={move,target};break;}
  }
  expect(dash).toBeTruthy();
  await page.locator('.squad-card[data-unit="lightning"]').click();
  if(dash.move) {await cell(page,dash.move.x,dash.move.y).click();expect(battle.move(dash.move.x,dash.move.y)).toBe(true);}
  await special(page).click();await cell(page,dash.target.x,dash.target.y).click();
  expect(battle.lightning(dash.target.x,dash.target.y)).toBe(true);
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  battle.select("wind");
  const windTarget=battle.targets("special").find(p=>{const preview=battle.previewAction(p.x,p.y,"special");return preview.pushes.length || preview.structureMoves.length;});
  expect(windTarget).toBeTruthy();
  await page.locator('.squad-card[data-unit="wind"]').click();await special(page).click();
  await cell(page,windTarget.x,windTarget.y).hover();await expect(page.locator("#attack-preview")).toContainText("Rajada de Vento");
  await cell(page,windTarget.x,windTarget.y).click();expect(battle.wind(windTarget.x,windTarget.y)).toBe(true);
  for(const u of battle.units) await expect(cell(page,u.x,u.y)).toHaveAttribute("aria-label",new RegExp(`${u.name}, ${u.hp} PV`));
  expect(requests).toEqual([]);
});
