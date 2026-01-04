(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});

    DA.state = {
        mensagensProcessadas: new Set(),
        embedsProcessados: new Set(),
        tuTimeoutId: null,
        enviandoTu: false,
        esperandoTuResposta: false,
        tuRespostaTimeoutId: null,
        ultimoTuStatus: null,
        ultimoTuStatusEm: null,
        waQueue: 0,
        processandoWa: false,
        reacaoPendente: null,
        kakeraReactCooldownUntil: null,
        preClaimTimeoutId: null,
        preClaimSession: null,
        claimResetAgenda: null,
        rollSession: null,
        claimPendente: null,
        rollsResetPendente: null
    };
})();
