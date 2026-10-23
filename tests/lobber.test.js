import test from "node:test";
import assert from "node:assert/strict";
import { Battle, DIRECTIONS } from "../src/engine.js";
import { createEnemy } from "../src/enemies.js";
import { createAlly } from "../src/roster.js";
import { blankLevel, normalizeLevel, validateLevel } from "../src/levels.js";
import { previewCellDescriptions, previewMarkup } from "../src/preview.js";

const grid = (value) => Array.from({ length: 8 }, () => Array(8).fill(value));
function scene() {
  const b = new Battle({ terrain: grid("grass"), waves: false, maxRounds: null, seed: "lobber" });
  const actor = createAlly("water", { x: 2, y: 3 });
  const victim = createAlly("fire", { x: 3, y: 1 });
  const enemy = createEnemy("lobber", "enemy-1", { x: 3, y: 3 });
  enemy.intent = { x: victim.x, y: victim.y };
  b.units = [actor, victim, enemy];
  b.selectedId = actor.id;
  b.visualEvents = [];
  return { b, actor, victim, enemy };
}
function end(b) {
  assert.equal(b.beginEnemyTurn(), true);
  assert.equal(b.resolveEnemyTurn(), true);
}

test("lobber: reaches every distance in all four cardinal directions, never diagonal or self", () => {
  for (const [dx, dy] of DIRECTIONS) {
    const { b, enemy } = scene();
    Object.assign(enemy, { x: dx < 0 ? 7 : 0, y: dy < 0 ? 7 : 0 });
    for (let n = 1; n <= 7; n++) {
      const target = { x: enemy.x + dx * n, y: enemy.y + dy * n };
      assert.equal(b.enemyAttackValid(enemy, target), true);
      enemy.intent = target;
      assert.deepEqual(b.enemyThreatenedCells(enemy), [target]);
    }
    assert.equal(b.enemyAttackValid(enemy, enemy), false);
    assert.equal(b.enemyAttackValid(enemy, { x: enemy.x + (dx || 1), y: enemy.y + (dy || 1) }), false);
  }
});

test("lobber: ignores intervening allies, enemies, structures, barriers and steam", () => {
  for (const obstacle of ["ally", "enemy", "tree", "rock", "wall", "barrier", "steam"]) {
    const { b, actor, victim, enemy } = scene();
    Object.assign(enemy, { x: 0, y: 3, intent: { x: 7, y: 3 } });
    Object.assign(victim, { x: 7, y: 3 });
    Object.assign(actor, { x: 0, y: 7 });
    let blocker;
    if (obstacle === "ally") {
      blocker = createAlly("earth", { x: 3, y: 3 });
      b.units.push(blocker);
    } else if (obstacle === "enemy") {
      blocker = createEnemy("melee", "enemy-2", { x: 3, y: 3 });
      b.units.push(blocker);
    } else if (obstacle === "barrier") {
      b.barrier = { x: 3, y: 3, hp: 2, maxHp: 2, type: "barrier" };
      blocker = b.structureAt(3, 3);
    } else if (obstacle === "steam") {
      b.levelLayers = { ground: grid("grass"), effects: grid(null), directions: grid(null) };
      b.levelLayers.effects[3][3] = "steam";
    } else {
      b.terrain[3][3] = obstacle;
      blocker = b.structureAt(3, 3);
    }
    const hp = blocker?.hp;
    assert.equal(b.enemyAttackValid(enemy), true, obstacle);
    assert.deepEqual(b.enemyThreatenedCells(enemy), [{ x: 7, y: 3 }], obstacle);
    end(b);
    assert.equal(victim.hp, 2, obstacle);
    assert.equal(blocker?.hp, hp, obstacle);
    assert.deepEqual(b.lastEffect.strikes[0].hit, { x: 7, y: 3 });
  }
});

