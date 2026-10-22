# Revisão do roadmap — Into The Sinobi

Preparada em 20/10/2026 com base no protótipo e nas decisões desta conversa. **O board do Trello ainda não foi consultado nem alterado**: a conexão não está disponível nesta sessão. Este documento prepara uma revisão concreta para aplicar ao quadro existente depois que o acesso estiver disponível.

A estrutura concentra o trabalho em decisões, experimentos e evidências. Missões por rank, 4–5 levels por operação, terrenos e combinações fazem parte da direção de projeto; quantidade total de mapas, regras detalhadas e recorte da demo precisam ser delimitados. A história dos selos permanece um argumento provisório.

As propostas anteriores de seis fases e 24 semanas não devem funcionar como compromissos de produção sem revisão. O ensaio isométrico é separado do jogo completo e não representa uma campanha ou uma adoção definitiva da câmera.

## Organização proposta do board

| Lista | Uso | Cartões preparados |
| --- | --- | --- |
| 00 · Base existente e referências | Referências factuais. | 4 |
| 01 · Decidir durante a prototipação | Perguntas que precisam ser respondidas. | 12 |
| 02 · Experimentos a preparar | Tarefas pequenas para testar as decisões. | 9 |
| 03 · Em teste | Experimentos iniciados, com hipótese e sessão de teste definida. | 0 |
| 04 · Decisões validadas | Conclusões registradas com evidências e consequências para o escopo. | 0 |
| 05 · Depois da validação | Expansão condicionada ao recorte validado. | 3 |
| 06 · Artes finais e entrega | Preparação e produção final após fechar a experiência. | 2 |

## Critérios de edição do quadro existente

- Ler listas, cartões, descrições e checklists existentes antes de alterar o board.
- Relacionar tarefas existentes aos temas desta revisão; editar e reaproveitar cartões antes de criar duplicatas.
- Preservar comentários, anexos, membros, links e histórico; não excluir cartões nem listas.
- Identificar propostas antigas que precisam ser revistas e movê-las apenas após ler seu contexto.
- Não atribuir pessoas nem datas arbitrárias; as estimativas dependem do recorte de protótipo.
- Em teste e Decisões validadas são estados de trabalho, inicialmente sem novos cartões nesta proposta.
- Marcar implementação existente como referência e manter validação de design separada de testes automatizados.
- Arte final permanece após validação de regras, câmera, narrativa e conteúdo.

## Próximo ciclo recomendado

Começar por objetivo geral (DEC-01), delimitação das mecânicas (DEC-03), vitória/derrota (DEC-04), estrutura das operações (DEC-05), tipos de missão (DEC-07), quantidade de mapas (DEC-08) e desafios por mapa (DEC-09). A história de marcação (DEC-02) acompanha essas decisões.

Depois, experimentar defesa de um alvo, um segundo tipo de missão e uma combinação. Construir a primeira operação de 4–5 levels apenas após observar esses cenários. Usar a decisão de câmera para orientar a apresentação provisória e deixar produção de arte final na última etapa.

P0 indica prioridade para destravar a prototipação; P1 depende das primeiras definições; P2 é produção posterior. Não são datas ou promessas de execução simultânea.

## 00 · Base existente e referências

### BASE-01 — Registrar o combate que já funciona

**Área:** Referência · **Prioridade:** Referência · **Estado:** Implementado no protótipo; equilíbrio em avaliação

**Pergunta:** Qual é a base real disponível para testar novas ideias?

**Entrega:** Inventário curto das regras implementadas, com links para fontes e versão de teste.

**Critério de conclusão:** As tarefas futuras reaproveitam a base existente e não tratam ideias como funcionalidades prontas.

**Dependências:** Nenhuma.

Checklist:

