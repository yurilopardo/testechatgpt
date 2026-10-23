import { classicOptions } from "./helpers/classic-map.js";
import test from "node:test";
import assert from "node:assert/strict";
import { Battle, DIRECTIONS, SIZE, distance } from "../src/engine.js";

const hero = (id, x, y) => ({
  id,
  element: id,
  name: id,
  team: "ally",
  x,
  y,
  hp: 3,
  maxHp: 3,
  range: 3,
  moved: false,
  acted: false,
});
const foe = (id, x, y, kind = "melee") => ({
  id,
  name: id,
  kind,
  team: "enemy",
  x,
  y,
  hp: kind === "ranged" ? 1 : 2,
  maxHp: kind === "ranged" ? 1 : 2,
  range: 2,
  attackRange: kind === "ranged" ? 4 : 1,
  intent: null,
});

function arena(element = "fire") {
  const b = new Battle(classicOptions({ waves: false, maxRounds: null }));
  b.terrain = Array.from({ length: SIZE }, () => Array(SIZE).fill("grass"));
  b.structures.clear();
  b.barrier = null;
  b.units = [hero(element, 3, 3), foe("distant", 7, 7)];
  b.selectedId = element;
  b.mode = "move";
  b.phase = "player";
  b.log = [];
  b.visualEvents = [];
  return b;
}

function structure(b, type, x, y, hp = 2) {
  if (type === "barrier")
    b.barrier = { x, y, type, name: "Barreira de Terra", hp, maxHp: 2 };
  else b.terrain[y][x] = type;
  const result = b.structureAt(x, y);
  result.hp = hp;
  return result;
}

function structures(b) {
  const result = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const found = b.structureAt(x, y);
      if (found) result.push(found);
    }
  return result;
}

// Compare the forecast with a real action, while also proving that inspection is inert.
function previewAndCommit(b, x, y, mode) {
  assert.equal(b.setMode(mode), true);
  const before = structuredClone(b);
  const originalUnits = b.units;
  const originalStructures = b.structures;
  const preview = b.previewAction(x, y);
  assert.ok(preview);
  assert.deepEqual(structuredClone(b), before);
  assert.equal(b.units, originalUnits);
  assert.equal(b.structures, originalStructures);
  assert.equal(b.act(x, y), true);
  const actual = structures(b);
  for (const expected of preview.structures) {
    const found = actual.find((s) => s.id === expected.id);
    assert.equal(found?.hp || 0, expected.hpAfter);
    if (found && expected.to)
      assert.deepEqual({ x: found.x, y: found.y }, expected.to);
  }
  for (const expected of preview.structureMoves) {
    const found = actual.find((s) => s.id === expected.id);
    assert.ok(found);
    assert.deepEqual({ x: found.x, y: found.y }, expected.to);
    assert.equal(found.hp, expected.hpAfter);
  }
  for (const expected of preview.units) {
    const found = b.units.find((u) => u.id === expected.id);
    assert.equal(found?.hp || 0, expected.hpAfter);
    if (found) assert.deepEqual({ x: found.x, y: found.y }, expected.to);
  }
  assert.equal(b.phase, preview.outcome);
  return preview;
}

