(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});

    DA.config = {
        palavraChave: "!ping",
        nickname: "reservadevops.com.br",
        kakeraEmojiId: "469835869059153940",
        kakeraAltoLimite: 100,
        tuIntervalBaseMin: 60,
        tuIntervalJitterMin: 3,
        tuIntervalJitterMax: 8,
        tuRetryMs: 30000,
        waDelayMs: 1200,
        horarioInicio: "00:00",
        horarioFim: "00:00",
        claimResetMinute: 55,
        claimResetIntervalHours: 3,
        claimResetAnchorHour: 14,
        claimLimits: {
            preClaim: 200,
            hour1: 200,
            hour2: 150,
            hour3: 100
        },
        claimDebounceMs: 45000,
        rollSessionIdleMs: 3500,
        rollsResetEnabled: true,
        rollsResetCommand: "$rolls",
        rollsResetWindowMinutes: 60,
        rollsResetTimeoutMs: 120000,
        rollsResetTuDelayMs: 4000,
        resetClaimTimerEnabled: true,
        preClaimOffsetMs: 30000,
        preClaimJanelaMs: 180000
    };

    DA.selectors = {
        embedDescription:
            ".embedDescription__623de, .embedDescription_c23d3b, [class^='embedDescription_'], [class*=' embedDescription_'], [class*='embedDescription']",
        messageContainer:
            "div[id^='message-accessories-'], div[id^='chat-messages-'], article[data-list-item-id^='chat-messages']"
    };
})();