test("lobber: damages only the endpoint, including friendly fire and structures", () => {
  for (const type of ["enemy", "tree", "rock", "wall", "barrier", "crate"]) {
    const { b, actor, victim, enemy } = scene();
    enemy.intent = { x: 6, y: 3 };
    Object.assign(actor, { x: 5, y: 3 });
    Object.assign(victim, { x: 6, y: 2 });
    let target;
    if (type === "enemy") {
      target = createEnemy("melee", "enemy-2", enemy.intent);
      b.units.push(target);
    } else if (type === "barrier") {
      b.barrier = { ...enemy.intent, type, hp: 2, maxHp: 2 };
      target = b.structureAt(6, 3);
    } else {
      b.terrain[3][6] = type;
      target = b.structureAt(6, 3);
    }
    const hp = target.hp;
    end(b);
    assert.equal(target.hp, hp - 1, type);
    assert.equal(actor.hp, 3, type);
    assert.equal(victim.hp, 3, type);
    if (type === "crate") assert.equal(b.terrain[3][6], "grass");
    if (type === "tree") assert.equal(b.structureAt(6, 3).hp, 1);
  }
});

test("lobber: an empty announced destination misses instead of hitting the path or following its former occupant", () => {
  const { b, actor, victim, enemy } = scene();
  Object.assign(actor, { x: 3, y: 2 });
  Object.assign(victim, { x: 4, y: 1 });
  end(b);
  assert.equal(actor.hp, 3);
  assert.equal(victim.hp, 3);
  assert.deepEqual(b.lastEffect.strikes[0].to, { x: 3, y: 1 });
  assert.ok(b.log.some((entry) => entry.text?.includes("casa vazia")));
});

for (const mode of ["wave", "punch"])
  test(`lobber: ${mode} translates the exact target in every push direction without rotating or changing distance`, () => {
    for (const [dx, dy] of DIRECTIONS)
      for (const [sx, sy] of DIRECTIONS) {
        const { b, actor, victim, enemy } = scene();
        enemy.hp = enemy.maxHp = 2; // Survives Soco; the real 1-PV unit is tested below.
        Object.assign(enemy, { x: dx < 0 ? 5 : dx > 0 ? 2 : 3, y: dy < 0 ? 5 : dy > 0 ? 2 : 3 });
        enemy.intent = { x: enemy.x + dx * 4, y: enemy.y + dy * 4 };
        Object.assign(actor, { x: enemy.x - sx, y: enemy.y - sy });
        Object.assign(victim, { x: enemy.intent.x + sx, y: enemy.intent.y + sy });
        const before = structuredClone(b.units);
        const preview = b.previewAction(mode === "wave" ? actor.x : enemy.x, mode === "wave" ? actor.y : enemy.y, mode === "wave" ? "special" : "punch");
        const predicted = preview.units.find((u) => u.id === enemy.id);
        assert.deepEqual(predicted.intent, { x: victim.x, y: victim.y });
        assert.deepEqual(predicted.attackCells, [{ x: victim.x, y: victim.y }]);
        assert.equal(preview.nextEnemies[0].attackInterrupted, false);
        assert.deepEqual(b.units, before, "preview does not mutate the live battle");
        assert.match(previewMarkup(preview), /alvo acompanha o empurrão/);
        assert.ok(previewCellDescriptions(preview).get(`${victim.x},${victim.y}`).some((text) => text.includes("Novo alvo do tiro por cima")));
        assert.equal(mode === "wave" ? b.wave() : b.punch(enemy.x, enemy.y), true);
        assert.deepEqual(enemy.intent, predicted.intent);
        assert.deepEqual({ x: enemy.intent.x - enemy.x, y: enemy.intent.y - enemy.y }, { x: dx * 4, y: dy * 4 });
        end(b);
        assert.equal(victim.hp, 2);
      }
  });

test("lobber: off-board displaced targets miss completely instead of clipping onto another character", () => {
  for (const [dx, dy] of DIRECTIONS) {
    const { b, actor, victim, enemy } = scene();
    enemy.intent = { x: dx ? (dx > 0 ? 7 : 0) : 3, y: dy ? (dy > 0 ? 7 : 0) : 3 };
    Object.assign(actor, { x: 3 - dx, y: 3 - dy });
    Object.assign(victim, { x: 3 + dx * 2, y: 3 + dy * 2 });
    const p = b.previewAction(actor.x, actor.y, "special");
    assert.deepEqual(p.units.find((u) => u.id === enemy.id).attackCells, []);
    assert.equal(p.nextEnemies[0].attackInterrupted, true);
    assert.equal(b.wave(), true);
    assert.equal(b.enemyAttackValid(enemy), false);
    assert.deepEqual(b.enemyThreatenedCells(enemy), []);
    end(b);
    assert.equal(victim.hp, 3);
    assert.equal(actor.hp, 3);
    assert.ok(b.log.some((entry) => entry.text?.includes("fora do tabuleiro")));
  }
});

