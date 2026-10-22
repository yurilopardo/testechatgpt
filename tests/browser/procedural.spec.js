import { test, expect } from "@playwright/test";
import { Battle } from "../../src/engine.js";
import { EXPORTED_GENERATED_WIN_STEPS } from "../helpers/generated-strategy.js";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);
const labels = (page) =>
  page
    .locator(".cell")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
const ready = async (page) => {
  if (await page.locator("#team-dialog").isVisible())
    await page.locator("#team-start").click();
  if (await page.locator("#start-battle").isVisible())
    await page.locator("#start-battle").click();
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
};

// These tests deliberately use the production procedural startup. No classic
// map route, internal game handle, or browser-state mutation is installed.
for (const [seed, formation] of [
  ["amostra-0", "Costa"],
  ["amostra-1", "Rio"],
  ["amostra-11", "Lago"],
]) {
  test(`procedural map: ${formation} has accessible water and fixed 2-PV ruins`, async ({
    page,
  }) => {
    await page.goto(`/?map=${seed}`);
    await ready(page);
    await expect(page.locator("#map-code")).toHaveText(seed);
    await expect(page.locator("#map-kind")).toHaveText(formation);
    await expect(page.locator(".cell")).toHaveCount(64);
    const cells = await labels(page);
    expect(cells.some((label) => label.includes(", água"))).toBe(true);
    expect(cells.some((label) => label.includes(", grama"))).toBe(true);
    expect(cells.some((label) => label.includes("árvore — bloqueada"))).toBe(
      true,
    );
    expect(cells.some((label) => label.includes("pedra — bloqueada"))).toBe(
      true,
    );
    const walls = cells.filter((label) => label.includes("muralha em ruínas"));
    expect(walls.length).toBeGreaterThanOrEqual(3);
    for (const wall of walls) {
      expect(wall).toContain("bloqueada");
      expect(wall).toContain("2 PV");
      expect(wall).not.toContain("movimento disponível");
    }
  });
}

test("procedural map: shared URL reproduces terrain, spawns and intentions after reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?map=UI-REPRO&from=shared#field");
  await ready(page);
  await expect(page.locator("#map-code")).toHaveText("ui-repro");
  const first = await labels(page);
  const formation = await page.locator("#map-kind").textContent();
  const url = new URL(page.url());
  expect(url.searchParams.get("map")).toBe("ui-repro");
  expect(url.searchParams.get("from")).toBe("shared");
  expect(url.hash).toBe("#field");
  await page.reload();
  await ready(page);
  expect(await labels(page)).toEqual(first);
  await expect(page.locator("#map-kind")).toHaveText(formation);
  expect(errors).toEqual([]);
});

