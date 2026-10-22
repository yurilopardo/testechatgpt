import { build } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";

// A self-contained GDevelop 5 project: no remote assets, extensions or runtime fetches.
const result = await build({
  configFile: false,
  logLevel: "error",
  build: {
    write: false,
    minify: true,
    lib: {
      entry: "src/app.js",
      name: "Triade",
      formats: ["iife"],
      fileName: "triade",
    },
    target: "es2020",
  },
});
const output = (Array.isArray(result) ? result[0] : result).output;
const bundle = output.find((o) => o.type === "chunk").code;
const css = await readFile("src/style.css", "utf8");
const js = (code) => ({
  type: "BuiltinCommonInstructions::JsCode",
  inlineCode: code.split("\n"),
  parameterObjects: "",
  useStrict: false,
  eventsSheetExpanded: false,
});
const comment = (text) => ({
  type: "BuiltinCommonInstructions::Comment",
  color: { r: 76, g: 99, b: 69, textR: 231, textG: 238, textB: 207 },
  comment: text,
});
const group = (name, description, code) => ({
  type: "BuiltinCommonInstructions::Group",
  name,
  source: "",
  colorR: 86,
  colorG: 110,
  colorB: 74,
  creationTime: 0,
  disabled: false,
  folded: true,
  parameters: [],
  events: [comment(description), js(code)],
});
const process = (...commands) =>
  `if (runtimeScene.__triade) runtimeScene.__triade.process(${JSON.stringify(commands)});`;

const boot = `if (!runtimeScene.__triade) {
  ${bundle}
  const previous = document.getElementById('triade-gdevelop');
  if (previous) { if (previous.__app) previous.__app.dispose(); previous.remove(); }
  const host = document.createElement('div');
  host.id = 'triade-gdevelop';
  Object.assign(host.style, { position: 'fixed', inset: '0', overflow: 'auto', zIndex: '10000', background: '#111a15' });
  const style = document.createElement('style');
  style.textContent = ${JSON.stringify(css)};
  host.appendChild(style);
  const root = document.createElement('div');
  host.appendChild(root); document.body.appendChild(host);
  const app = Triade.createApp(root, { eventDriven: true });
  host.__app = app;
  runtimeScene.__triade = app;
  if (typeof gdjs !== 'undefined' && gdjs.registerRuntimeSceneUnloadedCallback) {
    gdjs.registerRuntimeSceneUnloadedCallback(function(scene) {
      if (scene === runtimeScene) { app.dispose(); host.remove(); delete scene.__triade; }
    });
  }
}
${process("help", "close-dialog")}`;

