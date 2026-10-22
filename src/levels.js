import { ELEMENTS } from "./roster.js";
// Versioned level files are shared by the editor, game and standalone exports.
export const LEVEL_SIZE = 8;
const tile = (id, name, category, layer, color, rule, future = "") => ({
  id,
  name,
  category,
  layer,
  color,
  rule,
  future,
});
export const TILE_CATALOG = [
  tile("grass", "Grama", "Chão", "ground", "#698b52", "Movimento normal."),
  tile(
    "dirt",
    "Terra batida",
    "Chão",
    "ground",
    "#98764c",
    "Movimento normal.",
  ),
  tile(
    "path",
    "Caminho de pedra",
    "Chão",
    "ground",
    "#8d9685",
    "Movimento normal.",
  ),
  tile(
    "water",
    "Água rasa",
    "Chão",
    "ground",
    "#448e8d",
    "Pode ser atravessada.",
  ),
  tile(
    "deep-water",
    "Água profunda",
    "Chão",
    "ground",
    "#26536b",
    "Bloqueia caminhada; uma ponte permite atravessar.",
  ),
  tile("sand", "Areia", "Chão", "ground", "#cfb878", "Movimento normal."),
  tile(
    "mud",
    "Lama",
    "Chão",
    "ground",
    "#70543f",
    "Entrar custa 2 pontos de movimento; empurrões não gastam movimento.",
  ),
  tile(
    "ice",
    "Gelo",
    "Chão",
    "ground",
    "#a4d8de",
    "Pode ser atravessado com custo normal.",
    "Deslizamento ainda em planejamento.",
  ),
  tile(
    "tree",
    "Árvore",
    "Objetos",
    "objects",
    "#397044",
    "Fixa, 2 PV; recebe dano de colisão.",
  ),
  tile(
    "rock",
    "Pedra",
    "Objetos",
    "objects",
    "#8c9c83",
    "Móvel, 2 PV; preserva o chão ao ser empurrada.",
  ),
  tile(
    "wall",
    "Muralha em ruínas",
    "Objetos",
    "objects",
    "#a6a58b",
    "Fixa, 2 PV; bloqueia passagem e tiros.",
  ),
  tile(
    "bush",
    "Arbusto",
    "Objetos",
    "objects",
    "#59834b",
    "Permite passagem.",
    "Ocultação e cobertura ainda em planejamento.",
  ),
  tile(
    "log",
    "Tronco caído",
    "Objetos",
    "objects",
    "#856440",
    "Pinta 2 casas; segmentos fixos de 2 PV.",
    "Movimento do tronco inteiro ainda em planejamento.",
  ),
  tile(
    "crate",
    "Caixa de madeira",
    "Objetos",
    "objects",
    "#b98c53",
    "Móvel, 1 PV; bloqueia passagem e tiros.",
  ),
  tile(
    "pillar",
    "Pilar",
    "Objetos",
    "objects",
    "#b0b1a1",
    "Fixo, 2 PV; bloqueia passagem e tiros.",
    "Queda direcional ainda em planejamento.",
  ),
  tile(
    "bridge",
    "Ponte",
    "Objetos",
    "objects",
    "#ad895b",
    "Permite atravessar água profunda.",
    "Destruição da ponte ainda em planejamento.",
  ),
  tile(
    "spikes",
    "Espinhos",
    "Efeitos e objetivos",
    "effects",
    "#b4b8b1",
    "Marcador visível; permite passagem.",
    "Dano ao entrar ainda em planejamento.",
  ),
  tile(
    "abyss",
    "Abismo",
    "Efeitos e objetivos",
    "ground",
    "#19212d",
    "Bloqueia caminhada.",
    "Queda por empurrão ainda em planejamento.",
  ),
  tile(
    "current",
    "Correnteza",
    "Efeitos e objetivos",
    "effects",
    "#6bbbc4",
    "Marca água e direção do fluxo.",
    "Deslocamento automático ainda em planejamento.",
  ),
  tile(
    "embers",
    "Brasa",
    "Efeitos e objetivos",
    "effects",
    "#e6894d",
    "Marcador visível; permite passagem.",
    "Dano no fim do turno ainda em planejamento.",
  ),
  tile(
    "cracked",
    "Solo rachado",
    "Efeitos e objetivos",
    "effects",
    "#a38363",
    "Pode ser atravessado.",
    "Desmoronamento ainda em planejamento.",
  ),
  tile(
    "plate",
    "Placa de pressão",
    "Efeitos e objetivos",
    "effects",
    "#bda878",
    "Marcador de mecanismo; permite passagem.",
    "Ligação com portões ainda em planejamento.",
  ),
  tile(
    "shrine",
    "Santuário",
    "Efeitos e objetivos",
    "effects",
    "#d5c395",
    "Marcador de objetivo; permite passagem.",
    "Objetivos de proteger ou ocupar ainda em planejamento.",
  ),
  tile(
    "reinforcement",
    "Ponto de reforço",
    "Efeitos e objetivos",
    "effects",
    "#c37f77",
    "Reforços usam estas entradas; se não houver marcadores, usam as bordas.",
  ),
];
TILE_CATALOG.push(
  tile(
    "steam",
    "Vapor",
    "Efeitos e objetivos",
    "effects",
    "#b9d4c7",
    "Permite passagem e bloqueia projéteis dos dois lados.",
  ),
  tile(
    "hot-rock",
    "Pedra incandescente",
    "Objetos",
    "objects",
    "#d69762",
    "Pedra móvel de 2 PV; mantém as regras de colisão.",
    "Rastro de brasa ainda em planejamento.",
  ),
  tile(
    "electric-seal",
    "Selo elétrico",
    "Efeitos e objetivos",
    "effects",
    "#e2cb77",
    "Marcador visível de armadilha.",
    "Dano e paralisia ainda em planejamento.",
  ),
  tile(
    "electrified-water",
    "Água eletrizada",
    "Efeitos e objetivos",
    "effects",
    "#a5dfe1",
    "Água rasa com indicação elétrica; permite passagem.",
    "Dano por condução ainda em planejamento.",
  ),
  tile(
    "deployment",
    "Área inicial",
    "Efeitos e objetivos",
    "deployment",
    "#80d8ef",
    "Permite posicionar os ninjas antes do combate. Marque pelo menos três casas transitáveis sem inimigos. Não substitui o chão nem os efeitos.",
  ),
);
export const TILE_BY_ID = Object.fromEntries(
  TILE_CATALOG.map((t) => [t.id, t]),
);
export const DIRECTIONS = ["north", "east", "south", "west"];
export const DIRECTION_NAMES = {
  north: "↑ Norte",
  east: "→ Leste",
  south: "↓ Sul",
  west: "← Oeste",
};
export const SOLID_OBJECTS = [
  "tree",
  "rock",
  "hot-rock",
  "wall",
  "log",
  "crate",
  "pillar",
];
export const grid = (value = null) =>
  Array.from({ length: 8 }, () => Array(8).fill(value));
