// Public commands only: this helper can replay the same mission in engine and UI checks.
// This legal route clears every wave in round five without changing mission state.
export const MISSION_WIN_STEPS = [
  {
    type: "unit",
    id: "water",
    move: {
      x: 2,
      y: 7,
    },
    mode: "punch",
    at: {
      x: 3,
      y: 7,
    },
  },
  {
    type: "unit",
    id: "earth",
    move: {
      x: 2,
      y: 6,
    },
    mode: "punch",
    at: {
      x: 2,
      y: 5,
    },
  },
  {
    type: "unit",
    id: "fire",
    move: {
      x: 4,
      y: 5,
    },
    mode: "special",
    at: {
      x: 4,
      y: 7,
    },
  },
  {
    type: "end",
  },
  {
    type: "unit",
    id: "fire",
    move: {
      x: 4,
      y: 4,
    },
    mode: "special",
    at: {
      x: 4,
      y: 1,
    },
  },
  {
    type: "unit",
    id: "water",
    move: {
      x: 3,
      y: 6,
    },
    mode: "punch",
    at: {
      x: 4,
      y: 6,
    },
  },
  {
    type: "unit",
    id: "earth",
    move: {
      x: 1,
      y: 6,
    },
    mode: "wait",
  },
  {
    type: "end",
  },
  {
    type: "unit",
    id: "water",
    mode: "punch",
    at: {
      x: 4,
      y: 6,
    },
  },
  {
    type: "unit",
    id: "earth",
    mode: "punch",
    at: {
      x: 2,
      y: 6,
    },
  },
  {
    type: "unit",
    id: "fire",
    move: {
      x: 5,
      y: 6,
    },
    mode: "wait",
  },
  {
    type: "end",
  },
  {
    type: "unit",
    id: "fire",
    mode: "punch",
    at: {
      x: 4,
      y: 6,
    },
  },
  {
    type: "unit",
    id: "water",
    move: {
      x: 4,
      y: 6,
    },
    mode: "wait",
  },
  {
    type: "unit",
    id: "earth",
    mode: "wait",
  },
  {
    type: "end",
  },
  {
    type: "unit",
    id: "water",
    mode: "punch",
    at: {
      x: 3,
      y: 6,
    },
  },
];

export function applyMissionStep(battle, step) {
  if (step.type === "end") {
    return battle.beginEnemyTurn() && battle.resolveEnemyTurn();
  }
  if (step.type !== "unit" || !battle.select(step.id)) return false;
  if (step.move && !battle.move(step.move.x, step.move.y)) return false;
  if (step.mode === "wait") return battle.wait();
  return battle.setMode(step.mode) && battle.act(step.at.x, step.at.y);
}

export function replayMission(battle, steps = MISSION_WIN_STEPS) {
  for (const [index, step] of steps.entries()) {
    if (!applyMissionStep(battle, step)) {
      throw new Error(
        `Illegal mission command ${index}: ${JSON.stringify(step)}`,
      );
    }
  }
  return battle;
}
