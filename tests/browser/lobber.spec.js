import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const sample = JSON.parse(await readFile("public/fase-tiro-por-cima.json", "utf8"));
const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);
async function openScene(page, level, isometric = false) {
  await page.route("**/src/main.js*", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `import '/src/style.css'; import {createApp} from '/src/app.js';
    createApp(document.querySelector('#app'), {visualTest:${isometric},battleOptions:{level:${JSON.stringify(level)}}});`,
  }));
  await page.goto("/");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
}
async function waveFromLeft(page) {
  await page.locator('.squad-card[data-unit="water"]').click();
  await cell(page, 2, 6).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  await cell(page, 2, 6).focus();
}

for (const isometric of [false, true]) {
  test(`overhead target crosses obstacles, shifts from D2 to E2 and damages only E2 (isometric ${isometric})`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openScene(page, sample, isometric);
    const row = page.locator('[data-enemy="enemy-1"]');
    await expect(row).toContainText("Artilheiro 1");
    await expect(row).toContainText("TIRO POR CIMA · SEM LIMITE");
    await expect(row).toContainText("Ataque em D2");
    await expect(cell(page, 3, 3)).not.toHaveAttribute("aria-label", /perigo|ataque anunciado/);
    await expect(cell(page, 3, 1)).toHaveAttribute("aria-label", /perigo/);
    await waveFromLeft(page);
    await expect(page.locator(".preview-armed")).toContainText("Ataque mantém a direção ↑ · E2");
    await expect(cell(page, 4, 1)).toHaveAttribute("aria-description", /Novo alvo do tiro por cima/);
    await expect(row).toContainText("Ataque em D2");
    await page.keyboard.press("Enter");
    await expect(row).toContainText("Ataque em E2");
    await expect(cell(page, 3, 1)).not.toHaveAttribute("aria-label", /perigo/);
    await expect(cell(page, 4, 3)).toHaveAttribute("aria-label", /muralha/i);
    await expect(cell(page, 4, 3)).not.toHaveAttribute("aria-label", /perigo/);
    await page.getByRole("button", { name: "Encerrar turno" }).click();
    await expect(page.locator("#round-number")).toHaveText("TURNO 02");
    await expect(cell(page, 4, 1)).toHaveAttribute("aria-label", /Taro, 2 PV/);
    await expect(cell(page, 3, 1)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
    await expect(cell(page, 4, 3)).toHaveAttribute("aria-label", /2 PV/);
    expect(errors).toEqual([]);
    if (!isometric) await page.screenshot({ path: "/tmp/shinobi-artilheiro.png", fullPage: true });
  });

  test(`an off-board overhead target does not become a clipped edge hit (isometric ${isometric})`, async ({ page }) => {
    const level = structuredClone(sample);
    Object.assign(level.units.find((u) => u.id === "fire"), { x: 7, y: 6 });
    Object.assign(level.units.find((u) => u.id === "earth"), { x: 7, y: 7 });
    level.units = level.units.filter((u) => u.team === "ally" || u.kind === "lobber");
    await openScene(page, level, isometric);
    const row = page.locator('[data-enemy="enemy-1"]');
    await expect(row).toContainText("Ataque em H7");
    await waveFromLeft(page);
    await expect(page.locator(".preview-armed")).toContainText("fora do mapa");
    await page.keyboard.press("Enter");
    await expect(row).toContainText("Alvo fora do mapa");
    await expect(cell(page, 7, 6)).not.toHaveAttribute("aria-label", /perigo|ataque anunciado/);
    await page.getByRole("button", { name: "Encerrar turno" }).click();
    await expect(page.locator("#round-number")).toHaveText("TURNO 02");
    await expect(cell(page, 7, 6)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
    await expect(page.locator("#battle-log")).toContainText("fora do tabuleiro");
  });
}

test("editor adds Artilheiros to the map and waves, round-trips JSON and plays the export offline", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/editor.html");
  await page.locator('[data-category="Personagens"]').click();
  await page.locator('[data-brush="unit:lobber"]').click();
  await expect(page.locator("#editor-brush-info")).toContainText("Passa por cima de personagens");
  await page.getByTestId("edit-cell-4-1").click();
  await expect(page.getByTestId("edit-cell-4-1")).toHaveAttribute("aria-label", /Artilheiro/);
  await page.locator('[data-edit="add-wave"]').click();
  await page.locator('[data-wave-field="lobber"]').fill("1");
  await page.locator('[data-wave-field="lobber"]').press("Tab");
  await page.locator('[data-wave-field="melee"]').fill("0");
  await page.locator('[data-wave-field="melee"]').press("Tab");
  await page.locator('[data-edit="json"]').click();
  const level = JSON.parse(await page.locator("#editor-json").inputValue());
  expect(level.units.some((u) => u.kind === "lobber")).toBe(true);
  expect(level.rules.waves[0].kinds).toEqual(["lobber"]);
  await page.locator('[data-edit="apply-json"]').click();
  await page.reload();
  await expect(page.getByTestId("edit-cell-4-1")).toHaveAttribute("aria-label", /Artilheiro/);
  await expect(page.locator('[data-wave-field="lobber"]')).toHaveValue("1");
  const downloaded = page.waitForEvent("download");
  await page.locator('[data-edit="export-html"]').click();
  const html = await readFile(await (await downloaded).path(), "utf8");
  await context.setOffline(true);
  await page.goto("about:blank");
  await page.setContent(html);
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await expect(page.locator(".intent-row.lobber")).toContainText("TIRO POR CIMA · SEM LIMITE");
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await expect(page.locator(".intent-row.lobber")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("Artilheiro has black clothing, red eyes and a distinct copper launcher in both projections", async ({ page }) => {
  await openScene(page, sample);
  const sprites = await page.evaluate(async () => {
    const { drawUnit } = await import("/src/art.js");
    const { drawIsometricUnit } = await import("/src/isometric-art.js");
    const render = (draw, kind) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 96;
      const ctx = canvas.getContext("2d");
      draw(ctx, { team: "enemy", kind });
      return [...ctx.getImageData(0, 0, 96, 96).data];
    };
    return [
      (ctx, unit) => drawUnit(ctx, unit, 40, 48),
      (ctx, unit) => drawIsometricUnit(ctx, unit, { x: 40, y: 65 }),
    ].map((draw) => {
      const pixels = render(draw, "lobber"), old = render(draw, "ranged");
      let opaque = 0, dark = 0, red = 0, copper = 0, differing = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels.slice(i, i + 4).some((value, j) => value !== old[i + j])) differing++;
        if (pixels[i + 3] < 200) continue;
        opaque++;
        if (Math.max(...pixels.slice(i, i + 3)) < 65) dark++;
        if (pixels[i] > 220 && pixels[i + 1] < 80 && pixels[i + 2] < 100) red++;
        if (pixels[i] === 165 && pixels[i + 1] === 106 && pixels[i + 2] === 67) copper++;
      }
      return { darkFraction: dark / opaque, red, copper, differing };
    });
  });
  for (const sprite of sprites) {
    expect(sprite.darkFraction).toBeGreaterThan(0.7);
    expect(sprite.red).toBeGreaterThanOrEqual(16);
    expect(sprite.copper).toBeGreaterThan(30);
    expect(sprite.differing).toBeGreaterThan(200);
  }
});

test("editor wave controls fit a narrow screen with all three enemy types", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/editor.html");
  await page.locator('[data-edit="add-wave"]').click();
  await expect(page.locator('[data-wave-field="lobber"]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

test("the packaged Artilheiro example runs offline and previews the translated target", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const html = await readFile("teste-artilheiro.html", "utf8");
  await context.setOffline(true);
  await page.goto("about:blank");
  await page.setContent(html);
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await expect(page.locator(".intent-row")).toHaveCount(3);
  await expect(page.locator(".intent-row.lobber")).toContainText("Ataque em D2");
  await waveFromLeft(page);
  await expect(page.locator(".preview-armed")).toContainText("Ataque mantém a direção ↑ · E2");
  await page.keyboard.press("Enter");
  await expect(page.locator(".intent-row.lobber")).toContainText("Ataque em E2");
  expect(errors).toEqual([]);
});
