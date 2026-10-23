import { Battle, ELEMENTS, SIZE, key, inside } from "./engine.js";
import { ENEMY_TYPES } from "./enemies.js";
import { BoardRenderer, drawUnit } from "./art.js";
import { IsometricRenderer } from "./isometric-art.js";
import { isometricTestLevel } from "./isometric-scene.js";
import { previewMarkup, previewCellDescriptions } from "./preview.js";
import {
  TILE_BY_ID,
  normalizeLevel,
  validateLevel,
  usedFutureTiles,
  levelNeedsTeamSelection,
} from "./levels.js";

const paths = {
  fire: "M12 3c1 5 5 6 5 11a5 5 0 0 1-10 0c0-3 2-5 3-6 0 3 2 4 2 1V3Z",
  lightning: "m13 2-8 12h6l-1 8 9-13h-6l1-7Z",
  wind: "M3 8h12c5 0 5-6 1-6M2 12h17c5 0 5 7 0 7M5 16h6c4 0 4 6 0 6",
  water: "M12 3s-6 7-6 12a6 6 0 0 0 12 0c0-5-6-12-6-12Zm-3 13c0 2 1 3 3 3",
  earth: "m12 3 8 16H4L12 3Zm0 6 5 10M8 12h7",
  sword: "m5 19 4-4m-3-3 6 6m-3-5L17 3l4 0-1 4-10 9M3 21l3-3",
  move: "M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4m10-8 4 4-4 4",
  punch:
    "M7 13V7a2 2 0 0 1 4 0V5a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v7l-3 7H9l-5-6a2 2 0 0 1 3-2Zm4-6v5m4-5v5",
  wait: "M9 5v14M15 5v14",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  ranged: "M5 5c8-2 16 6 14 14M4 4l16 16M5 19 19 5m-6 0h6v6M4 14l6 6",
  lobber: "M3 18C3 2 21 2 21 18m-4-4 4 4 2-5M3 21h7M5 16v5M18 21h5",
  reset: "M3 11a9 9 0 1 1 2 7M3 4v7h7",
  undo: "M9 5 3 11l6 6M3 11h11a6 6 0 0 1 6 6v2",
  help: "M9 8a3 3 0 1 1 4 3c-1 1-1 2-1 3m0 3v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  flag: "M5 21V3c5-3 9 3 14 0v11c-5 3-9-3-14 0",
  heart: "M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 0 8 8 15 8-7 12-11 8-15Z",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  leaf: "M19 3C8 3 3 6 4 14c1 5 8 7 12 1 2-3 3-8 3-12ZM5 20l10-11",
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.shield}"/></svg>`;
const hearts = (hp, max) =>
  `<span class="hearts" aria-label="${hp} de ${max} pontos de vida">${Array.from({ length: max }, (_, i) => icon("heart", i < hp ? "full" : "empty")).join("")}</span>`;
const coord = (p) => `${"ABCDEFGH"[p.x]}${p.y + 1}`;
const facing = (enemy) =>
  !enemy.intent
    ? "Sem direção"
    : enemy.intent.x > enemy.x
      ? "→ LESTE"
      : enemy.intent.x < enemy.x
        ? "← OESTE"
        : enemy.intent.y > enemy.y
          ? "↓ SUL"
          : "↑ NORTE";
const tileNames = {
  grass: "grama",
  water: "água",
  tree: "árvore — bloqueada",
  rock: "pedra — bloqueada",
  wall: "muralha em ruínas — bloqueada",
};
const waterNames = {
  river: "Rio",
  lake: "Lago",
  coast: "Costa",
  custom: "Terreno personalizado",
};

