# Cronograma de produção — Tríade

Proposta criada em 18/10/2026 e revisada na mesma data para incluir combinações de chakra e uma história provisória, conforme pedido do criador. O documento organiza o desenvolvimento futuro; nenhuma das novas mecânicas ou cenas narrativas foi implementada nesta revisão.

A referência passa a ser uma **demo de seis fases em aproximadamente 24 semanas**, incluindo os cinco ninjas, as dez combinações do banco de ideias e uma história curta que conecte as missões. A estimativa considera desenvolvimento em tempo parcial, cerca de 15–20 horas por semana, com testes semanais e disponibilidade de arte a estimar separadamente. As semanas são relativas ao início da produção. O prazo será revisto depois do primeiro lote de combinações e da definição do inventário de arte.

As **artes finais são a última etapa de produção**. Até lá, usamos os desenhos atuais, blocos simples, textos de marcação e efeitos provisórios. A perspectiva, as dimensões e as necessidades de animação são definidas antes de encomendar ou produzir os assets definitivos.

## Base disponível

- Combate por turnos em tabuleiro 8×8, com ondas, prazo, vitória e derrota.
- Cinco ninjas, equipes de três, Soco e um Especial por elemento; caminhada de três casas para todos.
- Empurrões de personagens e estruturas móveis, colisões, dano em ambos os envolvidos e impacto de ataques letais.
- Prévia de dano, deslocamentos, colisões, custo do dash e avanço dos inimigos empurrados.
- Dois tipos de inimigo, com movimento e ataques direcionais anunciados.
- Mapas procedurais com rios, lagos, costas e muralhas em ruínas.
- Editor com 28 tiles, camadas, biblioteca local, JSON e exportação de fase jogável.
- Jogo e editor em HTML offline, geração do projeto GDevelop e testes automatizados.

O catálogo do editor já contém lama, vapor, pedra incandescente e outros tiles relacionados às combinações. Sua presença não representa a ativação dos jutsus combinados. O projeto GDevelop foi exercitado por uma simulação dos eventos; sua execução no editor oficial ainda precisa ser validada. Não há URL pública de teste confirmada neste ambiente.

## Escopo da próxima demo

Uma sequência de seis fases feitas no editor, incluindo tutorial jogável, os cinco ninjas atuais, os dois inimigos existentes, dez combinações de chakra, progresso salvo localmente e uma narrativa curta. O modo procedural continua disponível para partidas livres.

Os efeitos de terreno prioritários passam a ser os necessários às combinações: lama, vapor, brasa, correnteza, selo elétrico e condução pela água. Outros efeitos independentes, como espinhos e gelo deslizante, ficam para uma versão posterior. O objetivo alternativo proposto é proteger uma estrutura por determinado número de turnos; sua utilização será avaliada nas fases.

A história de marcação terá sinopse, motivos para cada missão, acontecimentos que conectem as fases, briefings, textos curtos de resultado e um desfecho provisório. Personagens, nomes e falas podem mudar durante os testes. A entrega usa texto e retratos provisórios; não inclui dublagem nem cenas cinematográficas animadas.

Novos ninjas, campanha longa, árvore de habilidades, inventário, multiplayer e editor de tamanhos variados ficam para um ciclo posterior. Um terceiro inimigo só entra se substituir outro trabalho planejado e resolver uma necessidade comprovada das fases.

## Etapas e entregas

