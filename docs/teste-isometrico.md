# Ensaio visual isométrico reduzido

Implementado em 18/10/2026. Escopo: um cenário fixo, três ninjas iniciais e um inimigo. A interface usa o mesmo componente do jogo completo.

A especificação visual anexada descreve projeção superior ortográfica. O pedido do usuário determina isometria para este ensaio. Foram aproveitados paleta, materiais, iluminação superior esquerda, uniformes comuns, silhuetas elementais e prioridade dos indicadores táticos. As dimensões da projeção e a ordenação por profundidade foram adaptadas para a câmera inclinada.

- Página de desenvolvimento: `isometrico.html`; alternativa: `/?visual=isometrico`.
- Arquivo independente offline: `teste-isometrico.html`, gerado por `npm run build` ou `npm run gdevelop`.
- Cenário: `src/isometric-scene.js`; renderer: `src/isometric-art.js`.
- Superfície de desenho: 512×384; losangos de 56×28; coordenadas lógicas do combate continuam de 0 a 7.
- Paleta limitada, contornos rasterizados em degraus e nenhuma imagem ou fonte remota adicional.
- Grama com textura discreta, rio contínuo, árvores e pedras com volume. Pedra e árvore danificadas têm indicação de vida.
- Uniforme azul-acinzentado comum. Fogo tem pontas e acentos quentes; Água tem faixa lateral e acentos ciano; Terra tem ombros e braceletes largos. O inimigo conserva roupa preta e olhos vermelhos.
- Sprites e objetos são ordenados pela posição projetada. Personagens altos podem cobrir células ao fundo; mouse seleciona os corpos e teclado permite acessar as células encobertas.
- Animação simples de caminhada, água, ataques, dano e empurrões. A preferência de movimento reduzido é respeitada. Animações não aplicam dano ou modificam o mapa lógico.
- Painéis, retratos, textos de ajuda e disposição geral reutilizam a interface existente. Os indicadores do tabuleiro foram convertidos para isometria.
- O botão de novo mapa, a troca de equipe e a importação de fase estão desativados apenas neste teste, mantendo o cenário fixo.

A arte é provisória, original e desenhada por código. O ensaio não inclui os 276 frames de unidade, as quatro direções completas ou todos os efeitos do documento. O protótipo principal e o editor continuam disponíveis com a apresentação anterior.
