(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});
    const { config, state, utils } = DA;
    const { log, formatarHorario } = utils;

    DA.core = DA.core || {};
    const core = DA.core;

    const getClaimLimits = () => {
        const limites = config.claimLimits || {};
        return {
            preClaim: Number.isFinite(Number(limites.preClaim)) ? Number(limites.preClaim) : 300,
            hour1: Number.isFinite(Number(limites.hour1)) ? Number(limites.hour1) : 200,
            hour2: Number.isFinite(Number(limites.hour2)) ? Number(limites.hour2) : 100,
            hour3: Number.isFinite(Number(limites.hour3)) ? Number(limites.hour3) : 100,
            fallback: Number.isFinite(Number(config.kakeraAltoLimite)) ? Number(config.kakeraAltoLimite) : 100
        };
    };

    const isPreClaim = (status, agora = new Date()) => {
        if (state.preClaimSession?.ativa) return true;
        if (status?.claimAvailable !== false) return false;

        const tempo = core.clock.getTimeToClaimReset(status, agora);
        if (!tempo || !Number.isFinite(tempo.ms)) return false;
        const preClaimOffsetMs = Math.max(config.preClaimOffsetMs ?? 0, 0);
        return tempo.ms <= preClaimOffsetMs;
    };

    const canAttemptClaim = (status, agora = new Date()) => {
        if (state.reacaoPendente) {
            return { ok: false, motivo: "reação em andamento" };
        }
        if (status?.claimAvailable === true) {
            return { ok: true, motivo: "claim disponível" };
        }
        if (isPreClaim(status, agora)) {
            return { ok: true, motivo: "pré-claim" };
        }
        return { ok: false, motivo: "claim indisponível" };
    };

    const clearPendingClaim = (motivo) => {
        const pendente = state.claimPendente;
        if (!pendente) return;
        if (pendente.timeoutId) clearTimeout(pendente.timeoutId);
        state.claimPendente = null;
        if (motivo) log(`[Claim] Agendamento cancelado (${motivo}).`);
    };

    const executeClaimCandidate = (candidato) => {
        if (!candidato?.botao) return;
        if (!candidato.botao.isConnected) {
            log("[Rolagem] Candidato inválido: botão desconectado.");
            return;
        }
        candidato.botao.click();
        log(`[Rolagem] Claim selecionado: ${candidato.motivo}.`);
        core.reaction.startRetry(candidato.botao, candidato.motivo);
    };

    const schedulePendingClaim = (candidato, delayMs, motivo) => {
        if (!candidato?.botao) return;
        clearPendingClaim();
        const atraso = Math.max(delayMs, 0);
        const agendadoPara = Date.now() + atraso;
        const timeoutId = setTimeout(() => {
            state.claimPendente = null;
            if (state.reacaoPendente) {
                log("[Claim] Ignorando agendamento: reação em andamento.");
                return;
            }
            executeClaimCandidate(candidato);
        }, atraso);
        state.claimPendente = { candidato, timeoutId, agendadoPara };
        const info = motivo ? ` (${motivo})` : "";
        log(`[Claim] Agendado para ${(atraso / 1000).toFixed(1)}s${info}.`);
    };

    const endPreClaimSession = (motivo) => {
        const sessao = state.preClaimSession;
        if (!sessao) return;
        if (sessao.timeoutId) clearTimeout(sessao.timeoutId);
        state.preClaimSession = null;
        log(`[Pré-claim] Sessão encerrada${motivo ? ` (${motivo})` : ""}.`);
    };

    const cancelPreClaimSchedule = () => {
        if (state.preClaimTimeoutId) {
            clearTimeout(state.preClaimTimeoutId);
            state.preClaimTimeoutId = null;
        }
    };

    const startPreClaimSession = (origem = "timer") => {
        cancelPreClaimSchedule();

        const rollsDisponiveis = state.ultimoTuStatus?.rollsLeft ?? 0;
        const agora = new Date();
        const tempoReset = core.clock.getTimeToClaimReset(state.ultimoTuStatus, agora);
        const janelaMaxMs = Math.max(config.preClaimJanelaMs || 180000, 30000);
        const msAteReset = tempoReset && Number.isFinite(tempoReset.ms) ? tempoReset.ms : config.preClaimOffsetMs ?? 30000;
        const timeoutMs = Math.min(janelaMaxMs, Math.max(msAteReset + 1000, 1000));
        const resetPrevistoEm = core.clock.getNextClaimReset(agora);
        const ultimoResetEm = core.clock.getLastClaimReset(agora);
        const limites = getClaimLimits();

        state.preClaimSession = {
            ativa: true,
            timeoutId: setTimeout(() => endPreClaimSession("janela expirada"), timeoutMs),
            iniciadaEm: Date.now(),
            resetPrevistoEm
        };

        if (rollsDisponiveis > 0) {
            state.waQueue = Math.max(state.waQueue, rollsDisponiveis);
            core.tu.processWaQueue();
        }

        log(
            `[Pré-claim] Sessão iniciada (${origem}). Rolls previstos: ${rollsDisponiveis}. Limite: ${limites.preClaim}. Reset ~${formatarHorario(
                resetPrevistoEm
            )} (ultimo ${formatarHorario(ultimoResetEm)}).`
        );
    };

    const schedulePreClaimSession = (status) => {
        cancelPreClaimSchedule();
        if (!status) return;
        if (status.claimAvailable) {
            endPreClaimSession("claim disponível");
            return;
        }

        const offsetMs = Math.max(config.preClaimOffsetMs ?? 30000, 0);
        const agora = new Date();
        const proximoReset = core.clock.getNextClaimReset(agora);
        const inicioPrevisto = new Date(proximoReset.getTime() - offsetMs);
        const delayMs = Math.max(inicioPrevisto.getTime() - agora.getTime(), 0);

        state.preClaimTimeoutId = setTimeout(() => startPreClaimSession("agendado"), delayMs);
        log(
            `[Pré-claim] Agendado para ${(delayMs / 60000).toFixed(1)} min (offset ${Math.round(
                offsetMs / 1000
            )}s, inicio ${formatarHorario(inicioPrevisto)}, reset ${formatarHorario(proximoReset)}).`
        );
    };

    core.claim = {
        getClaimLimits,
        isPreClaim,
        canAttemptClaim,
        clearPendingClaim,
        schedulePendingClaim,
        executeClaimCandidate,
        endPreClaimSession,
        cancelPreClaimSchedule,
        startPreClaimSession,
        schedulePreClaimSession
    };
})();