export const insideLevel = (x, y) =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  y >= 0 &&
  x < 8 &&
  y < 8;
export const cellName = (x, y) => `${"ABCDEFGH"[x]}${y + 1}`;

export function blankLevel() {
  return {
    format: "triade-level",
    version: 1,
    size: 8,
    name: "Nova fase",
    description: "",
    ground: grid("grass"),
    objects: grid(),
    effects: grid(),
    deployment: grid(),
    directions: grid("east"),
    units: [
      { id: "fire", team: "ally", element: "fire", x: 1, y: 6 },
      { id: "water", team: "ally", element: "water", x: 2, y: 6 },
      { id: "earth", team: "ally", element: "earth", x: 1, y: 7 },
      { id: "enemy-1", team: "enemy", kind: "melee", x: 5, y: 2 },
      { id: "enemy-2", team: "enemy", kind: "ranged", x: 6, y: 1 },
    ],
    rules: { maxRounds: 5, waves: [] },
  };
}

export function canStand(level, x, y) {
  if (!insideLevel(x, y) || SOLID_OBJECTS.includes(level.objects[y][x]))
    return false;
  return (
    level.objects[y][x] === "bridge" ||
    !["deep-water", "abyss"].includes(level.ground[y][x])
  );
}

export function normalizeLevel(input) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (
    !input ||
    input.format !== "triade-level" ||
    input.version !== 1 ||
    input.size !== 8
  )
    fail("Arquivo incompatível. Use uma fase Tríade, versão 1, de 8×8 casas.");
  const result = blankLevel();
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 80
  )
    fail("O nome da fase deve ter entre 1 e 80 caracteres.");
  result.name = input.name.trim();
  if (
    input.description !== undefined &&
    (typeof input.description !== "string" || input.description.length > 1000)
  )
    fail("A descrição deve ter até 1.000 caracteres.");
  result.description = input.description || "";
  for (const layer of ["ground", "objects", "effects", "deployment", "directions"]) {
    const rows = input[layer] ?? (layer === "directions" ? grid("east") : layer === "deployment" ? grid() : null);
    if (
      !Array.isArray(rows) ||
      rows.length !== 8 ||
      rows.some((row) => !Array.isArray(row) || row.length !== 8)
    )
      fail(`A camada ${layer} precisa ter 8 linhas de 8 casas.`);
    result[layer] = rows.map((row) =>
      row.map((value) => {
        if (layer === "directions") {
          if (!DIRECTIONS.includes(value)) fail("Direção inválida no mapa.");
        } else if (value === null && layer !== "ground") return null;
        else if (!TILE_BY_ID[value] || TILE_BY_ID[value].layer !== layer)
          fail(
            `Tile inválido na camada ${layer}: ${String(value).slice(0, 40)}.`,
          );
        return value;
      }),
    );
  }
  if (!Array.isArray(input.units) || input.units.length > 32)
    fail("A fase pode ter até 32 personagens.");
  const ids = new Set(),
    positions = new Set();
  result.units = input.units.map((u) => {
    if (!u || !insideLevel(u.x, u.y)) fail("Personagem fora do tabuleiro.");
    if (typeof u.id !== "string" || ids.has(u.id))
      fail("Personagens precisam de identificadores únicos.");
    const p = `${u.x},${u.y}`;
    if (positions.has(p))
      fail(`Dois personagens ocupam ${cellName(u.x, u.y)}.`);
    ids.add(u.id);
    positions.add(p);
    if (
      u.team === "ally" &&
      Object.hasOwn(ELEMENTS, u.element) &&
      u.id === u.element
    )
      return { id: u.id, team: "ally", element: u.element, x: u.x, y: u.y };
    if (
      u.team === "enemy" &&
      ["melee", "ranged"].includes(u.kind) &&
      /^enemy-[1-9]\d{0,3}$/.test(u.id)
    )
      return { id: u.id, team: "enemy", kind: u.kind, x: u.x, y: u.y };
    fail("Tipo de personagem inválido.");
  });
  const rules = input.rules;
  if (
    !rules ||
    !Number.isInteger(rules.maxRounds) ||
    rules.maxRounds < 1 ||
    rules.maxRounds > 20
  )
    fail("O limite da fase deve ser de 1 a 20 turnos.");
  if (!Array.isArray(rules.waves) || rules.waves.length > 19)
    fail("Lista de ondas inválida.");
  const rounds = new Set();
  result.rules = {
    maxRounds: rules.maxRounds,
    waves: rules.waves
      .map((wave) => {
        if (
          !wave ||
          !Number.isInteger(wave.round) ||
          wave.round < 2 ||
          wave.round > rules.maxRounds ||
          rounds.has(wave.round)
        )
          fail(
            "Cada onda precisa de um turno único entre 2 e o limite da fase.",
          );
        if (
          !Array.isArray(wave.kinds) ||
          wave.kinds.length < 1 ||
          wave.kinds.length > 8 ||
          wave.kinds.some((kind) => !["melee", "ranged"].includes(kind))
        )
          fail("Cada onda deve ter de 1 a 8 inimigos válidos.");
        rounds.add(wave.round);
        return { round: wave.round, kinds: wave.kinds.slice() };
      })
      .sort((a, b) => a.round - b.round),
  };
  return result;
}