const events = [
  group(
    "1. Inicialização",
    "Gera um tabuleiro procedural 8×8 reproduzível pelo código na URL (?map=...). Água forma rio, lago ou costa contínua; muralhas aparecem como trechos abertos em ruínas, com dois PV e sem movimento. Grama, árvores e pedras móveis completam o terreno. Posiciona três aliados e três inimigos em casas livres conectadas. Missão: nove inimigos em cinco turnos, com reforços de 1, 2, 1 e 2. Motor e interface web estão embutidos abaixo; o editor oficial ainda precisa de validação.",
    boot,
  ),
  group(
    "2. Seleção de unidades",
    "Escolhe três ninjas entre cinco antes da missão. Trocar equipe reinicia no mesmo mapa. Consome seleção pelo mouse ou pelas teclas 1, 2 e 3, seguindo a ordem da equipe.",
    process("select", "choose-team", "toggle-team", "start-team"),
  ),
  group(
    "3. Cálculo de movimento",
    "Busca em largura: até três passos para todos os cinco ninjas, sem diagonais. Água sem custo extra; obstáculos e unidades bloqueiam.",
    `const app = runtimeScene.__triade;
if (app) {
  const b = app.battle;
  const signature = JSON.stringify([b.mapSeed,b.selectedId,b.round,b.units.map(u=>[u.id,u.x,u.y,u.moved,u.acted]),b.barrier,b.terrainRevision]);
  if (app.movementSignature !== signature) { app.movementSignature = signature; app.movement = b.reachable(); }
}`,
  ),
  group(
    "4. Movimentação",
    "Valida destino pelo BFS; um deslocamento por unidade. Desfazer movimento (Z) devolve a posição e o movimento antes da ação, se a rota original continuar livre. Ações, empurrões e fim do turno invalidam o histórico; dano recebido e outras alterações na batalha são preservados. Realça o caminho ao apontar.",
    process("move", "undo"),
  ),
  group(
    "5. Seleção de ataques",
    "Seleciona Mover, Soco ou Especial. Ao apontar ou focar uma casa válida, simula a ação numa cópia da partida e mostra vida, empurrões e colisões, sem gastar ações. Verde para movimento; laranja para alcance; vermelho para perigo.",
    process("mode"),
  ),
  group(
    "6. Soco",
    "Um dano a um inimigo, pedra, barreira ou muralha adjacente. Personagens são empurrados uma casa mesmo se o Soco zerar seus PV; ainda causam um dano no personagem ou estrutura atrás antes de desaparecer. Pedras e barreiras sobreviventes são empurradas; muralhas permanecem fixas. Colisão com estrutura ou personagem causa um dano adicional em cada parte, sem avançar ou criar cadeia. Bordas bloqueiam sem dano adicional. Muralhas têm dois PV; o segundo Soco as destrói e libera a casa. Rochas conservam vida e chão ao mudar de casa.",
    process("punch"),
  ),
  group(
    "7. Especial de Fogo",
    "Projétil em linha reta de até quatro casas. Para em árvores, pedras, muralhas, barreiras e unidades; danifica apenas o primeiro inimigo. Este grupo também consome Raio e Vento: Dash Relâmpago avança até o primeiro alvo, causa um dano, empurra e custa um PV ao usuário; Rajada de Vento mira qualquer casa e empurra as quatro vizinhas sem dano direto, incluindo aliados e estruturas móveis. Sem combinações de chakra.",
    process("fire", "lightning", "wind"),
  ),
  group(
    "8. Especial de Água",
    "Ativação na própria casa de Nami; empurra aliados, inimigos, pedras e barreiras nas quatro vizinhas sem dano inicial. Destinos são avaliados antes dos efeitos. Colisão com estrutura ou personagem causa um dano em cada, sem empurrão em cadeia. Árvores e muralhas ficam paradas; a Onda não as danifica diretamente. Muralhas podem receber dano de colisão. Rochas conservam vida e chão sob elas.",
    process("wave"),
  ),
  group(
    "9. Especial de Terra",
    "Cria uma barreira de dois PV em grama adjacente vazia. Substitui a anterior.",
    process("earth"),
  ),
  group(
    "10. Intenções inimigas",
    "Inimigos avançam até duas casas quando necessário e armam um ataque direcional a cada turno, com seta persistente, caminho ameaçado e aviso ARMADO após o avanço. Sentinelas têm ataque adjacente; Besteiros disparam até quatro casas ortogonais e preparam uma direção mesmo sem aliado alinhado. Empurrões trasladam a intenção com o inimigo, sem girar nem mirar de novo; o sobrevivente ataca nessa direção ao encerrar o turno. A borda limita os disparos. O disparo para no primeiro personagem ou barreira; árvores, pedras e muralhas bloqueiam. A prévia considera ataques, reforços e prazo antes do próximo movimento, supondo encerrar o turno sem outras jogadas.",
    `const app = runtimeScene.__triade;
if (app) runtimeScene.getVariables().get('Intencoes').setString(JSON.stringify(app.battle.enemies.map(e => ({ id:e.id, tipo:e.kind, alcance:e.kind==='ranged'?4:1, x:e.x, y:e.y, alvo:e.intent }))));`,
  ),
  group(
    "11. Resolução do turno",
    "Esperar conclui a unidade. Encerrar turno resolve ataques; nos turnos 2 a 5 chegam de um a dois reforços pelas bordas livres antes do novo planejamento. As entradas bloqueadas adiam reforços. O avanço mantém os controles bloqueados até terminar; finish-enemy libera o novo turno. Ao encerrar o turno cinco sem limpar todas as ondas, o prazo termina sem criar turno seis.",
    process("wait", "end", "resolve", "finish-enemy", "finish-action"),
  ),
  group(
    "12. Vida e dano",
    "O motor registra cada dano: clarão, tremor breve e número flutuante, inclusive na derrota da unidade. Colisões têm partículas e um tranco contra a estrutura. Variáveis da cena permitem inspecionar os totais no depurador.",
    `const app = runtimeScene.__triade;
if (app) {
  runtimeScene.getVariables().get('AliadosVivos').setNumber(app.battle.allies.length);
  runtimeScene.getVariables().get('InimigosVivos').setNumber(app.battle.enemies.length);
  runtimeScene.getVariables().get('Turno').setNumber(app.battle.round);
  runtimeScene.getVariables().get('LimiteTurnos').setNumber(app.battle.maxRounds);
  runtimeScene.getVariables().get('Derrotados').setNumber(app.battle.kills);
  runtimeScene.getVariables().get('ReforcosRestantes').setNumber(app.battle.pendingReinforcements);
  runtimeScene.getVariables().get('CodigoMapa').setString(app.battle.mapSeed);
  runtimeScene.getVariables().get('FormacaoAgua').setString(app.battle.waterKind);
}`,
  ),
  group(
    "13. Vitória e derrota",
    "Vitória ao eliminar todos os nove inimigos de todas as ondas até o turno cinco. Limpar antes de chegarem todos os reforços não encerra a missão. Derrota ao perder os três aliados ou esgotar o prazo; o motivo aparece no resultado. Permite jogar novamente.",
    `const app = runtimeScene.__triade;
if (app) runtimeScene.getVariables().get('Fase').setString(app.battle.phase);`,
  ),
  group(
    "14. Reinício da missão",
    "Reiniciar missão restaura o mesmo código, terreno, unidades, ondas e intenções. Novo mapa pede confirmação e gera outro código e terreno. Ambos limpam históricos, timers e animações sem recarregar a página; a URL registra o código reproduzível.",
    process(
      "restart",
      "confirm-restart",
      "new-map",
      "confirm-new-map",
      "open-level",
      "load-level",
    ),
  ),
];
const project = {
  firstLayout: "Batalha",
  gdVersion: { major: 5, minor: 6, build: 271, revision: 0 },
  properties: {
    name: "Tríade — Clareira do Rio",
    description:
      "Protótipo tático 2D por turnos. Uma missão; cinco elementos e uma equipe de três ninjas. Motor e interface originais em eventos JavaScript organizados em 14 grupos.",
    version: "0.1.0",
    author: "",
    packageName: "com.triade.tatica",
    projectUuid: "5c42592d-7b7c-45a0-a8c2-67396443c0fa",
    windowWidth: 1280,
    windowHeight: 960,
    maxFPS: 60,
    minFPS: 20,
    verticalSync: true,
    adaptGameResolutionAtRuntime: false,
    antialiasingMode: "none",
    antialisingEnabledOnMobile: false,
    folderProject: false,
    orientation: "landscape",
    pixelsRounding: true,
    scaleMode: "nearest",
    sizeOnStartupMode: "adaptWidth",
    templateSlug: "",
    useDeprecatedZeroAsDefaultStringVariable: false,
    useDeprecatedZeroAsDefaultZOrder: false,
    latestCompilationDirectory: "",
    platformSpecificAssets: {},
    loadingScreen: {
      backgroundColor: 1120789,
      backgroundFadeInDuration: 0,
      backgroundImageResourceName: "",
      gdevelopLogoStyle: "light",
      logoAndProgressFadeInDuration: 0,
      logoAndProgressLogoFadeInDelay: 0,
      minDuration: 0,
      progressBarColor: 13819808,
      progressBarHeight: 4,
      progressBarMaxWidth: 200,
      progressBarMinWidth: 40,
      progressBarWidthPercent: 30,
      showGDevelopSplash: false,
      showProgressBar: true,
    },
    watermark: { placement: "bottom-left", showWatermark: false },
    authorIds: [],
    authorUsernames: [],
    categories: ["strategy"],
    playableDevices: ["keyboard", "mouse"],
    extensionProperties: [],
    platforms: [{ name: "GDevelop JS platform" }],
    currentPlatform: "GDevelop JS platform",
  },
  resources: { resources: [], resourceFolders: [] },
  objects: [],
  objectsFolderStructure: { folderName: "__ROOT" },
  objectsGroups: [],
  variables: [],
  externalEvents: [],
  eventsFunctionsExtensions: [],
  externalLayouts: [],
  externalSourceFiles: [],
  layouts: [
    {
      name: "Batalha",
      mangledName: "Batalha",
      title: "Tríade — Clareira do Rio",
      r: 17,
      v: 26,
      b: 21,
      standardSortMethod: true,
      stopSoundsOnStartup: true,
      disableInputWhenNotFocused: true,
      uiSettings: {
        grid: true,
        gridType: "rectangular",
        gridWidth: 64,
        gridHeight: 64,
        gridOffsetX: 0,
        gridOffsetY: 0,
        gridColor: 10401023,
        gridAlpha: 0.4,
        snap: true,
        zoomFactor: 0.7,
        windowMask: true,
        selectedLayer: "",
        gameEditorMode: "events-editor",
      },
      objectsGroups: [],
      variables: [
        { name: "Turno", type: "number", value: "1" },
        { name: "LimiteTurnos", type: "number", value: "5" },
        { name: "Derrotados", type: "number", value: "0" },
        { name: "ReforcosRestantes", type: "number", value: "6" },
        { name: "CodigoMapa", type: "string", value: "" },
        { name: "FormacaoAgua", type: "string", value: "" },
        { name: "AliadosVivos", type: "number", value: "3" },
        { name: "InimigosVivos", type: "number", value: "3" },
        { name: "Fase", type: "string", value: "player" },
        { name: "Intencoes", type: "string", value: "[]" },
      ],
      objectsFolderStructure: { folderName: "__ROOT" },
      objects: [],
      instances: [],
      events,
      layers: [
        {
          name: "",
          visibility: true,
          isLocked: false,
          isLightingLayer: false,
          followBaseLayerCamera: false,
          renderingType: "",
          cameraType: "orthographic",
          ambientLightColorR: 200,
          ambientLightColorG: 200,
          ambientLightColorB: 200,
          cameras: [
            {
              defaultSize: true,
              defaultViewport: true,
              height: 0,
              width: 0,
              viewportBottom: 1,
              viewportLeft: 0,
              viewportRight: 1,
              viewportTop: 0,
            },
          ],
          effects: [],
        },
      ],
      behaviorsSharedData: [],
    },
  ],
};
await mkdir("gdevelop", { recursive: true });
await writeFile(
  "gdevelop/triade.json",
  JSON.stringify(project, null, 2) + "\n",
);
console.log(
  "GDevelop: gdevelop/triade.json — 1 cena, 14 grupos, runtime embutido.",
);
const standalone = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111a15"><title>Tríade — Clareira do Rio</title><style>${css.replaceAll("</style", "<\\/style")}</style></head><body><div id="app"></div><script>${bundle.replaceAll("</script", "<\\/script")}\nTriade.createApp(document.getElementById('app'));</script></body></html>\n`;
await writeFile("jogar.html", standalone);
await writeFile(
  "teste-isometrico.html",
  standalone.replace(
    "Triade.createApp(document.getElementById('app'));",
    "Triade.createApp(document.getElementById('app'), { visualTest: true });",
  ),
);
console.log(
  "Offline: jogar.html — abra diretamente no navegador, sem instalação.",
);

const editorResult = await build({
  configFile: false,
  logLevel: "error",
  build: {
    write: false,
    minify: true,
    lib: {
      entry: "src/editor.js",
      name: "TriadeEditor",
      formats: ["iife"],
      fileName: "editor",
    },
    target: "es2020",
  },
});
const editorOutput = (
  Array.isArray(editorResult) ? editorResult[0] : editorResult
).output;
const editorBundle = editorOutput.find((o) => o.type === "chunk").code;
const editorCss = await readFile("src/editor.css", "utf8");
const escapeScript = (value) =>
  value.replaceAll("<", String.fromCharCode(92) + "u003c");
const editorStandalone = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ateliê Tríade — Editor de mapas</title><style>${css}${editorCss}</style></head><body><div id="editor-root"></div><script>${editorBundle.replaceAll("</script", "<" + String.fromCharCode(92) + "/script")}
TriadeEditor.createEditor(document.getElementById('editor-root'), { playerHtml: ${escapeScript(JSON.stringify(standalone))} });</script></body></html>`;
await writeFile("editor-offline.html", editorStandalone);
console.log(
  "Editor offline: editor-offline.html — catálogo completo e teste de fases embutido.",
);
