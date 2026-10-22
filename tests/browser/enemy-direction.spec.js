import { test, expect } from "@playwright/test";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);

for (const kind of ["melee", "ranged"])
  test(`${kind}: shove moves the armed attack without rotating it and the survivor hits the new target`, async ({
    page,
  }) => {
    const targetId = kind === "melee" ? "enemy-1" : "enemy-2";
    const options = {
      seed: "direction-ui",
      waves: false,
      terrain: Array.from({ length: 8 }, () => Array(8).fill("grass")),
      spawns: {
        water: { x: 2, y: 3 },
        fire: { x: 3, y: 2 },
        earth: { x: 4, y: 2 },
        "enemy-1": kind === "melee" ? { x: 3, y: 3 } : { x: 7, y: 7 },
        "enemy-2": kind === "ranged" ? { x: 3, y: 3 } : { x: 7, y: 7 },
        "enemy-3": { x: 0, y: 7 },
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
    await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
    const row = page.locator(`[data-enemy="${targetId}"]`);
    await expect(row).toContainText("↑ NORTE · ATAQUE ARMADO");
    await expect(row).toContainText("Ataque em D3");
    await page.locator('.squad-card[data-unit="water"]').click();
    await page.getByRole("button", { name: /^Onda Circular/ }).click();
    await cell(page, 2, 3).hover();
    await expect(page.locator(".preview-armed")).toContainText(
      "Ataque mantém a direção ↑ · E3",
    );
    await expect(row).toContainText("Ataque em D3");
    await cell(page, 2, 3).click();
    await expect(row).toContainText("↑ NORTE · ATAQUE ARMADO");
    await expect(row).toContainText("Ataque em E3");
    await expect(cell(page, 4, 2)).toHaveAttribute(
      "aria-label",
      /Taro, 3 PV, perigo/,
    );
    await expect(cell(page, 3, 2)).not.toHaveAttribute("aria-label", /perigo/);
    await page.getByRole("button", { name: "Encerrar turno" }).click();
    await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
    await expect(page.locator("#round-number")).toHaveText("TURNO 02");
    await expect(cell(page, 4, 2)).toHaveAttribute("aria-label", /Taro, 2 PV/);
    await expect(cell(page, 3, 2)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
    await expect(page.locator(".enemy-ready-label")).toHaveCount(3);
    for (const label of await page
      .locator(".enemy-ready-label")
      .allTextContents())
      expect(label).toContain("ATAQUE ARMADO");
    await expect(page.locator("#intent-list")).toContainText("Avançou 2 casas");
  });

for (const reduced of [false, true])
  test(`advance finishes before the armed banner, and the directional arrow persists (reduced motion ${reduced})`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { Battle } = await import("/src/engine.js");
      const { BoardRenderer } = await import("/src/art.js");
      const b = new Battle({
        terrain: Array.from({ length: 8 }, () => Array(8).fill("grass")),
        waves: false,
      });
      const hero = b.allies[0],
        enemy = b.enemies.find((u) => u.kind === "melee");
      Object.assign(hero, { x: 0, y: 0 });
      Object.assign(enemy, { x: 5, y: 0, intent: null });
      b.units = [hero, enemy];
      b.selectedId = hero.id;
      b.visualEvents = [];
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const r = new BoardRenderer(canvas, b);
      r.dispose();
      const text = [];
      const original = r.ctx.fillText.bind(r.ctx);
      r.ctx.fillText = (label, ...args) => {
        text.push(label);
        original(label, ...args);
      };
      b.prepareEnemies();
      r.draw(1000);
      const ready = r.feedback.find((e) => e.type === "enemy-ready");
      const first = text.includes("ARMADO");
      const motionEnd = r.motions.find((m) => m.id === enemy.id)?.end || 1000;
      text.length = 0;
      r.draw(ready.start + 20);
      const after = text.includes("ARMADO");
      text.length = 0;
      r.draw(ready.start + 1500);
      const pixels = r.ctx.getImageData(
        enemy.x * 64,
        enemy.y * 64,
        16,
        64,
      ).data;
      let arrowPixels = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] === 255 && pixels[i + 1] === 210 && pixels[i + 2] === 165)
          arrowPixels++;
      return {
        first,
        after,
        start: ready.start,
        motionEnd,
        expired: !text.includes("ARMADO"),
        arrowPixels,
        steps: enemy.advanceSteps,
      };
    });
    expect(result.steps).toBe(2);
    expect(result.start).toBe(result.motionEnd);
    expect(result.first).toBe(reduced);
    expect(result.after).toBe(true);
    expect(result.expired).toBe(true);
    expect(result.arrowPixels).toBeGreaterThan(20);
  });
