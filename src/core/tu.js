(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});
    const { config, state, utils } = DA;
    const { log, randomInt, clampInt } = utils;

    DA.core = DA.core || {};
    const core = DA.core;

    const getDailyDkConfig = () => ({
        dailyEnabled: config.dailyEnabled !== false,
        dkEnabled: config.dkEnabled !== false,
        dailyCommand: typeof config.dailyCommand === "string" ? config.dailyCommand : "$daily",
        dkCommand: typeof config.dkCommand === "string" ? config.dkCommand : "$dk",
        delayMs: clampInt(config.dailyDkDelayMs, 200, 5000, 800)
    });

    const scheduleDailyDkCommands = (status) => {
        if (!status) return 0;
        const cfg = getDailyDkConfig();
        const comandos = [];
        if (cfg.dailyEnabled && status.dailyAvailable === true) {
            comandos.push({ command: cfg.dailyCommand, label: "$daily" });
        }
        if (cfg.dkEnabled && status.dkAvailable === true) {
            comandos.push({ command: cfg.dkCommand, label: "$dk" });
        }
        if (!comandos.length) return 0;

        if (!core.clock.isWithinSchedule()) {
            log("[TU] Fora do horario, ignorando envio de $daily/$dk.");
            return 0;
        }

        let delayMs = 0;
        comandos.forEach((item, index) => {
            const enviar = () => {
                const enviado = DA.adapters.actions.sendCommand(item.command);
                if (enviado) {
                    log(`[TU] Comando ${item.command} enviado (${item.label} disponível).`);
                } else {
                    log(`[TU] Falha ao enviar ${item.command}.`);
                }
            };
            if (index === 0) {
                enviar();
            } else {
                delayMs += cfg.delayMs;
                setTimeout(enviar, delayMs);
            }
        });

        return cfg.delayMs * comandos.length;
    };

    const clearWaitingTu = () => {
        state.esperandoTuResposta = false;
        if (state.tuRespostaTimeoutId) {
            clearTimeout(state.tuRespostaTimeoutId);
            state.tuRespostaTimeoutId = null;
        }
    };

    const processTuMessage = (texto) => {
        if (!/rolls left/i.test(texto)) return;

        if (!state.esperandoTuResposta) {
            log("[WA] Mensagem $tu ignorada: não aguardávamos resposta.");
            return;
        }

        if (config.nickname && !texto.toLowerCase().includes(config.nickname.toLowerCase())) {
            log(`[WA] Mensagem $tu ignorada: não contém nickname esperado (${config.nickname}).`);
            return;
        }

        clearWaitingTu();

        const status = DA.adapters.parser.parseTuStatus(texto);
        if (!status) {
            log("Mensagem $tu recebida, mas não consegui extrair status.");
            return;
        }

        state.ultimoTuStatus = status;
        state.ultimoTuStatusEm = Date.now();
        log("Status $tu:", status);
        if (Number.isFinite(status.reactCooldownMinutes) && status.reactCooldownMinutes > 0) {
            core.reaction.registerCooldown(status.reactCooldownMinutes, "$tu");
        }
        core.clock.updateClaimResetAgenda(new Date());
        core.claim.schedulePreClaimSession(status);
        core.rollsReset.evaluate(status);
        if (core.rollsReset.consumeFinalRound(status)) {
            state.forceClaimFallbackNextSession = true;
            log("[WA] Ultima rodada apos $rolls: claim sera usado no maior valor se nenhum passar do limite.");
        }
        const comandosExtrasDelayMs = scheduleDailyDkCommands(status);

        const resetClaimTimerAtivo = config.resetClaimTimerEnabled === true && status.rtAvailable === true;
        if ((status.claimAvailable || resetClaimTimerAtivo) && Number.isFinite(status.rollsLeft) && status.rollsLeft > 0) {
            state.waQueue = Math.max(state.waQueue, status.rollsLeft);
            const origem = status.claimAvailable ? "claim OK" : "$rt disponível";
            log(`[WA] Enfilei ${status.rollsLeft} comandos $wa (${origem}, fila agora: ${state.waQueue}).`);
            if (comandosExtrasDelayMs > 0) {
                log(`[WA] Aguardando ${(comandosExtrasDelayMs / 1000).toFixed(1)}s antes de iniciar $wa.`);
                setTimeout(processWaQueue, comandosExtrasDelayMs);
            } else {
                processWaQueue();
            }
        } else {
            const claimMsg = status.claimAvailable ? "claim OK" : "claim bloqueado";
            const rollsMsg = typeof status.rollsLeft === "number" ? `rolls=${status.rollsLeft}` : "rolls=n/d";
            const rtMsg = status.rtAvailable ? "$rt=ok" : "$rt=n/d";
            log(`[WA] Nenhuma ação: ${claimMsg}, ${rollsMsg}, ${rtMsg}.`);
        }
    };

    const processWaQueue = () => {
        if (state.processandoWa) return;
        if (state.waQueue <= 0) return;

        if (!core.clock.isWithinSchedule()) {
            state.processandoWa = true;
            const delayMs = Math.max(core.clock.minutesUntilSchedule() * 60000, 60000);
            log(
                `[WA] Fora do horário (${core.clock.describeSchedule()}), fila pausada (${state.waQueue} itens). Retomando em ${(delayMs / 60000).toFixed(1)} min.`
            );
            setTimeout(() => {
                state.processandoWa = false;
                processWaQueue();
            }, delayMs);
            return;
        }

        state.processandoWa = true;
        log(`[WA] Iniciando processamento da fila (${state.waQueue} itens).`);
        const forceFallback = state.forceClaimFallbackNextSession === true;
        core.rollSession.startSession("fila-wa", { forceClaimFallback: forceFallback });
        if (forceFallback) state.forceClaimFallbackNextSession = false;

        const proximo = () => {
            if (state.waQueue <= 0) {
                state.processandoWa = false;
                log("[WA] Fila vazia, nada a enviar.");
                return;
            }

            if (!core.clock.isWithinSchedule()) {
                state.processandoWa = false;
                const atrasoMs = Math.max(core.clock.minutesUntilSchedule() * 60000, 60000);
                log(
                    `[WA] Horário encerrado (${core.clock.describeSchedule()}), pausa da fila. Próxima tentativa em ${(atrasoMs / 60000).toFixed(1)} min.`
                );
                setTimeout(processWaQueue, atrasoMs);
                return;
            }

            const sucesso = DA.adapters.actions.sendCommand("$wa");
            if (!sucesso) {
                log("Falha ao enviar $wa, tentando novamente em alguns segundos.");
                setTimeout(() => {
                    state.processandoWa = false;
                    processWaQueue();
                }, 5000);
                return;
            }
            core.rollSession.updateSessionEvent("envio");
            if (typeof state.ultimoTuStatus?.rollsLeft === "number") {
                state.ultimoTuStatus.rollsLeft = Math.max(state.ultimoTuStatus.rollsLeft - 1, 0);
            }
            state.waQueue -= 1;
            log(`[WA] Comando $wa enviado. Restam ${state.waQueue}.`);
            if (state.waQueue <= 0) {
                core.rollSession.scheduleSessionEnd();
            }
            const delay = config.waDelayMs + randomInt(150, 400);
            setTimeout(proximo, delay);
        };

        proximo();
    };

    const calculateNextTuDelay = () => {
        const base = config.tuIntervalBaseMin * 60 * 1000;
        const jitterMin = config.tuIntervalJitterMin * 60 * 1000;
        const jitterMax = config.tuIntervalJitterMax * 60 * 1000;
        const jitter = randomInt(jitterMin, jitterMax);
        return base + jitter;
    };

    const scheduleTu = (delayMs) => {
        if (state.tuTimeoutId) clearTimeout(state.tuTimeoutId);
        state.tuTimeoutId = setTimeout(executeTu, delayMs);
        log(`Próximo $tu agendado em ${(delayMs / 60000).toFixed(1)} min.`);
    };

    const executeTu = () => {
        if (state.enviandoTu) return;
        state.enviandoTu = true;

        if (!core.clock.isWithinSchedule()) {
            const delayMs = Math.max(core.clock.minutesUntilSchedule() * 60000, config.tuRetryMs);
            log(
                `Fora do horário configurado (${core.clock.describeSchedule()}), reagendando $tu para ${(delayMs / 60000).toFixed(1)} min.`
            );
            state.enviandoTu = false;
            scheduleTu(delayMs);
            return;
        }

        const enviado = DA.adapters.actions.sendCommand("$tu");
        if (!enviado) {
            log("Falha ao enviar $tu. Reagendando curto.");
            state.enviandoTu = false;
            scheduleTu(config.tuRetryMs);
            return;
        }

        state.enviandoTu = false;
        clearWaitingTu();
        state.esperandoTuResposta = true;
        state.tuRespostaTimeoutId = setTimeout(() => {
            clearWaitingTu();
            log("Timeout aguardando resposta do $tu.");
        }, 90000);
        log("Aguardando resposta do $tu por até 90s.");
        scheduleTu(calculateNextTuDelay());
    };

    core.tu = {
        processTuMessage,
        processWaQueue,
        scheduleTu,
        executeTu
    };
})();