- [ ] Registrar tabuleiro 8×8, três ninjas por equipe escolhidos entre cinco, caminhada de três casas e uma ação por turno.
- [ ] Registrar Soco, cinco especiais, empurrões, colisões, dano em aliados/estruturas e impacto de ataques letais.
- [ ] Registrar Sentinela e Besteiro, ataques anunciados e direção preservada após empurrão.
- [ ] Registrar prévias e desfazer caminhada antes da ação.
- [ ] Distinguir a missão atual de eliminação em cinco turnos de futuros objetivos de campanha.

### BASE-02 — Registrar editor e limitações do catálogo de terrenos

**Área:** Referência · **Prioridade:** Referência · **Estado:** Editor implementado; catálogo com efeitos parciais

**Pergunta:** O que o editor já permite criar e quais tiles ainda são marcadores?

**Entrega:** Lista de ferramentas existentes e comportamentos efetivamente ativos.

**Critério de conclusão:** Cada tile está identificado como regra ativa, comportamento parcial ou proposta.

**Dependências:** Nenhuma.

Checklist:

- [ ] Registrar 28 tiles, camadas, pincel, biblioteca local, histórico e importação/exportação JSON.
- [ ] Registrar teste de fases e exportação HTML offline.
- [ ] Distinguir lama com custo 2 e vapor que bloqueia tiro das combinações de chakra que ainda não existem.
- [ ] Listar efeitos pendentes, incluindo correnteza, brasa e selo elétrico.
- [ ] Preservar compatibilidade das fases existentes ao propor novos campos.

### BASE-03 — Registrar o ensaio isométrico separado

**Área:** Referência · **Prioridade:** Referência · **Estado:** Ensaio implementado; decisão de câmera pendente

**Pergunta:** O teste visual já resolve a câmera para todo o jogo?

**Entrega:** Referência do ensaio fixo com trio inicial e um inimigo.

**Critério de conclusão:** O board distingue ensaio técnico, revisão visual e adoção definitiva da perspectiva.

**Dependências:** Nenhuma.

Checklist:

- [ ] Registrar teste-isometrico.html: mapa fixo, três ninjas, um inimigo e nenhuma onda adicional.
- [ ] Registrar que o jogo completo e o editor ainda usam a vista superior.
- [ ] Registrar seleção, prévias e ordenação de sprites já exercitadas no ensaio.
- [ ] Avaliar células encobertas por sprites e escala antes de decidir a câmera final.
- [ ] Manter arte provisória e evitar assumir produção completa de spritesheets.

### BASE-04 — Separar propostas narrativas, de missão e de combinação

**Área:** Referência · **Prioridade:** Referência · **Estado:** Direções e propostas; funcionalidades futuras

**Pergunta:** Quais ideias desta conversa ainda precisam de decisão?

**Entrega:** Registro de intenções e hipóteses, com histórico das mudanças de direção.

**Critério de conclusão:** Nenhum cartão afirma que campanha, ranks, combinações ou resgate já estão implementados.

**Dependências:** Nenhuma.

Checklist:

- [ ] Registrar história Os Selos do Rio e Ordem do Véu como propostas de marcação.
- [ ] Registrar dez combinações desejadas; ativação, custos e equilíbrio ainda precisam de experimentos.
- [ ] Registrar missão como operação de 4–5 levels, classificada por rank e tipo, com terreno predominante.
- [ ] Registrar resgate, infiltração e defesa como tipos em discussão, sem pressupor implementação de todos.
- [ ] Tratar seis fases e 24 semanas do documento anterior como estimativas a revisar.

## 01 · Decidir durante a prototipação

### DEC-01 — Definir o objetivo geral e a experiência desejada

**Área:** Design · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** Qual experiência o jogo deve entregar e o que fará uma partida valer a pena?

**Entrega:** Uma página com proposta central, três pilares e limites do projeto.

**Critério de conclusão:** É possível explicar o jogo em duas frases e usar os pilares para aceitar ou recusar novas ideias.

**Dependências:** Nenhuma.

Checklist:

