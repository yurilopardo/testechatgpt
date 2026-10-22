import { useClassicMap } from "./helpers/classic-page.js";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await useClassicMap(page);
});

test("ranged enemies have a distinct hood and crossbow while keeping dark clothing and red eyes", async ({
  page,
}) => {
  await page.goto("/");
  const sprites = await page.evaluate(async () => {
    const { drawUnit } = await import("/src/art.js");
    const gallery = document.createElement("div");
    gallery.id = "enemy-art-gallery";
    gallery.style.cssText =
      "position:fixed;inset:0;z-index:10000;background:#284936;display:flex;gap:40px;align-items:center;justify-content:center;color:white;font:18px monospace";
    document.body.append(gallery);
    const render = (kind, label) => {
      const card = document.createElement("div");
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      canvas.style.cssText =
        "width:256px;height:256px;image-rendering:pixelated;display:block";
      card.append(canvas, label);
      gallery.append(card);
      const ctx = canvas.getContext("2d");
      drawUnit(ctx, { team: "enemy", kind }, 32, 32);
      const pixels = [...ctx.getImageData(0, 0, 64, 64).data];
      let dark = 0,
        opaque = 0,
        red = 0,
        purple = 0;
      const eyes = { left: false, right: false };
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 200) continue;
        opaque++;
        if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 55) dark++;
        if (pixels[i] > 200 && pixels[i + 1] < 80 && pixels[i + 2] < 100) {
          red++;
          const x = (i / 4) % 64;
          eyes[x < 32 ? "left" : "right"] = true;
        }
        if (pixels[i + 2] > pixels[i] && pixels[i] > pixels[i + 1] + 10)
          purple++;
      }
      return { pixels, dark, opaque, red, purple, eyes };
    };
    const melee = render("melee", "Sentinela · corpo a corpo");
    const ranged = render("ranged", "Atirador · ataque à distância");
    let differing = 0;
    for (let i = 0; i < ranged.pixels.length; i += 4)
      if (
        ranged.pixels.slice(i, i + 4).some((v, j) => v !== melee.pixels[i + j])
      )
        differing++;
    const at = (x, y) =>
      ranged.pixels.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4);
    return {
      darkFraction: ranged.dark / ranged.opaque,
      red: ranged.red,
      purple: ranged.purple,
      eyes: ranged.eyes,
      differing,
      hoodTip: at(32, 10),
      leftBow: at(12, 35),
      rightBow: at(51, 35),
    };
  });
  expect(sprites.darkFraction).toBeGreaterThan(0.75);
  expect(sprites.red).toBeGreaterThanOrEqual(12);
  expect(sprites.purple).toBeGreaterThan(40);
  expect(sprites.eyes).toEqual({ left: true, right: true });
  expect(sprites.differing).toBeGreaterThan(500);
  for (const pixel of [sprites.hoodTip, sprites.leftBow, sprites.rightBow])
    expect(pixel[3]).toBe(255);
  await page.locator("#enemy-art-gallery").screenshot({
    path: "/tmp/triade-ranged-art.png",
  });
});

test("the knockback preview keeps the ranged enemy silhouette", async ({
  page,
}) => {
  await page.goto("/");
  const ghost = await page.evaluate(async () => {
    const { Battle, initialTerrain } = await import("/src/engine.js");
    const { BoardRenderer } = await import("/src/art.js");
    const b = new Battle({ terrain: initialTerrain(), seed: "CLASSIC" });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const renderer = new BoardRenderer(canvas, b);
    renderer.dispose();
    renderer.ctx.clearRect(0, 0, 512, 512);
    renderer.preview = {
      units: [{ id: "archer", team: "enemy", kind: "ranged", hpAfter: 1 }],
      pushes: [{ id: "archer", from: { x: 2, y: 3 }, to: { x: 3, y: 3 } }],
      structures: [],
      collisions: [],
      blocked: [],
      nextEnemies: [],
    };
    renderer.drawPreview();
    const pixel = (x, y) => [...renderer.ctx.getImageData(x, y, 1, 1).data];
    return {
      hoodTip: pixel(3 * 64 + 32, 3 * 64 + 33 - 21),
      crossbow: pixel(3 * 64 + 32 - 19, 3 * 64 + 33 + 3),
    };
  });
  for (const pixel of [ghost.hoodTip, ghost.crossbow]) {
    expect(pixel[3]).toBeGreaterThan(100);
    expect(pixel[3]).toBeLessThan(150);
  }
});

