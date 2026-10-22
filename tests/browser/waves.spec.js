import { classicOptions } from "../helpers/classic-map.js";
import { useClassicMap } from "./helpers/classic-page.js";
import { test, expect } from "@playwright/test";
import { Battle } from "../../src/engine.js";
import {
  MISSION_WIN_STEPS,
  applyMissionStep,
} from "../helpers/mission-policy.js";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);

test.beforeEach(async ({ page }) => {
  await useClassicMap(page);
  await page.goto("/");
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
});

async function checkProgress(page, battle) {
  await expect(page.locator("#round-number")).toHaveText(
    `TURNO ${String(battle.round).padStart(2, "0")}`,
  );
  await expect(page.locator("#kill-count")).toHaveText(
    `${battle.kills} de ${battle.totalEnemies} derrotados`,
  );
  await expect(page.locator("#active-enemies")).toHaveText(
    String(battle.enemies.length),
  );
  await expect(page.locator("#pending-enemies")).toHaveText(
    String(battle.pendingReinforcements),
  );
  await expect(page.locator(".intent-row")).toHaveCount(battle.enemies.length);
}

async function playCommand(page, battle, step) {
  if (step.type === "end") {
    await page.getByRole("button", { name: "Encerrar turno" }).click();
  } else {
    await page.locator(`.squad-card[data-unit="${step.id}"]`).click();
    if (step.move) await cell(page, step.move.x, step.move.y).click();
    if (step.mode === "wait") {
      await page.getByRole("button", { name: /^Esperar/ }).click();
    } else {
      await page
        .locator(`[data-command="mode"][data-mode="${step.mode}"]`)
        .click();
      await cell(page, step.at.x, step.at.y).click();
    }
  }
  expect(applyMissionStep(battle, step)).toBe(true);
  if (step.type === "end" && battle.phase === "player") {
    await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  }
  await checkProgress(page, battle);
}

test("the five-turn mission presents all nine enemies and a distinct one-HP ranged foe", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Vença em 5 turnos" }),
  ).toBeVisible();
  await expect(page.locator(".round-display")).toHaveAttribute(
    "aria-label",
    "Turno 1 de 5. Sua vez de agir.",
  );
  await expect(page.locator("#round-limit")).toHaveText("/ 05");
  await expect(page.locator("#kill-dots i")).toHaveCount(9);
  await expect(page.locator("#next-wave")).toHaveText(
    "Próxima onda: 1 inimigo",
  );
  const b = new Battle(classicOptions());
  await checkProgress(page, b);
  const ranged = b.enemies.find((enemy) => enemy.kind === "ranged");
  const entry = page.locator(".intent-row.ranged");
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(ranged.name);
  await expect(entry).toContainText("DISTÂNCIA · ATÉ 4 CASAS");
  await expect(entry.locator(".hearts")).toHaveAttribute(
    "aria-label",
    "1 de 1 pontos de vida",
  );
  await expect(cell(page, ranged.x, ranged.y)).toHaveAttribute(
    "aria-label",
    new RegExp(`${ranged.name}, 1 PV`),
  );
});

test("waves update after real commands and round five ends in timeout before a full reset", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const b = new Battle(classicOptions());
  const waveCounts = [];
  // Stop one legal winning command early, leaving two enemies on the final turn.
  for (const step of MISSION_WIN_STEPS.slice(0, -1)) {
    const beforePending = b.pendingReinforcements;
    await playCommand(page, b, step);
    if (step.type === "end") {
      waveCounts.push(beforePending - b.pendingReinforcements);
      for (const enemy of b.enemies) {
        await expect(cell(page, enemy.x, enemy.y)).toHaveAttribute(
          "aria-label",
          new RegExp(`${enemy.name}, ${enemy.hp} PV`),
        );
      }
    }
  }
  expect(waveCounts).toEqual([1, 2, 1, 2]);
  expect(b.round).toBe(5);
  expect(b.kills).toBe(7);
  expect(b.enemies).toHaveLength(2);
  await expect(page.locator("#next-wave")).toHaveText(
    "Última onda no campo · elimine os restantes",
  );
  await expect(page.locator(".round-display")).toHaveClass(/last-round/);

  await playCommand(page, b, { type: "end" });
  expect(b.phase).toBe("defeat");
  expect(b.resultReason).toBe("timeout");
  await expect(
    page.getByRole("heading", { name: "Tempo esgotado." }),
  ).toBeVisible();
  await expect(page.locator("#result-overlay")).toContainText(
    "Você derrotou 7 de 9 inimigos.",
  );
  await expect(page.locator("#round-number")).toHaveText("TURNO 05");
  await expect(
    page.getByRole("button", { name: "Encerrar turno" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Jogar novamente" }).click();
  await expect(page.locator("#phase-label")).toHaveText("Sua vez de agir");
  await expect(page.locator("#result-overlay")).not.toBeVisible();
  await checkProgress(page, new Battle(classicOptions()));
  await expect(page.locator("#next-wave")).toHaveText(
    "Próxima onda: 1 inimigo",
  );
  await expect(page.locator(".round-display")).not.toHaveClass(/last-round/);
  expect(errors).toEqual([]);
});
