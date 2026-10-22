import { test, expect } from "@playwright/test";

const cell = (page, x, y) => page.getByTestId(`cell-${x}-${y}`);

for (const action of ["punch", "wave"])
  for (const blockerTeam of ["ally", "enemy"])
    test(`${action} into an ${blockerTeam} deals collision damage to both, and only the punched target takes attack damage`, async ({
      page,
    }) => {
      const actor = action === "punch" ? "fire" : "water";
      const blockerAlly = actor === "fire" ? "water" : "fire";
      const options = {
        terrain: Array.from({ length: 8 }, () => Array(8).fill("grass")),
        seed: "character-collision",
        waves: false,
        spawns: {
          [actor]: { x: 2, y: 3 },
          [blockerAlly]:
            blockerTeam === "ally" ? { x: 4, y: 3 } : { x: 0, y: 7 },
          earth: blockerTeam === "enemy" ? { x: 4, y: 4 } : { x: 0, y: 7 },
          "enemy-1": { x: 3, y: 3 },
          "enemy-2": { x: 7, y: 0 },
          "enemy-3": blockerTeam === "enemy" ? { x: 4, y: 3 } : { x: 7, y: 7 },
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
      const blockerName =
        blockerTeam === "enemy"
          ? "Sentinela III"
          : blockerAlly === "fire"
            ? "Ígni"
            : "Nami";
      const blockerHp = blockerTeam === "enemy" ? 2 : 3;
      await expect(cell(page, 3, 3)).toHaveAttribute(
        "aria-label",
        /Sentinela I, 2 PV/,
      );
      await expect(cell(page, 4, 3)).toHaveAttribute(
        "aria-label",
        new RegExp(`${blockerName}, ${blockerHp} PV`),
      );
      await page.locator(`.squad-card[data-unit="${actor}"]`).click();
      await page
        .getByRole("button", {
          name: action === "punch" ? /^Soco/ : /^Onda Circular/,
        })
        .click();
      const target = action === "punch" ? cell(page, 3, 3) : cell(page, 2, 3);
      await target.hover();
      const targetRow = page
        .locator(".preview-unit")
        .filter({ has: page.getByText("Sentinela I", { exact: true }) });
      const blockerRow = page
        .locator(".preview-unit")
        .filter({ has: page.getByText(blockerName, { exact: true }) });
      await expect(targetRow).toContainText(
        action === "punch" ? "2 → 0 PV" : "2 → 1 PV",
      );
      await expect(targetRow).toContainText(
        action === "punch"
          ? "1 PV do Soco + 1 PV da colisão"
          : "Dano: 1 PV da colisão",
      );
      await expect(blockerRow).toContainText(
        `${blockerHp} → ${blockerHp - 1} PV`,
      );
      await expect(blockerRow).toContainText("Dano: 1 PV da colisão");
      await expect(blockerRow).not.toContainText("do Soco");
      await expect(cell(page, 3, 3)).toHaveAttribute(
        "aria-label",
        /Sentinela I, 2 PV/,
      );
      await target.click();
      await expect(cell(page, 4, 3)).toHaveAttribute(
        "aria-label",
        new RegExp(`${blockerName}, ${blockerHp - 1} PV`),
      );
      if (action === "punch")
        await expect(cell(page, 3, 3)).not.toHaveAttribute(
          "aria-label",
          /Sentinela I,/,
        );
      else
        await expect(cell(page, 3, 3)).toHaveAttribute(
          "aria-label",
          /Sentinela I, 1 PV/,
        );
      await expect(cell(page, 2, 3)).toHaveAttribute(
        "aria-label",
        new RegExp(`${actor === "fire" ? "Ígni" : "Nami"}, 3 PV`),
      );
      await expect(page.locator("#battle-log")).toContainText("−1 PV em cada");
    });
