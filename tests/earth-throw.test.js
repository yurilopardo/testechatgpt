import test from "node:test";
import assert from "node:assert/strict";
import { Battle, DIRECTIONS, STRUCTURES } from "../src/engine.js";
import { createAlly } from "../src/roster.js";
import { createEnemy } from "../src/enemies.js";
import { previewMarkup, previewCellDescriptions } from "../src/preview.js";

const grid = (value) => Array.from({ length: 8 }, () => Array(8).fill(value));
function scene() {
  const b = new Battle({ terrain: grid("grass"), waves: false, maxRounds: null, seed: "earth-throw" });
  const actor = createAlly("earth", { x: 0, y: 3 });
  const enemy = createEnemy("melee", "enemy-1", { x: 7, y: 7 });
  b.units = [actor, enemy];
  b.selectedId = actor.id;
  b.visualEvents = [];
  return { b, actor, enemy };
}
function previewAndCommit(b, x, y) {
  const before = structuredClone(b);
  const p = b.previewAction(x, y, "special");
  assert.ok(p);
  assert.deepEqual(structuredClone(b), before, "hover does not mutate the battle");
  assert.equal(b.earth(x, y), true);
  assert.deepEqual(b.lastEffect, p.effect);
  for (const unit of p.units) {
    const after = b.units.find((u) => u.id === unit.id);
    assert.equal(after?.hp || 0, unit.hpAfter);
    if (after) assert.deepEqual({ x: after.x, y: after.y }, unit.to);
  }
  for (const structure of p.structures)
    assert.equal(b.structureAt(structure.x, structure.y)?.hp || 0, structure.hpAfter);
  return p;
}

test("Earth throw targets all distances in four cardinal directions, ignoring intervening obstacles", () => {
  for (const [dx, dy] of DIRECTIONS) {
    const { b, actor } = scene();
    Object.assign(actor, { x: dx < 0 ? 7 : 0, y: dy < 0 ? 7 : 0 });
    for (let n = 1; n <= 7; n++) {
      const x = actor.x + dx * n, y = actor.y + dy * n;
      b.terrain[y][x] = n % 2 ? "tree" : "wall";
      assert.ok(b.targets("special").some((p) => p.x === x && p.y === y));
      assert.ok(b.previewAction(x, y, "special"));
    }
    assert.equal(b.previewAction(actor.x, actor.y, "special"), null);
    assert.equal(b.previewAction(actor.x + (dx || 1), actor.y + (dy || 1), "special"), null);
    assert.equal(b.previewAction(-1, 3, "special"), null);
  }
});

test("Earth throw passes over every blocker and hits only the occupied endpoint, without pushing the central occupant", () => {
  for (const obstacle of ["ally", "enemy", "tree", "rock", "wall", "barrier", "steam"]) {
    const { b, enemy } = scene();
    Object.assign(enemy, { x: 7, y: 3 });
    let blocker;
    if (["ally", "enemy"].includes(obstacle)) {
      blocker = obstacle === "ally"
        ? createAlly("water", { x: 3, y: 3 })
        : createEnemy("melee", "enemy-2", { x: 3, y: 3 });
      b.units.push(blocker);
    } else if (obstacle === "barrier") {
      b.barrier = { x: 3, y: 3, hp: 2, maxHp: 2, type: "barrier" };
      blocker = b.structureAt(3, 3);
    } else if (obstacle === "steam") {
      b.levelLayers = { ground: grid("grass"), effects: grid(null), directions: grid("east") };
      b.levelLayers.effects[3][3] = "steam";
    } else {
      b.terrain[3][3] = obstacle;
      blocker = b.structureAt(3, 3);
    }
    const hp = blocker?.hp;
    const p = previewAndCommit(b, 7, 3);
    assert.equal(enemy.hp, 1, obstacle);
    assert.deepEqual({ x: enemy.x, y: enemy.y }, { x: 7, y: 3 });
    assert.equal(blocker?.hp, hp, obstacle);
    assert.equal(p.pushes.length, 0);
    assert.equal(p.effect.directHit, true);
    assert.match(previewMarkup(p), /Impacto direto: 1 PV/);
  }
});