| Período | Foco | Trabalho proposto | Critério para concluir |
| --- | --- | --- | --- |
| Semanas 1–2 | Distribuição, escopo e estrutura da história | Obter um link confiável para testes, identificar versões e registrar problemas. Definir perspectiva e plataforma de entrega. Validar a rota do GDevelop oficial se ele continuar como requisito. Esboçar o conflito, o arco das seis fases e o motivo de cada missão. | Pelo menos três pessoas conseguem abrir a mesma versão. A história tem começo, desenvolvimento e desfecho; cada missão tem um motivo. Há uma decisão sobre perspectiva e distribuição. |
| Semanas 3–5 | Combate e protótipo das combinações | Testar as dez equipes possíveis e revisar o papel de cada ninja. Prototipar como dois elementos ativam uma combinação. Fixar custo de ações, alcance, duração, ordem de resolução, dano em aliados e comportamento das prévias antes de ampliar o sistema. | Cada ninja tem uma utilidade demonstrável. Uma combinação funciona do início ao fim, com custo e resultado claros, sem alterar a partida ao consultar a prévia. |
| Semanas 6–8 | Primeiro lote de combinações | Desenvolver Lama, Vapor, Condução Elétrica e Estilhaços. Construir o suporte comum a estados, terrenos temporários, duração e resolução determinística. Criar cenários curtos de teste no editor. | As quatro combinações podem ser executadas, previstas e testadas, incluindo aliados, estruturas, empurrões, bordas e derrota de unidades. Reestimar o restante da produção com base no esforço observado. |
| Semanas 9–11 | Segundo lote de combinações | Desenvolver Frente de Chamas, Pedra Incandescente, Detonação, Correnteza, Lança Elétrica e Selo Elétrico. Reutilizar as regras comuns e testar sobreposições entre efeitos. | As dez combinações têm papel tático identificável e resultados reproduzíveis. A interface mostra os dois participantes, o custo, a área e os efeitos que persistirão. Nenhum gatilho cria ciclos de resolução. |
| Semanas 12–13 | Campanha, editor e narrativa funcional | Adicionar sequência de fases, progresso salvo, menu e telas simples de briefing e resultado. Permitir configurar textos, ordem das missões, efeitos e o objetivo de proteção no editor. Usar nomes, retratos e sons provisórios. | Uma pessoa consegue completar uma missão, entender o próximo objetivo e avançar. Derrota e repetição não avançam a história; fechar e reabrir preserva o progresso. Fases antigas continuam funcionando. |
| Semanas 14–16 | Seis fases e tutorial integrado à história | Construir as missões, introduzir as combinações gradualmente e ajustar ondas, prazos e obstáculos. Integrar os acontecimentos e diálogos de marcação ao percurso. Testar equipes com os elementos relevantes sem exigir um trio único em toda a campanha. | As seis fases têm soluções reproduzíveis e dificuldade crescente. O tutorial é compreendido sem explicação verbal. O jogador sabe o que está tentando fazer e por que está seguindo para a próxima missão. |
| Semanas 17–18 | Testes externos | Realizar duas rodadas com 5–10 pessoas no total. Observar entendimento das combinações, clareza da história, uso dos ninjas e duração das fases. Conferir teclado, telas de PC, desempenho e distribuição. | A segunda rodada mostra melhora nos problemas da primeira. As pessoas entendem como combinar elementos e conseguem explicar o objetivo da campanha. Não há falhas que apaguem progresso ou impeçam concluir missões. |
| Semanas 19–20 | Equilíbrio, fechamento de conteúdo e preparação de arte | Ajustar custos, alcances, duração e ritmo das missões. Fixar regras, fases, roteiro provisório e interface. Revisar as prévias e a ordem dos efeitos. Preparar o inventário de sprites, tiles, retratos e animações. | A demo funciona do início ao fim com arte provisória. As dez equipes foram exercitadas e cada combinação tem um uso documentado. O roteiro não depende de uma formação específica. Cada asset tem função, tamanho e uso definidos. |
| Semanas 21–24 | Artes finais e conclusão da versão | Produzir e integrar personagens, tiles, interface, retratos e efeitos próprios das dez combinações. Finalizar a apresentação sonora conforme o orçamento. Conferir legibilidade, oclusão, vida, seleção e efeitos sobrepostos. Gerar a entrega publicada e o pacote offline. | A demo funciona com o conjunto final de arte e mantém a clareza das decisões táticas. A versão publicada e o pacote offline correspondem à mesma entrega e passam pela verificação final. |

