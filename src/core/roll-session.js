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
        const fallback = sessao.candidatoFallback;
        const forceFallback = sessao.forceClaimFallback === true;
        clearSession();
        log(`[Rolagem] Sessão encerrada (${motivo}).`);

        const agora = new Date();
        const status = state.ultimoTuStatus;

        if (candidato) {
            const tempo = core.clock.getTimeToClaimReset(status, agora);
            if (status?.claimAvailable === true) {
                core.claim.executeClaimCandidate(candidato);
                return;
            }
            if (candidato.usaResetClaimTimer) {
                const ok = core.claim.executeClaimWithReset(candidato);
                if (!ok) {
                    log("[Rolagem] Claim com $rt indisponível ao finalizar.");
                }
                return;
            }
            if (core.claim.isPreClaim(status, agora) && tempo && Number.isFinite(tempo.ms)) {
                const resetPrevistoEm = state.preClaimSession?.resetPrevistoEm || core.clock.getNextClaimReset(agora);
                const delayMs = Math.max(resetPrevistoEm.getTime() - agora.getTime(), 0);
                if (delayMs <= 1000) {
                    core.claim.executeClaimCandidate(candidato);
                } else {
                    core.claim.schedulePendingClaim(candidato, delayMs, "aguardando reset");
                }
                return;
            }
            log("[Rolagem] Claim indisponível ao finalizar.");
            return;
        }

        if (forceFallback && fallback) {
            if (status?.claimAvailable === true) {
                log(`[Rolagem] Nenhum candidato acima do limite; usando fallback (${fallback.valor}).`);
                core.claim.executeClaimCandidate(fallback);
            } else {
                log("[Rolagem] Fallback ignorado: claim indisponivel.");
            }
            return;
        }

        if (!candidato && !forceFallback) {
            core.rollsReset.evaluate(status);
        }
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

    const startSession = (origem = "desconhecida", options = {}) => {
        if (state.rollSession?.ativa) {
            if (options.forceClaimFallback === true) {
                state.rollSession.forceClaimFallback = true;
                log(`[Rolagem] Sessao existente marcada para fallback (${origem}).`);
            }
            return;
        }
        const agora = Date.now();
        const cfg = getRollSessionConfig();
        const timeoutId = setTimeout(() => finalizeSession("debounce expirado"), cfg.debounceMs);
        const forceClaimFallback = options.forceClaimFallback === true;
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
            candidato: null,
            candidatoFallback: null,
            forceClaimFallback
        };
        const infoFallback = forceClaimFallback ? " Fallback ativo." : "";
        log(`[Rolagem] Sessão iniciada (${origem}). Debounce ${(cfg.debounceMs / 1000).toFixed(0)}s.${infoFallback}`);
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
                if (candidato.usaResetClaimTimer) {
                    core.claim.clearPendingClaim("reset claim timer");
                } else {
                    const agoraMs = Date.now();
                    const resetPrevistoEm = state.preClaimSession?.resetPrevistoEm || core.clock.getNextClaimReset(new Date());
                    const delayMs = Math.max(resetPrevistoEm.getTime() - agoraMs, 0);
                    core.claim.schedulePendingClaim(candidato, delayMs, "aguardando reset");
                }
            }
            return true;
        }
        return false;
    };

    const registerFallbackCandidate = (candidato) => {
        const sessao = state.rollSession;
        if (!sessao?.ativa || !sessao.forceClaimFallback) return false;
        if (!candidato) return false;
        const atual = sessao.candidatoFallback;
        const scoreNovo = Number.isFinite(candidato.score) ? candidato.score : candidato.valor;
        const scoreAtual = Number.isFinite(atual?.score) ? atual.score : atual?.valor;
        if (!atual || scoreNovo > scoreAtual) {
            sessao.candidatoFallback = candidato;
            log(`[Rolagem] Fallback atualizado: ${candidato.motivo}.`);
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
        registerClaimCandidate,
        registerFallbackCandidate
    };
})();
