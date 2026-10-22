import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { blankLevel, TILE_CATALOG } from "../../src/levels.js";

const cell = (page, x, y) => page.getByTestId(`edit-cell-${x}-${y}`);
async function importText(page, level) {
  await page.locator('[data-edit="json"]').click();
  await page.locator("#editor-json").fill(JSON.stringify(level));
  await page.locator('[data-edit="apply-json"]').click();
  await expect(page.locator("#editor-json-dialog")).not.toBeVisible();
}
async function currentFile(page) {
  await page.locator('[data-edit="json"]').click();
  const result = JSON.parse(await page.locator("#editor-json").inputValue());
  await page.locator('[data-edit="close-json"]').click();
  return result;
}
test.beforeEach(async ({ page }) => {
  await page.goto("/editor.html");
});

test("all 29 tiles can be painted, keep their layers and disclose future effects", async ({
  page,
}) => {
  const level = blankLevel();
  level.units = [];
  await importText(page, level);
  for (const [i, t] of TILE_CATALOG.entries()) {
    await page.locator(`[data-category="${t.category}"]`).click();
    await page.locator(`[data-brush="${t.id}"]`).click();
    await expect(page.locator("#editor-brush-info")).toContainText(t.rule);
    if (t.future)
      await expect(page.locator("#editor-brush-info")).toContainText(t.future);
    await cell(page, i % 8, Math.floor(i / 8)).click();
    await expect(cell(page, i % 8, Math.floor(i / 8))).toHaveAttribute(
      "aria-label",
      new RegExp(t.name),
    );
  }
  const file = await currentFile(page);
  const used = new Set([
    ...file.ground.flat(),
    ...file.objects.flat(),
    ...file.effects.flat(),
    ...file.deployment.flat(),
  ]);
  for (const t of TILE_CATALOG) expect(used.has(t.id)).toBe(true);
  expect(
    await cell(page, 0, 0).evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe("rgba(0, 0, 0, 0)");
  await expect(page.locator("#editor-validation")).toContainText(
    "Efeitos em planejamento",
  );
});

test("painting a drag is one undo operation, redo restores it and keyboard painting works", async ({
  page,
}) => {
  await page.locator('[data-brush="sand"]').click();
  const a = await cell(page, 0, 0).boundingBox(),
    c = await cell(page, 2, 0).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 15 });
  await page.mouse.up();
  for (let x = 0; x < 3; x++)
    await expect(cell(page, x, 0)).toHaveAttribute("aria-label", /Areia/);
  await page.locator("#editor-undo").click();
  for (let x = 0; x < 3; x++)
    await expect(cell(page, x, 0)).toHaveAttribute("aria-label", /Grama/);
  await page.locator("#editor-redo").click();
  await cell(page, 3, 0).focus();
  await page.keyboard.press("Enter");
  await expect(cell(page, 3, 0)).toHaveAttribute("aria-label", /Areia/);
  await page.keyboard.press("Control+z");
  await expect(cell(page, 3, 0)).toHaveAttribute("aria-label", /Grama/);
});