export function validateLevel(input) {
  let level;
  try {
    level = normalizeLevel(input);
  } catch (error) {
    return { errors: [error.message], warnings: [] };
  }
  const errors = [],
    warnings = [];
  if (level.units.filter((u) => u.team === "ally").length !== 3)
    errors.push(
      "Posicione exatamente três ninjas de elementos diferentes para testar a fase.",
    );
  for (const u of level.units)
    if (!canStand(level, u.x, u.y))
      errors.push(
        `Há um personagem sobre um obstáculo em ${cellName(u.x, u.y)}.`,
      );
  if (!level.units.some((u) => u.team === "enemy") && !level.rules.waves.length)
    errors.push("Adicione pelo menos um inimigo ou uma onda de reforços.");
  const marked = level.deployment.flat().filter(Boolean).length;
  if (marked) {
    const available = deploymentCells(level).length;
    if (available < 3)
      errors.push("A área inicial precisa de pelo menos três casas transitáveis sem inimigos.");
    if (available < marked)
      warnings.push(`${marked - available} casa(s) da área inicial estão bloqueadas ou ocupadas por inimigos e não podem receber ninjas.`);
  }
  const future = usedFutureTiles(level);
  if (future.length)
    warnings.push(
      `Efeitos em planejamento: ${future.map((t) => t.name).join(", ")}. Consulte a regra de cada tile; o teste usa apenas os comportamentos já disponíveis.`,
    );
  const heroes = level.units.filter((u) => u.team === "ally");
  for (const hero of heroes) {
    const hasExit = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ].some(
      ([dx, dy]) =>
        canStand(level, hero.x + dx, hero.y + dy) &&
        !level.units.some((u) => u.x === hero.x + dx && u.y === hero.y + dy),
    );
    if (!hasExit)
      warnings.push(`${ELEMENTS[hero.element].character} começa cercado.`);
  }
  return { errors, warnings };
}

