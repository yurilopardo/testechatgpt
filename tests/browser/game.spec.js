import { classicOptions } from "../helpers/classic-map.js";
import { useClassicMap } from "./helpers/classic-page.js";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Battle } from "../../src/engine.js";
import {
  MISSION_WIN_STEPS,
  applyMissionStep,
} from "../helpers/mission-policy.js";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);
const exportSeed = "EXPORT-TEST";
const cellLabels = (page) =>
  page
    .locator(".cell")
    .evaluateAll((cells) =>
      cells.map((button) => button.getAttribute("aria-label")),
    );

async function checkProceduralState(page, battle) {
  await expect(page.locator("#round-number")).toHaveText(
    `TURNO ${String(battle.round).padStart(2, "0")}`,
  );
  await expect(page.locator("#kill-count")).toHaveText(
    `${battle.kills} de ${battle.totalEnemies} derrotados`,
  );
  for (const unit of battle.units) {
    await expect(cell(page, unit.x, unit.y)).toHaveAttribute(
      "aria-label",
      new RegExp(`${unit.name}, ${unit.hp} PV`),
    );
  }
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const structure = battle.structureAt(x, y);
      if (structure) {
        await expect(cell(page, x, y)).toHaveAttribute(
          "aria-label",
          new RegExp(`${structure.hp} PV`),
        );
      }
    }
}

// Exercise the real generated artifact through public controls. Its seed only
// makes expectations reproducible; neither export is rewritten or given a fixture.
async function exerciseProceduralExport(page) {
  const battle = new Battle({ seed: exportSeed });
  await expect(page.locator("#team-dialog")).toBeVisible();
  await page.locator("#team-start").click();
  await page.locator("#start-battle").click();
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await expect(page.locator("#map-code")).toHaveText("export-test");
  await expect(page.locator(".cell")).toHaveCount(64);
  await checkProceduralState(page, battle);
  const initialLabels = await cellLabels(page);

  const mover = battle.allies.find((unit) => battle.reachable(unit).size);
  expect(mover).toBeTruthy();
  expect(battle.select(mover.id)).toBe(true);
  const origin = { x: mover.x, y: mover.y };
  const move = [...battle.reachable(mover).values()][0];
  await page.locator(`.squad-card[data-unit="${mover.id}"]`).click();
  await cell(page, move.x, move.y).click();
  expect(battle.move(move.x, move.y)).toBe(true);
  await expect(page.locator("#undo-move")).toBeEnabled();
  await checkProceduralState(page, battle);
  await page.locator("#undo-move").click();
  expect(battle.undoMove()).toBe(true);
  await expect(cell(page, origin.x, origin.y)).toHaveAttribute(
    "aria-label",
    new RegExp(`${mover.name}, 3 PV`),
  );
  await expect(page.locator("#undo-move")).toBeDisabled();

  let best = null;
  for (const unit of battle.allies) {
    const moves = [null, ...battle.reachable(unit).values()];
    for (const destination of moves) {
      const simulation = battle.fork();
      simulation.select(unit.id);
      if (destination) simulation.move(destination.x, destination.y);
      for (const mode of ["punch", "special"])
        for (const target of simulation.targets(mode)) {
          const preview = simulation.previewAction(target.x, target.y, mode);
          if (!preview) continue;
          const score =
            preview.units.reduce(
              (sum, unit) =>
                sum + (unit.team === "enemy" ? unit.damage * 10 : -unit.damage),
              0,
            ) +
            preview.structures.reduce(
              (sum, structure) =>
                sum + Math.max(0, structure.hpBefore - structure.hpAfter),
              0,
            );
          if (!best || score > best.score)
            best = { id: unit.id, destination, mode, target, score };
        }
    }
  }
  expect(best).toBeTruthy();
  expect(best.score).toBeGreaterThan(0);
  await page.locator(`.squad-card[data-unit="${best.id}"]`).click();
  expect(battle.select(best.id)).toBe(true);
  if (best.destination) {
    await cell(page, best.destination.x, best.destination.y).click();
    expect(battle.move(best.destination.x, best.destination.y)).toBe(true);
  }
  await page.locator(`[data-command="mode"][data-mode="${best.mode}"]`).click();
  expect(battle.setMode(best.mode)).toBe(true);
  const beforePreview = await cellLabels(page);
  await cell(page, best.target.x, best.target.y).hover();
  await expect(page.locator("#attack-preview")).toHaveClass(/has-preview/);
  expect(await cellLabels(page)).toEqual(beforePreview);
  await cell(page, best.target.x, best.target.y).click();
  expect(battle.act(best.target.x, best.target.y)).toBe(true);
  await checkProceduralState(page, battle);

  await page.getByRole("button", { name: "Encerrar turno" }).click();
  expect(battle.beginEnemyTurn()).toBe(true);
  expect(battle.resolveEnemyTurn()).toBe(true);
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await checkProceduralState(page, battle);
  await page
    .getByRole("button", { name: "Reiniciar missão", exact: true })
    .click();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  battle.reset();
  await page.locator("#start-battle").click();
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await checkProceduralState(page, battle);
  await expect.poll(() => cellLabels(page)).toEqual(initialLabels);
  await page.getByRole("button", { name: "Novo mapa", exact: true }).click();
  await page
    .getByRole("button", { name: "Gerar novo mapa", exact: true })
    .click();
  await expect(page.locator("#map-code")).not.toHaveText("export-test");
  await page.locator("#start-battle").click();
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await expect(page.locator("#round-number")).toHaveText("TURNO 01");
  await expect(page.locator("#kill-count")).toHaveText("0 de 9 derrotados");
}
test.beforeEach(async ({ page }) => {
  await useClassicMap(page);
  await page.goto("/");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
});

