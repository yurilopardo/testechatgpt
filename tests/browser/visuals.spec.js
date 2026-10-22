import { useClassicMap } from "./helpers/classic-page.js";
import { test, expect } from "@playwright/test";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);
test.beforeEach(async ({ page }) => {
  await useClassicMap(page);
  await page.goto("/");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
});

// Render deterministic moments to real canvas pixels, independently of wall-clock timing.
async function visualScene(page) {
  await page.evaluate(async () => {
    const { Battle, initialTerrain } = await import("/src/engine.js");
    const { BoardRenderer, drawUnit, ENEMY_STEP_MS } =
      await import("/src/art.js");
    const b = new Battle({ terrain: initialTerrain(), seed: "CLASSIC" });
    b.terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
    b.structures.clear();
    b.units = [
      {
        id: "fire",
        element: "fire",
        name: "Ígni",
        team: "ally",
        x: 3,
        y: 3,
        hp: 3,
        maxHp: 3,
        range: 3,
        moved: false,
        acted: false,
      },
      {
        id: "enemy",
        name: "Sentinela",
        team: "enemy",
        x: 6,
        y: 3,
        hp: 2,
        maxHp: 2,
        range: 2,
        intent: null,
      },
    ];
    b.selectedId = "fire";
    b.visualEvents = [];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const renderer = new BoardRenderer(canvas, b);
    renderer.dispose(); // Advance frames explicitly instead of letting requestAnimationFrame run.
    function eyeCenter() {
      const data = renderer.ctx.getImageData(0, 0, 512, 512).data;
      let sum = 0,
        count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (
          data[i] > 220 &&
          data[i + 1] < 80 &&
          data[i + 2] < 100 &&
          data[i + 3] > 200
        ) {
          sum += (i / 4) % 512;
          count++;
        }
      }
      return count ? sum / count : null;
    }
    window.visualScene = { b, renderer, drawUnit, ENEMY_STEP_MS, eyeCenter };
  });
}

test("preview draws distinct immediate and future paths and clears them without altering the enemy", async ({
  page,
}) => {
  await visualScene(page);
  const result = await page.evaluate(() => {
    const { b, renderer: r } = window.visualScene;
    const enemy = b.enemies[0];
    enemy.x = 4;
    enemy.intent = { x: 3, y: 3 };
    const pathPixels = () => {
      const pixels = r.ctx.getImageData(0, 0, 512, 512).data;
      let immediate = 0,
        future = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 180 && pixels[i + 1] > 180 && pixels[i + 2] > 200)
          immediate++;
        if (
          pixels[i] >= 180 &&
          pixels[i] <= 225 &&
          pixels[i + 1] >= 145 &&
          pixels[i + 1] <= 205 &&
          pixels[i + 2] > 235
        )
          future++;
      }
      return { immediate, future };
    };
    r.preview = b.previewAction(4, 3, "punch");
    r.draw(1000);
    const visible = pathPixels();
    r.preview = null;
    r.draw(1000);
    return {
      visible,
      cleared: pathPixels(),
      x: enemy.x,
      hp: enemy.hp,
      acted: b.selected.acted,
    };
  });
  expect(result.visible.immediate).toBeGreaterThan(40);
  expect(result.visible.future).toBeGreaterThan(40);
  expect(result.cleared).toEqual({ immediate: 0, future: 0 });
  expect([result.x, result.hp, result.acted]).toEqual([4, 2, false]);
});

test("enemy sprite has a black outfit, covered face and two visible red eyes", async ({
  page,
}) => {
  await visualScene(page);
  const colors = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 80;
    const ctx = canvas.getContext("2d");
    window.visualScene.drawUnit(ctx, { team: "enemy" }, 40, 40);
    const data = ctx.getImageData(0, 0, 80, 80).data;
    let black = 0,
      red = 0,
      other = 0;
    const redColumns = new Set();
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) continue;
      if (data[i] > 100 && data[i + 1] < 70 && data[i + 2] < 90) {
        red++;
        redColumns.add((i / 4) % 80);
      } else if (Math.max(data[i], data[i + 1], data[i + 2]) < 55) black++;
      else other++;
    }
    return {
      black,
      red,
      other,
      left: [...redColumns].some((x) => x < 40),
      right: [...redColumns].some((x) => x > 40),
    };
  });
  expect(colors.black).toBeGreaterThan(500);
  expect(colors.red).toBeGreaterThan(8);
  expect(colors.other).toBe(0);
  expect(colors.left && colors.right).toBe(true);
});

