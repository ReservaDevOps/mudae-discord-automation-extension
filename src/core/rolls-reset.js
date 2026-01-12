(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});
    const { config, state, utils } = DA;
    const { log, clampInt } = utils;

    DA.core = DA.core || {};
    const core = DA.core;

    const getRollsResetConfig = () => ({
        enabled: config.rollsResetEnabled !== false,
        command: typeof config.rollsResetCommand === "string" ? config.rollsResetCommand : "$rolls",
        janelaMin: clampInt(config.rollsResetWindowMinutes, 1, 180, 60),
        timeoutMs: clampInt(config.rollsResetTimeoutMs, 30000, 300000, 120000),
        tuDelayMs: clampInt(config.rollsResetTuDelayMs, 1000, 60000, 4000)
    });

    const clearPending = (motivo) => {
        const pendente = state.rollsResetPendente;
        if (!pendente) return;
        if (pendente.timeoutId) clearTimeout(pendente.timeoutId);
        state.rollsResetPendente = null;
        if (motivo) log(`[Rolls] Reset cancelado (${motivo}).`);
    };

    const startPending = () => {
        const cfg = getRollsResetConfig();
        clearPending();
        const timeoutId = setTimeout(() => clearPending("timeout"), cfg.timeoutMs);
        state.rollsResetPendente = {
            sentAt: Date.now(),
            timeoutId,
            messageId: null
        };
    };

    const markFinalRound = () => {
        state.rollsResetFinalRound = {
            confirmadoEm: Date.now()
        };
    };

    const clearFinalRound = (motivo) => {
        if (!state.rollsResetFinalRound && !state.forceClaimFallbackNextSession) return;
        state.rollsResetFinalRound = null;
        state.forceClaimFallbackNextSession = false;
        if (motivo) log(`[Rolls] Ultima rodada cancelada (${motivo}).`);
    };

    const consumeFinalRound = (status) => {
        if (!state.rollsResetFinalRound) return false;
        if (status?.claimAvailable !== true) return false;
        if (typeof status.rollsLeft !== "number" || status.rollsLeft <= 0) return false;
        state.rollsResetFinalRound = null;
        log("[Rolls] Ultima rodada confirmada; fallback de claim habilitado.");
        return true;
    };

    const confirmReset = () => {
        clearPending("confirmado");
        const cfg = getRollsResetConfig();
        markFinalRound();
        log("[Rolls] Reset confirmado, solicitando $tu para atualizar rolls.");
        core.tu.scheduleTu(cfg.tuDelayMs);
    };

    const trackRollsMessage = (node, texto, autor) => {
        const pendente = state.rollsResetPendente;
        if (!pendente || pendente.messageId) return;
        if (!texto || !/\$rolls/i.test(texto)) return;
        if (config.nickname && autor && autor.toLowerCase() !== config.nickname.toLowerCase()) return;

        const container =
            node.closest(".message__5126c") ||
            node.closest('div[id^="chat-messages-"]') ||
            node.closest('div[id^="message-accessories-"]') ||
            node.closest(DA.selectors.messageContainer);

        const messageId =
            container?.getAttribute("data-list-item-id") ||
            container?.id ||
            node.id ||
            null;

        if (messageId) {
            pendente.messageId = messageId;
            log(`[Rolls] Mensagem $rolls vinculada (${messageId}).`);
        }
    };

    const detectRollsConfirmation = (node) => {
        const pendente = state.rollsResetPendente;
        if (!pendente) return;
        if (!(node instanceof Element)) return;

        const container =
            node.closest(".message__5126c") ||
            node.closest('div[id^="chat-messages-"]') ||
            node.closest('div[id^="message-accessories-"]') ||
            (node.matches(".message__5126c") ? node : null);

        if (!container) return;

        const content = container.querySelector('div[id^="message-content-"]');
        if (!content) return;
        const messageId = container.getAttribute("data-list-item-id") || container.id || null;
        const contentId = content.id || null;
        if (pendente.messageId) {
            const ids = [messageId, contentId].filter(Boolean);
            if (ids.length && !ids.includes(pendente.messageId)) return;
        }
        const texto = content.innerText?.trim() ?? "";
        if (!/\$rolls/i.test(texto)) return;
        const autor = DA.adapters.parser.getMessageAuthor(content);
        if (config.nickname && autor && autor.toLowerCase() !== config.nickname.toLowerCase()) return;

        const checkmark =
            container.querySelector('img.emoji[alt="✅"]') ||
            container.querySelector('img.emoji[data-name="✅"]') ||
            container.querySelector('img.emoji[data-name*="check"]');

        if (checkmark) {
            confirmReset();
        }
    };

    const evaluate = (status) => {
        const cfg = getRollsResetConfig();
        if (!cfg.enabled) return;
        if (!status) return;
        if (status.claimAvailable !== true) return;
        if (typeof status.rollsLeft !== "number" || status.rollsLeft > 0) return;
        if (state.waQueue > 0 || state.processandoWa) return;
        if (state.rollsResetPendente) return;
        if (!core.clock.isWithinSchedule()) return;

        const tempo = core.clock.getTimeToClaimReset(status, new Date());
        if (!tempo || !Number.isFinite(tempo.ms)) return;
        if (tempo.ms > cfg.janelaMin * 60000) return;

        const enviado = DA.adapters.actions.sendCommand(cfg.command);
        if (enviado) {
            startPending();
            log(`[Rolls] Comando ${cfg.command} enviado (janela <= ${cfg.janelaMin} min).`);
        }
    };

    core.rollsReset = {
        getRollsResetConfig,
        clearPending,
        markFinalRound,
        clearFinalRound,
        consumeFinalRound,
        startPending,
        confirmReset,
        trackRollsMessage,
        detectRollsConfirmation,
        evaluate
    };
})();