- [ ] Definir público, PC como alvo inicial e duração desejada de level, missão e sessão.
- [ ] Escolher o peso de quebra-cabeça tático, combate, narrativa e rejogabilidade.
- [ ] Definir papel de empurrões, informação antecipada e cooperação elemental.
- [ ] Definir como o jogador percebe progresso e o que representa concluir o jogo.
- [ ] Registrar explicitamente recursos fora do recorte inicial.

### DEC-02 — Definir objetivo geral da história e arco provisório

**Área:** Narrativa · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** Quem somos, o que queremos impedir ou alcançar e por que cada missão existe?

**Entrega:** Sinopse de marcação, conflito central, motivação do esquadrão e arco inicial.

**Critério de conclusão:** O jogador consegue explicar o objetivo narrativo e a ligação entre duas operações.

**Dependências:** DEC-01

Checklist:

- [ ] Revisar a proposta dos selos, facção inimiga e consequências para as aldeias.
- [ ] Definir situação inicial, conflito, mudança esperada e desfecho do recorte.
- [ ] Definir relação e papel dos cinco ninjas, permitindo formar diferentes trios.
- [ ] Escolher formato mínimo: briefing, objetivo consultável e texto de resultado.
- [ ] Distinguir nomes/falas provisórios de decisões consolidadas.

### DEC-03 — Delimitar as mecânicas essenciais do protótipo

**Área:** Mecânicas · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** Quais mecânicas são indispensáveis para provar que o jogo funciona?

**Entrega:** Matriz manter / experimentar agora / avaliar depois / fora do recorte.

**Critério de conclusão:** Existe um conjunto mínimo de regras para testar, sem exigir completar todo o catálogo de ideias.

**Dependências:** DEC-01

Checklist:

- [ ] Reaproveitar movimentação, orçamento de ações, Soco, empurrões e prévias existentes.
- [ ] Definir informação pública, dano em aliados, colisões, bordas e ordem de resolução.
- [ ] Definir papel dos especiais individuais e das combinações.
- [ ] Escolher quais objetivos e estados serão realmente necessários ao primeiro experimento.
- [ ] Separar delimitação do protótipo do desejo de desenvolver as dez combinações no futuro.

### DEC-04 — Definir vitória, derrota e significado das perdas

**Área:** Design · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** Vencer é eliminar todos, proteger algo, retirar alguém ou cumprir outra condição?

**Entrega:** Contrato de objetivo principal, objetivos opcionais e condições de derrota por tipo de missão.

**Critério de conclusão:** Antes de jogar, a pessoa sabe o que precisa fazer, o que pode sacrificar e o que encerra a partida.

**Dependências:** DEC-01, DEC-03

Checklist:

- [ ] Reavaliar se cinco turnos é regra geral ou parâmetro de cada level.
- [ ] Distinguir derrota do esquadrão, perda do alvo e prazo esgotado.
- [ ] Prototipar objetivo de proteção como alternativa à eliminação.
- [ ] Decidir se vitórias parciais e bônus têm lugar no recorte.
- [ ] Avaliar integridade regional como hipótese, evitando criar uma economia de campanha prematuramente.

### DEC-05 — Definir a estrutura missão → levels → turnos

**Área:** Missões e mapas · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** Como uma operação de 4–5 levels começa, evolui e termina?

**Entrega:** Modelo de missão com briefing, seleção de trio, sequência de levels, resultado e repetição.

**Critério de conclusão:** Missão, level e mapa têm significados distintos e o fluxo entre eles está documentado.

**Dependências:** DEC-02, DEC-04

Checklist:

- [ ] Definir aproximação, obstáculo, objetivo central e consequência/retirada como estrutura de teste.
- [ ] Decidir quando usar quatro ou cinco levels sem atrelar quantidade apenas ao rank.
- [ ] Decidir quando o trio pode ser trocado e como uma missão é retomada.
- [ ] Definir quais estados atravessam levels: PV, ninjas caídos, efeitos e objetivos.
- [ ] Definir comportamento de derrota, repetição de level e repetição de missão.

### DEC-06 — Definir ranks D, C, B, A e S