test("taking damage flashes the sprite, restores its colors and preserves lethal-hit feedback", async ({
  page,
}) => {
  await visualScene(page);
  const result = await page.evaluate(() => {
    const { b, renderer: r } = window.visualScene;
    const pixel = () => [
      ...r.ctx.getImageData(3 * 64 + 32, 3 * 64 + 38, 1, 1).data,
    ];
    r.draw(1000);
    const normal = pixel();
    b.damage(b.selected, 1);
    r.consumeEvents(1000);
    r.draw(1000);
    const flash = pixel();
    r.draw(1800);
    const restored = pixel();
    const hp = b.selected.hp;
    b.damage(b.selected, 2);
    r.consumeEvents(2000);
    r.draw(2000);
    const lethal = pixel();
    r.draw(2800);
    const cleared = pixel();
    return {
      normal,
      flash,
      restored,
      hp,
      lethal,
      cleared,
      allies: b.allies.length,
    };
  });
  expect(result.flash.slice(0, 3).every((c) => c > 230)).toBe(true);
  expect(result.restored).toEqual(result.normal);
  expect(result.hp).toBe(2);
  expect(result.allies).toBe(0);
  expect(result.lethal.slice(0, 3).every((c) => c > 230)).toBe(true);
  expect(result.cleared).not.toEqual(result.lethal);
});

test("structure collision visibly bumps the enemy forward and back without changing its tile", async ({
  page,
}) => {
  await visualScene(page);
  const result = await page.evaluate(() => {
    const { b, renderer: r, eyeCenter } = window.visualScene;
    b.selected.element = "water";
    const enemy = b.enemies[0];
    enemy.x = 4;
    b.terrain[3][5] = "rock";
    r.reset();
    r.draw(1000);
    const before = eyeCenter();
    b.wave();
    r.consumeEvents(1000);
    r.draw(1170);
    const impact = eyeCenter();
    r.draw(1400);
    const after = eyeCenter();
    return {
      before,
      impact,
      after,
      x: enemy.x,
      y: enemy.y,
      hp: enemy.hp,
      structureHp: b.structureAt(5, 3).hp,
    };
  });
  expect(result.impact - result.before).toBeGreaterThan(8);
  expect(result.after).toBeCloseTo(result.before, 1);
  expect([result.x, result.y]).toEqual([4, 3]);
  expect(result.hp).toBe(1);
  expect(result.structureHp).toBe(1);
});

test("enemy movement renders intermediate tiles instead of teleporting to its destination", async ({
  page,
}) => {
  await visualScene(page);
  const result = await page.evaluate(() => {
    const { b, renderer: r, eyeCenter, ENEMY_STEP_MS } = window.visualScene;
    b.prepareEnemies();
    const duration = r.consumeEvents(1000);
    r.draw(1000);
    const start = eyeCenter();
    r.draw(1000 + ENEMY_STEP_MS);
    const middle = eyeCenter();
    r.draw(1000 + 2 * ENEMY_STEP_MS);
    const end = eyeCenter();
    return {
      start,
      middle,
      end,
      duration,
      step: ENEMY_STEP_MS,
      x: b.enemies[0].x,
    };
  });
  expect(result.start - result.middle).toBeCloseTo(64, 0);
  expect(result.middle - result.end).toBeCloseTo(64, 0);
  expect(result.duration).toBe(2 * result.step);
  expect(result.x).toBe(4);
});