test("starts with 64 accessible cells, original squad and visible enemy intentions", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page).toHaveTitle("Tríade — Clareira do Rio");
  await expect(page.locator(".cell")).toHaveCount(64);
  await expect(page.locator(".squad-card")).toHaveCount(3);
  await expect(page.locator(".intent-row")).toHaveCount(3);
  await expect(cell(page, 1, 5)).toHaveAttribute(
    "aria-label",
    /Ígni, 3 PV.*perigo/,
  );
  await expect(
    page.getByRole("button", { name: "Projétil de Fogo", exact: false }),
  ).toBeVisible();
  await expect(
    page.locator('.cell[aria-label*="movimento disponível"]'),
  ).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test("mouse: move once, punch once, switch characters and resolve enemy turn", async ({
  page,
}) => {
  await cell(page, 2, 4).click(); // rock: invalid and no budget consumed
  await expect(page.getByRole("status")).toHaveText(
    "Escolha uma casa verde ao alcance.",
  );
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await cell(page, 3, 6).click();
  await expect(cell(page, 3, 6)).toHaveAttribute("aria-label", /Nami, 3 PV/);
  await expect(
    page.getByRole("button", { name: "Mover", exact: false }),
  ).toBeDisabled();
  await cell(page, 3, 7).click();
  await expect(cell(page, 3, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 1 PV/,
  );
  await expect(
    page.getByRole("button", { name: "Soco", exact: false }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Selecionar Ígni/ }).click();
  await expect(
    page.getByRole("button", { name: "Soco", exact: false }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
});

test("fire damages the first adjacent sentinel and prevents a second action", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Projétil de Fogo", exact: false })
    .click();
  await cell(page, 2, 5).click();
  await expect(cell(page, 2, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 1 PV/,
  );
  await expect(
    page.getByRole("button", { name: "Projétil de Fogo", exact: false }),
  ).toBeDisabled();
  await expect(page.locator("#ready-count")).toHaveText("2");
  await expect(page.locator(".squad-card.selected")).toContainText(
    "Turno concluído",
  );
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#phase-label")).toHaveText("Inimigos em ação");
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await expect(page.locator("#ready-count")).toHaveText("3");
});

test("water pushes an ally and enemy at once, leaving their HP unchanged", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await cell(page, 2, 7).click();
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  await cell(page, 2, 7).click();
  await expect(cell(page, 4, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 2 PV/,
  );
  await expect(cell(page, 0, 7)).toHaveAttribute("aria-label", /Taro, 3 PV/);
  await expect(page.locator("#battle-log")).toContainText("Onda Circular");
  await expect(page.locator("#ready-count")).toHaveText("2");
});

test("punch deals one damage and pushes the enemy along the direction of attack", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Soco/ }).click();
  await expect(page.locator(".ability-note")).toContainText(
    "empurrão de 1 casa",
  );
  await cell(page, 2, 5).click();
  await expect(cell(page, 2, 5)).not.toHaveAttribute("aria-label", /Sentinela/);
  await expect(cell(page, 3, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 1 PV/,
  );
  await expect(cell(page, 1, 5)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
  await expect(page.getByRole("button", { name: /^Soco/ })).toBeDisabled();
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await expect(cell(page, 1, 5)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
});

test("punch into a rock applies collision damage to the enemy and the rock", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await page.getByRole("button", { name: /^Soco/ }).click();
  await cell(page, 2, 5).click();
  await expect(cell(page, 2, 5)).not.toHaveAttribute("aria-label", /Sentinela/);
  await expect(cell(page, 2, 4)).toHaveAttribute(
    "aria-label",
    /pedra.*estrutura, 1 PV/,
  );
  await expect(page.locator("#kill-count")).toHaveText("1 de 9 derrotados");
  await expect(page.locator("#battle-log")).toContainText("colidiu com Pedra");
});

test("wave collision damages the enemy and rock, destroys both on the second hit and resets cleanly", async ({
  page,
}) => {
  await expect(cell(page, 2, 4)).toHaveAttribute(
    "aria-label",
    /pedra.*estrutura, 2 PV/,
  );
  await page.getByRole("button", { name: /Selecionar Nami/ }).click();
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  await expect(page.locator(".ability-note")).toContainText(
    "1 de dano em cada",
  );
  await cell(page, 2, 6).click();
  await expect(cell(page, 2, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 1 PV/,
  );
  await expect(cell(page, 2, 4)).toHaveAttribute(
    "aria-label",
    /pedra.*estrutura, 1 PV/,
  );
  await expect(page.locator("#battle-log")).toContainText("−1 PV em cada");

  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  await cell(page, 2, 6).click();
  await expect(cell(page, 2, 4)).toHaveAttribute("aria-label", /^C5, grama/);
  await expect(cell(page, 2, 4)).not.toHaveAttribute(
    "aria-label",
    /estrutura|pedra/,
  );
  await expect(page.locator(".intent-row")).toHaveCount(3);
  await expect(page.locator("#kill-count")).toHaveText("1 de 9 derrotados");

  await page
    .getByRole("button", { name: "Reiniciar missão", exact: true })
    .click();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(cell(page, 2, 4)).toHaveAttribute(
    "aria-label",
    /pedra.*estrutura, 2 PV/,
  );
  await expect(cell(page, 2, 5)).toHaveAttribute(
    "aria-label",
    /Sentinela I, 2 PV/,
  );
});

test("earth throws a rock at an enemy, then restart restores its health", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Selecionar Taro/ }).click();
  await page
    .getByRole("button", { name: "Arremesso de Pedra", exact: false })
    .click();
  await cell(page, 3, 7).click();
  await expect(cell(page, 3, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 1 PV/,
  );
  await page
    .getByRole("button", { name: "Reiniciar missão", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Uma nova estratégia?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continuar missão", exact: true })
    .click();
  await expect(cell(page, 3, 7)).toHaveAttribute("aria-label", /Sentinela III, 1 PV/);
  await page
    .getByRole("button", { name: "Reiniciar missão", exact: true })
    .click();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(cell(page, 3, 7)).toHaveAttribute("aria-label", /Sentinela III, 2 PV/);
  await expect(page.locator("#ready-count")).toHaveText("3");
});

test("keyboard supports squad selection, WASD, arrows, confirm, cancel and end turn", async ({
  page,
}) => {
  await page.keyboard.press("2");
  await expect(page.locator(".squad-card.selected")).toContainText("Nami");
  await page.keyboard.press("a");
  await expect(cell(page, 1, 6)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(cell(page, 1, 6)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(cell(page, 1, 6)).toHaveAttribute("aria-label", /Nami/);
  await page.getByRole("button", { name: /^Onda Circular/ }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Soco", exact: false }),
  ).toHaveClass(/active/);
  await page.keyboard.press("1");
  await page.keyboard.press("w");
  await page.keyboard.press("Space");
  await expect(cell(page, 1, 4)).toHaveAttribute("aria-label", /Ígni, 3 PV/);
  await page.keyboard.press("e");
  await expect(page.locator("#round-number")).toHaveText("TURNO 02");
});

test("help dialog traps focus and closes with Escape", async ({ page }) => {
  await page.getByRole("button", { name: "Como jogar" }).click();
  await expect(
    page.getByRole("dialog", { name: "Pense um turno à frente." }),
  ).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#help-dialog .primary-btn")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#help-dialog .dialog-close")).toBeFocused();
  await page.keyboard.press("e");
  await expect(page.locator("#round-number")).toHaveText("TURNO 01");
  await page.keyboard.press("Escape");
  await expect(page.locator("#help-dialog")).not.toBeVisible();
});

test("mobile layout has no horizontal overflow and keeps the game operable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#battle-canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /Selecionar Taro/ }).click();
  await page
    .getByRole("button", { name: "Arremesso de Pedra", exact: false })
    .click();
  await cell(page, 3, 7).click();
  await expect(cell(page, 3, 7)).toHaveAttribute(
    "aria-label",
    /Sentinela III, 1 PV/,
  );
});

test("a complete legal mission clears every wave by round five and can be replayed", async ({
  page,
}) => {
  const b = new Battle(classicOptions());
  for (const step of MISSION_WIN_STEPS) {
    if (step.type === "end") {
      await page.getByRole("button", { name: "Encerrar turno" }).click();
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
    expect(applyMissionStep(b, step)).toBe(true);
    await expect(page.locator("#round-number")).toHaveText(
      `TURNO ${String(b.round).padStart(2, "0")}`,
    );
    await expect(page.locator("#kill-count")).toHaveText(
      `${b.kills} de 9 derrotados`,
    );
  }
  expect(b.phase).toBe("victory");
  expect(b.round).toBe(5);
  await expect(
    page.getByRole("heading", { name: "Missão cumprida." }),
  ).toBeVisible();
  await expect(page.locator("#kill-count")).toHaveText("9 de 9 derrotados");
  await page.getByRole("button", { name: "Jogar novamente" }).click();
  await expect(page.locator("#result-overlay")).not.toBeVisible();
  await expect(page.locator("#round-number")).toHaveText("TURNO 01");
});

test("leaving the squad exposed reaches defeat and allows a fresh mission", async ({
  page,
}) => {
  for (let i = 0; i < 15; i++) {
    if (await page.locator("#result-overlay").isVisible()) break;
    await page.locator("#end-turn").click();
    await expect(page.locator("#phase-label")).not.toHaveText(
      "Inimigos em ação",
    );
    if (
      (await page.locator("#phase-label").textContent()) === "Missão encerrada"
    ) {
      await expect(page.locator("#result-overlay")).toBeVisible();
      break;
    }
  }
  await expect(
    page.getByRole("heading", { name: "Esquadrão derrotado." }),
  ).toBeVisible();
  await expect(page.locator("#ally-count")).toHaveText("00 UNIDADES");
  await page.getByRole("button", { name: "Jogar novamente" }).click();
  await expect(page.locator("#ally-count")).toHaveText("03 UNIDADES");
});

test("standalone HTML plays offline without any network requests", async ({
  page,
  context,
}) => {
  await page.goto("about:blank");
  await context.setOffline(true);
  const requests = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await page.goto(
    `${pathToFileURL(resolve("jogar.html")).href}?map=${exportSeed}`,
  );
  await exerciseProceduralExport(page);
  expect(requests).toEqual([]);
});

test("GDevelop project runs the embedded game through all 14 event groups", async ({
  page,
}) => {
  const project = JSON.parse(await readFile("gdevelop/triade.json", "utf8"));
  expect(project.layouts).toHaveLength(1);
  const groups = project.layouts[0].events;
  expect(groups).toHaveLength(14);
  const codes = groups.flatMap((g) =>
    g.events
      .filter((e) => e.type === "BuiltinCommonInstructions::JsCode")
      .map((e) => e.inlineCode.join("\n")),
  );
  await page.route(`**/gd-harness?map=${exportSeed}`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body></body></html>",
    }),
  );
  await page.goto(`/gd-harness?map=${exportSeed}`);
  await page.evaluate((codes) => {
    window.gdjs = {
      registerRuntimeSceneUnloadedCallback: (cb) => {
        window.unloadGame = cb;
      },
    };
    const values = new Map();
    window.runtimeScene = {
      getVariables: () => ({
        get: (name) => ({
          setNumber: (value) => values.set(name, value),
          setString: (value) => values.set(name, value),
        }),
      }),
    };
    const events = codes.map((code) => new Function("runtimeScene", code));
    window.gdevelopTick = setInterval(
      () => events.forEach((event) => event(window.runtimeScene)),
      16,
    );
  }, codes);
  await exerciseProceduralExport(page);
  await page.evaluate(() => {
    clearInterval(window.gdevelopTick);
    window.unloadGame(window.runtimeScene);
  });
  await expect(page.locator("#triade-gdevelop")).toHaveCount(0);
});
