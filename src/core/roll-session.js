(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});
    const { config, state, utils } = DA;
    const { log, clampInt } = utils;

    DA.core = DA.core || {};
    const core = DA.core;

    const getRollSessionConfig = () => ({
        debounceMs: clampInt(config.claimDebounceMs, 1000, 120000, 45000),
        idleMs: clampInt(config.rollSessionIdleMs, 500, 20000, 3500)
    });

    const clearSession = () => {
        const sessao = state.rollSession;
        if (!sessao) return;
        if (sessao.timeoutId) clearTimeout(sessao.timeoutId);
        if (sessao.idleTimeoutId) clearTimeout(sessao.idleTimeoutId);
        state.rollSession = null;
    };

    const finalizeSession = (motivo) => {
        const sessao = state.rollSession;
        if (!sessao?.ativa) return;
        const candidato = sessao.candidato;
        clearSession();
        log(`[Rolagem] Sessão encerrada (${motivo}).`);
        if (!candidato) return;
        const agora = new Date();
        const status = state.ultimoTuStatus;
        const tempo = core.clock.getTimeToClaimReset(status, agora);
        if (status?.claimAvailable === true) {
            core.claim.executeClaimCandidate(candidato);
            return;
        }
        if (core.claim.isPreClaim(status, agora) && tempo && Number.isFinite(tempo.ms)) {
            if (tempo.ms <= 1000) {
                core.claim.executeClaimCandidate(candidato);
            } else {
                core.claim.schedulePendingClaim(candidato, tempo.ms, "aguardando reset");
            }
            return;
        }
        log("[Rolagem] Claim indisponível ao finalizar.");
    };

    const scheduleSessionEnd = () => {
        const sessao = state.rollSession;
        if (!sessao?.ativa) return;
        const cfg = getRollSessionConfig();
        if (sessao.idleTimeoutId) clearTimeout(sessao.idleTimeoutId);
        sessao.idleTimeoutId = setTimeout(() => {
            const atual = state.rollSession;
            if (!atual?.ativa) return;
            if (state.waQueue > 0) {
                scheduleSessionEnd();
                return;
            }
            const ultimo = Math.max(atual.ultimoEventoEm || 0, atual.ultimoEnvioEm || 0, atual.ultimoRollEm || 0);
            if (Date.now() - ultimo >= cfg.idleMs - 50) {
                finalizeSession("sessão ociosa");
            } else {
                scheduleSessionEnd();
            }
        }, cfg.idleMs);
    };

    const startSession = (origem = "desconhecida") => {
        if (state.rollSession?.ativa) return;
        const agora = Date.now();
        const cfg = getRollSessionConfig();
        const timeoutId = setTimeout(() => finalizeSession("debounce expirado"), cfg.debounceMs);
        state.rollSession = {
            ativa: true,
            origem,
            iniciadaEm: agora,
            deadlineEm: agora + cfg.debounceMs,
            ultimoEventoEm: agora,
            ultimoEnvioEm: null,
            ultimoRollEm: null,
            idleTimeoutId: null,
            timeoutId,
            candidato: null
        };
        log(`[Rolagem] Sessão iniciada (${origem}). Debounce ${(cfg.debounceMs / 1000).toFixed(0)}s.`);
    };

    const updateSessionEvent = (tipo) => {
        const sessao = state.rollSession;
        if (!sessao?.ativa) return;
        const agora = Date.now();
        sessao.ultimoEventoEm = agora;
        if (tipo === "envio") sessao.ultimoEnvioEm = agora;
        if (tipo === "roll") sessao.ultimoRollEm = agora;
        scheduleSessionEnd();
    };

    const cancelSession = (motivo) => {
        if (!state.rollSession?.ativa) return;
        clearSession();
        log(`[Rolagem] Sessão cancelada (${motivo}).`);
    };

    const registerClaimCandidate = (candidato) => {
        const sessao = state.rollSession;
        if (!sessao?.ativa) return false;
        if (!candidato) return false;
        const atual = sessao.candidato;
        if (!atual || candidato.score > atual.score) {
            sessao.candidato = candidato;
            log(`[Rolagem] Candidato atualizado: ${candidato.motivo}.`);
            if (state.ultimoTuStatus?.claimAvailable !== true && core.claim.isPreClaim(state.ultimoTuStatus, new Date())) {
                const agoraMs = Date.now();
                const resetPrevistoEm = state.preClaimSession?.resetPrevistoEm || core.clock.getNextClaimReset(new Date());
                const delayMs = Math.max(resetPrevistoEm.getTime() - agoraMs, 0);
                core.claim.schedulePendingClaim(candidato, delayMs, "aguardando reset");
            }
            return true;
        }
        return false;
    };

    core.rollSession = {
        startSession,
        updateSessionEvent,
        scheduleSessionEnd,
        cancelSession,
        finalizeSession,
        registerClaimCandidate
    };
})();
