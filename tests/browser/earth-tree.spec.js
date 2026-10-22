import { test, expect } from "@playwright/test";
import { Battle } from "../../src/engine.js";

test("Taro's panel and legal movement use three steps like every other ally", async ({
  page,
}) => {
  const options = {
    terrain: Array.from({ length: 8 }, () => Array(8).fill("grass")),
    seed: "earth-range",
    waves: false,
    spawns: {
      earth: { x: 0, y: 0 },
      fire: { x: 0, y: 7 },
      water: { x: 1, y: 7 },
    },
  };
  await page.route("**/src/main.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `import "/src/style.css"; import { createApp } from "/src/app.js";
      createApp(document.querySelector("#app"), { battleOptions: ${JSON.stringify(options)} });`,
    }),
  );
  await page.goto("/");
  for (const [id, range] of [
    ["fire", 3],
    ["water", 3],
    ["earth", 3],
  ]) {
    await page.locator(`.squad-card[data-unit="${id}"]`).click();
    await expect(
      page.locator('[data-command="mode"][data-mode="move"]'),
    ).toContainText(`Até ${range} casas`);
    await expect(page.locator(".unit-stats")).toContainText(`${range}casas`);
  }
  const battle = new Battle(options);
  battle.select("earth");
  const target = [...battle.reachable().values()].find((p) => p.steps === 3);
  expect(target).toBeTruthy();
  await page.getByTestId(`cell-${target.x}-${target.y}`).click();
  await expect(
    page.getByTestId(`cell-${target.x}-${target.y}`),
  ).toHaveAttribute("aria-label", /Taro, 3 PV/);
  await expect(page.locator("#undo-move")).toBeEnabled();
  await page.locator("#undo-move").click();
  await expect(page.getByTestId("cell-0-0")).toHaveAttribute(
    "aria-label",
    /Taro, 3 PV/,
  );
});

test("a tree collision changes its sprite and shows 1/2 PV until destruction; reset restores it", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { Battle } = await import("/src/engine.js");
    const { BoardRenderer } = await import("/src/art.js");
    const terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
    terrain[3][4] = "tree";
    const battle = new Battle({ terrain, waves: false });
    const water = battle.allies.find((u) => u.id === "water");
    const enemy = battle.enemies.find((u) => u.kind === "melee");
    Object.assign(water, { x: 2, y: 3 });
    Object.assign(enemy, { x: 3, y: 3, hp: 3, maxHp: 3 });
    battle.units = [water, enemy];
    battle.select("water");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const renderer = new BoardRenderer(canvas, battle);
    renderer.dispose();
    const labels = [];
    const originalText = renderer.ctx.fillText.bind(renderer.ctx);
    renderer.ctx.fillText = (text, ...args) => {
      labels.push(text);
      originalText(text, ...args);
    };
    renderer.draw(1000);
    const healthy = renderer.base
      .getContext("2d")
      .getImageData(256, 192, 64, 64).data;
    const preview = battle.previewAction(2, 3, "special");
    const previewHp = preview.structures[0].hpAfter;
    battle.wave();
    renderer.draw(2000);
    const damaged = renderer.base
      .getContext("2d")
      .getImageData(256, 192, 64, 64).data;
    let changed = 0;
    for (let i = 0; i < healthy.length; i += 4)
      if ([0, 1, 2].some((c) => healthy[i + c] !== damaged[i + c])) changed++;
    const hit = {
      treeHp: battle.structureAt(4, 3).hp,
      unitHp: enemy.hp,
      badge: labels.includes("1/2 PV"),
    };
    water.acted = false;
    battle.wave();
    renderer.draw(3000);
    const destroyed =
      battle.terrain[3][4] === "grass" && !battle.structureAt(4, 3);
    battle.reset();
    renderer.reset();
    renderer.draw(4000);
    const restored = renderer.base
      .getContext("2d")
      .getImageData(256, 192, 64, 64).data;
    return {
      previewHp,
      hit,
      changed,
      destroyed,
      restored: healthy.every((v, i) => v === restored[i]),
      resetHp: battle.structureAt(4, 3).hp,
    };
  });
  expect(result.previewHp).toBe(1);
  expect(result.hit).toEqual({ treeHp: 1, unitHp: 2, badge: true });
  expect(result.changed).toBeGreaterThan(500);
  expect(result.destroyed).toBe(true);
  expect(result.resetHp).toBe(2);
  expect(result.restored).toBe(true);
});
