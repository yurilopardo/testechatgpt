import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/engine.js";
import { normalizeSeed } from "../src/maps.js";
import { GENERATED_MISSION_CASES } from "./helpers/generated-strategy.js";
import { applyMissionStep } from "./helpers/mission-policy.js";

// These are representative playability checks, rather than a claim that every
// random board has the same difficulty or that every possible seed is solvable.
for (const mission of GENERATED_MISSION_CASES) {
  test(`generated mission: ${mission.seed} (${mission.waterKind}) is winnable with legal commands in five turns`, () => {
    const battle = new Battle({ seed: mission.seed });
    assert.equal(battle.mapSeed, normalizeSeed(mission.seed));
    assert.equal(battle.waterKind, mission.waterKind);
    assert.equal(battle.options.terrain, undefined);
    assert.equal(battle.maxRounds, 5);
    assert.equal(battle.totalEnemies, 9);
    const initialMap = structuredClone(battle.terrain);
    const initialUnits = structuredClone(battle.units);

    for (let repetition = 0; repetition < 2; repetition++) {
      if (repetition) {
        battle.reset();
        assert.deepEqual(battle.terrain, initialMap);
        assert.deepEqual(battle.units, initialUnits);
      }
      for (const [index, command] of mission.steps.entries()) {
        assert.equal(
          applyMissionStep(battle, command),
          true,
          `${mission.seed}: command ${index} must be legal: ${JSON.stringify(command)}`,
        );
      }
      assert.equal(battle.phase, "victory");
      assert.equal(battle.resultReason, "cleared");
      assert.equal(battle.round, 5);
      assert.equal(battle.kills, 9);
      assert.equal(battle.pendingReinforcements, 0);
      assert.equal(battle.enemies.length, 0);
      assert.equal(battle.allies.length, 3);
      assert.ok(battle.allies.every((ally) => ally.hp > 0));
    }
  });
}

test("generated mission strategies cover river, lake and coast", () => {
  assert.deepEqual(
    [...new Set(GENERATED_MISSION_CASES.map((mission) => mission.waterKind))].sort(),
    ["coast", "lake", "river"],
  );
});