test("Earth throw hits allies and every destructible object, and always pushes neighbors, including on lethal impact", () => {
  for (const type of ["ally", ...Object.keys(STRUCTURES), "barrier"]) {
    const { b } = scene();
    const nearby = createAlly("fire", { x: 4, y: 2 });
    b.units.push(nearby);
    let target;
    if (type === "ally") {
      target = createAlly("water", { x: 4, y: 3 });
      b.units.push(target);
    } else if (type === "barrier") {
      b.barrier = { x: 4, y: 3, type, hp: 2, maxHp: 2 };
      target = b.structureAt(4, 3);
    } else {
      b.terrain[3][4] = type;
      target = b.structureAt(4, 3);
    }
    const before = target.hp;
    assert.equal(b.specialArea(4, 3).length, 4);
    const p = previewAndCommit(b, 4, 3);
    assert.equal(target.hp, before - 1, type);
    assert.equal(nearby.hp, 3, type);
    assert.equal(nearby.y, 1, type);
    assert.equal(p.pushes.length, 1, type);
    assert.equal(p.structureMoves.length, 0, type);
    assert.equal(p.effect.directHit, true, type);
    if (type === "crate") assert.equal(b.terrain[3][4], "grass");
  }
});

test("Earth throw on empty ground pushes the four orthogonal neighbors simultaneously without direct damage", () => {
  const { b, enemy } = scene();
  Object.assign(enemy, { x: 4, y: 2, intent: { x: 5, y: 2 } });
  const ally = createAlly("fire", { x: 5, y: 3 });
  const diagonal = createAlly("water", { x: 5, y: 4 });
  b.units.push(ally, diagonal);
  b.terrain[4][4] = "rock";
  const rock = b.structureAt(4, 4);
  b.barrier = { x: 3, y: 3, type: "barrier", hp: 2, maxHp: 2 };
  const barrier = b.structureAt(3, 3);
  assert.equal(b.specialArea(4, 3).length, 4);
  const p = previewAndCommit(b, 4, 3);
  assert.equal(p.effect.radial, true);
  assert.equal(p.collisions.length, 0);
  assert.equal(p.pushes.length, 2);
  assert.equal(p.structureMoves.length, 2);
  assert.deepEqual([enemy.x, enemy.y, enemy.hp], [4, 1, 2]);
  assert.deepEqual(enemy.intent, { x: 5, y: 1 });
  assert.deepEqual([ally.x, ally.y, ally.hp], [6, 3, 3]);
  assert.deepEqual([rock.x, rock.y, rock.hp], [4, 5, 2]);
  assert.deepEqual([barrier.x, barrier.y, barrier.hp], [2, 3, 2]);
  assert.deepEqual([diagonal.x, diagonal.y, diagonal.hp], [5, 4, 3]);
  assert.equal(b.terrain[3][4], "grass");
  assert.equal(b.structureAt(4, 3), null);
  assert.match(previewMarkup(p), /Casa livre: empurra as 4 vizinhas, sem dano direto/);
  assert.match(previewCellDescriptions(p).get("4,3").join(" "), /Queda da pedra em casa livre/);
  assert.match(previewCellDescriptions(p).get("5,3").join(" "), /Área do empurrão/);
});

test("an occupied center loses 1 PV while all four neighbors are pushed and enemy intent follows its owner", () => {
  const { b, enemy } = scene();
  Object.assign(enemy, { x: 4, y: 3 });
  const ally = createAlly("water", { x: 4, y: 2 });
  const gunner = createEnemy("lobber", "enemy-2", { x: 5, y: 3 });
  gunner.intent = { x: 7, y: 3 };
  b.units.push(ally, gunner);
  b.terrain[4][4] = "rock";
  b.terrain[3][3] = "crate";
  const rock = b.structureAt(4, 4), crate = b.structureAt(3, 3);
  const p = previewAndCommit(b, 4, 3);
  assert.deepEqual([enemy.x, enemy.y, enemy.hp], [4, 3, 1]);
  assert.deepEqual([ally.x, ally.y, ally.hp], [4, 1, 3]);
  assert.deepEqual([gunner.x, gunner.y, gunner.hp], [6, 3, 1]);
  assert.deepEqual(gunner.intent, { x: 8, y: 3 });
  assert.deepEqual([rock.x, rock.y, rock.hp], [4, 5, 2]);
  assert.deepEqual([crate.x, crate.y, crate.hp], [2, 3, 1]);
  assert.equal(p.effect.directHit, true);
  assert.equal(p.collisions.length, 0);
  assert.equal(p.nextEnemies.find((e) => e.id === gunner.id).attackInterrupted, true);
});

