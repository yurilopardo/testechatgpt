import { ELEMENTS } from "./roster.js";
import { ENEMY_TYPES, ENEMY_KINDS } from "./enemies.js";
import { createApp } from "./app.js";
import { createTerrainCanvas, drawUnit } from "./art.js";
import { generateMap, randomSeed } from "./maps.js";
import {
  TILE_CATALOG,
  TILE_BY_ID,
  DIRECTION_NAMES,
  blankLevel,
  normalizeLevel,
  validateLevel,
  canStand,
  cellName,
  levelTerrain,
  levelFromGenerated,
  exportPlayableHtml,
} from "./levels.js";

const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const clone = (v) => structuredClone(v);
const DRAFT_KEY = "triade.editor.draft.v1",
  LIBRARY_KEY = "triade.editor.library.v1";
const unitName = (u) =>
  u.team === "enemy"
    ? ENEMY_TYPES[u.kind].name
    : ELEMENTS[u.element].character;
const fileName = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "fase";

export function createEditor(root, options = {}) {
  const controller = new AbortController(),
    { signal } = controller;
  let level = blankLevel(),
    library = [],
    selectedId = null,
    brush = "grass",
    mode = "paint",
    direction = "east";
  let past = [],
    future = [],
    stroke = null,
    strokeCells = new Set(),
    hovered = { x: 0, y: 0 },
    play = null;
  let storageWorks = true;
  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        level = normalizeLevel(JSON.parse(draft));
      } catch {
        /* A damaged draft must not hide a still-valid saved library. */
      }
    }
    const stored = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]");
    if (Array.isArray(stored))
      library = stored.slice(0, 30).flatMap((entry) => {
        try {
          return [{ id: String(entry.id), level: normalizeLevel(entry.level) }];
        } catch {
          return [];
        }
      });
  } catch {
    storageWorks = false;
  }
  root.innerHTML = `<main class="map-editor">
    <header class="editor-header"><div><a class="editor-brand" href="./jogar.html">△ TRÍADE</a><span class="editor-breadcrumb">/ ATELIÊ DE MAPAS</span><h1>Uma nova história começa no terreno.</h1><p>Pinte, posicione o esquadrão e experimente suas próprias fases.</p></div><div class="editor-header-actions"><button data-edit="json">Importar / JSON</button><button data-edit="export-json">Baixar fase</button><button data-edit="test" class="editor-primary">▶ Testar fase</button></div></header>
    <section class="editor-toolbar" aria-label="Ferramentas"><div class="editor-tool-group"><button data-mode="paint" aria-pressed="true">Pincel <kbd>B</kbd></button><button data-mode="fill" aria-pressed="false">Balde <kbd>G</kbd></button><button data-mode="erase" aria-pressed="false">Borracha <kbd>X</kbd></button><button data-mode="pick" aria-pressed="false">Conta-gotas <kbd>I</kbd></button></div><div class="editor-tool-group"><button data-edit="undo" id="editor-undo">↶ Desfazer</button><button data-edit="redo" id="editor-redo">↷ Refazer</button></div><span class="editor-grid-size">8 × 8 · VISTA SUPERIOR</span></section>
    <div class="editor-workspace"><aside class="editor-palette"><div class="editor-section-label">PALETA DE TILES <span>${TILE_CATALOG.length}</span></div><div class="editor-categories" role="group" aria-label="Categorias"><button data-category="Chão" aria-pressed="true">Chão</button><button data-category="Objetos" aria-pressed="false">Objetos</button><button data-category="Efeitos e objetivos" aria-pressed="false">Efeitos</button><button data-category="Personagens" aria-pressed="false">Ninjas</button></div><div id="editor-palette-items"></div><div class="editor-brush-card" id="editor-brush-info"></div><label class="editor-field">Orientação<select id="editor-direction">${Object.entries(
      DIRECTION_NAMES,
    )
      .map(
        ([id, name]) =>
          `<option value="${id}" ${id === "east" ? "selected" : ""}>${name}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="editor-field">Borracha remove<select id="editor-erase-layer"><option value="objects">Objetos</option><option value="effects">Efeitos e objetivos</option><option value="deployment">Área inicial</option><option value="units">Personagens</option><option value="ground">Chão → grama</option><option value="all">Tudo na casa</option></select></label><p class="editor-key-help">Arraste para pintar. Enter ou Espaço pinta a casa em foco. Setas movem o cursor. Ctrl+Z desfaz.</p></aside>
    <section class="editor-stage"><div class="editor-stage-heading"><span id="editor-map-name"></span><span id="editor-hover">A1</span></div><div class="editor-board-wrap"><div class="editor-axis">${"ABCDEFGH"
      .split("")
      .map((c) => `<span>${c}</span>`)
      .join(
        "",
      )}</div><div class="editor-board"><canvas id="editor-canvas" width="512" height="512" aria-hidden="true"></canvas><div class="editor-grid" role="group" aria-label="Mapa editável 8 por 8">${Array.from({ length: 64 }, (_, i) => `<button class="editor-cell" data-x="${i % 8}" data-y="${Math.floor(i / 8)}" data-testid="edit-cell-${i % 8}-${Math.floor(i / 8)}" tabindex="${i === 0 ? 0 : -1}"></button>`).join("")}</div></div><div class="editor-axis editor-axis-bottom">${"12345678"
      .split("")
      .map((c) => `<span>${c}</span>`)
      .join(
        "",
      )}</div></div><div class="editor-stage-footer"><span id="editor-counts"></span><span>Chão + objetos + efeitos + área inicial</span></div><div class="editor-message" id="editor-message" role="status" aria-live="polite">Pronto para criar. As alterações ficam no rascunho deste navegador.</div><section class="editor-validation" aria-label="Validação da fase"><h2>Conferência da fase</h2><div id="editor-validation"></div></section></section>
    <aside class="editor-settings"><div class="editor-section-label">SUA FASE</div><label class="editor-field">Nome<input id="editor-name" maxlength="80"></label><label class="editor-field">Descrição<textarea id="editor-description" maxlength="1000" rows="2"></textarea></label><div class="editor-settings-row"><label class="editor-field">Limite de turnos<input id="editor-rounds" type="number" min="1" max="20"></label><button data-edit="save" class="editor-save">Salvar na biblioteca</button></div><div class="editor-rule-summary">Objetivo: eliminar todos os inimigos e reforços antes do prazo, mantendo um aliado vivo.</div><p class="editor-muted" id="editor-team-note"></p><div class="editor-section-label">ONDAS DE REFORÇOS</div><div id="editor-waves"></div><button data-edit="add-wave" class="editor-wide">+ Adicionar onda</button><p class="editor-muted">Entram nos pontos de reforço marcados. Sem marcadores, usam as bordas livres.</p><div class="editor-section-label">BIBLIOTECA LOCAL</div><label class="editor-field">Fases salvas<select id="editor-library"><option value="">Escolha uma fase</option></select></label><div class="editor-inline-buttons"><button data-edit="duplicate">Duplicar</button><button data-edit="delete">Excluir salva</button></div><p class="editor-muted" id="editor-storage-note">Biblioteca salva neste navegador. Exporte os arquivos para guardar ou compartilhar.</p><div class="editor-section-label">PONTO DE PARTIDA</div><div class="editor-inline-buttons"><button data-edit="blank">Mapa limpo</button><button data-edit="generate">Gerar terreno</button></div><label class="editor-field">Código do terreno (opcional)<input id="editor-seed" maxlength="32" placeholder="Ex.: floresta-01"></label><button data-edit="export-html" class="editor-wide">↓ Baixar fase jogável (.html)</button><div class="editor-inspector" id="editor-inspector"></div></aside></div>
    <footer class="editor-footer"><span>ATELIÊ TRÍADE · FASES V1</span><span>Os tiles com ◇ têm efeitos especiais em planejamento. A regra disponível aparece na paleta.</span></footer>
    <dialog id="editor-json-dialog" class="editor-json-dialog"><div class="editor-dialog-heading"><h2>Arquivo da fase</h2><button data-edit="close-json" aria-label="Fechar JSON">×</button></div><p>Baixe o JSON ou copie o conteúdo. Para importar, escolha um arquivo ou cole uma fase no campo abaixo.</p><label class="editor-field">Importar arquivo JSON<input type="file" accept=".json,application/json" id="editor-import-file"></label><label class="editor-field">Conteúdo JSON<textarea id="editor-json" spellcheck="false" rows="14"></textarea></label><p id="editor-json-error" role="alert"></p><div class="editor-inline-buttons"><button data-edit="copy-json">Copiar JSON</button><button data-edit="export-json">Baixar JSON</button><button data-edit="apply-json" class="editor-primary">Carregar texto</button></div></dialog>
    <dialog id="editor-play-dialog" class="editor-play-dialog"><div class="editor-play-toolbar"><strong>TESTE DA FASE</strong><span>O rascunho permanece como você o deixou.</span><button data-edit="close-test">← Voltar ao editor</button></div><p id="editor-play-note"></p><div id="editor-game"></div></dialog>
    </main>`;
  const $ = (selector) => root.querySelector(selector),
    cells = [...root.querySelectorAll(".editor-cell")];
  const canvas = $("#editor-canvas"),
    ctx = canvas.getContext("2d");
  let category = "Chão";
  const thumbnails = new Map();

  function message(text, error = false) {
    $("#editor-message").textContent = text;
    $("#editor-message").classList.toggle("error", error);
  }
  function store() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(level));
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    } catch {
      storageWorks = false;
    }
    if (!storageWorks)
      $("#editor-storage-note").textContent =
        "Armazenamento local indisponível. Use Baixar fase ou copie o JSON para guardar seu trabalho.";
  }
  function history(before) {
    if (JSON.stringify(before) === JSON.stringify(level)) return;
    past.push(before);
    if (past.length > 100) past.shift();
    future = [];
    store();
  }
  function change(mutator) {
    const before = clone(level),
      candidate = clone(level);
    try {
      mutator(candidate);
      level = normalizeLevel(candidate);
      history(before);
      render();
      return true;
    } catch (error) {
      message(error.message, true);
      return false;
    }
  }
  function load(candidate, text) {
    const normalized = normalizeLevel(candidate),
      before = clone(level);
    level = normalized;
    selectedId = null;
    history(before);
    render();
    message(text);
  }
  function thumbnail(id) {
    if (thumbnails.has(id)) return thumbnails.get(id);
    const demo = blankLevel();
    demo.units = [];
    demo.objects = demo.objects.map((r) => r.map(() => null));
    if (TILE_BY_ID[id]) {
      demo[TILE_BY_ID[id].layer][0][0] = id;
      if (["bridge", "current", "electrified-water"].includes(id))
        demo.ground[0][0] = "water";
    }
    const image = createTerrainCanvas(
      levelTerrain(demo),
      new Map(),
      new Set(),
      demo,
    );
    const mini = document.createElement("canvas");
    mini.width = mini.height = 64;
    const c = mini.getContext("2d");
    c.drawImage(image, 0, 0, 64, 64, 0, 0, 64, 64);
    if (id.startsWith("unit:")) {
      c.clearRect(0, 0, 64, 64);
      const kind = id.slice(5);
      drawUnit(
        c,
        ENEMY_KINDS.includes(kind)
          ? { team: "enemy", kind }
          : { team: "ally", element: kind },
        32,
        33,
        1.1,
      );
    }
    thumbnails.set(id, mini);
    return mini;
  }
  function renderPalette() {
    const entries =
      category === "Personagens"
        ? [
            { id: "unit:fire", name: "Ígni · Fogo" },
            { id: "unit:water", name: "Nami · Água" },
            { id: "unit:earth", name: "Taro · Terra" },
            { id: "unit:lightning", name: "Rai · Raio" },
            { id: "unit:wind", name: "Sora · Vento" },
            ...ENEMY_KINDS.map((kind) => ({
              id: `unit:${kind}`, name: ENEMY_TYPES[kind].name,
              rule: ENEMY_TYPES[kind].rule,
            })),
          ]
        : TILE_CATALOG.filter((t) => t.category === category);
    $("#editor-palette-items").innerHTML = entries
      .map(
        (t) =>
          `<button class="editor-tile" data-brush="${t.id}" aria-pressed="${t.id === brush}" title="${escape(t.rule || t.name)}${t.future ? ` ${escape(t.future)}` : ""}"><canvas width="64" height="64" aria-hidden="true"></canvas><span>${escape(t.name)}${t.future ? " ◇" : ""}</span></button>`,
      )
      .join("");
    for (const button of $("#editor-palette-items").querySelectorAll("button"))
      button
        .querySelector("canvas")
        .getContext("2d")
        .drawImage(thumbnail(button.dataset.brush), 0, 0);
    for (const button of root.querySelectorAll("[data-category]"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.category === category),
      );
    renderBrush();
  }
  function renderBrush() {
    const t = TILE_BY_ID[brush];
    $("#editor-brush-info").innerHTML = t
      ? `<strong>${escape(t.name)}</strong><span>${escape(t.rule)}</span>${t.future ? `<small>◇ ${escape(t.future)}</small>` : '<small class="editor-ready">● Regra disponível no teste</small>'}`
      : `<strong>${escape(ENEMY_TYPES[brush.slice(5)]?.name || ELEMENTS[brush.slice(5)]?.character || "Personagem")}</strong>${ENEMY_TYPES[brush.slice(5)] ? `<small>${escape(ENEMY_TYPES[brush.slice(5)].rule)}</small>` : ""}<span>Clique em uma casa livre. Um aliado já colocado muda para a nova posição; inimigos podem ser adicionados várias vezes. Com Área inicial, os ninjas no mapa são opcionais: o jogador escolhe o trio antes de posicionar. Sem essa área, coloque exatamente 3 ninjas. Use a borracha de Personagens para retirar aliados.</span>`;
    for (const b of root.querySelectorAll("[data-brush]"))
      b.setAttribute("aria-pressed", String(b.dataset.brush === brush));
    for (const b of root.querySelectorAll("[data-mode]"))
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  }
  function paint(x, y) {
    const key = `${x},${y}`;
    if (strokeCells.has(key)) return;
    strokeCells.add(key);
    hovered = { x, y };
    if (mode === "pick") {
      const u = level.units.find((u) => u.x === x && u.y === y);
      brush = u
        ? `unit:${u.team === "ally" ? u.element : u.kind}`
        : level.deployment[y][x] || level.effects[y][x] || level.objects[y][x] || level.ground[y][x];
      category = u ? "Personagens" : TILE_BY_ID[brush].category;
      mode = "paint";
      renderPalette();
      inspect();
      return;
    }
    const candidate = clone(level);
    try {
      if (mode === "erase") {
        const layer = $("#editor-erase-layer").value;
        if (layer === "units" || layer === "all")
          candidate.units = candidate.units.filter(
            (u) => u.x !== x || u.y !== y,
          );
        for (const target of ["ground", "objects", "effects", "deployment"])
          if (layer === target || layer === "all")
            candidate[target][y][x] = target === "ground" ? "grass" : null;
      } else if (brush.startsWith("unit:")) {
        if (!canStand(candidate, x, y))
          throw new Error("Posicione o personagem em uma casa transitável.");
        const kind = brush.slice(5),
          ally = Object.hasOwn(ELEMENTS, kind);
        const occupant = candidate.units.find((u) => u.x === x && u.y === y);
        if (occupant && !(ally && occupant.id === kind)) {
          if (!ally && occupant.team === "enemy" && occupant.kind === kind)
            return;
          throw new Error(
            "Essa casa já tem um personagem. Use a borracha de personagens primeiro.",
          );
        }
        if (ally)
          candidate.units = candidate.units.filter((u) => u.id !== kind);
        const serial =
          Math.max(
            0,
            ...candidate.units
              .filter((u) => u.team === "enemy")
              .map((u) => Number(u.id.slice(6))),
          ) + 1;
        candidate.units.push(
          ally
            ? { id: kind, team: "ally", element: kind, x, y }
            : { id: `enemy-${serial}`, team: "enemy", kind, x, y },
        );
      } else {
        const tile = TILE_BY_ID[brush];
        const positions = [{ x, y }];
        if (mode === "fill") {
          if (tile.layer !== "ground")
            throw new Error("O balde pinta apenas o chão.");
          const old = candidate.ground[y][x],
            seen = new Set([key]);
          for (let i = 0; i < positions.length; i++)
            for (const [dx, dy] of [
              [0, -1],
              [1, 0],
              [0, 1],
              [-1, 0],
            ]) {
              const p = { x: positions[i].x + dx, y: positions[i].y + dy },
                k = `${p.x},${p.y}`;
              if (
                p.x < 0 ||
                p.y < 0 ||
                p.x >= 8 ||
                p.y >= 8 ||
                seen.has(k) ||
                candidate.ground[p.y][p.x] !== old
              )
                continue;
              seen.add(k);
              positions.push(p);
            }
        } else if (brush === "log") {
          const p = {
            x: x + (["east", "west"].includes(direction) ? 1 : 0),
            y: y + (["north", "south"].includes(direction) ? 1 : 0),
          };
          if (p.x >= 8 || p.y >= 8)
            throw new Error("O tronco precisa de duas casas dentro do mapa.");
          positions.push(p);
        }
        for (const p of positions) {
          candidate[tile.layer][p.y][p.x] = brush;
          candidate.directions[p.y][p.x] = direction;
          if (
            ["current", "electrified-water"].includes(brush) &&
            !["water", "deep-water"].includes(candidate.ground[p.y][p.x])
          )
            candidate.ground[p.y][p.x] = "water";
        }
      }
      if (
        candidate.units.some(
          (u) => !canStand(candidate, u.x, u.y) && canStand(level, u.x, u.y),
        )
      )
        throw new Error(
          "Esse tile bloquearia um personagem. Mova ou apague o personagem antes de pintar.",
        );
      level = normalizeLevel(candidate);
      render();
      message(
        `${cellName(x, y)} · ${mode === "erase" ? "Camada apagada" : brush.startsWith("unit:") ? "Personagem posicionado" : TILE_BY_ID[brush].name + " aplicado"}.`,
      );
    } catch (error) {
      message(error.message, true);
    }
  }
  function finishStroke() {
    if (stroke) {
      history(stroke);
      stroke = null;
      strokeCells.clear();
      render();
    }
  }
  function inspect() {
    const { x, y } = hovered,
      u = level.units.find((u) => u.x === x && u.y === y);
    $("#editor-hover").textContent = cellName(x, y);
    $("#editor-inspector").innerHTML =
      `<strong>CASA ${cellName(x, y)}</strong><span>Chão: ${escape(TILE_BY_ID[level.ground[y][x]].name)}</span><span>Objeto: ${escape(TILE_BY_ID[level.objects[y][x]]?.name || "nenhum")}</span><span>Efeito: ${escape(TILE_BY_ID[level.effects[y][x]]?.name || "nenhum")}</span><span>Área inicial: ${level.deployment[y][x] ? "sim" : "não"}</span><span>Personagem: ${escape(u ? unitName(u) : "nenhum")}</span>`;
  }
  function render() {
    $("#editor-name").value = level.name;
    $("#editor-description").value = level.description;
    $("#editor-rounds").value = level.rules.maxRounds;
    $("#editor-map-name").textContent = level.name;
    const image = createTerrainCanvas(
      levelTerrain(level),
      new Map(),
      new Set(),
      level,
    );
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 512, 512);
    ctx.drawImage(image, 0, 0);
    for (const u of level.units) drawUnit(ctx, u, u.x * 64 + 32, u.y * 64 + 33);
    ctx.strokeStyle = "#14271c66";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 64 + 0.5, 0);
      ctx.lineTo(i * 64 + 0.5, 512);
      ctx.moveTo(0, i * 64 + 0.5);
      ctx.lineTo(512, i * 64 + 0.5);
      ctx.stroke();
    }
    for (const c of cells) {
      const x = +c.dataset.x,
        y = +c.dataset.y,
        u = level.units.find((u) => u.x === x && u.y === y);
      c.setAttribute(
        "aria-label",
        `${cellName(x, y)}, ${TILE_BY_ID[level.ground[y][x]].name}${level.objects[y][x] ? `, ${TILE_BY_ID[level.objects[y][x]].name}` : ""}${level.effects[y][x] ? `, ${TILE_BY_ID[level.effects[y][x]].name}` : ""}${level.deployment[y][x] ? ", Área inicial" : ""}${u ? `, ${unitName(u)}` : ""}`,
      );
    }
    const hasStartingArea = level.deployment.flat().some(Boolean);
    const allyCount = level.units.filter((u) => u.team === "ally").length;
    $("#editor-team-note").textContent = hasStartingArea
      ? "Ninjas no mapa são opcionais. Com menos de três sugestões, o jogador escolhe o trio antes de posicionar na Área inicial."
      : "Coloque três ninjas ou pinte uma Área inicial com pelo menos três casas livres para deixar a escolha ao jogador.";
    $("#editor-counts").textContent =
      `${hasStartingArea ? `${allyCount} ninjas sugeridos` : `${allyCount}/3 aliados`} · ${level.units.filter((u) => u.team === "enemy").length} inimigos · ${level.rules.waves.reduce((n, w) => n + w.kinds.length, 0)} reforços · ${level.deployment.flat().filter(Boolean).length} casas de início`;
    const report = validateLevel(level);
    $("#editor-validation").innerHTML =
      report.errors
        .map((e) => `<p class="editor-error">! ${escape(e)}</p>`)
        .join("") +
      report.warnings
        .map((w) => `<p class="editor-warning">◇ ${escape(w)}</p>`)
        .join("") +
      (!report.errors.length
        ? '<p class="editor-valid">✓ Fase pronta para testar. A validação não garante que seja possível vencer.</p>'
        : "");
    $("#editor-undo").disabled = !past.length;
    $("#editor-redo").disabled = !future.length;
    $("#editor-waves").innerHTML = level.rules.waves
      .map(
        (w, i) =>
          `<div class="editor-wave" data-wave="${i}"><label>Turno<input data-wave-field="round" type="number" min="2" max="${level.rules.maxRounds}" value="${w.round}"></label>${ENEMY_KINDS.map((kind) => `<label>${ENEMY_TYPES[kind].plural}<input data-wave-field="${kind}" type="number" min="0" max="8" value="${w.kinds.filter((k) => k === kind).length}"></label>`).join("")}<button data-edit="remove-wave" data-index="${i}" aria-label="Excluir onda do turno ${w.round}">×</button></div>`,
      )
      .join("");
    $("#editor-library").innerHTML =
      '<option value="">Escolha uma fase</option>' +
      library
        .map(
          (e) =>
            `<option value="${escape(e.id)}" ${e.id === selectedId ? "selected" : ""}>${escape(e.level.name)}</option>`,
        )
        .join("");
    inspect();
    renderBrush();
  }
  function download(content, name, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function json() {
    return JSON.stringify(normalizeLevel(level), null, 2);
  }
  function closeTest() {
    play?.dispose();
    play = null;
    $("#editor-play-dialog").close();
    $("[data-edit=test]").focus();
  }
  async function command(action, button) {
    finishStroke();
    try {
      if (action === "undo" && past.length) {
        future.push(clone(level));
        level = past.pop();
        selectedId = null;
        store();
        render();
        message("Última alteração desfeita.");
      }
      if (action === "redo" && future.length) {
        past.push(clone(level));
        level = future.pop();
        selectedId = null;
        store();
        render();
        message("Alteração refeita.");
      }
      if (action === "blank")
        load(blankLevel(), "Mapa limpo criado. Desfazer recupera o anterior.");
      if (action === "generate")
        load(
          levelFromGenerated(
            generateMap($("#editor-seed").value.trim() || randomSeed()),
          ),
          "Terreno gerado. Você pode editar qualquer casa.",
        );
      if (action === "duplicate") {
        change((l) => {
          l.name = (l.name + " — cópia").slice(0, 80);
        });
        selectedId = null;
        render();
        message(
          "Cópia criada. Salve na biblioteca para guardar como outra fase.",
        );
      }
      if (action === "save") {
        const entry = {
          id:
            selectedId ||
            globalThis.crypto?.randomUUID?.() ||
            `fase-${Date.now()}`,
          level: normalizeLevel(level),
        };
        const index = library.findIndex((e) => e.id === entry.id);
        if (index < 0) {
          if (library.length >= 30)
            throw new Error(
              "A biblioteca comporta 30 fases. Exporte ou exclua uma para liberar espaço.",
            );
          library.push(entry);
        } else library[index] = entry;
        selectedId = entry.id;
        store();
        render();
        message(
          storageWorks
            ? "Fase salva na biblioteca deste navegador."
            : "Use o JSON para guardar sua fase; o armazenamento local está indisponível.",
          !storageWorks,
        );
      }
      if (action === "delete") {
        if (!selectedId)
          throw new Error("Escolha uma fase salva na biblioteca para excluir.");
        if (
          !window.confirm(
            "Excluir esta fase da biblioteca? O mapa aberto e os arquivos exportados serão preservados.",
          )
        )
          return;
        library = library.filter((e) => e.id !== selectedId);
        selectedId = null;
        store();
        render();
        message("Fase removida da biblioteca. O rascunho continua aberto.");
      }
      if (action === "add-wave") {
        const round = Array.from(
          { length: level.rules.maxRounds - 1 },
          (_, i) => i + 2,
        ).find((r) => !level.rules.waves.some((w) => w.round === r));
        if (!round)
          throw new Error(
            "Todos os turnos disponíveis já têm ondas. Aumente o limite ou edite uma onda.",
          );
        change((l) => l.rules.waves.push({ round, kinds: ["melee"] }));
      }
      if (action === "remove-wave")
        change((l) => l.rules.waves.splice(+button.dataset.index, 1));
      if (action === "json") {
        $("#editor-json").value = json();
        $("#editor-json-error").textContent = "";
        $("#editor-json-dialog").showModal();
      }
      if (action === "close-json") $("#editor-json-dialog").close();
      if (action === "apply-json") {
        load(
          JSON.parse($("#editor-json").value),
          "Fase importada do texto JSON.",
        );
        $("#editor-json-dialog").close();
      }
      if (action === "copy-json") {
        const field = $("#editor-json");
        field.value = json();
        field.select();
        try {
          await navigator.clipboard.writeText(field.value);
          $("#editor-json-error").textContent = "JSON copiado.";
        } catch {
          $("#editor-json-error").textContent =
            "O texto está selecionado. Use Ctrl+C para copiar.";
        }
      }
      if (action === "export-json") {
        download(
          json(),
          `${fileName(level.name)}.json`,
          "application/json;charset=utf-8",
        );
        message("Arquivo JSON da fase preparado para download.");
      }
      if (action === "test") {
        const report = validateLevel(level);
        if (report.errors.length) throw new Error(report.errors.join(" "));
        $("#editor-play-note").textContent = report.warnings.join(" ");
        $("#editor-play-dialog").showModal();
        play = createApp($("#editor-game"), {
          battleOptions: { level: clone(level) },
        });
        $("#editor-play-dialog").scrollTop = 0;
      }
      if (action === "close-test") closeTest();
      if (action === "export-html") {
        const report = validateLevel(level);
        if (report.errors.length) throw new Error(report.errors.join(" "));
        let html = options.playerHtml;
        if (!html) {
          const response = await fetch(new URL("./jogar.html", location.href));
          if (!response.ok)
            throw new Error(
              "A exportação jogável está indisponível. Abra a versão offline do editor.",
            );
          html = await response.text();
        }
        download(
          exportPlayableHtml(html, level),
          `${fileName(level.name)}.html`,
          "text/html;charset=utf-8",
        );
        message(
          "Fase jogável preparada. O HTML funciona offline, sem instalação.",
        );
      }
    } catch (error) {
      message(error.message, true);
      if ($("#editor-json-dialog").open)
        $("#editor-json-error").textContent = error.message;
    }
  }
  root.addEventListener(
    "click",
    (event) => {
      const b = event.target.closest("button");
      if (!b) return;
      if (b.dataset.edit) void command(b.dataset.edit, b);
      if (b.dataset.category) {
        category = b.dataset.category;
        renderPalette();
      }
      if (b.dataset.brush) {
        brush = b.dataset.brush;
        if (mode !== "fill" || TILE_BY_ID[brush]?.layer !== "ground")
          mode = "paint";
        renderBrush();
      }
      if (b.dataset.mode) {
        mode = b.dataset.mode;
        renderBrush();
      }
      if (b.classList.contains("editor-cell") && event.detail === 0) {
        stroke = clone(level);
        strokeCells.clear();
        paint(+b.dataset.x, +b.dataset.y);
        finishStroke();
      }
    },
    { signal },
  );
  $(".editor-grid").addEventListener(
    "pointerdown",
    (event) => {
      const c = event.target.closest(".editor-cell");
      if (!c || event.button !== 0) return;
      event.preventDefault();
      c.focus({ preventScroll: true });
      stroke = clone(level);
      strokeCells.clear();
      paint(+c.dataset.x, +c.dataset.y);
    },
    { signal },
  );
  $(".editor-grid").addEventListener(
    "pointermove",
    (event) => {
      const c = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest(".editor-cell");
      if (!c) return;
      hovered = { x: +c.dataset.x, y: +c.dataset.y };
      inspect();
      if (stroke) paint(hovered.x, hovered.y);
    },
    { signal },
  );
  window.addEventListener("pointerup", finishStroke, { signal });
  window.addEventListener("pointercancel", finishStroke, { signal });
  root.addEventListener(
    "change",
    (event) => {
      const field = event.target;
      if (field.id === "editor-name")
        change((l) => {
          l.name = field.value;
        });
      if (field.id === "editor-description")
        change((l) => {
          l.description = field.value;
        });
      if (field.id === "editor-rounds")
        change((l) => {
          l.rules.maxRounds = +field.value;
          l.rules.waves = l.rules.waves.filter(
            (w) => w.round <= l.rules.maxRounds,
          );
        });
      if (field.id === "editor-direction") direction = field.value;
      if (field.id === "editor-library") {
        const entry = library.find((e) => e.id === field.value);
        if (entry) {
          load(entry.level, "Fase carregada da biblioteca.");
          selectedId = entry.id;
          render();
        }
      }
      if (field.dataset.waveField) {
        const index = +field.closest("[data-wave]").dataset.wave;
        change((l) => {
          const row = field.closest("[data-wave]"),
            round = +row.querySelector('[data-wave-field="round"]').value;
          const counts = ENEMY_KINDS.map((kind) =>
            +row.querySelector(`[data-wave-field="${kind}"]`).value);
          if (
            counts.some((n) => !Number.isInteger(n) || n < 0) ||
            counts.reduce((sum, n) => sum + n, 0) < 1 ||
            counts.reduce((sum, n) => sum + n, 0) > 8
          )
            throw new Error("Use de 1 a 8 inimigos por onda.");
          l.rules.waves[index] = {
            round,
            kinds: ENEMY_KINDS.flatMap((kind, i) => Array(counts[i]).fill(kind)),
          };
        });
      }
      if (field.id === "editor-import-file") {
        const file = field.files[0];
        if (!file) return;
        if (file.size > 200000) {
          $("#editor-json-error").textContent =
            "Arquivo grande demais. Use uma fase JSON de até 200 KB.";
          return;
        }
        void file
          .text()
          .then((text) => {
            load(JSON.parse(text), "Fase importada do arquivo.");
            $("#editor-json-dialog").close();
          })
          .catch((error) => {
            $("#editor-json-error").textContent = error.message;
          });
      }
    },
    { signal },
  );
  root.addEventListener(
    "focusin",
    (event) => {
      const c = event.target.closest(".editor-cell");
      if (c) {
        hovered = { x: +c.dataset.x, y: +c.dataset.y };
        inspect();
      }
    },
    { signal },
  );
  window.addEventListener(
    "keydown",
    (event) => {
      if (
        $("#editor-play-dialog").open ||
        $("#editor-json-dialog").open ||
        event.target.closest("input,textarea,select")
      )
        return;
      const k = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && k === "z") {
        event.preventDefault();
        void command(event.shiftKey ? "redo" : "undo");
        return;
      }
      if ((event.ctrlKey || event.metaKey) && k === "y") {
        event.preventDefault();
        void command("redo");
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if ({ b: "paint", g: "fill", x: "erase", i: "pick" }[k]) {
        mode = { b: "paint", g: "fill", x: "erase", i: "pick" }[k];
        renderBrush();
      }
      const c = event.target.closest(".editor-cell"),
        delta = {
          ArrowUp: [0, -1],
          ArrowRight: [1, 0],
          ArrowDown: [0, 1],
          ArrowLeft: [-1, 0],
        }[event.key];
      if (c && delta) {
        event.preventDefault();
        const x = Math.max(0, Math.min(7, +c.dataset.x + delta[0])),
          y = Math.max(0, Math.min(7, +c.dataset.y + delta[1]));
        for (const cell of cells) cell.tabIndex = -1;
        const next = cells[y * 8 + x];
        next.tabIndex = 0;
        next.focus();
      }
    },
    { signal },
  );
  $("#editor-play-dialog").addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      closeTest();
    },
    { signal },
  );
  renderPalette();
  render();
  store();
  return {
    get level() {
      return clone(level);
    },
    dispose() {
      play?.dispose();
      controller.abort();
      root.innerHTML = "";
    },
  };
}