for (const type of ["rock", "barrier"]) {
  test(`movable ${type}: each ally can punch it one orthogonal cell after one damage`, () => {
    for (const element of ["fire", "water", "earth"])
      for (const [dx, dy] of DIRECTIONS) {
        const b = arena(element);
        const from = { x: 3 + dx, y: 3 + dy };
        const to = { x: 3 + 2 * dx, y: 3 + 2 * dy };
        const target = structure(b, type, from.x, from.y);
        assert.ok(target.id, "structures have an identity before moving");
        const id = target.id;
        assert.ok(b.targets("punch").some((p) => distance(p, from) === 0));
        const preview = previewAndCommit(b, from.x, from.y, "punch");
        assert.equal(b.structureAt(from.x, from.y), null);
        assert.equal(b.structureAt(to.x, to.y), target);
        assert.equal(target.id, id);
        assert.equal(target.hp, 1);
        assert.deepEqual(
          preview.structureMoves.map((s) => s.id),
          [id],
        );
        assert.equal(preview.structures.length, 1);
        assert.equal(preview.structures[0].moved, true);
        assert.equal(preview.structures[0].created, false);
        assert.equal(preview.structures[0].destroyed, false);
        assert.equal(b.selected.acted, true);
        assert.equal(b.punch(to.x, to.y), false);
        assert.ok(
          b.visualEvents.some(
            (e) => e.type === "structure-push" && e.id === id,
          ),
        );
      }
  });

  test(`movable ${type}: Onda Circular pushes without base damage in all four directions`, () => {
    for (const [dx, dy] of DIRECTIONS) {
      const b = arena("water");
      const target = structure(b, type, 3 + dx, 3 + dy);
      const id = target.id;
      const preview = previewAndCommit(b, 3, 3, "special");
      assert.equal(b.structureAt(3 + dx, 3 + dy), null);
      assert.equal(b.structureAt(3 + dx * 2, 3 + dy * 2), target);
      assert.equal(target.hp, 2);
      assert.equal(preview.structureMoves[0].hpBefore, 2);
      assert.equal(preview.structureMoves[0].hpAfter, 2);
      assert.equal(preview.structureMoves[0].id, id);
    }
  });

  test(`movable ${type}: an edge blocks a push without collision damage`, () => {
    for (const mode of ["punch", "special"]) {
      const b = arena(mode === "special" ? "water" : "fire");
      b.selected.x = 6;
      const target = structure(b, type, 7, 3);
      const preview = previewAndCommit(b, mode === "special" ? 6 : 7, 3, mode);
      assert.equal(b.structureAt(7, 3), target);
      assert.equal(target.hp, mode === "punch" ? 1 : 2);
      assert.equal(preview.structureMoves.length, 0);
      assert.equal(preview.collisions.length, 0);
    }
  });

  for (const team of ["ally", "enemy"]) {
    test(`movable ${type}: wave collision with ${team} damages both without displacing either`, () => {
      const b = arena("water");
      const target = structure(b, type, 4, 3);
      const blocker =
        team === "ally" ? hero("earth", 5, 3) : foe("blocker", 5, 3);
      b.units.push(blocker);
      const preview = previewAndCommit(b, 3, 3, "special");
      assert.equal(b.structureAt(4, 3), target);
      assert.equal(target.hp, 1);
      assert.deepEqual(
        [blocker.x, blocker.y, blocker.hp],
        [5, 3, blocker.maxHp - 1],
      );
      assert.equal(preview.structureMoves.length, 0);
      assert.equal(preview.collisions.length, 1);
      assert.equal(preview.collisions[0].obstacleType, "unit");
    });

    test(`movable ${type}: a punch followed by collision with ${team} destroys the rock and damages the character`, () => {
      const b = arena();
      const target = structure(b, type, 4, 3);
      const blocker =
        team === "ally" ? hero("earth", 5, 3) : foe("blocker", 5, 3);
      b.units.push(blocker);
      const preview = previewAndCommit(b, 4, 3, "punch");
      assert.equal(target.hp, 0);
      assert.equal(b.structureAt(4, 3), null);
      assert.deepEqual(
        [blocker.x, blocker.y, blocker.hp],
        [5, 3, blocker.maxHp - 1],
      );
      assert.equal(
        preview.structures.find((s) => s.id === target.id).destroyed,
        true,
      );
      assert.equal(preview.structureMoves.length, 0);
    });
  }

  test(`movable ${type}: a blocker killed by collision does not let the surviving structure advance`, () => {
    const b = arena("water");
    const target = structure(b, type, 4, 3);
    const blocker = foe("blocker", 5, 3, "ranged");
    b.units.push(blocker);
    previewAndCommit(b, 3, 3, "special");
    assert.equal(target.hp, 1);
    assert.equal(b.structureAt(4, 3), target);
    assert.equal(b.unitAt(5, 3), null);
    assert.equal(b.structureAt(5, 3), null);
    assert.equal(b.kills, 1);
  });

  test(`movable ${type}: lethal base punch never damages or pushes a target behind it`, () => {
    for (const blockerType of ["unit", "tree", "rock"]) {
      const b = arena();
      const target = structure(b, type, 4, 3, 1);
      const blocker =
        blockerType === "unit"
          ? foe("blocker", 5, 3)
          : structure(b, blockerType, 5, 3);
      if (blockerType === "unit") b.units.push(blocker);
      const preview = previewAndCommit(b, 4, 3, "punch");
      assert.equal(target.hp, 0);
      assert.equal(blocker.hp, 2);
      assert.equal(b.structureAt(4, 3), null);
      assert.equal(preview.collisions.length, 0);
      assert.equal(preview.structureMoves.length, 0);
    }
  });
}

