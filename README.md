# Discord Automation (Mudae)

Extensão de conteúdo (Manifest v3) para o Discord Web que automatiza interações com o mini-game do bot Mudae. Ela envia comandos, reage a kakera valiosos e ajuda no uso eficiente do claim, respeitando janelas de horário e alguns limites de segurança.

## Visão rápida do mini-game
- `$wa`: rola personagens; os rolls resetam a cada 1h.
- Claim: pode ser usado a cada ~3h; gastar cedo demais impede usar nos dois próximos resets de rolls.
- `$tu`: mostra status (rolls restantes, claim disponível ou tempo de espera, cooldown de reação, estoque de kakera, etc.) e serve de gatilho para decisões.
- `$rt`: reseta o timer do claim quando disponível (aparece na mensagem do `$tu`).
- Estratégia de pré-claim: caso esteja sem claim, é possível roletar ~30s antes do reset e gastar o claim assim que virar o minuto do reset. Limites típicos: 300ka (pré-claim), 200ka (1a hora após reset), 100ka (2a e 3a horas).

## O que a extensão faz
- Observa o DOM do Discord Web e processa novas mensagens e embeds do Mudae.
- Agenda `$tu` perto do reset de rolls (por padrão entre os minutos 55–59) para acompanhar rolls/claim.
- Quando o `$tu` indica `$daily` ou `$dk` disponíveis, envia os comandos automaticamente.
- Quando o `$tu` mostra claim disponível e rolls > 0, enfileira e envia `$wa` em sequência com atraso curto.
- Detecta kakera em embeds e reage automaticamente quando o valor ultrapassa o limite configurado (dependente de claim) ou quando há um ícone especial de reação (diferente de ❤️). Ícones especiais ignoram a disponibilidade do claim. Em sessões de rolagem, aplica um debounce para escolher o maior valor antes de reagir. Mantém retentativas de clique por ~9s para garantir a reação.
- Quando `resetClaimTimerEnabled` está ativo e `$rt` está disponível no `$tu`, permite rolar mesmo sem claim e usa `$rt` para resetar o claim se aparecer kakera acima do limite da hora 1.
- Monitora mensagens de confirmação de claim/kakera para encerrar retentativas de clique e mensagens de cooldown de reação (`You can't react to kakera for ...`) para evitar reações repetidas até o tempo expirar.
- Respeita uma janela de operação (padrão 06:00–00:00). Fora dela, não envia comandos e pausa filas até reabrir.
- Implementa sessões de pré-claim: agenda o início ~30s antes do reset do claim (minuto configurado), aplica limites por fase (pré-claim/1a/2a/3a hora) e encerra após a janela de 3min ou quando o claim fica disponível. Se houver candidato, o claim pode ser agendado para o momento do reset.

## Configuração (`CONFIG` em `src/config.js`)
- `palavraChave`: string para logging quando aparece em mensagens (hoje apenas loga).
- `nickname`: usado para validar que a resposta do `$tu` é do usuário certo.
- `kakeraEmojiId`: ID do emoji de kakera para leitura do valor.
- `kakeraAltoLimite`: limite padrão de kakera quando não há contexto de claim.
- `kakeraConfirmacaoGif`: URL enviada quando uma mensagem de confirmação de kakera é detectada (deixe vazio para desativar).
- `tuWindowStartMinute`, `tuWindowEndMinute`: janela de minutos do relógio para disparar o `$tu` (se não definidos, usa `tuIntervalBaseMin` + jitter).
- `tuIntervalBaseMin`, `tuIntervalJitterMin`, `tuIntervalJitterMax`, `tuRetryMs`: controle de agendamento e retentativa do `$tu`.
- `dailyEnabled`, `dkEnabled`, `dailyCommand`, `dkCommand`, `dailyDkDelayMs`: envio automático de `$daily`/`$dk` quando disponíveis.
- `waDelayMs`: atraso base entre envios sequenciais de `$wa` (adiciona jitter de 150–400ms).
- `horarioInicio`, `horarioFim`: janela diária de operação (formato HH:MM). Se iguais, fica 24h ativo.
- `claimResetMinute`, `claimResetIntervalHours`, `claimResetAnchorHour`: configuração do reset de claim (ex.: minuto 55 a cada 3h, ancorado em uma hora conhecida como 14 se o último reset foi 14:55).
- `claimLimits`: limites por fase (`preClaim`, `hour1`, `hour2`, `hour3`).
- `limiteRt`: limite de kakera para usar `$rt` quando disponível (fallback para `claimLimits.hour1`).
- `claimDebounceMs`: janela máxima para selecionar o melhor claim dentro de uma sessão de rolagem.
- `rollSessionIdleMs`: tempo de ociosidade para encerrar uma sessão de rolagem após o último roll.
- `rollsResetEnabled`, `rollsResetCommand`, `rollsResetWindowMinutes`: controle do reset de rolls via `$rolls` quando o claim está disponível na última hora.
- `rollsResetTimeoutMs`, `rollsResetTuDelayMs`: timeout do reset e atraso para solicitar `$tu` após a confirmação.
- `resetClaimTimerEnabled`: habilita o uso do `$rt` quando disponível no `$tu` para resetar o claim em kakera acima do limite da hora 1.
- `preClaimOffsetMs`: quanto antes do reset iniciar a sessão de pré-claim.
- `preClaimJanelaMs`: duração máxima da sessão de pré-claim.