export function createApp(root, options = {}) {
  const visualTest =
    options.visualTest ??
    (!options.battleOptions &&
      !globalThis.__TRIADE_LEVEL__ &&
      new URLSearchParams(location.search).get("visual") === "isometrico");
  const battle = new Battle(
    options.battleOptions ??
      (visualTest
        ? { level: isometricTestLevel() }
        : globalThis.__TRIADE_LEVEL__
          ? { level: globalThis.__TRIADE_LEVEL__ }
          : {
              deployment: true,
              seed:
                new URLSearchParams(location.search).get("map") || undefined,
            }),
  );
  let teamSelectionPending =
    levelNeedsTeamSelection(battle.options.level) ||
    (options.teamSelection ??
      (!visualTest && !options.battleOptions && !globalThis.__TRIADE_LEVEL__));
  let draftTeam = battle.team.slice();
  const controller = new AbortController();
  const { signal } = controller;
  let turnTimer = null,
    resultTimer = null,
    toastTimer = null,
    dialog = null,
    previousFocus = null;
  let actionAnimating = false;
  let enemyAnimating = false,
    enemyAnimationRound = 1,
    resultRevealed = false;
  const queue = [];
  let previewGeneration = 0,
    previewSignature = "";
  root.innerHTML = `
    <div class="game-shell">
      <header class="site-header">
        <a class="brand" href="#" aria-label="Tríade, início da missão"><svg class="brand-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 5 45 41H3L24 5Z" stroke="currentColor" stroke-width="2"/><path d="m24 17 13 23H11l13-23Z" fill="currentColor" opacity=".23"/><path d="M24 5v12M3 41l8-1m34 1-8-1" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="30" r="3" fill="currentColor"/></svg><span>TRÍADE<small>TÁTICA ELEMENTAL</small></span></a>
        <div class="header-mission"><span class="tiny-line"></span> UMA MISSÃO. TRÊS ELEMENTOS.</div>
        <div class="header-actions">${!options.battleOptions?.level && !globalThis.__TRIADE_LEVEL__ ? `<a class="help-btn editor-nav" href="${location.protocol === "file:" ? "./editor-offline.html" : "./editor.html"}" aria-label="Editor de mapas">▦<span>Editor</span></a>` : ""}<span class="prototype"><i></i> PROTÓTIPO JOGÁVEL</span><button class="help-btn level-load" data-command="open-level" aria-label="Carregar fase">${icon("leaf")}<span>Fase</span></button><button class="help-btn" data-command="help">${icon("help")}<span>Como jogar</span></button></div>
      </header>

      <main>
        <section class="mission-header" aria-label="Missão">
          <div><div class="eyebrow">MISSÃO 01 <span>/</span> FLORESTA VERDANTE</div><h1>Clareira do Rio<span>.</span></h1><p>Leia o campo. Escolha seus elementos. Encontre seu caminho.</p></div>
          <div class="round-display"><div class="round-icon">${icon("leaf")}</div><div><span class="eyebrow round-counter"><span id="round-number">TURNO 01</span><span id="round-limit"> / 05</span></span><strong id="phase-label">Sua vez de agir</strong></div><span class="live-dot"></span></div>
        </section>

        <section class="map-strip" aria-label="Mapa da missão"><div class="map-terrain">${icon("water")}<span><strong id="map-kind">Terreno procedural</strong><small>Água contínua · muralhas em ruínas</small></span></div><div class="map-identity"><span>MAPA</span><code id="map-code"></code></div><button class="secondary-btn new-map-btn" data-command="new-map">${icon("reset")} Novo mapa</button></section>

        <p class="level-rule-notice" id="level-rule-notice" hidden></p>
        <section id="deployment-panel" class="deployment-panel" aria-label="Posicionamento inicial" hidden><div><div class="eyebrow">ANTES DO COMBATE</div><h2>Posicione seu esquadrão.</h2><p>Selecione um ninja no painel e clique em uma casa azul. Se já houver um aliado, os dois trocam de lugar. Você pode ajustar quantas vezes quiser.</p><strong id="deployment-selected"></strong></div><button class="primary-btn" data-command="confirm-deployment" id="start-battle">Confirmar posicionamento ${icon("arrow")}</button></section>
        <div class="battle-layout">
          <aside class="squad-column">
            <div class="section-heading"><h2>Seu esquadrão</h2><span id="ally-count">03 UNIDADES</span></div><button class="change-team-btn" data-command="choose-team">Trocar equipe</button>
            <div id="squad" class="squad-list"></div>
            <div class="objective-card"><div class="eyebrow">${icon("flag")} OBJETIVO DA MISSÃO</div><h3>Vença em 5 turnos</h3><p>Elimine todas as ondas até o fim do turno 5. Mantenha um aliado de pé.</p><div class="objective-progress"><span id="kill-count">0 de 9 derrotados</span><div id="kill-dots" aria-hidden="true"></div></div><div class="wave-status"><span><strong id="active-enemies">3</strong> no campo</span><span><strong id="pending-enemies">6</strong> reforços restantes</span></div><div class="next-wave" id="next-wave">Próxima onda: 1 inimigo</div></div>
            <div class="field-guide"><span class="eyebrow">LEITURA DO CAMPO</span><div><i class="legend-square movement"></i> Movimento disponível</div><div><i class="legend-square attack"></i> Alcance da ação</div><div><i class="legend-square danger"></i> Ataque inimigo anunciado</div><p>${icon("water")} A água pode ser atravessada.</p><p>${icon("shield")} Muralhas: 2 PV. Bloqueiam a passagem, podem ser destruídas e ficam no lugar.</p></div>
          </aside>

          <section class="board-column" aria-label="Campo de batalha">
            <div class="board-topline"><span>${icon("eye")} <span id="board-status">Intenções reveladas</span></span><span>8 × 8 <i>·</i> VISTA SUPERIOR</span></div>
            <div class="board-frame"><div class="axis axis-top">${"ABCDEFGH"
              .split("")
              .map((x) => `<span>${x}</span>`)
              .join(
                "",
              )}</div><div class="axis axis-left">${Array.from({ length: 8 }, (_, i) => `<span>${i + 1}</span>`).join("")}</div>
              <div class="board-surface"><canvas id="battle-canvas" width="512" height="512" aria-hidden="true"></canvas><div id="grid-input" class="grid-input" role="group" aria-label="Tabuleiro 8 por 8">${Array.from({ length: 64 }, (_, i) => `<button class="cell" data-x="${i % 8}" data-y="${Math.floor(i / 8)}" data-testid="cell-${i % 8}-${Math.floor(i / 8)}" tabindex="${i === 41 ? 0 : -1}"></button>`).join("")}</div><div id="result-overlay" class="result-overlay" hidden></div></div>
              <div class="board-corner corner-tl"></div><div class="board-corner corner-tr"></div><div class="board-corner corner-bl"></div><div class="board-corner corner-br"></div>
            </div>
            <div class="board-caption"><span id="action-hint">Selecione uma casa destacada para mover Ígni.</span><span id="hover-coordinate">—</span></div>
            <div class="turn-controls"><div class="turn-summary"><span id="ready-count">3</span><div><strong id="ready-label">unidades disponíveis</strong><small>Um movimento + uma ação por unidade</small></div></div><button class="end-turn" data-command="end" id="end-turn">Encerrar turno ${icon("arrow")}<kbd>E</kbd></button></div>
          </section>

          <aside class="action-column">
            <div class="section-heading"><h2>Unidade selecionada</h2><span class="selection-dot"></span></div>
            <section class="unit-panel" id="unit-panel"></section>
            <section id="attack-preview" class="preview-panel" aria-label="Prévia da jogada" aria-live="polite" aria-atomic="true"></section>
            <section class="intent-panel"><div class="section-heading"><h2>${icon("eye")} Intenções inimigas</h2><span id="threat-count">03</span></div><p>A cada turno, os inimigos avançam até 2 casas e armam o próximo ataque. A seta mostra a direção: um empurrão desloca o ataque junto com o inimigo.</p><div id="intent-list"></div><div class="intent-note">${icon("shield")} Empurre para mudar as casas ameaçadas. A direção permanece.</div></section>
          </aside>
        </div>

        <section class="battle-journal"><div class="journal-title"><span class="eyebrow"><i></i> REGISTRO DE CAMPO</span><span id="journal-round">T01</span></div><div id="battle-log" class="battle-log" role="log" aria-live="polite"></div><button class="restart-btn" data-command="restart">${icon("reset")} Reiniciar missão</button></section>
      </main>
      <footer><span>Cinco elementos. Três ninjas. <strong>A estratégia é sua.</strong></span><div><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> cursor</span><span><kbd>↵</kbd> confirmar</span><span><kbd>Esc</kbd> cancelar</span><span><kbd>Z</kbd> desfazer movimento</span></div><span class="build-tag">TRÍADE <i>/</i> PROTÓTIPO 0.1</span></footer>
      <input id="game-level-file" type="file" accept=".json,application/json" hidden><div id="toast" class="toast" role="status" hidden></div>
      <dialog id="help-dialog" aria-labelledby="help-title"><button class="dialog-close" data-command="close-dialog" aria-label="Fechar">${icon("close")}</button><div class="eyebrow">GUIA DE CAMPO</div><h2 id="help-title">Pense um turno à frente.</h2><p>Elimine os 9 inimigos de todas as ondas até o fim do turno 5. Se o prazo acabar ou todo o esquadrão cair, a missão termina.</p><div class="help-steps"><div><b>01</b><span><strong>Escolha e mova</strong>Clique em um aliado e em uma casa verde. Todos os ninjas andam até 3 casas, sem diagonais. Antes de usar uma ação, use Desfazer movimento (Z) para voltar à posição anterior, se a casa estiver livre.</span></div><div><b>02</b><span><strong>Escolha sua ação</strong>Use Soco, um Especial ou Esperar. Você também pode agir sem se mover; a ação encerra a vez da unidade. Aponte uma casa para ver o resultado antes de confirmar.</span></div><div><b>03</b><span><strong>Antecipe o perigo</strong>Sentinelas atacam a casa vizinha. Besteiros atacam em linha reta até 4 casas: o primeiro personagem ou barreira recebe 1 de dano. Árvores, pedras e muralhas bloqueiam o disparo. Artilheiros atiram por cima, sem limite de distância, apenas na mesma linha ou coluna. Só a casa marcada recebe 1 PV de dano; personagens e estruturas no caminho não interceptam. Após um empurrão, o alvo acompanha a nova posição pela mesma distância e direção; se sair do tabuleiro, o tiro por cima erra. O inimigo sobrevivente ataca ao encerrar o turno, sem voltar a mirar nos aliados.</span></div><div><b>04</b><span><strong>Prepare-se para as ondas</strong>Ao encerrar o turno, os inimigos atacam e avançam até 2 casas. Dos turnos 2 a 5, chegam 1 ou 2 reforços e todos revelam seus próximos ataques. Elimine a última onda antes que o turno 5 termine.</span></div></div><p class="help-push">Soco e Onda Circular empurram personagens, pedras naturais e barreiras por 1 casa. O Soco causa 1 de dano e empurra o personagem mesmo se o golpe zerar seus PV: ele ainda causa 1 de dano no personagem ou estrutura logo atrás. A Onda não causa dano direto. Uma colisão com personagem ou estrutura causa 1 de dano em cada envolvido, sem empurrão em cadeia. Soco contra outro personagem: o alvo perde 2 PV (1 do Soco + 1 da colisão) e o personagem atrás perde apenas 1 PV. Árvores têm 2 PV, sofrem 1 de dano por colisão e exibem copa quebrada e 1/2 PV quando feridas. Árvores e muralhas ficam no lugar. O Soco pode danificar muralhas adjacentes, mas não as empurra; a Onda não as desloca. Muralhas têm 2 PV e bloqueiam a caminhada até serem destruídas. A água pode ser atravessada.</p><div class="help-elements">${Object.entries(
        ELEMENTS,
      )
        .map(
          ([id, e]) =>
            `<div style="--element:${e.color}">${icon(id)}<strong>${e.special}</strong><p>${e.description}</p></div>`,
        )
        .join(
          "",
        )}</div><div class="help-keyboard"><kbd>WASD / ↑↓←→</kbd> Cursor <kbd>Enter / Espaço</kbd> Confirmar <kbd>Esc</kbd> Cancelar <kbd>Z</kbd> Desfazer movimento <kbd>E</kbd> Encerrar <kbd>1 / 2 / 3</kbd> Unidade</div><button class="primary-btn" data-command="close-dialog">Entendido. Vamos ao campo. ${icon("arrow")}</button></dialog>
      <dialog id="team-dialog" class="team-dialog" aria-labelledby="team-title"><div class="eyebrow">MONTE SEU ESQUADRÃO</div><h2 id="team-title">Três ninjas. Sua estratégia.</h2><p>Escolha 3 dos 5 elementos. Todos têm 3 PV, 3 casas de caminhada, Soco e um poder próprio. Os poderes funcionam individualmente.</p><div id="team-options" class="team-options"></div><p id="team-count" role="status" aria-live="polite"></p><p class="team-restart-note">Ao confirmar, a missão começa no turno 1 no mesmo mapa.</p><div class="dialog-actions"><button class="secondary-btn" data-command="close-dialog" id="team-cancel">Continuar missão</button><button class="primary-btn" data-command="start-team" id="team-start">Iniciar missão ${icon("arrow")}</button></div></dialog>
      <dialog id="restart-dialog" class="restart-dialog" aria-labelledby="restart-title"><div class="eyebrow">RECOMEÇAR</div><h2 id="restart-title">Uma nova estratégia?</h2><p>A missão volta ao turno 1 de 5 no mesmo mapa, com todas as unidades restauradas e as ondas reiniciadas.</p><div class="dialog-actions"><button class="secondary-btn" data-command="close-dialog">Continuar missão</button><button class="primary-btn" data-command="confirm-restart">${icon("reset")} Reiniciar</button></div></dialog>
      <dialog id="new-map-dialog" class="restart-dialog" aria-labelledby="new-map-title"><div class="eyebrow">OUTRO CAMPO</div><h2 id="new-map-title">Explorar outro terreno?</h2><p>Gera um novo mapa e começa a missão no turno 1 de 5. A partida atual será encerrada. Para tentar novamente no mesmo terreno, use Reiniciar missão.</p><div class="dialog-actions"><button class="secondary-btn" data-command="close-dialog">Continuar missão</button><button class="primary-btn" data-command="confirm-new-map">${icon("reset")} Gerar novo mapa</button></div></dialog>
    </div>`;

  const $ = (selector) => root.querySelector(selector);
  const renderer = new (visualTest ? IsometricRenderer : BoardRenderer)(
    $("#battle-canvas"),
    battle,
  );
  if (visualTest) {
    $("#battle-canvas").dataset.projection = "isometric";
    $(".board-topline > span:last-child").textContent =
      "8 × 8 · VISTA ISOMÉTRICA";
    for (const command of ["new-map", "choose-team", "open-level"]) {
      const button = root.querySelector(`[data-command="${command}"]`);
      button.disabled = true;
      button.title = "Cenário fixo do teste visual: três ninjas e um inimigo.";
    }
  }
  const cells = [...root.querySelectorAll(".cell")];
  let cursor = { x: battle.selected.x, y: battle.selected.y };

  function portrait(canvas, unit, large = false) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 80, 80);
    ctx.imageSmoothingEnabled = false;
    drawUnit(ctx, unit, 40, large ? 43 : 42, large ? 2 : 1.7);
  }

  function update() {
    previewGeneration++;
    const selected = battle.selected,
      meta = selected ? ELEMENTS[selected.element] : null;
    const isDeployment = battle.phase === "deployment" && !teamSelectionPending;
    const isPlayer =
        battle.phase === "player" &&
        !enemyAnimating &&
        !actionAnimating &&
        !teamSelectionPending,
      isOver = ["victory", "defeat"].includes(battle.phase);
    const displayedRound = enemyAnimating ? enemyAnimationRound : battle.round;
    root.classList.toggle("is-deploying", isDeployment);
    $("#deployment-panel").hidden = !isDeployment;
    $("#deployment-selected").textContent = selected ? `Reposicionando: ${selected.name} · ${battle.deploymentCells.length} casas disponíveis` : "";
    $(".turn-summary small").textContent = isDeployment ? "Posicionamento livre · sem gastar ações" : "Um movimento + uma ação por unidade";
    $(".intent-panel > p").textContent = isDeployment ? "Os inimigos permanecem nas posições iniciais. Os primeiros ataques serão preparados depois que você confirmar o posicionamento." : "A cada turno, os inimigos avançam até 2 casas e armam o próximo ataque. A seta mostra a direção: um empurrão desloca o ataque junto com o inimigo.";
    const custom = battle.options.level;
    $(".mission-header h1").textContent = custom?.name || "Clareira do Rio.";
    $(".mission-header p").textContent =
      custom?.description ||
      "Leia o campo. Escolha seus elementos. Encontre seu caminho.";
    $(".objective-card h3").textContent =
      `Vença em ${battle.maxRounds || "∞"} turnos`;
    $(".objective-card > p").textContent =
      `Elimine todos os ${battle.totalEnemies} inimigos e reforços até o fim do turno ${battle.maxRounds || "final"}. Mantenha um aliado de pé.`;
    $(".help-steps > div:nth-child(4) span").innerHTML =
      `<strong>Prepare-se para as ondas</strong>Ao encerrar o turno, os inimigos atacam e avançam até 2 casas, preparando a próxima direção. ${custom ? `Os reforços seguem a configuração desta fase. Elimine todos até o turno ${battle.maxRounds}.` : "Dos turnos 2 a 5, chegam 1 ou 2 reforços. Elimine a última onda antes que o turno 5 termine."}`;
    const futureTiles = custom ? usedFutureTiles(custom) : [];
    $("#level-rule-notice").hidden = !futureTiles.length;
    $("#level-rule-notice").textContent = futureTiles.length
      ? "Regras deste teste: " +
        futureTiles.map((t) => `${t.name}: ${t.rule} ${t.future}`).join(" ")
      : "";
    $("#help-dialog > p").textContent =
      `Elimine os ${battle.totalEnemies} inimigos e reforços em até ${battle.maxRounds} turnos. Se o esquadrão cair ou o prazo acabar, a missão termina.`;
    if (custom) {
      $("#help-dialog > p").textContent =
        `Elimine os ${battle.totalEnemies} inimigos e reforços em até ${battle.maxRounds} turnos. As ondas e entradas foram definidas nesta fase.`;
      $(".map-terrain small").textContent = usedFutureTiles(custom).length
        ? "Fase do editor · há efeitos em planejamento"
        : "Fase criada no editor de mapas";
    } else
      $(".map-terrain small").textContent =
        "Água contínua · muralhas em ruínas";
    $("#map-code").textContent = battle.mapSeed || "personalizado";
    $("#map-code").title =
      battle.waterKind === "custom"
        ? "Terreno personalizado"
        : "Código do terreno. A URL desta página abre o mesmo mapa.";
    $("#map-kind").textContent =
      waterNames[battle.waterKind] || "Terreno procedural";
    $("#round-number").textContent =
      isDeployment ? "PREPARAÇÃO" : `TURNO ${String(displayedRound).padStart(2, "0")}`;
    $("#round-limit").textContent =
      ` / ${String(battle.maxRounds).padStart(2, "0")}`;
    $(".round-display").classList.toggle(
      "last-round",
      displayedRound === battle.maxRounds && !isOver,
    );
    $("#phase-label").textContent = actionAnimating
      ? "Dash em execução"
      : enemyAnimating
        ? "Inimigos em movimento"
        : {
            deployment: "Posicionamento inicial",
            player: "Sua vez de agir",
            enemy: "Inimigos em ação",
            victory: "Missão cumprida",
            defeat: "Missão encerrada",
          }[battle.phase];
    $(".round-display").classList.toggle(
      "enemy-phase",
      battle.phase === "enemy" || enemyAnimating,
    );
    $(".round-display").setAttribute(
      "aria-label",
      `Turno ${displayedRound} de ${battle.maxRounds}. ${$("#phase-label").textContent}.`,
    );
    $("#board-status").textContent = isDeployment ? "Casas azuis: área inicial" : actionAnimating
      ? "Dash Relâmpago…"
      : enemyAnimating
        ? "Inimigos avançando…"
        : battle.phase === "enemy"
          ? "Resolvendo ataques…"
          : isOver
            ? "Batalha encerrada"
            : "Intenções reveladas";
    $("#ally-count").textContent =
      `${String(battle.allies.length).padStart(2, "0")} UNIDADES`;
    $("#squad").innerHTML = battle.team
      .map((id, i) => {
        const e = ELEMENTS[id];
        const unit = battle.units.find((u) => u.id === id);
        return `<button class="squad-card ${battle.selectedId === id ? "selected" : ""} ${!unit ? "defeated" : ""}" data-command="select" data-unit="${id}" style="--element:${e.color}" ${!unit || !(isPlayer || isDeployment) ? "disabled" : ""} aria-label="Selecionar ${e.character}, ${e.name}${unit ? `, ${unit.hp} pontos de vida` : ", derrotado"}" aria-pressed="${battle.selectedId === id}"><span class="portrait-frame"><canvas width="80" height="80" data-portrait="${id}" aria-hidden="true"></canvas><span class="element-badge">${icon(id)}</span></span><span class="squad-info"><span class="squad-name">${e.character}<kbd>${i + 1}</kbd></span><span class="element-name">${e.name}</span>${hearts(unit?.hp || 0, 3)}<span class="unit-status">${!unit ? "Derrotado" : isDeployment ? "Na área inicial" : unit.acted ? `${icon("check")} Turno concluído` : `<i></i> ${unit.moved ? "Ação disponível" : "Pronto para agir"}`}</span></span></button>`;
      })
      .join("");
    root
      .querySelectorAll("[data-portrait]")
      .forEach((c) =>
        portrait(c, { team: "ally", element: c.dataset.portrait }),
      );
    if (visualTest) {
      $("#map-kind").textContent = "Cenário fixo";
      $("#map-code").textContent = "TESTE-ISO-01";
      $(".map-terrain small").textContent = "Rio · grama · pedras · árvores";
    }
    const remaining = battle.allies.filter((u) => !u.acted).length,
      kills = battle.kills;
    $("#ready-count").textContent = remaining;
    $("#ready-label").textContent =
      isDeployment ? "ninjas posicionados" : remaining === 1 ? "unidade disponível" : "unidades disponíveis";
    $("#kill-count").textContent =
      `${kills} de ${battle.totalEnemies} derrotados`;
    $("#kill-dots").innerHTML = Array.from(
      { length: battle.totalEnemies },
      (_, i) => `<i class="${i < kills ? "complete" : ""}"></i>`,
    ).join("");
    $("#active-enemies").textContent = battle.enemies.length;
    $("#pending-enemies").textContent = battle.pendingReinforcements;
    $("#next-wave").textContent = isOver
      ? battle.phase === "victory"
        ? "Todas as ondas derrotadas"
        : "Missão encerrada"
      : battle.nextWaveCount > 0
        ? `Próxima onda: ${battle.nextWaveCount} ${battle.nextWaveCount === 1 ? "inimigo" : "inimigos"}`
        : battle.pendingReinforcements > 0
          ? "Reforços aguardando espaço no campo"
          : "Última onda no campo · elimine os restantes";
    $(".objective-card").classList.toggle(
      "last-round",
      displayedRound === battle.maxRounds && !isOver,
    );
    $("#end-turn").disabled = !isPlayer;
    $("#end-turn").classList.toggle("all-done", remaining === 0);
    if (selected) {
      const disabled = !isPlayer || selected.acted;
      const canUndo = isPlayer && battle.canUndoMove();
      $("#unit-panel").style.setProperty("--element", meta.color);
      $("#unit-panel").innerHTML =
        `<div class="selected-profile"><span class="selected-portrait"><canvas id="large-portrait" width="80" height="80" aria-hidden="true"></canvas></span><div><div class="eyebrow">${icon(selected.element)} ${meta.name.toUpperCase()}</div><h3>${selected.name}</h3><span>${meta.title}</span></div></div><div class="unit-stats"><span>${icon("heart")} <strong>${selected.hp}</strong><small>/ 3 PV</small></span><span>${icon("move")} <strong>${selected.range}</strong><small>casas</small></span><span>${icon("sword")} <strong>1</strong><small>ação</small></span></div><div class="action-heading"><span class="eyebrow">${selected.acted ? "TURNO CONCLUÍDO" : "ESCOLHA SUA AÇÃO"}</span><span class="action-pips"><i class="${selected.moved ? "used" : ""}" title="Movimento"></i><i class="${selected.acted ? "used" : ""}" title="Ação"></i></span></div><div class="action-buttons"><button class="action-btn ${battle.mode === "move" && !selected.acted ? "active" : ""}" data-command="mode" data-mode="move" ${disabled || selected.moved ? "disabled" : ""}>${icon("move")}<span><strong>Mover</strong><small>Até ${selected.range} casas</small></span><span class="action-value">${selected.range}</span></button><button class="action-btn undo-btn" id="undo-move" data-command="undo" ${canUndo ? "" : "disabled"} aria-keyshortcuts="Z">${icon("undo")}<span><strong>Desfazer movimento</strong><small>Voltar antes de usar uma ação</small></span><kbd>Z</kbd></button><button class="action-btn ${battle.mode === "punch" ? "active" : ""}" data-command="mode" data-mode="punch" ${disabled ? "disabled" : ""}>${icon("punch")}<span><strong>Soco</strong><small>1 de dano · empurra 1 casa</small></span><span class="action-value">1</span></button><button class="action-btn special-btn ${battle.mode === "special" ? "active" : ""}" data-command="mode" data-mode="special" ${disabled ? "disabled" : ""}>${icon(selected.element)}<span><strong>${meta.special}</strong><small>${selected.element === "fire" ? "Linha reta · até 4 casas" : selected.element === "water" ? "Própria casa · 4 vizinhas" : selected.element === "lightning" ? "Linha reta · custa 1 PV" : selected.element === "wind" ? "Qualquer casa · 4 vizinhas" : "Adjacente · 2 PV"}</small></span><span class="special-star">✦</span></button><button class="action-btn wait-btn" data-command="wait" ${disabled ? "disabled" : ""}>${icon("wait")}<span><strong>Esperar</strong><small>Encerrar ação da unidade</small></span></button></div><div class="ability-note">${selected.acted ? `${icon("check")} ${selected.name} já agiu. Selecione outro aliado.` : battle.mode === "special" ? meta.description : battle.mode === "punch" ? "1 de dano e empurrão de 1 casa em inimigos, pedras ou barreiras. Colisão: 1 de dano em cada envolvido, sem empurrão em cadeia. Contra outro personagem: 2 PV no alvo (Soco + colisão) e 1 PV no personagem atrás, aliado ou inimigo. Mesmo com 0 PV, o alvo ainda é empurrado e causa dano no obstáculo atrás. Árvores e muralhas ficam no lugar; o Soco também danifica muralhas." : "Você pode agir sem se mover. Desfaça o movimento com Z antes de usar uma ação, que encerra a vez desta unidade."}</div>`;
      portrait($("#large-portrait"), selected, true);
      if (isDeployment) {
        $("#unit-panel .action-buttons").hidden = true;
        $("#unit-panel .action-heading .eyebrow").textContent = "POSIÇÃO INICIAL";
        $("#unit-panel .ability-note").textContent = `Escolha uma casa azul para ${selected.name}. O posicionamento não gasta caminhada nem ação. Confirme acima do tabuleiro para iniciar o turno 1.`;
      }
    } else
      $("#unit-panel").innerHTML =
        '<div class="empty-unit">Nenhuma unidade disponível.</div>';
    $("#threat-count").textContent = String(battle.enemies.length).padStart(
      2,
      "0",
    );
    $("#intent-list").innerHTML =
      battle.enemies
        .map((e) => {
          const type = ENEMY_TYPES[e.kind];
          const threatened = battle.enemyThreatenedCells(e);
          const point = threatened.at(-1) ||
            (e.kind === "lobber" ? null : battle.enemyAttackPath(e).at(-1));
          return `<div class="intent-row ${e.kind} ${e.intent && !threatened.length ? "attack-blocked" : ""}" data-enemy="${e.id}"><span class="enemy-number">${icon(type.icon)}</span><span><strong>${e.name}</strong><span class="enemy-role">${type.role}</span><span class="enemy-ready-label">${isDeployment ? "AGUARDANDO POSICIONAMENTO" : `${facing(e)} · ${enemyAnimating ? "PREPARANDO ATAQUE" : "ATAQUE ARMADO"}`}</span><small>${e.advanceSteps ? `Avançou ${e.advanceSteps} casa${e.advanceSteps === 1 ? "" : "s"}` : "Em posição"} · ${point ? `Ataque em <b>${coord(point)}</b>` : isDeployment ? "Ataque ainda não preparado" : "Alvo fora do mapa"}${point && !threatened.length ? " · bloqueado" : ""} · 1 de dano${e.kind === "lobber" ? " · só no destino, por cima dos obstáculos" : ""}</small></span>${hearts(e.hp, e.maxHp)}</div>`;
        })
        .join("") ||
      `<div class="no-threats">${battle.pendingReinforcements > 0 ? "Campo livre. Há reforços a caminho." : "Todas as ondas derrotadas."}</div>`;
    $("#battle-log").innerHTML = battle.log
      .slice(0, 3)
      .map(
        (entry, i) =>
          `<div class="log-entry ${entry.type} ${i === 0 ? "latest" : ""}"><span class="log-dot"></span><span>${entry.text}</span></div>`,
      )
      .join("");
    $("#journal-round").textContent =
      `T${String(battle.round).padStart(2, "0")}`;
    $("#action-hint").textContent = isDeployment
      ? `Escolha uma casa azul para ${selected?.name || "o ninja"}. Casas ocupadas trocam os aliados de lugar.`
      : !isPlayer
      ? isOver
        ? "Reinicie para testar uma nova estratégia."
        : "Os inimigos executam as intenções anunciadas…"
      : !selected
        ? "Selecione uma unidade."
        : selected.acted
          ? "Unidade concluiu a vez. Selecione outro aliado ou encerre o turno."
          : battle.mode === "move"
            ? `Clique em uma casa destacada para mover ${selected.name}.`
            : battle.mode === "punch"
              ? "Soco: 1 de dano no alvo adjacente. Empurra inimigos, pedras e barreiras; muralhas ficam no lugar."
              : selected.element === "water"
                ? `Ative a Onda Circular na casa de ${selected.name}: empurra personagens e pedras vizinhos.`
                : selected.element === "earth"
                  ? "Escolha uma casa de grama adjacente para erguer a barreira."
                  : selected.element === "lightning"
                    ? "Escolha uma direção destacada: dash até o primeiro alvo. Rai perde 1 PV."
                    : selected.element === "wind"
                      ? "Mire qualquer casa: a rajada empurra as quatro vizinhas, inclusive aliados."
                      : "Escolha uma direção destacada para lançar o projétil.";
    const announced = new Set(
      battle.enemies.flatMap((e) =>
        (e.kind === "lobber" ? battle.enemyThreatenedCells(e) :
          battle.enemyAttackPath(e)).map((p) => key(p.x, p.y)),
      ),
    );
    const danger = new Set(
      battle.enemies.flatMap((e) =>
        battle.enemyThreatenedCells(e).map((p) => key(p.x, p.y)),
      ),
    );
    const targets = new Set(
      (isPlayer ? battle.targets() : []).map((p) => key(p.x, p.y)),
    );
    const waveSelected =
      isPlayer &&
      battle.mode === "special" &&
      selected?.element === "water" &&
      !selected.acted;
    const waveArea = new Set(
      (waveSelected ? battle.waveArea() : []).map((p) => key(p.x, p.y)),
    );
    cells.forEach((cell) => {
      const x = +cell.dataset.x,
        y = +cell.dataset.y,
        unit = battle.unitAt(x, y),
        structure = battle.structureAt(x, y);
      const type = battle.terrain[y][x];
      const label = `${coord({ x, y })}, ${tileNames[type] || TILE_BY_ID[type]?.name || type}${unit ? `, ${unit.name}, ${unit.hp} PV` : ""}${structure ? (structure.type === "barrier" ? ", barreira, " : ", estrutura, ") + structure.hp + " PV" : ""}${danger.has(key(x, y)) ? ", perigo: ataque anunciado" : announced.has(key(x, y)) ? ", ataque anunciado sem alcance ou bloqueado" : ""}${targets.has(key(x, y)) ? `, ${battle.mode === "move" ? "movimento disponível" : waveSelected ? "ativar Onda Circular" : "alcance da ação"}` : ""}${waveArea.has(key(x, y)) ? ", área afetada pela onda" : ""}${battle.levelLayers?.effects[y][x] ? `, ${TILE_BY_ID[battle.levelLayers.effects[y][x]].name}` : ""}${type === "mud" ? ", custo de movimento 2" : ""}`;
      const deploymentLabel = isDeployment && battle.inDeploymentArea(x, y) ? ", área inicial, posicionamento disponível" : "";
      cell.setAttribute("aria-label", label + deploymentLabel);
      cell.classList.toggle("deployment-cell", !!deploymentLabel);
      cell.disabled = !(isPlayer || isDeployment);
      cell.title = label;
      cell.setAttribute("aria-pressed", String(unit?.id === battle.selectedId));
    });
    const overlay = $("#result-overlay");
    if (isOver && !resultRevealed && resultTimer === null) {
      resultTimer = setTimeout(() => {
        resultTimer = null;
        resultRevealed = true;
        update();
      }, 460);
    }
    overlay.hidden = !isOver || !resultRevealed;
    if (isOver)
      overlay.innerHTML = `<div class="result-card ${battle.phase}"><div class="result-emblem">${icon(battle.phase === "victory" ? "flag" : "shield")}</div><span class="eyebrow">${battle.phase === "victory" ? "CLAREIRA PROTEGIDA" : battle.resultReason === "timeout" ? "LIMITE DE TURNOS" : "O CAMPO SILENCIOU"}</span><h2>${battle.phase === "victory" ? "Missão cumprida." : battle.resultReason === "timeout" ? "Tempo esgotado." : "Esquadrão derrotado."}</h2><p>${battle.phase === "victory" ? `Todas as ondas caíram em ${battle.round} turno${battle.round === 1 ? "" : "s"}.<br>${kills} inimigos derrotados. A clareira está protegida.` : battle.resultReason === "timeout" ? `O turno ${battle.maxRounds} terminou.<br>Você derrotou ${kills} de ${battle.totalEnemies} inimigos. Tente uma nova estratégia.` : "Toda estratégia é um começo.<br>Reagrupe os elementos e tente novamente."}</p><button class="primary-btn" data-command="confirm-restart">${icon("reset")} Jogar novamente</button></div>`;
    refreshPreview();
  }

  function refreshPreview() {
    const point = renderer.cursor || renderer.hover;
    const signature = `${previewGeneration}:${dialog?.open ? "dialog" : "game"}:${point ? key(point.x, point.y) : "none"}`;
    if (signature === previewSignature) return;
    previewSignature = signature;
    const preview =
      point && !enemyAnimating && !actionAnimating && !dialog?.open
        ? battle.previewAction(point.x, point.y)
        : null;
    renderer.preview = preview;
    $("#attack-preview").innerHTML = previewMarkup(preview);
    $("#attack-preview").classList.toggle("has-preview", !!preview);
    const descriptions = previewCellDescriptions(preview);
    for (const cell of cells) {
      const description = descriptions
        .get(key(+cell.dataset.x, +cell.dataset.y))
        ?.join(". ");
      if (description)
        cell.setAttribute("aria-description", `Prévia: ${description}`);
      else cell.removeAttribute("aria-description");
      cell.title =
        cell.getAttribute("aria-label") +
        (description ? `. Prévia: ${description}` : "");
    }
    renderer.draw(performance.now());
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $("#toast").textContent = message;
    $("#toast").hidden = false;
    toastTimer = setTimeout(() => {
      $("#toast").hidden = true;
    }, 2600);
  }
  function effect() {
    renderer.trigger(battle.lastEffect);
    return renderer.consumeEvents();
  }
  function holdActionMovement(duration) {
    clearTimeout(turnTimer);
    actionAnimating = duration > 0;
    renderer.inputLocked = actionAnimating;
    if (actionAnimating)
      turnTimer = setTimeout(() => dispatch("finish-action"), duration);
  }
  function holdEnemyMovement(duration, displayRound = battle.round) {
    clearTimeout(turnTimer);
    actionAnimating = false;
    enemyAnimating = duration > 0;
    enemyAnimationRound = displayRound;
    renderer.inputLocked = enemyAnimating;
    if (enemyAnimating)
      turnTimer = setTimeout(() => dispatch("finish-enemy"), duration);
  }
  function syncMapLocation() {
    if (!battle.mapSeed || battle.waterKind === "custom") return;
    try {
      const url = new URL(location.href);
      url.searchParams.set("map", battle.mapSeed);
      history.replaceState(history.state, "", url);
    } catch {
      // Some file viewers do not permit changing the local page URL.
    }
  }
  function restartMission(newMap = false, level = null, team = null) {
    clearTimeout(turnTimer);
    clearTimeout(resultTimer);
    clearTimeout(toastTimer);
    turnTimer = null;
    resultTimer = null;
    resultRevealed = false;
    queue.length = 0;
    if (team) battle.setTeam(team);
    else if (level) battle.loadLevel(level);
    else if (newMap && !visualTest) battle.newMap();
    else battle.reset();
    syncMapLocation();
    cursor = { x: battle.selected.x, y: battle.selected.y };
    renderer.reset();
    cells.forEach(
      (cell) =>
        (cell.tabIndex =
          +cell.dataset.x === cursor.x && +cell.dataset.y === cursor.y
            ? 0
            : -1),
    );
    $("#hover-coordinate").textContent = "—";
    $("#toast").hidden = true;
    holdEnemyMovement(renderer.consumeEvents());
    // A new imported level may require choosing its team. Release the previous
    // mandatory dialog before opening the new one, without skipping selection.
    teamSelectionPending = false;
    closeDialog();
    teamSelectionPending = !!level && levelNeedsTeamSelection(battle.options.level);
    update();
    if (teamSelectionPending) {
      draftTeam = battle.team.slice();
      renderTeamSelection();
      openDialog("team-dialog");
    }
  }
  function selectUnit(id) {
    if (battle.select(id)) {
      const boardFocused = document.activeElement?.matches(".cell, .isometric-unit-target");
      cursor = { x: battle.selected.x, y: battle.selected.y };
      renderer.cursor = null;
      cells.forEach((cell) => {
        cell.tabIndex = +cell.dataset.x === cursor.x && +cell.dataset.y === cursor.y ? 0 : -1;
      });
      update();
      if (boardFocused) setCursor(cursor.x, cursor.y);
    }
  }
  function clickCell(x, y) {
    if (
      !["player", "deployment"].includes(battle.phase) ||
      enemyAnimating ||
      dialog?.open ||
      teamSelectionPending
    )
      return;
    cursor = { x, y };
    renderer.cursor = null;
    const unit = battle.unitAt(x, y);
    if (battle.phase === "deployment") {
      dispatch("deploy", { x, y });
      return;
    }
    if (
      battle.mode === "special" &&
      battle.selected?.element === "water" &&
      !battle.selected.acted
    ) {
      if (battle.selected.x === x && battle.selected.y === y) dispatch("wave");
      else if (unit?.team === "ally") dispatch("select", unit.id);
      else toast("Ative a Onda Circular na própria casa de Nami.");
      return;
    }
    if (
      battle.mode === "special" &&
      battle.selected?.element === "wind" &&
      !battle.selected.acted
    ) {
      dispatch("wind", { x, y });
      return;
    }
    if (unit?.team === "ally") {
      dispatch("select", unit.id);
      return;
    }
    if (battle.selected?.acted) {
      toast("Esta unidade já agiu. Escolha outro aliado.");
      return;
    }
    if (battle.mode === "move") dispatch("move", { x, y });
    else if (battle.mode === "punch") dispatch("punch", { x, y });
    else if (battle.mode === "special")
      dispatch(battle.selected?.element, {
        x,
        y,
      });
  }
  const handlers = {
    "choose-team": () => {
      draftTeam = battle.team.slice();
      renderTeamSelection();
      openDialog("team-dialog");
    },
    "toggle-team": (id) => {
      if (draftTeam.includes(id))
        draftTeam = draftTeam.filter((element) => element !== id);
      else if (draftTeam.length < 3 && Object.hasOwn(ELEMENTS, id))
        draftTeam.push(id);
      renderTeamSelection();
    },
    "start-team": () => {
      if (draftTeam.length !== 3) return;
      teamSelectionPending = false;
      restartMission(false, null, draftTeam);
    },
    select: (id) => selectUnit(id),
    deploy: (p) => {
      if (battle.deploy(p.x, p.y)) update();
      else toast("Escolha uma casa azul transitável da área inicial.");
    },
    "confirm-deployment": () => {
      if (!battle.confirmDeployment()) return;
      holdEnemyMovement(effect());
      update();
    },
    mode: (mode) => {
      if (battle.setMode(mode)) {
        renderer.cursor = null;
        if (mode === "special" && battle.selected.element === "water") {
          setCursor(battle.selected.x, battle.selected.y);
        }
        update();
      }
    },
    move: (p) => {
      if (battle.move(p.x, p.y)) {
        effect();
        update();
      } else toast("Escolha uma casa verde ao alcance.");
    },
    undo: () => {
      if (!battle.undoMove()) return;
      effect();
      cursor = { x: battle.selected.x, y: battle.selected.y };
      renderer.cursor = null;
      renderer.hover = null;
      cells.forEach(
        (cell) =>
          (cell.tabIndex =
            +cell.dataset.x === cursor.x && +cell.dataset.y === cursor.y
              ? 0
              : -1),
      );
      $("#hover-coordinate").textContent = "—";
      update();
    },
    punch: (p) => {
      if (battle.punch(p.x, p.y)) {
        effect();
        update();
      } else
        toast(
          "O Soco precisa de um inimigo, pedra, barreira ou muralha a 1 casa.",
        );
    },
    fire: (p) => {
      if (battle.fire(p.x, p.y)) {
        effect();
        update();
      } else toast("Escolha uma linha livre destacada, até 4 casas.");
    },
    wave: () => {
      if (battle.wave()) {
        effect();
        update();
      }
    },
    lightning: (p) => {
      if (battle.lightning(p.x, p.y)) {
        holdActionMovement(effect());
        update();
      } else
        toast(
          "Escolha uma linha até um inimigo ou estrutura. Aliados e terreno intransponível bloqueiam o dash.",
        );
    },
    wind: (p) => {
      if (battle.wind(p.x, p.y)) {
        effect();
        update();
      }
    },
    earth: (p) => {
      if (battle.earth(p.x, p.y)) {
        effect();
        update();
      } else toast("A barreira precisa de grama adjacente e vazia.");
    },
    wait: () => {
      if (battle.wait()) update();
    },
    end: () => {
      if (!battle.beginEnemyTurn()) return;
      update();
      turnTimer = setTimeout(() => {
        dispatch("resolve");
      }, 700);
    },
    resolve: () => {
      const round = battle.round;
      if (battle.resolveEnemyTurn()) {
        holdEnemyMovement(effect(), round);
        update();
      }
    },
    "finish-action": () => {
      actionAnimating = false;
      renderer.inputLocked = false;
      update();
    },
    "finish-enemy": () => {
      enemyAnimating = false;
      renderer.inputLocked = false;
      update();
    },
    restart: () => {
      openDialog("restart-dialog");
    },
    "confirm-restart": () => restartMission(),
    "new-map": () => {
      openDialog("new-map-dialog");
    },
    "confirm-new-map": () => restartMission(true),
    "open-level": () => $("#game-level-file").click(),
    "load-level": (p) => restartMission(false, p.level),
    help: () => openDialog("help-dialog"),
    "close-dialog": () => closeDialog(),
  };
  function dispatch(type, payload) {
    if (options.eventDriven) queue.push({ type, payload });
    else runCommand(type, payload);
  }
  function runCommand(type, payload) {
    if (
      (enemyAnimating || actionAnimating) &&
      ![
        "finish-enemy",
        "finish-action",
        "choose-team",
        "toggle-team",
        "start-team",
        "help",
        "close-dialog",
        "restart",
        "confirm-restart",
        "new-map",
        "confirm-new-map",
        "open-level",
        "load-level",
      ].includes(type)
    )
      return;
    handlers[type]?.(payload);
  }
  function process(commands) {
    // Preserve chronological input even when different GDevelop event groups consume it.
    while (queue.length && commands.includes(queue[0].type)) {
      const cmd = queue.shift();
      runCommand(cmd.type, cmd.payload);
    }
  }
  function openDialog(id) {
    previousFocus = document.activeElement;
    dialog = $("#" + id);
    dialog.showModal();
    dialog
      .querySelector("button:not(:disabled):not([hidden])")
      ?.focus({ preventScroll: true });
    refreshPreview();
  }
  function closeDialog() {
    if (teamSelectionPending && dialog?.id === "team-dialog") return;
    if (dialog?.open) dialog.close();
    dialog = null;
    if (previousFocus?.isConnected) previousFocus.focus();
    refreshPreview();
  }
  root.addEventListener(
    "click",
    (event) => {
      const cell = event.target.closest(".cell, .isometric-unit-target");
      if (cell) {
        clickCell(+cell.dataset.x, +cell.dataset.y);
        return;
      }
      const button = event.target.closest("[data-command]");
      if (button && !button.disabled) {
        event.preventDefault();
        dispatch(
          button.dataset.command,
          button.dataset.unit || button.dataset.mode,
        );
      }
      if (event.target.closest(".brand")) event.preventDefault();
    },
    { signal },
  );
  $("#grid-input").addEventListener(
    "pointermove",
    (event) => {
      const cell = event.target.closest(".cell, .isometric-unit-target");
      if (!cell) return;
      if (
        renderer.hover?.x === +cell.dataset.x &&
        renderer.hover?.y === +cell.dataset.y &&
        !renderer.cursor
      )
        return;
      renderer.hover = { x: +cell.dataset.x, y: +cell.dataset.y };
      renderer.cursor = null;
      $("#hover-coordinate").textContent = coord(renderer.hover);
      refreshPreview();
    },
    { signal },
  );
  $("#grid-input").addEventListener(
    "pointerleave",
    () => {
      renderer.hover = null;
      $("#hover-coordinate").textContent = "—";
      refreshPreview();
    },
    { signal },
  );
  $("#grid-input").addEventListener(
    "focusin",
    (event) => {
      const cell = event.target.closest(".cell, .isometric-unit-target");
      if (!cell) return;
      cursor = { x: +cell.dataset.x, y: +cell.dataset.y };
      renderer.cursor = cursor;
      renderer.hover = null;
      refreshPreview();
    },
    { signal },
  );
  root.querySelectorAll("dialog").forEach((d) => {
    d.addEventListener(
      "click",
      (e) => {
        if (e.target === d) closeDialog();
      },
      { signal },
    );
    d.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        closeDialog();
      },
      { signal },
    );
  });
  function setCursor(x, y) {
    cursor = {
      x: Math.max(0, Math.min(SIZE - 1, x)),
      y: Math.max(0, Math.min(SIZE - 1, y)),
    };
    renderer.cursor = cursor;
    renderer.hover = null;
    cells.forEach(
      (c) =>
        (c.tabIndex =
          +c.dataset.x === cursor.x && +c.dataset.y === cursor.y ? 0 : -1),
    );
    const cell = cells[cursor.y * 8 + cursor.x];
    cell.focus({ preventScroll: true });
    $("#hover-coordinate").textContent = coord(cursor);
    refreshPreview();
  }
  document.addEventListener(
    "keydown",
    (event) => {
      if (dialog?.open) {
        if (event.key === "Tab") {
          const buttons = [...dialog.querySelectorAll("button:not(:disabled)")];
          const first = buttons[0],
            last = buttons.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const k = event.key.toLowerCase();
      const dirs = {
        w: [0, -1],
        arrowup: [0, -1],
        d: [1, 0],
        arrowright: [1, 0],
        s: [0, 1],
        arrowdown: [0, 1],
        a: [-1, 0],
        arrowleft: [-1, 0],
      };
      if (dirs[k]) {
        event.preventDefault();
        const [dx, dy] = dirs[k];
        setCursor(cursor.x + dx, cursor.y + dy);
        return;
      }
      if (k === "z") {
        event.preventDefault();
        if (!event.repeat) dispatch("undo");
        return;
      }
      if (k === "e") {
        event.preventDefault();
        if (!event.repeat) dispatch("end");
        return;
      }
      if (k === "escape") {
        event.preventDefault();
        renderer.cursor = null;
        renderer.hover = null;
        if (battle.selected && !battle.selected.moved) dispatch("mode", "move");
        else if (battle.selected && !battle.selected.acted)
          dispatch("mode", "punch");
        refreshPreview();
        return;
      }
      if (["1", "2", "3"].includes(k)) {
        event.preventDefault();
        dispatch("select", battle.team[+k - 1]);
        return;
      }
      if (
        (k === "enter" || k === " ") &&
        (!event.target.closest("button") ||
          event.target.classList.contains("cell"))
      ) {
        event.preventDefault();
        if (!event.repeat) clickCell(cursor.x, cursor.y);
      }
    },
    { signal },
  );
  $("#game-level-file").addEventListener(
    "change",
    async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        if (file.size > 200000)
          throw new Error("Use uma fase JSON de até 200 KB.");
        const level = normalizeLevel(JSON.parse(await file.text()));
        const report = validateLevel(level);
        if (report.errors.length) throw new Error(report.errors.join(" "));
        dispatch("load-level", { level });
        toast(
          report.warnings.length
            ? report.warnings.join(" ")
            : "Fase carregada.",
        );
      } catch (error) {
        toast(error.message);
      }
      event.target.value = "";
    },
    { signal },
  );
  function renderTeamSelection() {
    const focused = document.activeElement?.dataset.unit;
    $("#team-options").innerHTML = Object.entries(ELEMENTS)
      .map(
        ([id, e]) =>
          `<button class="team-option" data-command="toggle-team" data-unit="${id}" style="--element:${e.color}" aria-pressed="${draftTeam.includes(id)}" ${!draftTeam.includes(id) && draftTeam.length === 3 ? "disabled" : ""}><span class="team-portrait"><canvas width="80" height="80" data-team-portrait="${id}" aria-hidden="true"></canvas>${icon(id)}</span><span class="team-option-name">${e.character}<small>${e.name}</small></span><strong>${e.special}</strong><span class="team-description">${e.description}</span><span class="team-choice">${draftTeam.includes(id) ? `${draftTeam.indexOf(id) + 1} · SELECIONADO` : "SELECIONAR"}</span></button>`,
      )
      .join("");
    root.querySelectorAll("[data-team-portrait]").forEach((canvas) =>
      portrait(canvas, {
        team: "ally",
        element: canvas.dataset.teamPortrait,
      }),
    );
    $("#team-count").textContent =
      `${draftTeam.length} / 3 ninjas selecionados${draftTeam.length === 3 ? ". Desmarque um ninja para trocar por outro." : ". Escolha mais " + (3 - draftTeam.length) + "."}`;
    $("#team-start").disabled = draftTeam.length !== 3;
    $("#team-start").innerHTML = `${battle.deploymentCells.length ? "Posicionar equipe" : "Iniciar missão"} ${icon("arrow")}`;
    $(".team-restart-note").textContent = battle.deploymentCells.length ? "Ao confirmar, escolha as posições iniciais nas casas azuis do mesmo mapa." : "Ao confirmar, a missão começa no turno 1 no mesmo mapa.";
    $("#team-cancel").hidden = teamSelectionPending;
    if (focused)
      $("#team-options")
        .querySelector(`[data-unit="${focused}"]`)
        ?.focus({ preventScroll: true });
  }
  syncMapLocation();
  holdEnemyMovement(renderer.consumeEvents());
  update();
  if (teamSelectionPending) {
    renderTeamSelection();
    openDialog("team-dialog");
  }
  return {
    battle,
    renderer,
    process,
    update,
    root,
    dispose() {
      controller.abort();
      clearTimeout(turnTimer);
      clearTimeout(resultTimer);
      clearTimeout(toastTimer);
      renderer.dispose();
      root.innerHTML = "";
    },
  };
}
