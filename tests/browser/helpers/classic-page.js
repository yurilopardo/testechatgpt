import { classicOptions } from "../../helpers/classic-map.js";

// Configure the app before it starts. Tests still play exclusively through the
// public controls; the production entry point and exported games stay procedural.
export async function useClassicMap(page, options = {}) {
  const { preparedEnemies = {}, ...battleOptions } = options;
  await page.route("**/src/main.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `import "/src/style.css";
import { createApp } from "/src/app.js";
const game = createApp(document.querySelector("#app"), {
  battleOptions: ${JSON.stringify(classicOptions(battleOptions))}
});
for (const [id, state] of Object.entries(${JSON.stringify(preparedEnemies)})) {
  Object.assign(game.battle.enemies.find((enemy) => enemy.id === id), state);
}
if (${Object.keys(preparedEnemies).length} > 0) {
  game.battle.visualEvents = [];
  game.renderer.reset();
  game.update();
}
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());`,
    }),
  );
}
