# Fases do editor

O arquivo JSON usa `format: "triade-level"`, `version: 1` e `size: 8`. `name` tem até 80 caracteres e `description`, até 1.000.

As camadas `ground`, `objects`, `effects` e `directions` têm oito linhas de oito células, indexadas como `[y][x]`. Chão sempre contém um identificador de tile; objetos e efeitos usam `null` quando vazios. Direções aceitam `north`, `east`, `south` e `west`.

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

Escolha exatamente três aliados distintos entre `fire`, `water`, `earth`, `lightning` e `wind`. Cada aliado tem `id` igual a `element`. Todos começam com 3 PV e caminhada de 3 casas. Inimigos usam `enemy-N`, com N de 1 a 9999. Não pode haver IDs duplicados nem duas unidades na mesma casa. Vida e habilidades vêm das regras do jogo, sem parâmetros arbitrários nos arquivos de fase.

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

Rascunhos incompletos podem ser salvos e exportados. Para jogar, são necessários exatamente três aliados de elementos distintos sobre casas transitáveis e pelo menos um inimigo inicial ou onda. Fases inválidas não substituem a partida em andamento. Objetos ocupam uma casa por segmento; o pincel de tronco pinta dois segmentos, com vida independente.

O teste clona os dados da fase. Reiniciar restaura o mesmo mapa e posições; Novo mapa sai da fase personalizada e retorna à missão procedural. A preparação inicial arma os inimigos sem mover suas posições colocadas no editor. Nos turnos seguintes, eles seguem a movimentação e os ataques direcionais normais.

A exportação HTML incorpora o JSON e o runtime em um único arquivo. Os nomes e descrições são texto e não código executável. Efeitos em planejamento continuam identificados no arquivo jogável; salvá-los no editor não implementa suas futuras mecânicas.