test("movable structures: collisions against trees, rocks and barriers damage both without a chain push", () => {
  for (const targetType of ["rock", "barrier"])
    for (const blockerType of ["tree", "rock", "barrier"]) {
      if (targetType === "barrier" && blockerType === "barrier") continue;
      const b = arena("water");
      const target = structure(b, targetType, 4, 3);
      const blocker = structure(b, blockerType, 5, 3);
      const preview = previewAndCommit(b, 3, 3, "special");
      assert.equal(b.structureAt(4, 3), target);
      assert.equal(b.structureAt(5, 3), blocker);
      assert.equal(target.hp, 1);
      assert.equal(blocker.hp, 1);
      assert.equal(b.structureAt(6, 3), null);
      assert.equal(preview.structureMoves.length, 0);
    }
});

test("movable structures: destroying a structure blocker still leaves the pushed rock at its origin", () => {
  const b = arena("water");
  const target = structure(b, "rock", 4, 3);
  structure(b, "tree", 5, 3, 1);
  const preview = previewAndCommit(b, 3, 3, "special");
  assert.equal(b.structureAt(4, 3), target);
  assert.equal(target.hp, 1);
  assert.equal(b.structureAt(5, 3), null);
  assert.equal(b.terrain[3][5], "grass");
  assert.equal(preview.structureMoves.length, 0);
});

test("movable structures: trees are fixed and diagonal rocks stay outside the circular wave", () => {
  const b = arena("water");
  const tree = structure(b, "tree", 4, 3);
  const diagonal = structure(b, "rock", 4, 4);
  assert.equal(
    b.targets("punch").some((p) => p.x === 4 && p.y === 3),
    false,
  );
  assert.equal(b.punch(4, 3), false);
  assert.equal(b.previewAction(4, 3, "punch"), null);
  const preview = previewAndCommit(b, 3, 3, "special");
  assert.equal(b.structureAt(4, 3), tree);
  assert.equal(tree.hp, 2);
  assert.equal(b.structureAt(4, 4), diagonal);
  assert.equal(diagonal.hp, 2);
  assert.equal(preview.structureMoves.length, 0);
  assert.equal(preview.structures.length, 0);
});

for (const type of ["rock", "barrier"]) {
  test(`movable ${type}: moving onto water then breaking restores the river without healing the rock`, () => {
    const b = arena();
    const target = structure(b, type, 4, 3);
    const id = target.id;
    b.terrain[3][5] = "water";
    previewAndCommit(b, 4, 3, "punch");
    assert.equal(b.structureAt(4, 3), null);
    assert.equal(b.terrain[3][4], "grass");
    assert.equal(b.structureAt(5, 3).id, id);
    assert.equal(b.structureAt(5, 3).hp, 1);
    b.units.push(hero("earth", 5, 4));
    assert.equal(b.select("earth"), true);
    const preview = previewAndCommit(b, 5, 3, "punch");
    assert.equal(preview.structures.find((s) => s.id === id).destroyed, true);
    assert.equal(b.structureAt(5, 3), null);
    assert.equal(b.terrain[3][5], "water");
    assert.equal(b.free(5, 3), true);
  });

  test(`movable ${type}: moving away from water restores its underlying tile`, () => {
    const b = arena("water");
    const target = structure(b, type, 4, 3);
    b.terrain[3][5] = "water";
    previewAndCommit(b, 3, 3, "special");
    assert.equal(b.structureAt(5, 3), target);
    b.units.push(hero("fire", 6, 3));
    assert.equal(b.select("fire"), true);
    previewAndCommit(b, 5, 3, "punch");
    assert.equal(b.structureAt(4, 3), target);
    assert.equal(target.hp, 1);
    assert.equal(b.terrain[3][5], "water");
    assert.equal(b.structureAt(5, 3), null);
  });
}