**Área:** Missões e mapas · **Prioridade:** P1 · **Estado:** Proposta para revisão

**Pergunta:** O que diferencia o risco e a complexidade de cada rank?

**Entrega:** Rubrica de classificação com exemplos de uma mesma tarefa em ranks diferentes.

**Critério de conclusão:** Cada rank é explicado por desafios e consequências, com requisitos visíveis para o jogador.

**Dependências:** DEC-04, DEC-05

Checklist:

- [ ] Definir critérios: pressão de tempo, objetivos simultâneos, oposição e exigência de coordenação.
- [ ] Distinguir rank narrativo, dificuldade escolhida e complexidade da equipe.
- [ ] Evitar depender apenas de mais PV ou mais dano.
- [ ] Classificar exemplos de resgate, infiltração e defesa.
- [ ] Escolher quais ranks precisam aparecer no primeiro recorte.

### DEC-07 — Escolher os tipos de missão para experimentar primeiro

**Área:** Missões e mapas · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** Quais tarefas testarão melhor a proposta sem exigir muitos sistemas novos?

**Entrega:** Catálogo inicial com objetivo, ações necessárias e critérios de sucesso por tipo.

**Critério de conclusão:** Há uma seleção pequena de experimentos prioritários e uma lista separada de tipos futuros.

**Dependências:** DEC-02, DEC-03, DEC-04

Checklist:

- [ ] Comparar defesa, resgate e infiltração com a eliminação já existente.
- [ ] Listar necessidade de alvo protegido, personagem de resgate, extração ou alerta.
- [ ] Escolher um tipo principal e um segundo tipo para comparação em cenários curtos.
- [ ] Manter escolta, captura, sabotagem, evacuação e demais tarefas no backlog até seleção explícita.
- [ ] Definir como cada tipo contribui para a história.

### DEC-08 — Definir quantidade de mapas e orçamento de conteúdo

**Área:** Missões e mapas · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** Quantos cenários precisamos para o próximo teste, a primeira missão e uma futura demo?

**Entrega:** Tabela de quantidades separando cenários de teste, levels, layouts únicos e variações.

**Critério de conclusão:** O recorte tem quantidade explícita e justificada; nenhuma hipótese antiga é tratada como compromisso.

**Dependências:** DEC-05, DEC-07

Checklist:

- [ ] Contar o cenário procedural atual e o ensaio fixo separadamente de uma campanha pronta.
- [ ] Propor poucos cenários isolados para testar hipóteses antes de uma operação completa.
- [ ] Escolher o tamanho da primeira missão de 4–5 levels.
- [ ] Calcular operações × levels por operação e distinguir reutilização de geometria de conteúdo novo.
- [ ] Decidir tamanho de demo/campanha apenas depois de medir o trabalho do primeiro recorte.

### DEC-09 — Definir desafios e aprendizado de cada mapa

**Área:** Missões e mapas · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** Que decisão tática específica cada level apresenta?

**Entrega:** Ficha de level com objetivo, problema central, terreno, inimigos, restrições e soluções de referência.

**Critério de conclusão:** Cada mapa tem uma razão para existir e oferece oportunidades de resposta compreensíveis.

**Dependências:** DEC-04, DEC-07, DEC-08

Checklist:

- [ ] Definir um problema central e uma complicação opcional por cenário de teste.
- [ ] Relacionar desafio a empurrão, colisão, linha de tiro, proteção, custo de movimento ou extração.
- [ ] Registrar entrada/saída, objetivos, posições iniciais, ondas e prazo.
- [ ] Procurar mais de uma solução útil quando possível e distinguir perdas parciais de bloqueio inevitável.
- [ ] Testar os mapas com formações diferentes e registrar restrições de equipe quando forem necessárias.

### DEC-10 — Definir terrenos e a matriz de rejogabilidade

**Área:** Missões e mapas · **Prioridade:** P1 · **Estado:** Proposta para revisão