test("procedural map: restart restores the same terrain and damaged structures", async ({
  page,
}) => {
  const battle = new Battle({ seed: "ui-reset" });
  await page.goto("/?map=ui-reset");
  await ready(page);
  const initial = await labels(page);
  const url = page.url();
  // Find a legal move and punch that damage a generated rock or wall.
  let action = null;
  for (const ally of battle.allies) {
    for (const move of [null, ...battle.reachable(ally).values()]) {
      const candidate = battle.fork();
      candidate.select(ally.id);
      if (move) candidate.move(move.x, move.y);
      for (const target of candidate.targets("punch")) {
        const preview = candidate.previewAction(target.x, target.y, "punch");
        if (preview?.structures.some((s) => s.hpAfter < s.hpBefore))
          action = { ally, move, target };
      }
    }
  }
  expect(action).toBeTruthy();
  await page.locator(`.squad-card[data-unit="${action.ally.id}"]`).click();
  if (action.move) await cell(page, action.move.x, action.move.y).click();
  await page.locator('[data-command="mode"][data-mode="punch"]').click();
  await cell(page, action.target.x, action.target.y).click();
  await expect(page.locator("#undo-move")).toBeDisabled();
  expect(await labels(page)).not.toEqual(initial);
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await ready(page);
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await page
    .getByRole("button", { name: "Reiniciar missão", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Uma nova estratégia?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await ready(page);
  expect(await labels(page)).toEqual(initial);
  expect(page.url()).toBe(url);
  await expect(page.locator("#map-code")).toHaveText("ui-reset");
  await expect(page.locator("#round-number")).toHaveText("TURNO 01");
  await expect(page.locator("#ready-count")).toHaveText("3");
  await expect(page.locator("#undo-move")).toBeDisabled();
});

test("procedural map: cancel preserves the mission and confirm generates a shareable new map", async ({
  page,
}) => {
  await page.goto("/?map=amostra-1&from=shared#field");
  await ready(page);
  const before = await labels(page);
  const oldUrl = page.url();
  await page.getByRole("button", { name: "Novo mapa", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Explorar outro terreno?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar missão" }).click();
  expect(await labels(page)).toEqual(before);
  expect(page.url()).toBe(oldUrl);
  await page.getByRole("button", { name: "Novo mapa", exact: true }).click();
  await page.getByRole("button", { name: "Gerar novo mapa" }).click();
  await ready(page);
  const newSeed = await page.locator("#map-code").textContent();
  expect(newSeed).not.toBe("amostra-1");
  const url = new URL(page.url());
  expect(url.searchParams.get("map")).toBe(newSeed);
  expect(url.searchParams.get("from")).toBe("shared");
  expect(url.hash).toBe("#field");
  await expect(page.locator("#round-number")).toHaveText("TURNO 01");
  await expect(page.locator("#undo-move")).toBeDisabled();
  const generated = await labels(page);
  expect(generated).not.toEqual(before);
  await page.reload();
  await ready(page);
  expect(await labels(page)).toEqual(generated);
});

test("procedural map: undo and restart keep the keyboard cursor on the generated hero", async ({
  page,
}) => {
  const battle = new Battle({ seed: "ui-reset" });
  const origin = { x: battle.selected.x, y: battle.selected.y };
  const move = [...battle.reachable().values()][0];
  await page.goto("/?map=ui-reset");
  await ready(page);
  await cell(page, move.x, move.y).click();
  await expect(page.locator("#undo-move")).toBeEnabled();
  await page.keyboard.press("z");
  await expect(cell(page, origin.x, origin.y)).toHaveAttribute(
    "aria-label",
    /Ígni, 3 PV/,
  );
  await expect(page.locator('.cell[tabindex="0"]')).toHaveCount(1);
  await expect(cell(page, origin.x, origin.y)).toHaveAttribute("tabindex", "0");
  await expect(page.locator("#undo-move")).toBeDisabled();
  await cell(page, move.x, move.y).click();
  await page
    .getByRole("button", { name: "Reiniciar missão", exact: true })
    .click();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await ready(page);
  await expect(page.locator('.cell[tabindex="0"]')).toHaveCount(1);
  await expect(cell(page, origin.x, origin.y)).toHaveAttribute("tabindex", "0");
  await page.keyboard.press("ArrowRight");
  await expect(cell(page, Math.min(origin.x + 1, 7), origin.y)).toBeFocused();
  await expect(page.locator("#ready-count")).toHaveText("3");
  await expect(page.locator("#undo-move")).toBeDisabled();
});

test("procedural map: a fresh mobile visit generates a code without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await ready(page);
  const seed = await page.locator("#map-code").textContent();
  expect(seed).toMatch(/^map-[a-z0-9]+-[a-z0-9]+$/);
  expect(new URL(page.url()).searchParams.get("map")).toBe(seed);
  await expect(page.locator("#map-kind")).toHaveText(/^(Rio|Lago|Costa)$/);
  await expect(
    page.getByRole("button", { name: "Novo mapa", exact: true }),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
});

test("procedural map: the generated mission can be won through public controls by round five", async ({
  page,
}) => {
  await page.goto("/?map=EXPORT-TEST");
  await ready(page);
  await expect(page.locator("#map-code")).toHaveText("export-test");
  const initial = await labels(page);
  let round = 1;
  for (const step of EXPORTED_GENERATED_WIN_STEPS) {
    if (step.type === "end") {
      await page.getByRole("button", { name: "Encerrar turno" }).click();
      await ready(page);
      round++;
      await expect(page.locator("#round-number")).toHaveText(
        `TURNO ${String(round).padStart(2, "0")}`,
      );
    } else {
      await page.locator(`.squad-card[data-unit="${step.id}"]`).click();
      if (step.move) await cell(page, step.move.x, step.move.y).click();
      if (step.mode === "wait")
        await page.locator('[data-command="wait"]').click();
      else {
        await page
          .locator(`[data-command="mode"][data-mode="${step.mode}"]`)
          .click();
        await cell(page, step.at.x, step.at.y).click();
      }
    }
  }
  await expect(page.locator("#round-number")).toHaveText("TURNO 05");
  await expect(page.locator("#kill-count")).toHaveText("9 de 9 derrotados");
  await expect(
    page.getByRole("heading", { name: "Missão cumprida." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Jogar novamente" }).click();
  await ready(page);
  await expect(page.locator("#map-code")).toHaveText("export-test");
  await expect(page.locator("#round-number")).toHaveText("TURNO 01");
  expect(await labels(page)).toEqual(initial);
});
