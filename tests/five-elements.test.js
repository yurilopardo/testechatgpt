import test from "node:test";
import assert from "node:assert/strict";
import { Battle, ELEMENTS, DIRECTIONS, distance } from "../src/engine.js";
import { createAlly } from "../src/roster.js";
import {
  blankLevel,
  normalizeLevel,
  validateLevel,
  exportPlayableHtml,
} from "../src/levels.js";
import { previewMarkup } from "../src/preview.js";
const grass = () => Array.from({ length: 8 }, () => Array(8).fill("grass"));
const enemy = (x, y, hp = 3) => ({
  id: "enemy-1",
  team: "enemy",
  kind: "melee",
  name: "Sentinela",
  x,
  y,
  hp,
  maxHp: hp,
  range: 2,
  intent: { x: x - 1, y },
});
function arena(element = "lightning") {
  const b = new Battle({ terrain: grass(), waves: false, maxRounds: null });
  b.units = [createAlly(element, { x: 1, y: 3 }), enemy(5, 3)];
  b.team = [element];
  b.selectedId = element;
  b.visualEvents = [];
  return b;
}

test("all ten teams of three have unique IDs, three HP, three movement points and stable spawn slots", () => {
  const ids = Object.keys(ELEMENTS),
    baseline = new Battle({ seed: "five-team" });
  assert.equal(ids.length, 5);
  for (let a = 0; a < 3; a++)
    for (let c = a + 1; c < 4; c++)
      for (let d = c + 1; d < 5; d++) {
        const team = [ids[a], ids[c], ids[d]],
          b = new Battle({ seed: "five-team", team });
        assert.deepEqual(
          b.allies.map((u) => u.element),
          team,
        );
        assert.deepEqual(
          b.allies.map(({ x, y }) => ({ x, y })),
          baseline.allies.map(({ x, y }) => ({ x, y })),
        );
        assert.ok(
          b.allies.every((u) => u.range === 3 && u.hp === 3 && u.maxHp === 3),
        );
        assert.equal(b.selectedId, team[0]);
        const before = structuredClone(b.units);
        b.reset();
        assert.deepEqual(b.units, before);
        b.newMap("other-team-map");
        assert.deepEqual(b.team, team);
      }
});
test("invalid team choices are rejected without changing an active battle", () => {
  const b = new Battle({ seed: "team" }),
    before = structuredClone(b);
  for (const team of [
    [],
    ["fire", "wind"],
    ["wind", "wind", "earth"],
    ["fire", "water", "none"],
    ["fire", "water", "earth", "wind"],
  ]) {
    assert.throws(() => b.setTeam(team), /três ninjas/);
    assert.deepEqual(structuredClone(b), before);
    assert.throws(() => new Battle({ team }));
  }
  assert.ok(b.setTeam(["lightning", "wind", "earth"]));
  assert.deepEqual(
    b.allies.map((u) => u.id),
    ["lightning", "wind", "earth"],
  );
});
for (const [dx, dy] of DIRECTIONS)
  test(`dash ${dx},${dy}: full straight route, one damage plus push, one self damage and consumed action`, () => {
    const b = arena(),
      u = b.selected,
      e = b.enemies[0];
    Object.assign(u, { x: 3, y: 3 });
    Object.assign(e, { x: 3 + dx * 2, y: 3 + dy * 2 });
    e.intent = { x: e.x - dx, y: e.y - dy };
    const before = structuredClone(b),
      p = b.previewAction(e.x, e.y, "special");
    assert.ok(p);
    assert.deepEqual(structuredClone(b), before);
    assert.equal(p.units.find((c) => c.id === u.id).hpAfter, 2);
    assert.equal(p.units.find((c) => c.id === e.id).hpAfter, 2);
    assert.match(previewMarkup(p), /custo: 1 PV/);
    assert.ok(b.lightning(e.x, e.y));
    assert.deepEqual([u.x, u.y], [3 + dx, 3 + dy]);
    assert.deepEqual([e.x, e.y], [3 + dx * 3, 3 + dy * 3]);
    assert.deepEqual([u.hp, e.hp], [2, 2]);
    assert.deepEqual(e.intent, { x: e.x - dx, y: e.y - dy });
    assert.equal(u.moved, true);
    assert.equal(u.acted, true);
    assert.equal(b.canUndoMove(), false);
    assert.equal(b.lightning(e.x, e.y), false);
    assert.equal(b.move(3, 3), false);
    assert.ok(
      b.visualEvents.some((e) => e.type === "dash" && e.path.length === 2),
    );
  });
