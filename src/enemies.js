// Shared by battle rules, level files, editor and intent panels.
export const ENEMY_TYPES = {
  melee: {
    name: "Sentinela",
    plural: "Sentinelas",
    hp: 2,
    attackRange: 1,
    role: "CORPO A CORPO · 1 CASA",
    icon: "sword",
    color: "#ef9f8b",
    rule: "Ataca a casa vizinha, causando 1 PV de dano.",
  },
  ranged: {
    name: "Besteiro",
    plural: "Besteiros",
    hp: 1,
    attackRange: 4,
    role: "DISTÂNCIA · ATÉ 4 CASAS",
    icon: "ranged",
    color: "#c8b3ed",
    rule: "Dispara em linha reta até 4 casas. O primeiro personagem ou barreira recebe 1 PV de dano; estruturas bloqueiam o tiro.",
  },
  lobber: {
    name: "Artilheiro",
    plural: "Artilheiros",
    hp: 1,
    attackRange: Infinity,
    role: "TIRO POR CIMA · SEM LIMITE",
    icon: "lobber",
    color: "#ffc17b",
    rule: "Mira uma casa na mesma linha ou coluna, sem limite de distância. Passa por cima de personagens e obstáculos e causa 1 PV de dano somente no destino. Empurrar o Artilheiro desloca o alvo pela mesma distância e direção.",
  },
};
export const ENEMY_KINDS = Object.keys(ENEMY_TYPES);

export function createEnemy(kind, id, position) {
  const type = ENEMY_TYPES[kind];
  if (!type) throw new Error("Tipo de inimigo desconhecido.");
  return {
    id,
    team: "enemy",
    kind,
    name: `${type.name} ${id.slice(6)}`,
    x: position.x,
    y: position.y,
    hp: type.hp,
    maxHp: type.hp,
    range: 2,
    attackRange: type.attackRange,
    moved: false,
    acted: false,
    intent: null,
  };
}
