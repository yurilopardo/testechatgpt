import test from "node:test";
import assert from "node:assert/strict";
import { Battle, DIRECTIONS } from "../src/engine.js";

function scene(dx, dy) {
  const b = new Battle({
    seed: "lethal-knockback",
    terrain: Array.from({ length: 8 }, () => Array(8).fill("grass")),
    waves: false,
    maxRounds: null,
  });
  const actor = b.allies.find((u) => u.id === "fire");
  const target = b.enemies.find((u) => u.kind === "ranged");
  const spare = b.enemies.find((u) => u.id === "enemy-3");
  Object.assign(actor, { x: 3, y: 3 });
  Object.assign(target, { x: 3 + dx, y: 3 + dy });
  Object.assign(spare, { x: 7, y: 7 });
  b.units = [actor, target, spare];
  b.selectedId = actor.id;
  b.visualEvents = [];
  return {
    b,
    actor,
    target,
    spare,
    destination: { x: 3 + 2 * dx, y: 3 + 2 * dy },
  };
}

function commit({ b, target }) {
  const snapshot = structuredClone(b);
  const p = b.previewAction(target.x, target.y, "punch");
  assert.ok(p);
  assert.deepEqual(structuredClone(b), snapshot);
  assert.equal(b.punch(target.x, target.y), true);
  assert.equal(target.hp, 0);
  assert.equal(b.units.includes(target), false);
  for (const u of p.units)
    assert.equal(
      b.units.find((actual) => actual.id === u.id)?.hp || 0,
      u.hpAfter,
    );
  for (const s of p.structures)
    assert.equal(b.structureAt(s.x, s.y)?.hp || 0, s.hpAfter);
  assert.equal(b.phase, p.outcome);
  assert.equal(p.nextEnemies.length, 0);
  return p;
}

test("lethal Soco still pushes the defeated ranged enemy onto empty ground or water in all directions", () => {
  for (const [dx, dy] of DIRECTIONS)
    for (const ground of ["grass", "water"]) {
      const s = scene(dx, dy);
      s.b.terrain[s.destination.y][s.destination.x] = ground;
      const origin = { x: s.target.x, y: s.target.y };
      const p = commit(s);
      assert.deepEqual(
        [s.target.x, s.target.y],
        [s.destination.x, s.destination.y],
      );
      assert.deepEqual(
        p.pushes.map((push) => ({ from: push.from, to: push.to })),
        [{ from: origin, to: s.destination }],
      );
      const event = s.b.visualEvents.find((e) => e.type === "push");
      assert.equal(event.defeatedUnit.hp, 0);
      assert.deepEqual(
        [event.defeatedUnit.x, event.defeatedUnit.y],
        [s.destination.x, s.destination.y],
      );
      assert.equal(s.b.free(s.destination.x, s.destination.y), true);
      assert.equal(s.b.terrain[s.destination.y][s.destination.x], ground);
      assert.equal(s.b.kills, 1);
      assert.equal(s.b.phase, "player");
    }
});

for (const team of ["ally", "enemy"])
  test(`lethal Soco deals collision damage to an ${team} behind the target without a chain push`, () => {
    for (const [dx, dy] of DIRECTIONS)
      for (const hp of [1, 2]) {
        const s = scene(dx, dy);
        const blocker = {
          id: "blocker",
          name: "Atrás",
          team,
          element: "water",
          hp,
          maxHp: 3,
          range: 2,
          ...s.destination,
        };
        const beyond = {
          ...blocker,
          id: "beyond",
          hp: 3,
          x: 3 + 3 * dx,
          y: 3 + 3 * dy,
        };
        s.b.units.push(blocker, beyond);
        const p = commit(s);
        assert.equal(blocker.hp, hp - 1);
        assert.deepEqual(
          [blocker.x, blocker.y],
          [s.destination.x, s.destination.y],
        );
        assert.equal(beyond.hp, 3);
        assert.equal(s.b.kills, team === "enemy" && hp === 1 ? 2 : 1);
        assert.equal(p.pushes.length, 0);
        assert.equal(p.collisions.length, 1);
        assert.equal(p.collisions[0].obstacleId, blocker.id);
      }
  });

for (const type of ["tree", "rock", "wall", "barrier"])
  test(`lethal Soco damages and can destroy the ${type} behind a defeated character`, () => {
    for (const [dx, dy] of DIRECTIONS)
      for (const hp of [1, 2]) {
        const s = scene(dx, dy);
        const { x, y } = s.destination;
        if (type === "barrier")
          s.b.barrier = {
            id: "barrier",
            name: "Barreira",
            type,
            x,
            y,
            hp,
            maxHp: 2,
          };
        else s.b.terrain[y][x] = type;
        const obstacle = s.b.structureAt(x, y);
        obstacle.hp = hp;
        const p = commit(s);
        assert.equal(obstacle.hp, hp - 1);
        assert.equal(p.structures.length, 1);
        assert.equal(p.structures[0].destroyed, hp === 1);
        assert.equal(s.b.structureAt(x, y)?.hp || 0, hp - 1);
        assert.equal(s.b.kills, 1);
        assert.equal(p.pushes.length, 0);
        assert.equal(p.collisions.length, 1);
        assert.equal(s.b.unitAt(x, y), null);
        if (hp === 1) assert.equal(s.b.terrain[y][x], "grass");
      }
  });

test("a lethal punch at the board edge does not leave the grid or invent a collision", () => {
  const s = scene(1, 0);
  s.actor.x = 6;
  s.target.x = 7;
  const p = commit(s);
  assert.equal(s.target.x, 7);
  assert.equal(p.pushes.length, 0);
  assert.equal(p.collisions.length, 0);
  assert.equal(p.blocked[0].reason, "edge");
  assert.equal(s.b.kills, 1);
});
