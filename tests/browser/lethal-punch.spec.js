import { test, expect } from "@playwright/test";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);

for (const behind of [
  "ally",
  "enemy",
  "tree",
  "rock",
  "wall",
  "grass",
  "water",
])
  test(`a punch kills a 1-PV crossbowman and still resolves the impact into ${behind}`, async ({
    page,
  }) => {
    const terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
    if (!["ally", "enemy"].includes(behind)) terrain[3][4] = behind;
    const options = {
      seed: "lethal-punch",
      terrain,
      waves: false,
      spawns: {
        fire: { x: 2, y: 3 },
        water: behind === "ally" ? { x: 4, y: 3 } : { x: 0, y: 7 },
        earth: { x: 4, y: 4 },
        "enemy-1": { x: 7, y: 0 },
        "enemy-2": { x: 3, y: 3 },
        "enemy-3": behind === "enemy" ? { x: 4, y: 3 } : { x: 7, y: 7 },
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
    await expect(cell(page, 3, 3)).toHaveAttribute(
      "aria-label",
      /Besteiro II, 1 PV/,
    );
    await page.getByRole("button", { name: /^Soco/ }).click();
    await cell(page, 3, 3).hover();
    const targetRow = page
      .locator(".preview-unit")
      .filter({ has: page.getByText("Besteiro II", { exact: true }) });
    await expect(targetRow).toContainText("1 → 0 PV");
    await expect(targetRow).toContainText("Derrotado");
    if (["grass", "water"].includes(behind)) {
      await expect(targetRow).toContainText("Empurrão: D4 → E4");
      await expect(page.locator(".preview-next")).toHaveCount(0);
    } else if (["ally", "enemy"].includes(behind)) {
      const name = behind === "ally" ? "Nami" : "Sentinela III";
      const row = page
        .locator(".preview-unit")
        .filter({ has: page.getByText(name, { exact: true }) });
      await expect(row).toContainText(
        behind === "ally" ? "3 → 2 PV" : "2 → 1 PV",
      );
      await expect(row).toContainText("Dano: 1 PV da colisão");
    } else {
      await expect(page.locator(".preview-structure")).toContainText(
        "2 → 1 PV",
      );
    }
    await expect(cell(page, 3, 3)).toHaveAttribute(
      "aria-label",
      /Besteiro II, 1 PV/,
    );
    await cell(page, 3, 3).click();
    await expect(cell(page, 3, 3)).not.toHaveAttribute(
      "aria-label",
      /Besteiro/,
    );
    await expect(page.locator("#kill-count")).toHaveText("1 de 3 derrotados");
    if (behind === "ally")
      await expect(cell(page, 4, 3)).toHaveAttribute(
        "aria-label",
        /Nami, 2 PV/,
      );
    else if (behind === "enemy")
      await expect(cell(page, 4, 3)).toHaveAttribute(
        "aria-label",
        /Sentinela III, 1 PV/,
      );
    else if (!["grass", "water"].includes(behind))
      await expect(cell(page, 4, 3)).toHaveAttribute(
        "aria-label",
        /estrutura, 1 PV/,
      );
    else
      await expect(cell(page, 4, 3)).not.toHaveAttribute(
        "aria-label",
        /Besteiro/,
      );
  });

for (const reduced of [false, true])
  test(`defeated ninja moves before fading, with reduced motion ${reduced}`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { Battle } = await import("/src/engine.js");
      const { BoardRenderer, ENEMY_STEP_MS } = await import("/src/art.js");
      const b = new Battle({
        terrain: Array.from({ length: 8 }, () => Array(8).fill("grass")),
        waves: false,
      });
      const fire = b.allies[0],
        target = b.enemies.find((u) => u.kind === "ranged");
      Object.assign(fire, { x: 2, y: 3 });
      Object.assign(target, { x: 3, y: 3 });
      b.units = [fire, target];
      b.selectedId = "fire";
      b.visualEvents = [];
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const r = new BoardRenderer(canvas, b);
      r.dispose();
      b.punch(3, 3);
      r.draw(1000);
      const corpse = r.feedback.find(
        (f) => f.type === "damage" && f.id === target.id,
      ).unit;
      const start = r.positionFor(corpse, 1000).x;
      r.draw(1000 + ENEMY_STEP_MS / 2);
      const middle = r.positionFor(corpse, 1000 + ENEMY_STEP_MS / 2).x;
      r.draw(1000 + ENEMY_STEP_MS + 10);
      const end = r.positionFor(corpse, 1000 + ENEMY_STEP_MS + 10).x;
      const pixels = r.ctx.getImageData(4 * 64, 3 * 64, 64, 64).data;
      let redEyes = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] > 170 && pixels[i + 1] < 100 && pixels[i + 2] < 110)
          redEyes++;
      r.draw(3000);
      return {
        start,
        middle,
        end,
        redEyes,
        feedbackCleared: r.feedback.length === 0,
        kills: b.kills,
        livingTarget: b.units.includes(target),
      };
    });
    if (reduced) {
      expect(result.start).toBe(256);
      expect(result.middle).toBe(256);
    } else {
      expect(result.start).toBe(192);
      expect(result.middle).toBeGreaterThan(210);
      expect(result.middle).toBeLessThan(240);
    }
    expect(result.end).toBeCloseTo(256, -1);
    expect(result.redEyes).toBeGreaterThan(0);
    expect(result.feedbackCleared).toBe(true);
    expect(result.kills).toBe(1);
    expect(result.livingTarget).toBe(false);
  });
