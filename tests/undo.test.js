import { classicOptions } from "./helpers/classic-map.js";
import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/engine.js";

function arena(element = "fire") {
  const battle = new Battle(classicOptions({ waves: false, maxRounds: null }));
  battle.terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
  battle.structures = new Map();
  battle.barrier = null;
  battle.units = [
    {
      id: element,
      element,
      name: "Herói",
      team: "ally",
      x: 3,
      y: 3,
      hp: 3,
      maxHp: 3,
      range: 3,
      moved: false,
      acted: false,
    },
    {
      id: "enemy-1",
      name: "Sentinela",
      team: "enemy",
      x: 7,
      y: 7,
      hp: 2,
      maxHp: 2,
      range: 2,
      intent: null,
    },
  ];
  battle.selectedId = element;
  battle.mode = "move";
  battle.phase = "player";
  battle.visualEvents = [];
  battle.log = [];
  return battle;
}

function addAlly(battle, id = "earth", x = 6, y = 5) {
  const unit = {
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
  };
  battle.units.push(unit);
  return unit;
}

test("undo: movement can be undone and replaced repeatedly without gaining actions", () => {
  const b = arena();
  const unit = b.selected;
  assert.equal(b.canUndoMove(), false);
  assert.equal(b.undoMove(), false);
  assert.equal(b.move(0, 3), true);
  assert.equal(b.move(0, 2), false);
  assert.equal(b.canUndoMove(), true);
  assert.equal(b.undoMove(), true);
  assert.deepEqual(
    [unit.x, unit.y, unit.moved, unit.acted],
    [3, 3, false, false],
  );
  assert.equal(b.mode, "move");
  assert.deepEqual(b.lastEffect.path, [
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
  ]);
  assert.equal(b.undoMove(), false);
  assert.equal(b.move(3, 0), true);
  assert.equal(b.undoMove(), true);
  assert.equal(b.move(5, 4), true);
  assert.deepEqual(
    [unit.x, unit.y, unit.moved, unit.acted],
    [5, 4, true, false],
  );
});

test("undo: histories belong to each ally and survive selecting another character", () => {
  const b = arena();
  const fire = b.selected;
  const earth = addAlly(b);
  assert.equal(b.move(2, 3), true);
  assert.equal(b.select("earth"), true);
  assert.equal(b.canUndoMove(), false);
  assert.equal(b.canUndoMove(fire), true);
  assert.equal(b.move(6, 4), true);
  assert.equal(b.select("fire"), true);
  assert.equal(b.undoMove(), true);
  assert.deepEqual([earth.x, earth.y, earth.moved], [6, 4, true]);
  assert.equal(b.select("earth"), true);
  assert.equal(b.undoMove(), true);
  assert.deepEqual([fire.x, fire.y, earth.x, earth.y], [3, 3, 6, 5]);
});

test("undo: selecting an attack or issuing an invalid attack does not commit movement", () => {
  const b = arena();
  assert.equal(b.move(4, 3), true);
  assert.equal(b.setMode("punch"), true);
  assert.equal(b.act(4, 2), false);
  assert.equal(b.canUndoMove(), true);
  assert.equal(b.setMode("special"), true);
  assert.equal(b.act(2, 2), false);
  assert.equal(b.canUndoMove(), true);
  assert.equal(b.undoMove(), true);
  assert.deepEqual([b.selected.x, b.selected.y], [3, 3]);
});

test("undo: Soco, each special and waiting commit the actor's movement", () => {
  const scenarios = [
    [
      "fire",
      (b) => {
        Object.assign(b.enemies[0], { x: 5, y: 3 });
        return b.punch(5, 3);
      },
    ],
    [
      "fire",
      (b) => {
        Object.assign(b.enemies[0], { x: 6, y: 3 });
        return b.fire(6, 3);
      },
    ],
    ["water", (b) => b.wave()],
    ["earth", (b) => b.earth(4, 2)],
    ["fire", (b) => b.wait()],
  ];
  for (const [element, action] of scenarios) {
    const b = arena(element);
    const unit = b.selected;
    assert.equal(b.move(4, 3), true);
    assert.equal(b.canUndoMove(), true);
    assert.equal(action(b), true);
    assert.equal(unit.moveUndo, undefined);
    assert.equal(b.canUndoMove(), false);
    assert.equal(b.undoMove(), false);
    assert.deepEqual([unit.x, unit.y, unit.acted], [4, 3, true]);
  }
});