test("ranged projectiles travel to the first interceptor and cancelled shots draw no arrow", async ({
  page,
}) => {
  await page.goto("/");
  const animation = await page.evaluate(async () => {
    const { Battle, initialTerrain } = await import("/src/engine.js");
    const { BoardRenderer } = await import("/src/art.js");
    const b = new Battle({
      terrain: initialTerrain(),
      seed: "CLASSIC",
      waves: false,
      maxRounds: null,
    });
    b.terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
    b.structures.clear();
    b.units = [
      {
        id: "target",
        name: "Ígni",
        team: "ally",
        element: "fire",
        x: 5,
        y: 3,
        hp: 3,
        maxHp: 3,
        range: 3,
      },
      {
        id: "interceptor",
        name: "Taro",
        team: "ally",
        element: "earth",
        x: 3,
        y: 3,
        hp: 3,
        maxHp: 3,
        range: 3,
      },
      {
        id: "shooter",
        name: "Besteiro",
        team: "enemy",
        kind: "ranged",
        x: 1,
        y: 3,
        hp: 2,
        maxHp: 2,
        range: 2,
        attackRange: 4,
        intent: { x: 5, y: 3 },
      },
    ];
    b.selectedId = "target";
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const renderer = new BoardRenderer(canvas, b);
    renderer.dispose();
    b.beginEnemyTurn();
    b.resolveEnemyTurn();
    const hit = b.lastEffect.strikes[0].hit;
    renderer.trigger(b.lastEffect);
    let start = renderer.effect.start;
    const frame = (elapsed) => {
      renderer.ctx.clearRect(0, 0, 512, 512);
      renderer.drawEffect(start + elapsed);
      const pixels = renderer.ctx.getImageData(0, 0, 512, 512).data;
      let count = 0,
        sumX = 0,
        minX = 512,
        maxX = -1;
      for (let i = 0; i < pixels.length; i += 4) {
        if (
          pixels[i + 3] < 15 ||
          pixels[i + 2] <= pixels[i] + 15 ||
          pixels[i] <= pixels[i + 1] + 10
        )
          continue;
        const x = (i / 4) % 512;
        count++;
        sumX += x;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
      return { count, center: count ? sumX / count : null, minX, maxX };
    };
    const middle = frame(162.5);
    const arrival = frame(325);
    const stopped = frame(550);
    const finished = frame(651);
    const health = [
      b.units.find((u) => u.id === "interceptor").hp,
      b.units.find((u) => u.id === "target").hp,
    ];
    // Moving the shooter off the announced row invalidates its fixed target.
    Object.assign(b.enemies[0], { x: 1, y: 2, intent: { x: 5, y: 3 } });
    b.beginEnemyTurn();
    b.resolveEnemyTurn();
    const cancelled = b.lastEffect.strikes[0].cancelled;
    renderer.trigger(b.lastEffect);
    start = renderer.effect.start;
    return {
      hit,
      health,
      middle,
      arrival,
      stopped,
      finished,
      cancelled,
      cancelledFrame: frame(162.5),
    };
  });
  expect(animation.hit).toEqual({ x: 3, y: 3 });
  expect(animation.health).toEqual([2, 3]);
  expect(animation.middle.count).toBeGreaterThan(40);
  expect(animation.middle.center).toBeGreaterThan(145);
  expect(animation.middle.center).toBeLessThan(170);
  expect(animation.arrival.center - animation.middle.center).toBeCloseTo(64, 0);
  expect(animation.stopped.center).toBeCloseTo(animation.arrival.center, 0);
  for (const frame of [animation.middle, animation.arrival, animation.stopped])
    expect(frame.maxX).toBeLessThan(240);
  expect(animation.finished.count).toBe(0);
  expect(animation.cancelled).toBe(true);
  expect(animation.cancelledFrame.count).toBe(0);
});