test("layers erase independently, bridge allows deep water and the eyedropper selects the existing tile", async ({
  page,
}) => {
  await page.locator('[data-brush="deep-water"]').click();
  await cell(page, 0, 0).click();
  await page.locator('[data-category="Objetos"]').click();
  await page.locator('[data-brush="bridge"]').click();
  await cell(page, 0, 0).click();
  await expect(cell(page, 0, 0)).toHaveAttribute(
    "aria-label",
    /Água profunda, Ponte/,
  );
  await page.locator('[data-mode="pick"]').click();
  await cell(page, 0, 0).click();
  await expect(page.locator('[data-brush="bridge"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('[data-mode="erase"]').click();
  await cell(page, 0, 0).click();
  await expect(cell(page, 0, 0)).toHaveAttribute(
    "aria-label",
    "A1, Água profunda",
  );
  await page.locator("#editor-undo").click();
  await expect(cell(page, 0, 0)).toHaveAttribute("aria-label", /Ponte/);
});

test("bucket fill respects connected regions and refuses to block an occupied tile", async ({
  page,
}) => {
  await page.locator('[data-brush="sand"]').click();
  await page.locator('[data-mode="fill"]').click();
  await cell(page, 0, 0).click();
  await expect(cell(page, 7, 7)).toHaveAttribute("aria-label", /Areia/);
  await page.locator('[data-brush="deep-water"]').click();
  await cell(page, 0, 0).click();
  await expect(page.locator("#editor-message")).toContainText(
    "bloquearia um personagem",
  );
  await expect(cell(page, 0, 0)).toHaveAttribute("aria-label", /Areia/);
});

test("allies relocate uniquely and enemies can be added or removed without touching the ground", async ({
  page,
}) => {
  await page.locator('[data-category="Personagens"]').click();
  await page.locator('[data-brush="unit:fire"]').click();
  await cell(page, 0, 0).click();
  await expect(cell(page, 0, 0)).toHaveAttribute("aria-label", /Ígni/);
  await expect(cell(page, 1, 6)).not.toHaveAttribute("aria-label", /Ígni/);
  await page.locator('[data-brush="unit:melee"]').click();
  await cell(page, 3, 3).click();
  await cell(page, 4, 3).click();
  await expect(page.locator("#editor-counts")).toContainText("4 inimigos");
  await page.locator("#editor-erase-layer").selectOption("units");
  await page.locator('[data-mode="erase"]').click();
  await cell(page, 3, 3).click();
  await expect(cell(page, 3, 3)).toHaveAttribute("aria-label", "D4, Grama");
  const level = await currentFile(page);
  expect(level.units.filter((u) => u.id === "fire")).toHaveLength(1);
});

test("local library saves, duplicates and restores independent levels across reloads", async ({
  page,
}) => {
  await page.locator("#editor-name").fill("Fase A");
  await page.locator("#editor-name").press("Tab");
  await page.locator('[data-brush="mud"]').click();
  await cell(page, 0, 0).click();
  await page.locator('[data-edit="save"]').click();
  await page.locator('[data-edit="duplicate"]').click();
  await page.locator('[data-brush="sand"]').click();
  await cell(page, 0, 0).click();
  await page.locator('[data-edit="save"]').click();
  await expect(page.locator("#editor-library option")).toHaveCount(3);
  await page.reload();
  await expect(page.locator("#editor-name")).toHaveValue("Fase A — cópia");
  const first = await page
    .locator("#editor-library option")
    .filter({ hasText: /^Fase A$/ })
    .getAttribute("value");
  await page.locator("#editor-library").selectOption(first);
  await expect(cell(page, 0, 0)).toHaveAttribute("aria-label", /Lama/);
  await expect(page.locator("#editor-name")).toHaveValue("Fase A");
});

test("configured turns and waves are used in the playable test and returning preserves the draft", async ({
  page,
}) => {
  await page.locator("#editor-rounds").fill("7");
  await page.locator("#editor-rounds").press("Tab");
  await page.locator('[data-edit="add-wave"]').click();
  await page.locator('[data-wave-field="ranged"]').fill("1");
  await page.locator('[data-wave-field="ranged"]').press("Tab");
  await page.locator('[data-edit="test"]').click();
  await expect(page.locator("#editor-game #round-limit")).toHaveText("/ 07");
  await expect(page.locator("#editor-game #kill-count")).toHaveText(
    "0 de 4 derrotados",
  );
  await expect(
    page.locator('#editor-game [data-testid="cell-5-2"]'),
  ).toHaveAttribute("aria-label", /Sentinela/);
  await page.locator('#editor-game .squad-card[data-unit="fire"]').click();
  await page.locator('#editor-game [data-testid="cell-0-6"]').click();
  await page.locator('[data-edit="close-test"]').click();
  await expect(cell(page, 1, 6)).toHaveAttribute("aria-label", /Ígni/);
  await expect(cell(page, 0, 6)).not.toHaveAttribute("aria-label", /Ígni/);
  await expect(page.locator("#editor-rounds")).toHaveValue("7");
});

test("malformed imports preserve the draft, and valid JSON imports by file without script execution", async ({
  page,
}) => {
  await page.locator('[data-edit="json"]').click();
  await page.locator("#editor-json").fill("{bad");
  await page.locator('[data-edit="apply-json"]').click();
  await expect(page.locator("#editor-json-dialog")).toBeVisible();
  await expect(page.locator("#editor-json-error")).not.toBeEmpty();
  const l = blankLevel();
  l.name = "<script>window.editorPwned=true</script>";
  l.ground[0][0] = "mud";
  await page.locator("#editor-import-file").setInputFiles({
    name: "fase.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(l)),
  });
  await expect(page.locator("#editor-json-dialog")).not.toBeVisible();
  await expect(page.locator("#editor-name")).toHaveValue(l.name);
  expect(await page.evaluate(() => window.editorPwned)).toBeUndefined();
  await expect(cell(page, 0, 0)).toHaveAttribute("aria-label", /Lama/);
});

test("editor exports real JSON downloads and the game can import the resulting file", async ({
  page,
}, testInfo) => {
  await page.locator("#editor-name").fill("Meu cenário");
  await page.locator("#editor-name").press("Tab");
  const pending = page.waitForEvent("download");
  await page.locator('[data-edit="export-json"]').first().click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("meu-cenario.json");
  const path = testInfo.outputPath("fase.json");
  await download.saveAs(path);
  const data = JSON.parse(await readFile(path, "utf8"));
  expect(data.name).toBe("Meu cenário");
  await page.goto("/");
  await page.locator("#game-level-file").setInputFiles(path);
  await expect(page.locator(".mission-header h1")).toHaveText("Meu cenário");
  await expect(page.locator("#kill-count")).toHaveText("0 de 2 derrotados");
  await expect(page.locator('[data-testid="cell-5-2"]')).toHaveAttribute(
    "aria-label",
    /Sentinela/,
  );
});

test("standalone editor and its exported playable phase work offline without network requests", async ({
  page,
}, testInfo) => {
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().startsWith("http")) requests.push(r.url());
  });
  await page.goto(pathToFileURL(resolve("editor-offline.html")).href);
  await expect(page.locator(".editor-cell")).toHaveCount(64);
  const l = blankLevel();
  l.name = "</script><script>window.gamePwned=true</script>";
  l.ground[0][0] = "mud";
  await importText(page, l);
  const pending = page.waitForEvent("download");
  await page.locator('[data-edit="export-html"]').click();
  const download = await pending;
  const path = testInfo.outputPath("fase-jogavel.html");
  await download.saveAs(path);
  await page.goto(pathToFileURL(path).href);
  await expect(page.locator(".mission-header h1")).toHaveText(l.name);
  await expect(page.locator('[data-testid="cell-0-0"]')).toHaveAttribute(
    "aria-label",
    /Lama/,
  );
  expect(await page.evaluate(() => window.gamePwned)).toBeUndefined();
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});