test("undo: an occupied origin blocks return without changing either character", () => {
  const b = arena();
  assert.equal(b.move(4, 3), true);
  const occupant = addAlly(b, "water", 3, 3);
  assert.equal(b.canUndoMove(), false);
  assert.equal(b.undoMove(), false);
  assert.deepEqual(
    [b.selected.x, b.selected.y, occupant.x, occupant.y],
    [4, 3, 3, 3],
  );
  occupant.y = 2;
  assert.equal(b.canUndoMove(), true);
  assert.equal(b.undoMove(), true);
});

test("undo: a new structure at the origin or along the route blocks return", () => {
  for (const [x, y, type] of [
    [3, 3, "rock"],
    [2, 3, "tree"],
    [1, 3, "barrier"],
  ]) {
    const b = arena();
    assert.equal(b.move(0, 3), true);
    if (type === "barrier") b.barrier = { x, y, type, hp: 2, maxHp: 2 };
    else b.terrain[y][x] = type;
    assert.equal(b.canUndoMove(), false);
    assert.equal(b.undoMove(), false);
    assert.deepEqual(
      [b.selected.x, b.selected.y, b.selected.moved],
      [0, 3, true],
    );
    if (type === "barrier") b.barrier = null;
    else b.terrain[y][x] = "grass";
    assert.equal(b.undoMove(), true);
  }
});

test("undo: returning preserves health, terrain and a different ally's completed action", () => {
  const b = arena();
  const fire = b.selected;
  fire.hp = 2;
  const earth = addAlly(b);
  assert.equal(b.move(4, 3), true);
  assert.equal(b.select("earth"), true);
  assert.equal(b.earth(6, 4), true);
  const barrier = b.barrier;
  b.damage(b.enemies[0], 1);
  const priorLog = [...b.log];
  assert.equal(b.select("fire"), true);
  assert.equal(b.undoMove(), true);
  assert.equal(fire.hp, 2);
  assert.equal(b.enemies[0].hp, 1);
  assert.equal(b.barrier, barrier);
  assert.equal(earth.acted, true);
  assert.deepEqual(b.log.slice(1), priorLog);
});

test("undo: returning preserves received damage while a forced push invalidates history", () => {
  const b = arena(),
    unit = b.selected;
  assert.equal(b.move(4, 3), true);
  b.damage(unit, 1);
  assert.equal(b.canUndoMove(), true);
  assert.equal(b.undoMove(), true);
  assert.equal(unit.hp, 2);
  assert.equal(b.move(4, 3), true);
  b.pushUnit(unit, { x: 5, y: 3 });
  assert.equal(unit.moveUndo, undefined);
  assert.equal(b.canUndoMove(), false);
  assert.equal(b.undoMove(), false);
});

test("undo: harmless damage leaves the move reversible", () => {
  const b = arena();
  assert.equal(b.move(4, 3), true);
  b.damage(b.selected, 0);
  assert.equal(b.canUndoMove(), true);
  assert.equal(b.undoMove(), true);
});

test("undo: ending the turn clears all histories before enemy resolution", () => {
  const b = arena();
  const fire = b.selected;
  const earth = addAlly(b);
  assert.equal(b.move(4, 3), true);
  assert.equal(b.select("earth"), true);
  assert.equal(b.move(6, 4), true);
  assert.equal(b.beginEnemyTurn(), true);
  assert.equal(fire.moveUndo, undefined);
  assert.equal(earth.moveUndo, undefined);
  assert.equal(b.undoMove(), false);
  assert.equal(b.resolveEnemyTurn(), true);
  assert.equal(b.phase, "player");
  assert.equal(b.canUndoMove(), false);
  assert.equal(b.undoMove(), false);
});

test("undo: reset and stale round or position cannot restore a previous move", () => {
  const b = arena();
  assert.equal(b.move(4, 3), true);
  b.round++;
  assert.equal(b.undoMove(), false);
  b.round--;
  b.selected.y = 4;
  assert.equal(b.undoMove(), false);
  b.reset();
  assert.equal(b.canUndoMove(), false);
  assert.equal(b.undoMove(), false);
  assert.equal(
    b.allies.every((unit) => unit.moveUndo === undefined),
    true,
  );
});

test("undo: preview simulation cannot consume movement history or change the board", () => {
  const b = arena();
  Object.assign(b.enemies[0], { x: 5, y: 3 });
  assert.equal(b.move(4, 3), true);
  const history = b.selected.moveUndo;
  const before = structuredClone(b);
  assert.ok(b.previewAction(5, 3, "punch"));
  assert.deepEqual(structuredClone(b), before);
  assert.equal(b.selected.moveUndo, history);
  assert.equal(b.canUndoMove(), true);
  assert.equal(b.undoMove(), true);
  assert.deepEqual(
    [b.enemies[0].x, b.enemies[0].y, b.enemies[0].hp],
    [5, 3, 2],
  );
});