test("movable structures: one wave handles structures, characters and collisions from the same initial board", () => {
  const b = arena("water");
  const north = structure(b, "rock", 3, 2);
  const east = structure(b, "barrier", 4, 3);
  const eastBlocker = structure(b, "tree", 5, 3);
  const southBlocker = structure(b, "rock", 3, 5, 1);
  const west = structure(b, "rock", 2, 3);
  b.units.push(hero("fire", 3, 4), foe("west-blocker", 1, 3));
  const reversed = b.fork();
  reversed.units.reverse();
  const preview = previewAndCommit(b, 3, 3, "special");
  previewAndCommit(reversed, 3, 3, "special");
  assert.equal(b.structureAt(3, 1), north);
  assert.equal(north.hp, 2);
  assert.equal(east.hp, 1);
  assert.equal(eastBlocker.hp, 1);
  assert.equal(b.structureAt(3, 5), null);
  assert.equal(southBlocker.hp, 0);
  assert.equal(b.unitAt(3, 4).hp, 2);
  assert.equal(west.hp, 1);
  assert.equal(b.unitAt(1, 3).hp, 1);
  assert.equal(preview.structureMoves.length, 1);
  const unitState = (battle) =>
    battle.units
      .map(({ id, x, y, hp }) => ({ id, x, y, hp }))
      .sort((a, c) => a.id.localeCompare(c.id));
  const structureState = (battle) =>
    structures(battle)
      .map(({ id, x, y, hp }) => ({ id, x, y, hp }))
      .sort((a, c) => a.id.localeCompare(c.id));
  assert.deepEqual(unitState(b), unitState(reversed));
  assert.deepEqual(structureState(b), structureState(reversed));
  assert.deepEqual(b.terrain, reversed.terrain);
});

test("movable structures: a displaced rock opens walking, fire and crossbow lines immediately", () => {
  const b = arena("water");
  structure(b, "rock", 4, 3);
  const fire = hero("fire", 4, 5);
  const archer = foe("archer", 4, 1, "ranged");
  archer.intent = { x: 4, y: 5 };
  b.units.push(fire, archer);
  assert.equal(b.select("fire"), true);
  assert.equal(b.reachable().has("4,3"), false);
  assert.equal(
    b.targets("special").some((p) => p.x === 4 && p.y === 1),
    false,
  );
  assert.equal(b.enemyAttackValid(archer), false);
  assert.equal(b.select("water"), true);
  previewAndCommit(b, 3, 3, "special");
  assert.equal(b.select("fire"), true);
  assert.equal(b.reachable().has("4,3"), true);
  assert.equal(
    b.targets("special").some((p) => p.x === 4 && p.y === 1),
    true,
  );
  assert.equal(b.enemyAttackValid(archer), true);
  assert.equal(b.fire(4, 1), true);
  assert.equal(b.units.includes(archer), false);
});

test("movable structures: a character pushed into a rock damages both without pushing the rock onward", () => {
  const b = arena("water");
  const character = foe("pushed", 4, 3);
  b.units.push(character);
  const rock = structure(b, "rock", 5, 3);
  const preview = previewAndCommit(b, 3, 3, "special");
  assert.deepEqual([character.x, character.y, character.hp], [4, 3, 1]);
  assert.equal(b.structureAt(5, 3), rock);
  assert.equal(rock.hp, 1);
  assert.equal(preview.structureMoves.length, 0);
});

test("movable structures: a placed barrier keeps its identity and can be damaged by an overhead rock", () => {
  const b = arena("earth");
  const old = structure(b, "barrier", 4, 3);
  b.units.push(hero("fire", 4, 4));
  assert.equal(b.select("fire"), true);
  previewAndCommit(b, 4, 3, "punch");
  assert.equal(b.structureAt(4, 2), old);
  assert.equal(old.hp, 1);
  assert.equal(b.select("earth"), true);
  assert.equal(b.move(3, 2), true);
  const preview = previewAndCommit(b, 4, 2, "special");
  assert.equal(b.structureAt(4, 2), null);
  assert.equal(preview.structures.find((s) => s.id === old.id).destroyed, true);
  assert.equal(preview.structureMoves.length, 0);
});

test("movable structures: resetting clears moved rocks and barriers, then restores the original terrain", () => {
  const b = arena("water");
  structure(b, "rock", 4, 3);
  structure(b, "barrier", 3, 4);
  previewAndCommit(b, 3, 3, "special");
  b.reset();
  const fresh = new Battle(classicOptions({ waves: false, maxRounds: null }));
  assert.deepEqual(b.terrain, fresh.terrain);
  assert.equal(b.barrier, null);
  for (const entry of structures(b)) assert.equal(entry.hp, entry.maxHp);
  assert.equal(
    b.visualEvents.some((e) => e.type === "structure-push"),
    false,
  );
  assert.equal(b.round, 1);
});