test("lobber: a collision blocks displacement and leaves the announced target unchanged", () => {
  const { b, enemy } = scene();
  enemy.hp = 2;
  b.terrain[3][4] = "wall";
  assert.equal(b.wave(), true);
  assert.equal(enemy.x, 3);
  assert.deepEqual(enemy.intent, { x: 3, y: 1 });
  assert.deepEqual(b.enemyThreatenedCells(enemy), [{ x: 3, y: 1 }]);
});

test("lobber: a lethal punch still pushes the enemy, but the defeated gunner cannot fire", () => {
  const { b, victim, enemy } = scene();
  const preview = b.previewAction(enemy.x, enemy.y, "punch");
  assert.equal(preview.units.find((u) => u.id === enemy.id).defeated, true);
  assert.equal(preview.pushes.length, 1);
  assert.equal(b.punch(enemy.x, enemy.y), true);
  assert.equal(enemy.x, 4);
  assert.equal(b.enemies.length, 0);
  assert.equal(b.kills, 1);
  assert.equal(victim.hp, 3);
  assert.equal(b.phase, "victory");
});

test("lobber: stays aligned through obstacles, otherwise advances at most two cells and arms a cardinal tile each turn", () => {
  const { b, actor, victim, enemy } = scene();
  Object.assign(actor, { x: 0, y: 0, hp: 100 });
  Object.assign(victim, { x: 0, y: 1, hp: 100 });
  Object.assign(enemy, { x: 7, y: 7, intent: null });
  for (let round = 1; round <= 3; round++) {
    b.visualEvents = [];
    b.prepareEnemies();
    assert.ok(enemy.advanceSteps <= 2);
    assert.equal(b.enemyAttackValid(enemy), true);
    assert.equal(b.enemyThreatenedCells(enemy).length, 1);
    assert.ok(b.visualEvents.some((event) => event.type === "enemy-ready"));
    end(b);
  }
  Object.assign(enemy, { x: 7, y: 0, intent: null });
  b.terrain[0][3] = "wall";
  b.prepareEnemies();
  assert.equal(enemy.advanceSteps, 0);
  assert.deepEqual(enemy.intent, { x: 0, y: 0 });
});

test("lobber: custom levels and waves round-trip with canonical stats, including zero authored allies", () => {
  const level = blankLevel();
  level.units = [{ id: "enemy-1", team: "enemy", kind: "lobber", x: 7, y: 0 }];
  for (const x of [0, 1, 2]) level.deployment[7][x] = "deployment";
  level.rules.waves = [{ round: 2, kinds: ["lobber", "ranged"] }];
  const saved = normalizeLevel(JSON.parse(JSON.stringify(level)));
  assert.equal(validateLevel(saved).errors.length, 0);
  const b = new Battle({ level: saved });
  assert.equal(b.enemies[0].name, "Artilheiro 1");
  assert.equal(b.enemies[0].hp, 1);
  assert.equal(b.enemies[0].range, 2);
  assert.equal(b.enemies[0].attackRange, Infinity);
  assert.equal(b.confirmDeployment(), true);
  b.damage(b.enemies[0], 1);
  end(b);
  assert.deepEqual(b.enemies.map((u) => u.kind), ["lobber", "ranged"]);
  assert.equal(b.enemies[0].hp, 1);
  assert.equal(b.enemyAttackValid(b.enemies[0]), true);
  assert.deepEqual(b.options.level, saved);
});

test("lobber: the standard mission includes the third enemy in the fourth-turn wave", () => {
  const b = new Battle({ seed: "lobber-default" });
  assert.ok(b.reinforcementQueue.some((entry) => entry.round === 4 && entry.kind === "lobber"));
  assert.equal(b.totalEnemies, 9);
});
