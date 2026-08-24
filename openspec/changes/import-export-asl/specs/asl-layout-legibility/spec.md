# asl-layout-legibility Specification

## Purpose

Garantir que um ASL importado chegue ao canvas como um diagrama **bem dimensionado
e legível** — geometria calculada, containment real e dimensionado, leitura da
esquerda para a direita, sem sobreposição de nós ou de rótulos — e que qualquer
problema de qualidade visual vire **aviso, nunca bloqueio**.

Este é requisito de produto: uma importação que produza nós soltos sobrepostos é
falha da funcionalidade, não um polimento pendente.

## Requirements

### Requirement: A geometria é calculada por ELK, não herdada do arquivo

O ASL não carrega posição, tamanho nem ordem. O sistema DEVE calcular toda a
geometria com ELK, reutilizando o engine de layout do projeto, e NÃO DEVE recorrer
a posicionamento em grade nem a distribuição sequencial.

#### Scenario: Nenhuma posição vem do arquivo

- **GIVEN** `solution.asl.yaml`, que não declara nenhuma coordenada
- **WHEN** o import roda
- **THEN** todos os nós recebem posição vinda do resultado do ELK

#### Scenario: Dois imports do mesmo arquivo produzem a mesma geometria

- **GIVEN** o mesmo arquivo importado duas vezes em diagramas vazios
- **WHEN** as geometrias são comparadas
- **THEN** as caixas resultantes são idênticas

### Requirement: O diagrama lê da esquerda para a direita

O layout DEVE usar `elk.direction: "RIGHT"`, e as conexões DEVEM respeitar a regra
dura do produto: handles à esquerda são entrada, handles à direita são saída,
qualquer que seja a posição do nó. A ordem de handles calculada pelo ELK DEVE ser
aplicada em `handleOrder`, o mesmo campo que o usuário altera manualmente.

#### Scenario: A cadeia do arquivo de referência flui para a direita

- **GIVEN** a cadeia fila → aplicação → banco → processador → tópico
- **WHEN** o import roda
- **THEN** cada alvo tem posição horizontal maior que a de sua origem

#### Scenario: Lados dos handles não são derivados da posição

- **WHEN** uma conexão é criada pelo import
- **THEN** ela sai pelo lado direito da origem e chega pelo lado esquerdo do alvo
- **AND** mover um nó depois do import não reescreve os lados

### Requirement: Containment vira aninhamento real em painel

Todo construto ASL que contenha outros DEVE virar um `PanelComponent`, porque o
React Flow só aninha visualmente sob um painel. Os filhos DEVEM receber posição
relativa ao pai, e o painel DEVE receber largura e altura vindas do box do ELK.
Nós folha NÃO DEVEM receber largura e altura do layout — mantêm o tamanho
intrínseco do DOM.

#### Scenario: Aplicações ficam dentro do painel do serviço

- **GIVEN** um `ApplicationService` e duas `Application` que lhe pertencem
- **WHEN** o import roda
- **THEN** os dois nós de aplicação têm o painel como pai
- **AND** as caixas dos dois estão inteiramente contidas na caixa do painel

#### Scenario: O painel é dimensionado pelos filhos

- **WHEN** o import roda
- **THEN** a largura e a altura do painel vêm do layout, não do tamanho padrão de painel
- **AND** há folga entre a borda do painel e o filho mais próximo

#### Scenario: Posição de filho é relativa ao pai

- **WHEN** o import roda
- **THEN** a posição gravada para um nó filho é relativa ao painel, e não absoluta no canvas

### Requirement: Container vazio continua sendo desenhado

Um container sem filhos DEVE ser desenhado como painel, com tamanho suficiente
para o rótulo do cabeçalho não truncar. Um container vazio NÃO DEVE colapsar para
o tamanho de um nó folha nem ser omitido.

#### Scenario: ApplicationService sem aplicações

- **GIVEN** um arquivo ASL com um `ApplicationService` e nenhuma `Application`
- **WHEN** o import roda
- **THEN** um painel é desenhado com o nome do serviço legível por completo
- **AND** seu tamanho é o de container vazio, não o de nó folha

#### Scenario: Container vazio não desloca o resto do diagrama para cima do gráfico principal