test("a lethal central hit still resolves neighbor collisions before declaring victory", () => {
  const { b, enemy } = scene();
  Object.assign(enemy, { x: 4, y: 3, hp: 1 });
  const ally = createAlly("fire", { x: 5, y: 3 });
  b.units.push(ally);
  b.terrain[3][6] = "wall";
  const p = previewAndCommit(b, 4, 3);
  assert.equal(p.units.find((u) => u.id === enemy.id).defeated, true);
  assert.equal(p.effect.directHit, true);
  assert.equal(p.collisions.length, 1);
  assert.equal(ally.hp, 2);
  assert.equal(ally.x, 5);
  assert.equal(b.structureAt(6, 3).hp, 1);
  assert.equal(b.kills, 1);
  assert.equal(b.phase, "victory");
  assert.equal(p.outcome, "victory");
});

test("Earth radial push preserves collision damage, no chain push, fixed structures and board edges", () => {
  for (const obstacle of ["tree", "wall", "rock", "unit"]) {
    const { b, enemy } = scene();
    Object.assign(enemy, { x: 5, y: 3 });
    let blocker;
    if (obstacle === "unit") {
      blocker = createAlly("fire", { x: 6, y: 3 });
      b.units.push(blocker);
    } else {
      b.terrain[3][6] = obstacle;
      blocker = b.structureAt(6, 3);
    }
    b.terrain[2][4] = "tree";
    b.terrain[4][4] = "wall";
    const hp = blocker.hp;
    const p = previewAndCommit(b, 4, 3);
    assert.equal(enemy.x, 5, obstacle);
    assert.equal(enemy.hp, 1, obstacle);
    assert.equal(blocker.hp, hp - 1, obstacle);
    assert.equal(blocker.x, 6, obstacle);
    assert.equal(b.structureAt(4, 2).hp, 2);
    assert.equal(b.structureAt(4, 4).hp, 2);
    assert.equal(p.collisions.length, 1);
    assert.equal(p.blocked[0].reason, obstacle === "unit" ? "unit" : "structure");
  }
  const { b, enemy } = scene();
  Object.assign(enemy, { x: 7, y: 3 });
  const p = previewAndCommit(b, 6, 3);
  assert.equal(enemy.x, 7);
  assert.equal(enemy.hp, 2);
  assert.equal(p.blocked[0].reason, "edge");
  assert.equal(p.collisions.length, 0);
});

test("Earth radial push also moves crates, hot rocks and the caster, preserving movement undo rules", () => {
  for (const type of ["crate", "hot-rock"]) {
    const { b } = scene();
    b.terrain[3][5] = type;
    const target = b.structureAt(5, 3);
    const hp = target.hp;
    previewAndCommit(b, 4, 3);
    assert.equal(target.x, 6);
    assert.equal(target.hp, hp);
  }
  const { b, actor } = scene();
  assert.equal(b.move(1, 3), true);
  assert.equal(b.canUndoMove(), true);
  previewAndCommit(b, 2, 3);
  assert.equal(actor.x, 0);
  assert.equal(actor.hp, 3);
  assert.equal(actor.acted, true);
  assert.equal(actor.moveUndo, undefined);
  assert.equal(b.undoMove(), false);
  assert.equal(b.earth(3, 3), false);
});

test("Earth throw can land on water, deep water or abyss without creating a permanent rock or barrier", () => {
  for (const terrain of ["water", "deep-water", "abyss", "mud"]) {
    const { b } = scene();
    b.terrain[3][4] = terrain;
    previewAndCommit(b, 4, 3);
    assert.equal(b.terrain[3][4], terrain);
    assert.equal(b.structureAt(4, 3), null);
    assert.equal(b.barrier, null);
  }
});
