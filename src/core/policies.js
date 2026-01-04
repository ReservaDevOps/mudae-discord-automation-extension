(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});
    const { state } = DA;

    DA.core = DA.core || {};
    const core = DA.core;

    const getKakeraLimitForClaim = (status, agora = new Date()) => {
        const limites = core.claim.getClaimLimits();
        const tempo = core.clock.getTimeToClaimReset(status, agora);
        if (!tempo || !Number.isFinite(tempo.ms)) {
            return { limite: limites.fallback, origem: "fallback", fase: "desconhecida" };
        }

        if (core.claim.isPreClaim(status, agora)) {
            return { limite: limites.preClaim, origem: "pre-claim", fase: "pre-claim", tempo };
        }

        const umaHoraMs = 60 * 60 * 1000;
        if (tempo.ms > 2 * umaHoraMs) {
            return { limite: limites.hour1, origem: "janela-claim", fase: "hora-1", tempo };
        }
        if (tempo.ms > umaHoraMs) {
            return { limite: limites.hour2, origem: "janela-claim", fase: "hora-2", tempo };
        }
        return { limite: limites.hour3, origem: "janela-claim", fase: "hora-3", tempo };
    };

    const getCurrentKakeraLimit = () => getKakeraLimitForClaim(state.ultimoTuStatus, new Date());

    core.policies = {
        getKakeraLimitForClaim,
        getCurrentKakeraLimit
    };
})();
