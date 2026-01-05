(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});
    const { config, state, utils } = DA;
    const { log, normalizarTexto, minutosDeMatch } = utils;

    DA.core = DA.core || {};
    const core = DA.core;

    const clearRetry = (motivo) => {
        const atual = state.reacaoPendente;
        if (!atual) return;
        if (atual.intervalId) clearInterval(atual.intervalId);
        if (atual.timeoutId) clearTimeout(atual.timeoutId);
        state.reacaoPendente = null;
        const infoMotivo = motivo ? `: ${motivo}` : "";
        log(`[Reação] Retentativa encerrada${infoMotivo}.`);
    };

    const startRetry = (botao, motivo) => {
        if (!botao) return;
        clearRetry();

        const duracaoMs = 9000;
        const intervaloMs = 500;
        const inicioMs = Date.now();

        const tentar = () => {
            if (!state.reacaoPendente) return;
            if (!botao.isConnected) {
                clearRetry("botão de reação indisponível");
                return;
            }
            const elapsed = Date.now() - inicioMs;
            if (elapsed >= duracaoMs) {
                clearRetry("tempo esgotado");
                return;
            }
            botao.click();
        };

        const intervalId = setInterval(tentar, intervaloMs);
        const timeoutId = setTimeout(() => clearRetry("tempo esgotado"), duracaoMs + 100);
        state.reacaoPendente = { motivo, intervalId, timeoutId, inicioMs };
        log(
            `[Reação] Tentativas a cada ${(intervaloMs / 1000).toFixed(1)}s por ${(duracaoMs / 1000).toFixed(1)}s (${motivo}).`
        );
    };

    const registerCooldown = (minutos, origem) => {
        if (!Number.isFinite(minutos) || minutos <= 0) return false;
        const agora = Date.now();
        const novoFim = agora + minutos * 60 * 1000;
        const atual = state.kakeraReactCooldownUntil || 0;
        if (novoFim <= atual) return false;
        state.kakeraReactCooldownUntil = novoFim;
        const origemInfo = origem ? ` (${origem})` : "";
        log(`[Kakera] Cooldown de reação detectado: ${Math.ceil(minutos)} min${origemInfo}.`);
        return true;
    };

    const getRemainingCooldownMs = () => {
        const fim = state.kakeraReactCooldownUntil;
        if (!fim) return 0;
        const restante = fim - Date.now();
        if (restante <= 0) {
            state.kakeraReactCooldownUntil = null;
            return 0;
        }
        return restante;
    };

    const canReactNow = () => {
        const restanteMs = getRemainingCooldownMs();
        if (restanteMs > 0) return { ok: false, restanteMs };
        return { ok: true, restanteMs: 0 };
    };

    const detectConfirmation = (texto) => {
        if (!config.nickname) return;

        const normalized = normalizarTexto(texto).toLowerCase();
        const nick = config.nickname.toLowerCase();
        if (!normalized.includes(nick)) return;

        const confirmouClaim = /conquistou/.test(normalized);
        const confirmouKakera = /\+\s*\d+.*\(\$k\)/.test(normalized);
        const cooldownMatch = normalized.match(/you can't react to kakera for\s+(?:(\d+)h\s+)?(\d+)\s*min/i);
        const cooldownMin = minutosDeMatch(cooldownMatch);

        if ((confirmouClaim || confirmouKakera) && state.reacaoPendente) {
            clearRetry("mensagem de confirmação detectada");
        }

        if (Number.isFinite(cooldownMin) && cooldownMin > 0) {
            const atualizado = registerCooldown(cooldownMin, "mensagem");
            if (atualizado && state.reacaoPendente) {
                clearRetry("cooldown de reação");
            }
        }

        if (confirmouClaim) {
            const agora = new Date();
            const tempo = core.clock.getTimeToClaimReset(null, agora);
            const cooldownMin = tempo && Number.isFinite(tempo.ms) ? Math.ceil(tempo.ms / 60000) : null;
            const anterior = state.ultimoTuStatus || {};
            state.ultimoTuStatus = {
                ...anterior,
                claimAvailable: false,
                claimCooldownMinutes: cooldownMin
            };
            state.ultimoTuStatusEm = Date.now();
            core.claim.endPreClaimSession("claim usado");
            core.rollSession.cancelSession("claim confirmado");
            core.claim.clearPendingClaim("claim confirmado");
            core.rollsReset.clearPending("claim confirmado");
            core.claim.schedulePreClaimSession(state.ultimoTuStatus);
            log(`[Claim] Confirmado via mensagem. Cooldown estimado: ${cooldownMin ?? "n/d"} min.`);
        }
    };

    core.reaction = {
        clearRetry,
        startRetry,
        registerCooldown,
        getRemainingCooldownMs,
        canReactNow,
        detectConfirmation
    };
})();