## Fluxos principais no código (`src/core` e `src/adapters`)
- **Observação de mensagens**: `MutationObserver` em `document.body` processa novos nós com ID `message-content-*` e embeds; evita retrabalho via sets de IDs.
- **Parsing do `$tu`**: `parseTuStatus` extrai claim/rolls/reset/daily/dk/vote/power/estoque. `processTuMessage` valida nickname, atualiza estado e agenda fila de `$wa` ou pré-claim.
- **Envio de comandos**: `sendCommand` localiza o editor Slate, evita interferir se o usuário estiver digitando, simula eventos de teclado para digitar e enviar. Usa `processWaQueue` para drenar a fila de `$wa` respeitando horário.
- **Janela de operação**: `isWithinSchedule`, `minutesUntilSchedule` e `describeSchedule` controlam pausas/reagendamentos tanto para `$tu` quanto para a fila de `$wa`.
- **Pré-claim**: `schedulePreClaimSession`, `startPreClaimSession` e `endPreClaimSession` gerenciam a sessão; `getCurrentKakeraLimit` calcula o limite por fase (pré-claim/1a/2a/3a hora) com base no reset do claim.
- **Sessão de rolagem**: durante o envio de `$wa`, o código agrupa rolls e aplica debounce (`claimDebounceMs`) para escolher a maior carta antes de reagir.
- **Reset de rolls**: se o claim estiver disponível e faltarem <= 60 min para o reset, o script pode enviar `$rolls` quando os rolls acabarem e aguardar a confirmação por reação ✅; na rodada pós-$rolls, se nada passar do limite, usa o claim no maior valor para não perder a janela.
- **Reação a kakera**: `processKakeraEmbed` lê valor (via `extractKakeraValue`), escolhe botão de reação (`findReactionButtons` / `detectReactionByIcon`), respeita cooldown de reação quando detectado, clica e inicia retentativas (`startRetry`).
- **Confirmação de reação**: `detectConfirmation` encerra retentativas ao ver mensagens de claim/kakera para o nickname configurado e registra cooldown quando aparece `You can't react to kakera for ...`.

## Estrutura do repositório
- `manifest.json`: manifesto MV3 para injetar os módulos em `https://discord.com/*`.
- `src/config.js`: configurações e seletores globais.
- `src/state.js`: estado compartilhado da automação.
- `src/utils.js`: utilitários de tempo, logging e normalização.
- `src/core/*`: regras e decisões (claim, $tu, sessões, cooldowns, resets).
- `src/adapters/*`: integração com DOM do Discord (parser, actions, observer).
- `src/bootstrap.js`: ponto de entrada que liga observador e agenda o $tu inicial.
- `package.json`: metadata simples (sem build ou dependências externas).
- `docs/html-exemplos.md`: exemplos de HTML do Discord (resposta do `$wa`) e seletores recomendados.

## Como usar em modo desenvolvedor
1. Chrome/Edge/Brave: abra `chrome://extensions`, ative "Modo do desenvolvedor" e carregue a pasta do projeto via "Carregar sem compactação".
2. Abra o Discord Web, entre no servidor/canal com o Mudae e mantenha a aba ativa. O console mostrará logs com prefixo `[Discord Automação]`.
3. Ajuste valores do `CONFIG` conforme sua estratégia (horários, limites, nickname). Salve o arquivo e recarregue a extensão ou a aba para aplicar.

## Limitações e cuidados
- Mudanças no DOM do Discord podem quebrar os seletores usados para ler mensagens/embeds/botões.
- Automatizar interações pode violar termos do Discord/Mudae; use por sua conta e risco.
- Não há persistência de estado além da aba atual; recarregar a página limpa filas e timers.