**Pergunta:** Como mudar o terreno altera uma missão de verdade?

**Entrega:** Matriz tipo de missão × terreno × rank com uma diferença tática por combinação escolhida.

**Critério de conclusão:** As variações mudam decisões, rotas ou prioridades e não apenas as cores do cenário.

**Dependências:** DEC-07, DEC-09

Checklist:

- [ ] Usar floresta ribeirinha como base disponível; escolher um segundo terreno apenas para comparação.
- [ ] Definir bioma predominante por operação e subáreas dos seus levels.
- [ ] Separar bioma de regras de tile: rio, lama, pedra, árvore e muralha.
- [ ] Comparar dois tipos no mesmo terreno e um mesmo tipo em terrenos diferentes.
- [ ] Delimitar autoria manual, variações controladas e papel da geração procedural.

### DEC-11 — Definir ativação, custo e limites das combinações de chakra

**Área:** Mecânicas · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** Como uma combinação cria uma boa decisão dentro de um turno com três ninjas?

**Entrega:** Regras comparadas de ativação e escolha de um ou dois pares para o primeiro experimento.

**Critério de conclusão:** O custo é legível, a combinação tem utilidade e seu resultado cabe numa prévia confiável.

**Dependências:** DEC-03, DEC-04

Checklist:

- [ ] Comparar ação conjunta de dois ninjas com preparação de casa/objeto em duas ações.
- [ ] Definir participantes, alcance, origem, custo, duração, ordem dos gatilhos e dano em aliados.
- [ ] Selecionar pares simples, como Lama e Vapor, para testar controle de terreno e cobertura.
- [ ] Comparar o benefício com as duas ações individuais que a combinação substitui.
- [ ] Manter os dez pares desejados no horizonte; delimitar lote e quantidade da primeira entrega após os testes.

### DEC-12 — Decidir perspectiva e requisitos visuais do protótipo

**Área:** Arte e UX · **Prioridade:** P1 · **Estado:** Proposta para revisão

**Pergunta:** Isometria melhora a leitura e a interação o suficiente para ser adotada?

**Entrega:** Comparação documentada entre vista superior e ensaio isométrico.

**Critério de conclusão:** Há decisão sobre câmera e requisitos de interação antes de produzir arte final.

**Dependências:** BASE-03, DEC-03

Checklist:

- [ ] Comparar legibilidade de unidades, terreno, seleções e ameaças nas duas vistas.
- [ ] Avaliar células encobertas, clique em sprites, redimensionamento e teclado.
- [ ] Definir escala, âncoras e ordem de desenho caso a isometria avance.
- [ ] Manter sprites e efeitos provisórios durante a avaliação.
- [ ] Estimar expansão para jogo completo e editor somente depois da decisão.

## 02 · Experimentos a preparar

### EXP-01 — Distribuir uma versão identificada e coletar problemas

**Área:** Técnico · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** As pessoas conseguem abrir e jogar a mesma versão?

**Entrega:** Canal confiável de teste com versão, instruções curtas e registro de problemas.

**Critério de conclusão:** Três pessoas abrem a versão e conseguem devolver um problema reproduzível.

**Dependências:** BASE-01, BASE-03

Checklist:

- [ ] Conferir o HTML offline e o fluxo de envio que já causou dificuldades de download.
- [ ] Definir hospedagem para testes e conferir o link com outra pessoa quando disponível.
- [ ] Identificar versão, cenário/mapa, equipe e passos ao registrar um problema.
- [ ] Conservar o ensaio isométrico separado do protótipo completo.
- [ ] Definir como guardar observações sem exigir contas ou sistemas adicionais.

### EXP-02 — Comparar papéis dos cinco ninjas em desafios controlados

**Área:** Mecânicas · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** Cada ninja cria uma vantagem e um custo reconhecíveis?

**Entrega:** Relato de cenários comparáveis com as dez formações e ajustes propostos.

**Critério de conclusão:** Água e Vento têm papéis próprios; a barreira de Terra demonstra utilidade; o custo do dash é compreendido.

