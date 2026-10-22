import { useClassicMap } from "./helpers/classic-page.js";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await useClassicMap(page);
  await page.goto("/");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
});

async function structureScene(page, type = "rock") {
  await page.evaluate(async (type) => {
    const { Battle, initialTerrain } = await import("/src/engine.js");
    const { BoardRenderer, createTerrainCanvas } = await import("/src/art.js");
    const b = new Battle({ terrain: initialTerrain(), seed: "CLASSIC" });
    b.terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
    b.structures.clear();
    b.barrier = null;
    b.units = [];
    b.selectedId = null;
    b.visualEvents = [];
    const structure = {
      id: "movable-structure",
      type,
      x: 3,
      y: 3,
      hp: 2,
      maxHp: 2,
      underlay: "grass",
    };
    if (type === "rock") {
      b.terrain[3][3] = "rock";
      b.structures.set("3,3", structure);
    } else b.barrier = structure;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const renderer = new BoardRenderer(canvas, b);
    renderer.dispose();
    const signature = type === "rock" ? [161, 172, 143] : [142, 137, 92];
    const spritePixels = () => {
      const pixels = renderer.ctx.getImageData(0, 0, 512, 512).data;
      let count = 0,
        sumX = 0,
        left = Infinity;
      for (let i = 0; i < pixels.length; i += 4)
        if (signature.every((color, j) => pixels[i + j] === color)) {
          const x = (i / 4) % 512;
          count++;
          sumX += x;
          left = Math.min(left, x);
        }
      return { count, center: sumX / count, left };
    };
    const push = () =>
      b.visualEvents.push({
        type: "structure-push",
        id: structure.id,
        structure: { ...structure },
        path: [
          { x: 2, y: 3 },
          { x: 3, y: 3 },
        ],
      });
    window.structureScene = {
      b,
      renderer,
      structure,
      spritePixels,
      push,
      createTerrainCanvas,
    };
  }, type);
}

for (const type of ["rock", "barrier"])
  test(`${type} slides one tile without a duplicate at its destination`, async ({
    page,
  }) => {
    await structureScene(page, type);
    const result = await page.evaluate(() => {
      const { b, renderer: r, spritePixels, push } = window.structureScene;
      push();
      r.draw(1000);
      const start = spritePixels();
      r.draw(1090);
      const middle = spritePixels();
      r.draw(1180);
      const end = spritePixels();
      r.draw(1400);
      return {
        start,
        middle,
        end,
        settled: spritePixels(),
        locked: r.inputLocked,
        events: b.visualEvents.length,
      };
    });
    expect(result.start.count).toBeGreaterThan(50);
    expect(result.middle.count).toBe(result.start.count);
    expect(result.end.count).toBe(result.start.count);
    expect(result.middle.center - result.start.center).toBeCloseTo(32, 3);
    expect(result.end.center - result.start.center).toBeCloseTo(64, 3);
    expect(result.settled).toEqual(result.end);
    expect(result.locked).toBe(false);
    expect(result.events).toBe(0);
  });

test("a rock over water retains the river and its continuous shoreline", async ({
  page,
}) => {
  await structureScene(page);
  const result = await page.evaluate(() => {
    const { b, structure, createTerrainCanvas } = window.structureScene;
    b.terrain[3] = Array(8).fill("water");
    const expected = createTerrainCanvas(b.terrain);
    b.terrain[3][3] = "rock";
    structure.underlay = "water";
    const actual = createTerrainCanvas(b.terrain, b.structures);
    const omitted = createTerrainCanvas(
      b.terrain,
      b.structures,
      new Set(["3,3"]),
    );
    const samePixels = (a, c, x, y, width, height) => {
      const first = a.getContext("2d").getImageData(x, y, width, height).data;
      const second = c.getContext("2d").getImageData(x, y, width, height).data;
      return first.every((value, i) => value === second[i]);
    };
    return {
      riverMatches: samePixels(actual, expected, 3 * 64, 3 * 64, 64, 8),
      neighborMatches: samePixels(actual, expected, 4 * 64, 3 * 64, 8, 64),
      omittedMatches: samePixels(omitted, expected, 0, 0, 512, 512),
    };
  });
  expect(result).toEqual({
    riverMatches: true,
    neighborMatches: true,
    omittedMatches: true,
  });
});

test("reduced motion and reset leave only the final structure sprite", async ({
  page,
}) => {
  await structureScene(page);
  const result = await page.evaluate(() => {
    const { renderer: r, spritePixels, push } = window.structureScene;
    r.draw(1000);
    const expected = spritePixels();
    r.reducedMotion = true;
    push();
    r.draw(1100);
    const reduced = spritePixels();
    const reducedMotions = r.motions.length;
    r.reducedMotion = false;
    push();
    r.draw(1200);
    const animated = spritePixels();
    r.reset();
    r.draw(1200);
    return {
      expected,
      reduced,
      reducedMotions,
      animated,
      reset: spritePixels(),
      motions: r.motions.length,
    };
  });
  expect(result.reduced).toEqual(result.expected);
  expect(result.reducedMotions).toBe(0);
  expect(result.animated.center).toBeLessThan(result.expected.center);
  expect(result.reset).toEqual(result.expected);
  expect(result.motions).toBe(0);
});

test("a blocked rock visibly bumps toward the collision and returns to its tile", async ({
  page,
}) => {
  await structureScene(page);
  const result = await page.evaluate(() => {
    const { b, renderer: r, structure, spritePixels } = window.structureScene;
    r.draw(1000);
    const before = spritePixels();
    b.visualEvents.push({
      type: "collision",
      id: structure.id,
      from: { x: 3, y: 3 },
      to: { x: 4, y: 3 },
    });
    r.draw(1000);
    r.draw(1170);
    const impact = spritePixels();
    r.draw(1400);
    return { before, impact, after: spritePixels(), x: structure.x };
  });
  // Impact particles may cover a few sprite pixels, but the rock itself jolts 14px.
  expect(result.impact.count).toBeGreaterThan(result.before.count / 2);
  expect(result.impact.left - result.before.left).toBe(14);
  expect(result.after).toEqual(result.before);
  expect(result.x).toBe(3);
});

test("a structure forecast draws its destination and arrow and clears both", async ({
  page,
}) => {
  await structureScene(page);
  const result = await page.evaluate(() => {
    const { renderer: r, structure, spritePixels } = window.structureScene;
    const cyanPixels = () => {
      const data = r.ctx.getImageData(0, 0, 512, 512).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i] === 139 && data[i + 1] === 229 && data[i + 2] === 237)
          count++;
      return count;
    };
    r.draw(1000);
    const before = spritePixels();
    r.preview = {
      units: [],
      pushes: [],
      structures: [],
      collisions: [],
      blocked: [],
      nextEnemies: [],
      structureMoves: [
        {
          id: structure.id,
          type: "rock",
          from: { x: 3, y: 3 },
          to: { x: 4, y: 3 },
          hpBefore: 2,
          hpAfter: 1,
          maxHp: 2,
        },
      ],
    };
    r.draw(1000);
    const active = cyanPixels();
    r.preview = null;
    r.draw(1000);
    return {
      before,
      after: spritePixels(),
      active,
      cleared: cyanPixels(),
      x: structure.x,
      hp: structure.hp,
    };
  });
  expect(result.active).toBeGreaterThan(100);
  expect(result.cleared).toBe(0);
  expect(result.after).toEqual(result.before);
  expect([result.x, result.hp]).toEqual([3, 2]);
});