test("dash can be used after walking and invalidates movement undo", () => {
  const b = arena();
  assert.ok(b.move(2, 3));
  assert.ok(b.canUndoMove());
  assert.ok(b.lightning(5, 3));
  assert.equal(b.canUndoMove(), false);
});
test("dash never stops early at a selected empty cell", () => {
  const b = arena();
  assert.ok(b.lightning(2, 3));
  assert.deepEqual([b.selected.x, b.selected.y], [4, 3]);
  assert.deepEqual([b.enemies[0].x, b.enemies[0].hp], [6, 2]);
});
for (const type of ["tree", "wall", "rock"])
  test(`dash impacts ${type} and costs life; only rocks move`, () => {
    const b = arena();
    Object.assign(b.enemies[0], { x: 7, y: 7 });
    b.terrain[3][4] = type;
    assert.ok(b.lightning(4, 3));
    assert.deepEqual([b.selected.x, b.selected.y, b.selected.hp], [3, 3, 2]);
    const s = b.structureAt(type === "rock" ? 5 : 4, 3);
    assert.equal(s.type, type);
    assert.equal(s.hp, 1);
  });
test("dash knocks a character into another character: target loses two PV, blocker one, actor one", () => {
  const b = arena(),
    e = b.enemies[0],
    ally = createAlly("water", { x: 6, y: 3 });
  b.units.push(ally);
  const p = b.previewAction(5, 3, "special");
  assert.equal(p.units.find((u) => u.id === e.id).damage, 2);
  assert.equal(p.units.find((u) => u.id === ally.id).damage, 1);
  assert.match(previewMarkup(p), /1 PV do Dash \+ 1 PV da colisão/);
  b.lightning(5, 3);
  assert.deepEqual([e.hp, ally.hp, b.selected.hp], [1, 2, 2]);
  assert.deepEqual([e.x, ally.x], [5, 6]);
});
test("lethal dash still pushes the defeated enemy into a structure exactly once", () => {
  const b = arena(),
    e = b.enemies[0];
  e.hp = 1;
  b.terrain[3][6] = "wall";
  const p = b.previewAction(5, 3, "special");
  assert.equal(p.structures[0].hpAfter, 1);
  assert.ok(b.lightning(5, 3));
  assert.equal(b.enemies.length, 0);
  assert.equal(b.kills, 1);
  assert.equal(b.structureAt(6, 3).hp, 1);
  assert.equal(b.selected.hp, 2);
});
test("a one-PV lightning ninja still completes the impact before dying; last ally death is defeat", () => {
  const b = arena(),
    e = b.enemies[0];
  b.selected.hp = 1;
  e.hp = 1;
  const p = b.previewAction(5, 3, "special");
  assert.equal(p.outcome, "defeat");
  assert.equal(p.pushes[0].to.x, 6);
  assert.ok(b.lightning(5, 3));
  assert.equal(b.allies.length, 0);
  assert.equal(b.enemies.length, 0);
  assert.equal(b.phase, "defeat");
  assert.equal(b.kills, 1);
});
test("dash rejects diagonals, own tile, empty rays, allied blockers, impassable terrain and clicks beyond the first target without spending HP", () => {
  const b = arena();
  const e = b.enemies[0];
  for (const p of [
    { x: 2, y: 4 },
    { x: 1, y: 3 },
    { x: 0, y: 3 },
    { x: 6, y: 3 },
    { x: 9, y: 3 },
  ])
    assert.equal(b.lightning(p.x, p.y), false);
  b.units.push(createAlly("water", { x: 3, y: 3 }));
  assert.equal(b.lightning(e.x, e.y), false);
  b.units.pop();
  b.terrain[3][3] = "deep-water";
  assert.equal(b.lightning(e.x, e.y), false);
  assert.equal(b.selected.hp, 3);
  assert.equal(b.selected.acted, false);
  assert.equal(b.previewAction(e.x, e.y, "special"), null);
});
test("dash preview shows self damage, path, pushed direction and next enemy advance", () => {
  const b = arena(),
    e = b.enemies[0],
    p = b.previewAction(e.x, e.y, "special");
  assert.equal(p.effect.type, "lightning");
  assert.equal(p.effect.path.length, 4);
  assert.equal(p.units.find((u) => u.id === e.id).intent.x, 5);
  assert.equal(p.nextEnemies.length, 1);
  assert.deepEqual(p.effect.impactFrom, { x: 4, y: 3 });
});
test("wind targets every board tile over intervening units; center stays still and four neighbors move outward", () => {
  const b = arena("wind"),
    center = { x: 4, y: 3 };
  const middle = enemy(4, 3);
  middle.id = "enemy-2";
  b.units.push(middle, createAlly("water", { x: 3, y: 3 }), enemy(4, 2));
  b.units.at(-1).id = "enemy-3";
  b.terrain[4][4] = "rock";
  assert.equal(b.targets("special").length, 64);
  const before = structuredClone(b),
    p = b.previewAction(4, 3, "special");
  assert.deepEqual(structuredClone(b), before);
  assert.equal(p.units.length, 3);
  assert.equal(p.structureMoves.length, 1);
  assert.equal(p.pushes.length, 3);
  assert.ok(b.wind(4, 3));
  assert.deepEqual([middle.x, middle.y], [4, 3]);
  assert.deepEqual(
    [b.units.find((u) => u.id === "water").x, b.enemies[0].x],
    [2, 6],
  );
  assert.equal(b.structureAt(4, 5).type, "rock");
  assert.equal(b.structureAt(4, 5).hp, 2);
  assert.ok(b.units.every((u) => u.hp === u.maxHp));
  assert.equal(b.selected.acted, true);
});
test("wind can target an allied occupied tile instead of selecting that ally", () => {
  const b = arena("wind");
  b.units.push(createAlly("water", { x: 4, y: 3 }));
  assert.ok(b.wind(4, 3));
  assert.equal(b.enemies[0].x, 6);
});
test("wind affects its own caster when adjacent to the targeted center, including collision damage", () => {
  const b = arena("wind");
  b.terrain[3][0] = "tree";
  const p = b.previewAction(2, 3, "special");
  assert.equal(p.units.find((u) => u.id === "wind").hpAfter, 2);
  assert.equal(p.structures[0].hpAfter, 1);
  b.wind(2, 3);
  assert.equal(b.selected.hp, 2);
  assert.equal(b.structureAt(0, 3).hp, 1);
});
test("wind leaves fixed structures in place; moving a rock into a wall damages both without a chain push", () => {
  const b = arena("wind");
  b.terrain[3][4] = "rock";
  b.terrain[3][5] = "wall";
  b.terrain[2][3] = "tree";
  const p = b.previewAction(3, 3, "special");
  assert.equal(p.structures.length, 2);
  assert.equal(p.structureMoves.length, 0);
  b.wind(3, 3);
  assert.equal(b.structureAt(4, 3).hp, 1);
  assert.equal(b.structureAt(5, 3).hp, 1);
  assert.equal(b.structureAt(3, 2).hp, 2);
});
test("wind border blocks pushes without damage and invalid targets do not consume actions", () => {
  const b = arena("wind");
  Object.assign(b.enemies[0], { x: 7, y: 3 });
  const p = b.previewAction(6, 3, "special");
  assert.equal(p.blocked[0].reason, "edge");
  assert.equal(p.units[0].damage, 0);
  assert.equal(b.wind(-1, 0), false);
  assert.equal(b.selected.acted, false);
  assert.ok(b.wind(6, 3));
  assert.equal(b.enemies[0].hp, 3);
  assert.equal(b.enemies[0].x, 7);
});
test("new elements retain punch, ordinary movement, wait and fresh actions next turn", () => {
  for (const element of ["lightning", "wind"]) {
    const b = arena(element);
    Object.assign(b.enemies[0], { x: 2, y: 3 });
    assert.ok(b.punch(2, 3));
    assert.equal(b.enemies[0].hp, 2);
    assert.equal(b.enemies[0].x, 3);
    b.beginEnemyTurn();
    b.resolveEnemyTurn();
    assert.equal(b.selected.acted, false);
    assert.equal(b.selected.range, 3);
    assert.ok(b.wait());
    assert.equal(b.selected.acted, true);
  }
});
test("level format and custom spawns support three chosen ninjas among five and reject two or four", () => {
  const level = blankLevel();
  level.units[0] = { ...level.units[0], id: "lightning", element: "lightning" };
  level.units[1] = { ...level.units[1], id: "wind", element: "wind" };
  assert.deepEqual(validateLevel(level).errors, []);
  assert.deepEqual(normalizeLevel(level), level);
  const b = new Battle({ level });
  assert.deepEqual(b.team, ["lightning", "wind", "earth"]);
  assert.deepEqual(
    b.allies.map(({ x, y }) => ({ x, y })),
    level.units.slice(0, 3).map(({ x, y }) => ({ x, y })),
  );
  assert.ok(b.allies.every((u) => u.hp === 3 && u.range === 3));
  b.reset();
  assert.deepEqual(b.team, ["lightning", "wind", "earth"]);
  const html = exportPlayableHtml(
    "<head></head><script>Triade.createApp()</script>",
    level,
  );
  assert.match(html, /"element":"lightning"/);
  const two = structuredClone(level);
  two.units.shift();
  assert.match(validateLevel(two).errors[0], /exatamente três/);
  const four = structuredClone(level);
  four.units.push({ id: "fire", element: "fire", team: "ally", x: 0, y: 0 });
  assert.match(validateLevel(four).errors[0], /exatamente três/);
  b.setTeam(["wind", "fire", "water"]);
  assert.deepEqual(b.team, ["wind", "fire", "water"]);
  assert.deepEqual(
    b.allies.map(({ x, y }) => ({ x, y })),
    level.units.slice(0, 3).map(({ x, y }) => ({ x, y })),
  );
});
