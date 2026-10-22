export const ELEMENTS = {
  fire: {
    name: "Fogo",
    character: "Ígni",
    title: "O impulso da chama",
    special: "Projétil de Fogo",
    color: "#efa36d",
    description:
      "1 de dano em linha reta, até 4 casas. Atinge o primeiro inimigo; obstáculos e unidades bloqueiam.",
  },
  water: {
    name: "Água",
    character: "Nami",
    title: "A força da corrente",
    special: "Onda Circular",
    color: "#80c7dd",
    description:
      "Ative na própria casa para empurrar unidades, pedras e barreiras nas 4 vizinhas. Colisão: 1 de dano em cada parte. Árvores ficam paradas.",
  },
  earth: {
    name: "Terra",
    character: "Taro",
    title: "A firmeza da terra",
    special: "Barreira de Terra",
    color: "#bdcb7b",
    description:
      "Cria uma barreira de 2 PV em grama adjacente vazia. Pode ser empurrada. Criar outra substitui a anterior.",
  },
  lightning: {
    name: "Raio",
    character: "Rai",
    title: "A velocidade do trovão",
    special: "Dash Relâmpago",
    color: "#ecd278",
    description:
      "Avança em linha reta até o primeiro inimigo ou estrutura. Causa 1 de dano e empurra 1 casa. Rai perde 1 PV. Aliados e terreno intransponível bloqueiam o dash.",
  },
  wind: {
    name: "Vento",
    character: "Sora",
    title: "O rumo da rajada",
    special: "Rajada de Vento",
    color: "#b8b5ed",
    description:
      "Mire qualquer casa, sobrevoando personagens. Empurra as 4 vizinhas para fora: aliados, inimigos, pedras e barreiras. Sem dano direto. Árvores e muralhas ficam paradas; colisões causam 1 de dano em cada parte.",
  },
};
export const DEFAULT_TEAM = ["fire", "water", "earth"];
export function normalizeTeam(team = DEFAULT_TEAM) {
  if (
    !Array.isArray(team) ||
    team.length !== 3 ||
    new Set(team).size !== 3 ||
    team.some((id) => !Object.hasOwn(ELEMENTS, id))
  )
    throw new Error("Escolha exatamente três ninjas de elementos diferentes.");
  return team.slice();
}
export function createAlly(element, position) {
  return {
    id: element,
    team: "ally",
    element,
    name: ELEMENTS[element].character,
    ...position,
    hp: 3,
    maxHp: 3,
    range: 3,
    moved: false,
    acted: false,
    intent: null,
  };
}
