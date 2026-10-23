# Fases do editor

O arquivo JSON usa `format: "triade-level"`, `version: 1` e `size: 8`. `name` tem até 80 caracteres e `description`, até 1.000.

As camadas `ground`, `objects`, `effects`, `deployment` e `directions` têm oito linhas de oito células, indexadas como `[y][x]`. Chão sempre contém um identificador de tile; objetos e efeitos usam `null` quando vazios. `deployment` é opcional em arquivos v1 antigos: usa `"deployment"` nas casas marcadas e `null` nas demais; quando ausente, é normalizada como uma camada vazia. Direções aceitam `north`, `east`, `south` e `west`.

O catálogo e as regras disponíveis ficam em `src/levels.js`. Um arquivo não pode colocar um identificador na camada errada. Por exemplo, `mud` pertence a `ground`, `bridge` a `objects` e `steam` a `effects`. `abyss` aparece na categoria de efeitos da paleta, mas é salvo como chão, porque substitui a superfície transitável.

`units` é uma lista de até 32 personagens com coordenadas inteiras de 0 a 7:

```json
[
  { "id": "fire", "team": "ally", "element": "fire", "x": 1, "y": 5 },
  { "id": "water", "team": "ally", "element": "water", "x": 2, "y": 6 },
  { "id": "earth", "team": "ally", "element": "earth", "x": 1, "y": 7 },
  { "id": "enemy-1", "team": "enemy", "kind": "melee", "x": 6, "y": 2 },
  { "id": "enemy-2", "team": "enemy", "kind": "ranged", "x": 6, "y": 4 }
]
```

Sem Área inicial, coloque exatamente três aliados distintos entre `fire`, `water`, `earth`, `lightning` e `wind`. Com Área inicial, os aliados em `units` são opcionais: a lista pode conter apenas inimigos, ou ficar vazia se houver ondas. O trio de três ninjas é criado em tempo de execução após a escolha do jogador. Um ou dois aliados colocados no editor servem de sugestão para a seleção; três mantêm o trio sugerido, que pode ser alterado em Trocar equipe. Cada aliado tem `id` igual a `element`. Todos começam com 3 PV e caminhada de 3 casas. Inimigos aceitam `kind: "melee"` (Sentinela), `"ranged"` (Besteiro) ou `"lobber"` (Artilheiro). Os três tipos também são aceitos em `rules.waves[].kinds`. O Artilheiro tem 1 PV, caminhada de 2 casas e tiro por cima sem limite de distância, apenas na mesma linha ou coluna. Só o destino recebe 1 PV de dano; personagens e obstáculos no caminho são ignorados. Empurrões deslocam o alvo junto com o atacante, mantendo direção e distância; um alvo fora do mapa erra completamente. Inimigos usam `enemy-N`, com N de 1 a 9999. Não pode haver IDs duplicados nem duas unidades na mesma casa. Vida e habilidades vêm das regras do jogo, sem parâmetros arbitrários nos arquivos de fase.

As regras da missão são:

```json
{
  "maxRounds": 7,
  "waves": [
    { "round": 3, "kinds": ["melee"] },
    { "round": 5, "kinds": ["melee", "ranged"] }
  ]
}
```

`maxRounds` vai de 1 a 20. Cada onda usa um turno único entre 2 e o prazo e contém de 1 a 8 inimigos. Uma lista vazia desativa os reforços. Marcadores `reinforcement` escolhem as entradas; sem marcadores, o jogo usa as bordas livres. Entradas ocupadas adiam o reforço. O total do objetivo soma os inimigos iniciais e os das ondas.

Rascunhos incompletos podem ser salvos e exportados. Para jogar, são necessários pelo menos um inimigo inicial ou onda e uma Área inicial com três destinos válidos, ou três aliados de elementos distintos sobre casas transitáveis quando a fase não tiver essa área. Fases inválidas não substituem a partida em andamento. Objetos ocupam uma casa por segmento; o pincel de tronco pinta dois segmentos, com vida independente.

## Área inicial

O tile **Área inicial** pertence à camada `deployment`, independente das demais. Ele não substitui o chão nem outro efeito na mesma casa. Para habilitar o posicionamento, marque ao menos três casas transitáveis sem inimigos. Marcações sobre obstáculos, água profunda sem ponte, abismo ou inimigos são ignoradas como destinos e geram aviso; se restarem menos de três destinos, a fase não pode ser iniciada.

Os ninjas são opcionais em `units`. Se houver menos de três sugestões, o jogo abre a seleção de equipe antes do posicionamento, tanto no teste do editor quanto na importação JSON e no HTML exportado. As posições sugeridas pelo autor são usadas quando possível; os demais ninjas são acomodados nas casas válidas da área. Escolher ou trocar o trio não insere aliados no arquivo do autor nem altera seus dados. Antes do combate, o jogador pode mudar a formação livremente e trocar aliados de lugar; ainda não há ataques preparados. **Confirmar posicionamento** inicia o turno 1 sem gastar movimento ou ação e prepara os inimigos. Em fases autorais, os inimigos não avançam nessa preparação inicial.

O posicionamento é preservado na biblioteca, importação/exportação JSON e HTML independente. A borracha de Área inicial só limpa essa camada. Arquivos antigos ou sem casas marcadas mantêm o início imediato nas posições fixas. Reiniciar mantém o trio escolhido e volta à etapa de posicionamento, restaurando as posições sugeridas ou a distribuição inicial na área.

O teste clona os dados da fase. Reiniciar restaura o mesmo mapa e posições; Novo mapa sai da fase personalizada e retorna à missão procedural. A preparação inicial arma os inimigos sem mover suas posições colocadas no editor. Nos turnos seguintes, eles seguem a movimentação e os ataques direcionais normais.

A exportação HTML incorpora o JSON e o runtime em um único arquivo. Os nomes e descrições são texto e não código executável. Efeitos em planejamento continuam identificados no arquivo jogável; salvá-los no editor não implementa suas futuras mecânicas.
