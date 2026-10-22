import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("ruined masonry joins across horizontal and vertical tile borders and breaks at its ends", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { createTerrainCanvas } = await import("/src/art.js");
    const terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
    for (const [x, y] of [
      [2, 2],
      [3, 2],
      [3, 3],
      [3, 4],
    ])
      terrain[y][x] = "wall";
    const canvas = createTerrainCanvas(terrain),
      ctx = canvas.getContext("2d");
    const pixel = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
    const grass = createTerrainCanvas(
      Array.from({ length: 8 }, () => Array(8).fill("grass")),
    ).getContext("2d");
    return {
      horizontal: [pixel(3 * 64 - 1, 2 * 64 + 36), pixel(3 * 64, 2 * 64 + 36)],
      vertical: [pixel(3 * 64 + 26, 3 * 64 - 1), pixel(3 * 64 + 26, 3 * 64)],
      brokenLeft: pixel(2 * 64, 2 * 64 + 36),
      grassLeft: [...grass.getImageData(2 * 64, 2 * 64 + 36, 1, 1).data],
      brokenBottom: pixel(3 * 64 + 26, 5 * 64 - 1),
      grassBottom: [...grass.getImageData(3 * 64 + 26, 5 * 64 - 1, 1, 1).data],
    };
  });
  expect(result.horizontal[0]).toEqual(result.horizontal[1]);
  expect(result.horizontal[0].slice(0, 3)).toEqual([124, 128, 107]);
  expect(result.vertical[0]).toEqual(result.vertical[1]);
  expect(result.vertical[0].slice(0, 3)).toEqual([194, 191, 160]);
  expect(result.brokenLeft).toEqual(result.grassLeft);
  expect(result.brokenBottom).toEqual(result.grassBottom);
});

test("full-health ruins already show stable cracks, moss and rubble without painting neighboring tiles", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { createTerrainCanvas } = await import("/src/art.js");
    const terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
    const grass = createTerrainCanvas(terrain)
      .getContext("2d")
      .getImageData(0, 0, 512, 512).data;
    terrain[3][3] = "wall";
    const canvas = createTerrainCanvas(terrain),
      repeated = createTerrainCanvas(terrain),
      ctx = canvas.getContext("2d");
    const pixels = ctx.getImageData(0, 0, 512, 512).data;
    let changedInside = 0,
      changedOutside = 0,
      cracks = 0,
      moss = 0,
      rubble = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const x = (i / 4) % 512,
        y = Math.floor(i / 4 / 512);
      const inside = x >= 192 && x < 256 && y >= 192 && y < 256;
      if (
        pixels[i] !== grass[i] ||
        pixels[i + 1] !== grass[i + 1] ||
        pixels[i + 2] !== grass[i + 2]
      ) {
        if (inside) changedInside++;
        else changedOutside++;
      }
      if (!inside) continue;
      const color = [pixels[i], pixels[i + 1], pixels[i + 2]].join(",");
      if (color === "98,108,84") cracks++;
      if (color === "85,115,70") moss++;
      if (y >= 192 + 49 && color === "150,155,128") rubble++;
    }
    return {
      changedInside,
      changedOutside,
      cracks,
      moss,
      rubble,
      stable: canvas.toDataURL() === repeated.toDataURL(),
    };
  });
  expect(result.changedInside).toBeGreaterThan(900);
  expect(result.changedOutside).toBe(0);
  expect(result.cracks).toBeGreaterThan(20);
  expect(result.moss).toBeGreaterThan(20);
  expect(result.rubble).toBeGreaterThan(10);
  expect(result.stable).toBe(true);
});

test("damaged walls display missing health and an extra fracture and leave grass after destruction", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { Battle } = await import("/src/engine.js");
    const { BoardRenderer, createTerrainCanvas } = await import("/src/art.js");
    const b = new Battle({ waves: false });
    b.terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
    b.terrain[3][3] = "wall";
    const wall = {
      id: "wall-art",
      name: "Muralha",
      type: "wall",
      x: 3,
      y: 3,
      hp: 2,
      maxHp: 2,
    };
    b.structures = new Map([["3,3", wall]]);
    b.barrier = null;
    b.units = [];
    b.selectedId = null;
    b.phase = "enemy";
    b.visualEvents = [];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const renderer = new BoardRenderer(canvas, b);
    renderer.dispose();
    const count = (rgb) => {
      const pixels = renderer.ctx.getImageData(192, 192, 64, 64).data;
      let n = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (rgb.every((value, c) => pixels[i + c] === value)) n++;
      return n;
    };
    renderer.draw(1000);
    const healthy = count([240, 211, 160]);
    wall.hp = 1;
    renderer.draw(1000);
    const damaged = {
      cracks: count([240, 211, 160]),
      hp: count([232, 193, 139]),
      missingHp: count([67, 83, 62]),
    };
    b.terrain[3][3] = "grass";
    b.structures.clear();
    b.terrainRevision++;
    renderer.draw(2000);
    return {
      healthy,
      damaged,
      cleared:
        canvas.toDataURL() === createTerrainCanvas(b.terrain).toDataURL(),
    };
  });
  expect(result.healthy).toBe(0);
  expect(result.damaged.cracks).toBeGreaterThan(20);
  expect(result.damaged.hp).toBe(21);
  expect(result.damaged.missingHp).toBe(21);
  expect(result.cleared).toBe(true);
});

test("a wall destruction preview overlays the ruin and clears without changing its health", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { Battle } = await import("/src/engine.js");
    const { BoardRenderer } = await import("/src/art.js");
    const b = new Battle({ waves: false });
    b.terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
    b.terrain[3][3] = "wall";
    const wall = {
      id: "wall-art",
      name: "Muralha",
      type: "wall",
      x: 3,
      y: 3,
      hp: 1,
      maxHp: 2,
    };
    b.structures = new Map([["3,3", wall]]);
    b.units = [];
    b.selectedId = null;
    b.phase = "enemy";
    b.visualEvents = [];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const r = new BoardRenderer(canvas, b);
    r.dispose();
    r.draw(1000);
    const before = canvas.toDataURL();
    r.preview = {
      units: [],
      pushes: [],
      structures: [{ ...wall, hpBefore: 1, hpAfter: 0, destroyed: true }],
      collisions: [],
      blocked: [],
      nextEnemies: [],
    };
    r.draw(1000);
    const visible = canvas.toDataURL() !== before;
    r.preview = null;
    r.draw(1000);
    return {
      visible,
      cleared: canvas.toDataURL() === before,
      hp: wall.hp,
      terrain: b.terrain[3][3],
    };
  });
  expect(result).toEqual({
    visible: true,
    cleared: true,
    hp: 1,
    terrain: "wall",
  });
});