- **GIVEN** um arquivo com um container vazio e uma cadeia conectada de nós
- **WHEN** o import roda
- **THEN** a caixa do container vazio não se sobrepõe a nenhum outro nó

### Requirement: Nós e rótulos não se sobrepõem

No arquivo de referência, o diagrama importado DEVE ter zero sobreposição de nó
com nó, zero aresta atravessando nó que não seja seu extremo, e zero sobreposição
de rótulo — medidos pelo instrumento de legibilidade do projeto
(`layoutReadability`) sobre o caminho efetivamente renderizado (`renderedEdgePath`).

#### Scenario: Baseline do arquivo de referência

- **WHEN** o harness de legibilidade roda sobre `solution.asl.yaml`
- **THEN** `edgeNodeOverlaps` é 0
- **AND** `labelOverlaps` é 0

#### Scenario: Rótulos longos são medidos antes de serem escolhidos

- **GIVEN** as duas hipóteses de rótulo: a `description` completa e o verbo do `type`
- **WHEN** o harness mede `labelOverlaps` nas duas
- **THEN** o resultado registrado no baseline é o da hipótese escolhida
- **AND** a hipótese descartada aparece na tabela impressa, para comparação

### Requirement: Qualidade visual nunca bloqueia a importação

Nenhuma métrica de legibilidade PODE impedir que uma importação conclua. Problemas
de qualidade visual DEVEM ser reportados como aviso ao usuário, com string via
i18n em `en` e `pt-BR`, e o diagrama DEVE ser escrito no canvas mesmo assim.

#### Scenario: Diagrama feio ainda é importado

- **GIVEN** um ASL sintético que produz rótulos sobrepostos
- **WHEN** o import roda
- **THEN** todos os componentes e conexões são criados
- **AND** um aviso é exibido
- **AND** nenhum erro é lançado

#### Scenario: O harness é guarda de regressão, não portão

- **WHEN** a suíte de legibilidade roda
- **THEN** ela compara com o baseline registrado e falha o CI se algum número piorar
- **AND** nenhuma dessas verificações é executada no caminho de runtime do import

### Requirement: Fixtures ASL entram no harness de legibilidade existente

O projeto DEVE registrar fixtures ASL no mesmo instrumento que já mede o pipeline
de geração por LLM, com baseline por fixture, no molde de
`layoutReadability.baseline.test.ts`. O conjunto DEVE cobrir, no mínimo: o arquivo
de referência, um container vazio, um leque de saída largo (um nó com muitos
alvos) e um caso de rótulos longos.

#### Scenario: Tabela impressa e baseline verificado

- **WHEN** a suíte de baseline ASL roda
- **THEN** ela imprime a tabela por fixture com travessias, sobreposições e dimensões
- **AND** falha se qualquer fixture piorar em relação ao número registrado

### Requirement: A extração do engine de layout não regride a geração por LLM

Generalizar `irLayoutEngine` para um engine de grafo neutro DEVE ser
comportamento-idêntico para o pipeline de IR. O baseline de legibilidade existente
DEVE permanecer verde e com os mesmos valores registrados.

#### Scenario: Baseline do IR inalterado

- **GIVEN** a extração do engine neutro aplicada
- **WHEN** `layoutReadability.baseline.test.ts` roda
- **THEN** ele passa sem alteração nos números do baseline

#### Scenario: A ordem de handles do ELK continua ligada

- **WHEN** um diagrama é gerado pelo pipeline de IR após a extração
- **THEN** a ordem de handles do ELK continua sendo aplicada por padrão

### Requirement: Notas ficam fora do grafo de layout

Notas — incluindo as geradas a partir de `BusinessRule` — NÃO DEVEM participar do
grafo entregue ao ELK, seguindo o que o auto-layout do canvas já faz. Elas DEVEM
ser posicionadas após o layout, ancoradas ao componente que a relação `appliesTo`
indica, sem se sobrepor ao diagrama.

#### Scenario: A nota da regra não distorce as camadas

- **GIVEN** o arquivo de referência, cuja `BusinessRule` se aplica ao `ApplicationService`
- **WHEN** o import roda
- **THEN** a geometria dos nós técnicos é a mesma que seria sem a nota
- **AND** a nota é posicionada adjacente ao alvo, sem sobrepor nenhum nó