export function usedFutureTiles(level) {
  const ids = new Set([
    ...level.ground.flat(),
    ...level.objects.flat(),
    ...level.effects.flat(),
  ]);
  return TILE_CATALOG.filter((t) => ids.has(t.id) && t.future);
}

export function levelTerrain(level) {
  return level.ground.map((row, y) =>
    row.map((type, x) => level.objects[y][x] || type),
  );
}

// Deployment is a separate optional layer, so old v1 files keep fixed spawns.
export function deploymentCells(level) {
  return (level.deployment || grid()).flatMap((row, y) =>
    row.flatMap((marker, x) =>
      marker && canStand(level, x, y) &&
      !level.units.some((u) => u.team === "enemy" && u.x === x && u.y === y)
        ? [{ x, y }] : [],
    ),
  );
}

// A small, reproducible starting area around the generated allied formation.
export function defaultDeploymentCells(terrain, allies, enemies, limit = 9) {
  const cells = [], seen = new Set();
  const add = ({ x, y }) => {
    const key = `${x},${y}`;
    if (!insideLevel(x, y) || seen.has(key) ||
      SOLID_OBJECTS.includes(terrain[y][x]) ||
      ["deep-water", "abyss"].includes(terrain[y][x]) ||
      enemies.some((e) => e.x === x && e.y === y)) return;
    seen.add(key);
    cells.push({ x, y });
  };
  allies.forEach(add);
  for (let i = 0; i < cells.length && cells.length < limit; i++)
    for (const [dx, dy] of [[0,-1], [1,0], [0,1], [-1,0]]) {
      if (cells.length >= limit) break;
      add({ x: cells[i].x + dx, y: cells[i].y + dy });
    }
  return cells;
}

export function levelFromGenerated(map) {
  const level = blankLevel();
  level.name = `Terreno ${map.seed}`.slice(0, 80);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const type = map.terrain[y][x];
      if (["tree", "rock", "wall"].includes(type)) level.objects[y][x] = type;
      else level.ground[y][x] = type;
    }
  level.units = [
    ...["fire", "water", "earth"].map((id) => ({
      id,
      team: "ally",
      element: id,
      ...map.spawns[id],
    })),
    ...["enemy-1", "enemy-2", "enemy-3"].map((id) => ({
      id,
      team: "enemy",
      kind: id === "enemy-2" ? "ranged" : "melee",
      ...map.spawns[id],
    })),
  ];
  for (const { x, y } of defaultDeploymentCells(map.terrain,
    level.units.filter((u) => u.team === "ally"),
    level.units.filter((u) => u.team === "enemy")))
    level.deployment[y][x] = "deployment";
  return normalizeLevel(level);
}

export function exportPlayableHtml(playerHtml, input) {
  const level = normalizeLevel(input),
    validation = validateLevel(level);
  if (validation.errors.length) throw new Error(validation.errors.join(" "));
  if (
    typeof playerHtml !== "string" ||
    !playerHtml.includes("</head>") ||
    !playerHtml.includes("Triade.createApp")
  )
    throw new Error(
      "A versão jogável não está disponível. Gere os arquivos offline antes de exportar.",
    );
  const data = JSON.stringify(level).replaceAll(
    "<",
    String.fromCharCode(92) + "u003c",
  );
  return playerHtml.replace(
    "</head>",
    `<script>window.__TRIADE_LEVEL__=${data};</script></head>`,
  );
}