**Dependências:** DEC-03, DEC-09

Checklist:

- [ ] Reaproveitar os cinco ninjas existentes e suas regras atuais.
- [ ] Comparar Água e Vento em deslocamento e proteção.
- [ ] Avaliar barreira de Terra em corredores e bloqueio de tiros.
- [ ] Avaliar quando perder um PV no dash de Rai vale a pena.
- [ ] Registrar escolhas, alternativas e casos de poder dominante antes de alterar números.

### EXP-03 — Prototipar defesa de um alvo fixo

**Área:** Mecânicas · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** Proteger algo torna empurrões e posicionamento mais interessantes?

**Entrega:** Um cenário curto com objetivo protegido, intenção inimiga legível e resultado próprio.

**Critério de conclusão:** O jogador entende o que protege e consegue comparar eliminar, deslocar, bloquear ou aceitar dano.

**Dependências:** DEC-04, DEC-07, DEC-09

Checklist:

- [ ] Usar o mapa/editor existentes e arte provisória.
- [ ] Fazer inimigos anunciarem ataques contra o objetivo e resolver o dano de verdade.
- [ ] Definir a vitória por proteção e a derrota pela perda do alvo.
- [ ] Mostrar dano colateral e efeito de colisões nas prévias.
- [ ] Comparar com a missão atual de eliminação e registrar o que mudou nas decisões.

### EXP-04 — Prototipar um segundo tipo: resgate ou infiltração

**Área:** Missões e mapas · **Prioridade:** P1 · **Estado:** Proposta para revisão

**Pergunta:** A mesma base tática sustenta outra tarefa sem excesso de regras?

**Entrega:** Um cenário isolado do tipo escolhido, com ações e vitória verificáveis.

**Critério de conclusão:** A tarefa gera decisões diferentes da defesa e é compreendida durante o jogo.

**Dependências:** DEC-07, DEC-09, DEC-10

Checklist:

- [ ] Escolher somente um segundo tipo para esse teste.
- [ ] Se resgate: definir libertação, comportamento do resgatado e ponto de extração.
- [ ] Se infiltração: definir detecção, alerta e retirada com regras visíveis.
- [ ] Evitar introduzir todos os tipos de missão ao mesmo tempo.
- [ ] Avaliar como a tarefa muda em uma variação de terreno.

### EXP-05 — Testar uma combinação e sua prévia completa

**Área:** Mecânicas · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** O jogador entende e utiliza uma combinação melhor que duas ações individuais?

**Entrega:** Experimento com um par elemental e comparação de ativação/custo.

**Critério de conclusão:** Participantes, ações consumidas, área, duração e riscos ficam claros antes da confirmação.

**Dependências:** DEC-11, DEC-09

Checklist:

- [ ] Reaproveitar lama/vapor já suportados pelo terreno quando o par escolhido permitir.
- [ ] Implementar um par inicial e medir o esforço antes de ampliar o lote.
- [ ] Cobrir interação com aliados, inimigos, estruturas móveis e terreno.
- [ ] Comparar previsão e execução e definir a ordem dos efeitos.
- [ ] Registrar manter, ajustar ou descartar a regra de ativação testada.

### EXP-06 — Prototipar a ligação narrativa entre dois levels

**Área:** Narrativa · **Prioridade:** P1 · **Estado:** Proposta para revisão

**Pergunta:** O jogador entende por que concluiu uma tarefa e deve seguir para outra?

**Entrega:** Dois cenários ligados por briefing e consequência em texto provisório.

**Critério de conclusão:** A pessoa explica o objetivo narrativo, a consequência da vitória e o próximo passo sem ajuda verbal.

**Dependências:** DEC-02, DEC-05, DEC-07

Checklist:

- [ ] Usar texto curto e personagens provisórios, sem produção de cenas finais.
- [ ] Manter o objetivo consultável e permitir pular textos.
- [ ] Garantir que a narração funcione com trios diferentes.
- [ ] Não avançar a história na derrota nem duplicar acontecimentos ao repetir.
- [ ] Revisar o argumento dos selos com base no que as missões permitem fazer.