test("a missing ally prevents playtesting, while exporting the incomplete draft remains possible", async ({
  page,
}) => {
  await page.locator("#editor-erase-layer").selectOption("units");
  await page.locator('[data-mode="erase"]').click();
  await cell(page, 1, 6).click();
  await page.locator('[data-edit="test"]').click();
  await expect(page.locator("#editor-message")).toContainText("exatamente três ninjas");
  await expect(page.locator("#editor-play-dialog")).not.toBeVisible();
  const pending = page.waitForEvent("download");
  await page.locator('[data-edit="export-json"]').first().click();
  const d = await pending;
  expect(d.suggestedFilename()).toMatch(/\.json$/);
});

test("procedural generation remains editable and mobile layout does not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#editor-seed").fill("editor-terreno");
  await page.locator('[data-edit="generate"]').click();
  await expect(page.locator("#editor-name")).toHaveValue(
    "Terreno editor-terreno",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const level = await currentFile(page);
  expect(level.ground.flat()).toContain("water");
  expect(level.objects.flat()).toContain("wall");
  await page.locator("#editor-undo").click();
  await expect(page.locator("#editor-name")).toHaveValue("Nova fase");
});

test("the log brush paints two oriented segments atomically and rejects placement beyond the edge", async ({
  page,
}) => {
  await page.locator('[data-category="Objetos"]').click();
  await page.locator('[data-brush="log"]').click();
  await cell(page, 6, 0).click();
  await expect(cell(page, 6, 0)).toHaveAttribute("aria-label", /Tronco/);
  await expect(cell(page, 7, 0)).toHaveAttribute("aria-label", /Tronco/);
  await page.locator("#editor-direction").selectOption("north");
  await cell(page, 0, 0).click();
  await expect(cell(page, 0, 1)).toHaveAttribute("aria-label", /Tronco/);
  await page.locator("#editor-undo").click();
  await expect(cell(page, 0, 0)).not.toHaveAttribute("aria-label", /Tronco/);
  await expect(cell(page, 0, 1)).not.toHaveAttribute("aria-label", /Tronco/);
  await cell(page, 7, 7).click();
  await expect(page.locator("#editor-message")).toContainText(
    "duas casas dentro do mapa",
  );
});

test("an imported draft with several blocked characters can be repaired one cell at a time", async ({
  page,
}) => {
  const level = blankLevel();
  level.objects[6][1] = "tree";
  level.objects[6][2] = "wall";
  await importText(page, level);
  await expect(page.locator("#editor-validation")).toContainText(
    "personagem sobre um obstáculo",
  );
  await page.locator('[data-mode="erase"]').click();
  await cell(page, 1, 6).click();
  await cell(page, 2, 6).click();
  await expect(cell(page, 1, 6)).toHaveAttribute(
    "aria-label",
    "B7, Grama, Ígni",
  );
  await expect(page.locator("#editor-validation")).not.toContainText(
    "personagem sobre um obstáculo",
  );
});

test("a damaged autosaved draft does not erase the saved library", async ({
  page,
}) => {
  await page.locator('[data-edit="save"]').click();
  await page.evaluate(() =>
    localStorage.setItem("triade.editor.draft.v1", "{bad"),
  );
  await page.reload();
  await expect(page.locator("#editor-library option")).toHaveCount(2);
  await expect(page.locator("#editor-storage-note")).not.toContainText(
    "indisponível",
  );
});

test("when browser storage is unavailable, painting and explicit JSON exports still work", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage unavailable");
      },
    }),
  );
  await page.reload();
  await expect(page.locator("#editor-storage-note")).toContainText(
    "indisponível",
  );
  await page.locator('[data-brush="mud"]').click();
  await cell(page, 0, 0).click();
  await expect(cell(page, 0, 0)).toHaveAttribute("aria-label", /Lama/);
  const pending = page.waitForEvent("download");
  await page.locator('[data-edit="export-json"]').first().click();
  const d = await pending;
  expect(d.suggestedFilename()).toMatch(/\.json$/);
});

test("the game exposes an editor link", async ({ page }) => {
  await page.goto("/");
  await page.locator("#team-start").click();
  await page.getByRole("link", { name: "Editor de mapas" }).click();
  await expect(page.locator(".editor-cell")).toHaveCount(64);
});