test("a collision between characters flashes both victims and preserves their positions", async ({
  page,
}) => {
  await visualScene(page);
  const result = await page.evaluate(() => {
    const { b, renderer: r } = window.visualScene;
    b.selected.element = "water";
    const target = b.enemies[0];
    target.x = 4;
    const friend = {
      id: "friend",
      element: "fire",
      name: "Aliado",
      team: "ally",
      x: 5,
      y: 3,
      hp: 3,
      maxHp: 3,
      range: 3,
      moved: false,
      acted: false,
    };
    b.units.push(friend);
    const pixel = (x) => [
      ...r.ctx.getImageData(x * 64 + 32, 3 * 64 + 38, 1, 1).data,
    ];
    r.draw(1000);
    const before = pixel(5);
    b.wave();
    r.consumeEvents(1000);
    r.draw(1000);
    const enemyFlash = pixel(4),
      allyFlash = pixel(5);
    r.draw(1800);
    return {
      before,
      enemyFlash,
      allyFlash,
      restored: pixel(5),
      enemy: [target.x, target.hp],
      ally: [friend.x, friend.hp],
    };
  });
  expect(result.enemyFlash.slice(0, 3).every((c) => c > 230)).toBe(true);
  expect(result.allyFlash.slice(0, 3).every((c) => c > 230)).toBe(true);
  expect(result.restored).toEqual(result.before);
  expect(result.enemy).toEqual([4, 1]);
  expect(result.ally).toEqual([5, 2]);
});

test("punch knockback renders a short slide toward the next tile", async ({
  page,
}) => {
  await visualScene(page);
  const result = await page.evaluate(() => {
    const { b, renderer: r, eyeCenter } = window.visualScene;
    const target = b.enemies[0];
    target.x = 4;
    r.draw(1000);
    const before = eyeCenter();
    b.punch(4, 3);
    r.consumeEvents(1000);
    r.draw(1120);
    const sliding = eyeCenter();
    r.draw(1800);
    const after = eyeCenter();
    return { before, sliding, after, hp: target.hp, x: target.x, y: target.y };
  });
  expect(result.sliding).toBeGreaterThan(result.before + 20);
  expect(result.sliding).toBeLessThan(result.after - 8);
  expect(result.after - result.before).toBeCloseTo(64, 0);
  expect([result.x, result.y, result.hp]).toEqual([5, 3, 1]);
});

test("reduced motion skips enemy travel and keeps damage feedback without flashing", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await visualScene(page);
  const result = await page.evaluate(() => {
    const { b, renderer: r } = window.visualScene;
    const pixel = () => [
      ...r.ctx.getImageData(3 * 64 + 32, 3 * 64 + 38, 1, 1).data,
    ];
    r.draw(1000);
    const before = pixel();
    b.damage(b.selected, 1);
    b.prepareEnemies();
    const duration = r.consumeEvents(1000);
    r.draw(1000);
    return {
      before,
      after: pixel(),
      duration,
      reduced: r.reducedMotion,
      damageShown: r.feedback.some((f) => f.type === "damage"),
    };
  });
  expect(result.reduced).toBe(true);
  expect(result.duration).toBe(0);
  expect(result.after).toEqual(result.before);
  expect(result.damageShown).toBe(true);
});

test("wave confirms on Nami's own tile with mouse or keyboard, never on a neighbor", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  await expect(cell(page, 2, 6)).toHaveAttribute(
    "aria-label",
    /ativar Onda Circular/,
  );
  await expect(cell(page, 2, 5)).toHaveAttribute(
    "aria-label",
    /área afetada pela onda/,
  );
  await cell(page, 2, 5).click();
  await expect(cell(page, 2, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 2 PV/,
  );
  await expect(page.locator("#ready-count")).toHaveText("3");
  await cell(page, 2, 6).click();
  await expect(cell(page, 2, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 1 PV/,
  );
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  await expect(cell(page, 2, 6)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#kill-count")).toHaveText("1 de 9 derrotados");
});

test("enemy movement keeps board and actions locked until the next player turn", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#phase-label")).toHaveText(
    "Inimigos em movimento",
  );
  await expect(page.locator("#end-turn")).toBeDisabled();
  await expect(page.locator(".cell:disabled")).toHaveCount(64);
  await expect(
    page.getByRole("button", { name: "Soco", exact: false }),
  ).toBeDisabled();
  await page.keyboard.press("e");
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await expect(page.locator(".cell:disabled")).toHaveCount(0);
});

test("restarting during enemy movement clears the old animation and restores turn one", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#phase-label")).toHaveText(
    "Inimigos em movimento",
  );
  await page
    .getByRole("button", { name: "Reiniciar missão", exact: true })
    .click();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 01");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await expect(cell(page, 1, 5)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
  await expect(page.locator("#end-turn")).toBeEnabled();
});