### EXP-07 — Construir a primeira operação de 4–5 levels após validar os cenários

**Área:** Missões e mapas · **Prioridade:** P1 · **Estado:** Proposta para revisão

**Pergunta:** Uma sequência curta mantém interesse, clareza e variedade?

**Entrega:** Uma missão completa no rank, tipo e terreno escolhidos, ainda com arte provisória.

**Critério de conclusão:** Cada level tem um desafio próprio e a operação possui início, mudança de situação e desfecho.

**Dependências:** DEC-06, DEC-08, DEC-09, EXP-03, EXP-04, EXP-05, EXP-06

Checklist:

- [ ] Reaproveitar apenas os experimentos com resultados favoráveis.
- [ ] Definir quatro ou cinco fichas de level antes de construir os mapas.
- [ ] Usar o mesmo terreno predominante com subáreas e situações diferentes.
- [ ] Testar recuperação, troca de trio, repetição e duração total da operação.
- [ ] Registrar custo de autoria para revisar a quantidade de conteúdo da demo.

### EXP-08 — Validar rejogabilidade por tipo, terreno e equipe

**Área:** Design · **Prioridade:** P1 · **Estado:** Proposta para revisão

**Pergunta:** Repetir um tipo de missão em outro terreno realmente muda a estratégia?

**Entrega:** Comparação pequena entre cenários com objetivo ou terreno variado.

**Critério de conclusão:** As pessoas identificam decisões diferentes e vontade de experimentar outra composição.

**Dependências:** DEC-10, EXP-03, EXP-04, EXP-05

Checklist:

- [ ] Comparar o mesmo tipo em dois terrenos e dois tipos no mesmo terreno.
- [ ] Aproveitar layouts existentes antes de criar biomas completos.
- [ ] Registrar rotas, importância das estruturas, linhas de tiro e pares de chakra usados.
- [ ] Distinguir nova estratégia de simples aumento de inimigos.
- [ ] Revisar a matriz de conteúdo com base no resultado.

### EXP-09 — Conduzir testes observados e registrar decisões

**Área:** Pesquisa e UX · **Prioridade:** P0 · **Estado:** Proposta para revisão

**Pergunta:** O protótipo comunica suas regras e gera escolhas interessantes?

**Entrega:** Duas rodadas curtas com jogadores novos e registro de evidências.

**Critério de conclusão:** Problemas de compreensão são distinguidos de bugs; cada hipótese recebe decisão e próximo passo.

**Dependências:** EXP-01

Checklist:

- [ ] Pedir previsão do resultado antes de confirmar ações e combinações.
- [ ] Observar entendimento do objetivo, rank, perdas e motivo narrativo.
- [ ] Medir duração de levels/operação e pontos de frustração.
- [ ] Registrar situações sem opções úteis e problemas de prévia.
- [ ] Mover para decisões validadas apenas conclusões sustentadas pelos testes.

## 03 · Em teste

Sem cartões novos colocados automaticamente nesta lista. O movimento dependerá do trabalho e das evidências.

## 04 · Decisões validadas

Sem cartões novos colocados automaticamente nesta lista. O movimento dependerá do trabalho e das evidências.

## 05 · Depois da validação

### FUT-01 — Fechar o recorte da demo e reestimar o trabalho

**Área:** Planejamento · **Prioridade:** P1 · **Estado:** Proposta para revisão

**Pergunta:** Qual é a menor entrega coesa apoiada no que aprendemos?

**Entrega:** Escopo versionado com missões, levels, layouts, terrenos, ranks, tipos e combinações.

**Critério de conclusão:** O escopo tem limites, dependências, exclusões e estimativa baseada no primeiro recorte.

**Dependências:** EXP-07, EXP-08, EXP-09

Checklist:

- [ ] Revisar as propostas antigas de seis fases e 24 semanas.
- [ ] Escolher quantidade de operações e de mapas únicos/variantes.
- [ ] Escolher quais das dez combinações entram em cada entrega.
- [ ] Definir recursos de campanha, editor e distribuição necessários.
- [ ] Reservar tempo de testes e manter artes finais como última etapa.

### FUT-02 — Expandir campanha, missões e terrenos selecionados

**Área:** Produção futura · **Prioridade:** P2 · **Estado:** Proposta para revisão

**Pergunta:** Quais conteúdos e sistemas foram justificados pelos protótipos?

**Entrega:** Lotes de conteúdo e recursos selecionados no recorte validado.

**Critério de conclusão:** Cada lote usa fichas de desafio, respeita o orçamento e passa por revisão de jogo.

**Dependências:** FUT-01

Checklist:

- [ ] Produzir apenas operações, tipos e ranks selecionados.
- [ ] Desenvolver os pares de chakra aprovados para o lote.
- [ ] Ampliar estados, objetivos e campos do editor preservando fases antigas.
- [ ] Integrar seleção de missão, progresso local e desbloqueios definidos.
- [ ] Exercitar mapas e combinações com diferentes equipes.

### FUT-03 — Reavaliar recursos opcionais depois do recorte

**Área:** Produção futura · **Prioridade:** P2 · **Estado:** Proposta para revisão

**Pergunta:** Que acréscimos resolvem necessidades comprovadas da experiência?

**Entrega:** Backlog avaliado de terceiros inimigos, novos biomas, desafios e ferramentas de compartilhamento.

**Critério de conclusão:** Nenhum extra entra por quantidade de ideias; cada inclusão tem justificativa e troca de escopo.

**Dependências:** FUT-01

Checklist:

- [ ] Avaliar novos inimigos apenas quando os dois atuais não sustentarem os desafios.
- [ ] Avaliar medidor persistente da região e objetivos secundários.
- [ ] Avaliar anotações e exportação do estado do turno para discutir estratégias.
- [ ] Manter inventário, multiplayer, árvore de habilidades e campanha longa fora do recorte salvo decisão específica.
- [ ] Reavaliar geração procedural a partir dos problemas encontrados nos mapas.

## 06 · Artes finais e entrega

### ART-01 — Fechar conteúdo e preparar o inventário de assets

**Área:** Arte · **Prioridade:** P2 · **Estado:** Proposta para revisão

**Pergunta:** A experiência está pronta para receber arte final?

**Entrega:** Inventário com personagens, tiles, efeitos, retratos, interface, dimensões e animações.

**Critério de conclusão:** Regras, câmera, tipos de missão e conteúdo do lote estão estáveis com arte provisória.

**Dependências:** FUT-01, FUT-02

Checklist:

- [ ] Concluir a revisão de leitura tática e perspectiva.
- [ ] Fixar escala, âncoras, direções e animações necessárias.
- [ ] Listar efeitos das combinações efetivamente incluídas.
- [ ] Revisar roteiro e interface antes de encomendar assets.
- [ ] Estimar esforço de arte com o inventário real.

### ART-02 — Produzir e integrar artes finais na última etapa

**Área:** Arte · **Prioridade:** P2 · **Estado:** Proposta para revisão

**Pergunta:** Como finalizar a apresentação sem perder a clareza tática validada?

**Entrega:** Conjunto final de sprites, tiles, efeitos e interface do recorte selecionado.

**Critério de conclusão:** A versão final mantém legibilidade, desempenho, seleção e previsões da versão provisória.

**Dependências:** ART-01

Checklist:

- [ ] Produzir personagens, terrenos e retratos com identidade visual comum.
- [ ] Integrar efeitos e animações dos poderes e combinações.
- [ ] Conferir unidades e ameaças em diferentes fundos e resoluções.
- [ ] Respeitar movimento reduzido e garantir informação estática suficiente.
- [ ] Executar revisão final e conferir distribuição offline/publicada.