## Combinações previstas

As dez propostas permanecem detalhadas em `banco-de-ideias.txt`. Elas entram no escopo de desenvolvimento; números e regras de ativação são hipóteses a testar.

| Lote | Combinação | Função tática proposta |
| --- | --- | --- |
| 1 | Água + Terra — Lama | Criar terreno que aumenta o custo de caminhada. |
| 1 | Fogo + Água — Vapor | Interromper linhas de tiro e permitir atravessar a área a pé. |
| 1 | Raio + Água — Condução Elétrica | Atingir uma área conectada de água, com seleção determinística e área visível. |
| 1 | Vento + Terra — Estilhaços | Usar uma pedra como origem de um ataque e consumir parte de sua vida. |
| 2 | Fogo + Vento — Frente de Chamas | Deslocar um alvo e criar uma região perigosa. |
| 2 | Fogo + Terra — Pedra Incandescente | Mover uma pedra aquecida e deixar brasa no caminho. |
| 2 | Fogo + Raio — Detonação | Atingir o centro de uma área e empurrar seus vizinhos. |
| 2 | Vento + Água — Correnteza | Produzir deslocamento em uma direção determinada no fim do turno. |
| 2 | Vento + Raio — Lança Elétrica | Atingir dois personagens alinhados com um disparo perfurante. |
| 2 | Raio + Terra — Selo Elétrico | Preparar uma armadilha que causa dano e restringe movimento voluntário. |

**Hipótese inicial para ativação:** uma ação conjunta entre dois ninjas vivos e com ação disponível, consumindo a ação de ambos. O jogador escolhe os participantes e vê alcance, área, dano, deslocamentos e efeitos futuros antes de confirmar. A etapa das semanas 3–5 compara essa solução com preparar uma casa/objeto com um elemento e transformá-lo com o segundo, proposta já registrada em REG-001. Escolheremos um padrão antes de implementar todos os pares.

Precisamos definir explicitamente alcance e origem de cada combinação; permanência e duração; ordem entre correnteza, dano de terreno e ataques inimigos; quais efeitos alcançam aliados; comportamento após a derrota de um participante; interação com estruturas móveis e destruídas; custos próprios da combinação. Os custos dos poderes individuais não são herdados automaticamente sem uma regra definida.

Cada equipe de três elementos distintos oferece três pares possíveis. As dez formações precisam continuar viáveis. O primeiro lote já envolve os cinco elementos; ele serve para validar o sistema e orientar o restante do trabalho.

## História e progressão

O argumento provisório está em [historia-provisoria.md](historia-provisoria.md). Ele conecta as seis fases à investigação de ataques contra os selos que regulam o rio e protegem as aldeias da região. A importância das combinações aparece na cooperação entre os cinco elementos e nas situações do tabuleiro.

A estrutura narrativa será definida nas semanas 1–2 e integrada ao jogo antes dos testes externos. A história será revista com base na experiência das fases, mantendo uma sequência curta de briefing, missão, consequência e próximo objetivo.

A narração principal deve funcionar com qualquer trio. Falas individuais podem aparecer quando o personagem correspondente estiver na equipe. O jogador poderá pular textos e consultar o objetivo e o briefing novamente. Repetir uma missão não duplica desbloqueios nem altera acontecimentos já concluídos.

As fases devem apresentar oportunidades de combinação e soluções alternativas. Se uma missão de tutorial exigir uma formação específica para ensinar um par, isso deve ser informado antes de iniciá-la e permanecer restrito à introdução daquela regra. As missões seguintes retomam a escolha de equipe.

## Proposta para as seis fases

| Fase | Acontecimento de marcação | Aprendizado ou desafio principal |
| --- | --- | --- |
| 1 — Clareira do Rio | O esquadrão repele uma incursão e descobre que o ataque faz parte de uma ofensiva contra os selos da região. | Movimento, Soco, colisões, prévia e ataque anunciado. |
| 2 — Passagem em Ruínas | O grupo atravessa uma rota bloqueada para seguir o rastro dos invasores. | Estruturas móveis, proteção e apresentação de Lama e Estilhaços. |
| 3 — O Posto das Brumas | Registros recuperados revelam que o próximo alvo fica junto à nascente. | Besteiros, linhas de tiro, Vapor e Condução Elétrica. |
| 4 — Margens Partidas | A equipe interrompe uma segunda frente de ataque e precisa recuperar o controle da travessia. | Introdução gradual às combinações restantes em situações preparadas; replay para comparar equipes. |
| 5 — O Santuário da Fonte | O esquadrão mantém os invasores afastados enquanto o selo é estabilizado. | Objetivo de proteção, controle de terreno e resolução dos efeitos no turno. |
| 6 — O Último Selo | O grupo enfrenta a última ofensiva e impede que o sistema de proteção da região entre em colapso. | Domínio de posicionamento, ondas, combinações e prazo; conclusão do arco da demo. |

O ensino não exige apresentar todas as dez combinações numa única primeira passagem. As fases 2–4 podem oferecer pequenas situações de treino repetíveis e variar suas dicas conforme os pares disponíveis. Todas as combinações precisam ter um cenário de uso verificável. As primeiras missões podem ter menos ondas e prazos mais generosos que o desafio atual de cinco turnos.

## Dependências e decisões

**Água e Vento:** preservar funções próprias para os poderes individuais. As combinações ampliam a escolha de equipe, mas não dispensam avaliar a sobreposição entre Rajada de Vento e Onda Circular.

**Terra:** avaliar a utilidade da barreira e sua participação em Lama, Estilhaços, Pedra Incandescente e Selo Elétrico, mantendo o alcance normal de caminhada.

**Visão isométrica:** permanece uma decisão de projeto na primeira etapa. Se adotada, reservar **2–3 semanas adicionais antes dos testes externos**, com blocos provisórios para adaptar desenho, seleção, sobreposição e prévias. A referência passa a aproximadamente 26–27 semanas, com as artes finais ainda na última posição. Reestimar o volume de arte depois de definir perspectiva e direções dos personagens.

**Editor e arquivos:** suportar textos e regras da campanha, efeitos temporários e objetivos sem invalidar fases já criadas. Distinguir efeitos colocados no mapa de efeitos criados durante uma partida. Manter progresso de campanha separado da biblioteca do editor.

**Mapas procedurais:** continuar como modo livre. As seis fases feitas à mão sustentam o ritmo da história e a introdução das combinações. A geração procedural requer testes próprios com efeitos e diferentes equipes; conectividade geométrica não garante equilíbrio.

**Controle de escopo:** as dez combinações e a história entram no plano. O catálogo de terrenos independentes foi reduzido para acomodar os efeitos que elas exigem. Se o primeiro lote revelar custo maior que o estimado, revisar o prazo ou discutir a divisão da entrega, preservando testes e a posição final das artes.

## Rotina de produção

- A cada semana, escolher uma entrega principal e os problemas que precisam ser resolvidos para alcançá-la.
- A cada mudança de regra, atualizar a prévia, a ajuda, os cenários de teste e o editor quando aplicável.
- Ao fim da semana, gerar uma versão identificada e jogar uma sessão curta, registrando dúvidas de controle, combinação e objetivo narrativo.
- Encerrar etapas pelos critérios de conclusão e revisar o calendário ao terminar o primeiro lote de combinações.
- Manter ideias futuras fora da entrega atual até uma decisão explícita de inclusão.

O primeiro trabalho recomendado é obter uma distribuição de teste confiável, esboçar o arco das seis missões e testar o modelo de ativação de uma combinação. A arte provisória permanece até o jogo, as combinações e a progressão narrativa estarem completos e revisados.
