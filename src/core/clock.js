(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});
    const { config, state, utils } = DA;
    const {
        horarioParaMinutos,
        minutosDesdeMeiaNoite,
        formatarHorarioMinutos,
        formatarHorario,
        clampInt,
        normalizarHora,
        log
    } = utils;

    const criarHorarioConfig = () => {
        const inicioMin = horarioParaMinutos(config.horarioInicio, 6 * 60);
        const fimMin = horarioParaMinutos(config.horarioFim, 0);
        return { inicioMin, fimMin };
    };

    const horarioConfig = criarHorarioConfig();

    const describeSchedule = () => {
        if (horarioConfig.inicioMin === horarioConfig.fimMin) return "24h (sem restrição)";
        return `${formatarHorarioMinutos(horarioConfig.inicioMin)}-${formatarHorarioMinutos(horarioConfig.fimMin)}`;
    };

    const isWithinSchedule = (date = new Date()) => {
        const { inicioMin, fimMin } = horarioConfig;
        if (inicioMin === fimMin) return true;
        const agoraMin = minutosDesdeMeiaNoite(date);
        if (inicioMin < fimMin) return agoraMin >= inicioMin && agoraMin < fimMin;
        return agoraMin >= inicioMin || agoraMin < fimMin;
    };

    const minutesUntilSchedule = (date = new Date()) => {
        const { inicioMin, fimMin } = horarioConfig;
        if (isWithinSchedule(date)) return 0;
        const agoraMin = minutosDesdeMeiaNoite(date);
        if (inicioMin === fimMin) return 0;
        if (inicioMin < fimMin) {
            if (agoraMin < inicioMin) return inicioMin - agoraMin;
            return 1440 - agoraMin + inicioMin;
        }
        return inicioMin - agoraMin;
    };

    const getClaimResetConfig = () => ({
        minute: clampInt(config.claimResetMinute, 0, 59, 55),
        intervalHours: clampInt(config.claimResetIntervalHours, 1, 24, 3),
        anchorHour: normalizarHora(config.claimResetAnchorHour, 0)
    });

    const obterChaveDia = (date = new Date()) => {
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, "0");
        const dia = String(date.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    };

    const listarResetClaimsDoDia = (date = new Date()) => {
        const { minute, intervalHours, anchorHour } = getClaimResetConfig();
        const resets = [];
        for (let hora = 0; hora < 24; hora += 1) {
            const diff = (hora - anchorHour) % intervalHours;
            if ((diff + intervalHours) % intervalHours === 0) {
                resets.push(hora * 60 + minute);
            }
        }
        return resets.sort((a, b) => a - b);
    };

    const updateClaimResetAgenda = (date = new Date()) => {
        const chave = obterChaveDia(date);
        if (state.claimResetAgenda?.dateKey === chave) return state.claimResetAgenda;

        const resetsMinutos = listarResetClaimsDoDia(date);
        const resetsTexto = resetsMinutos.map((minutos) => formatarHorarioMinutos(minutos));
        state.claimResetAgenda = { dateKey: chave, resetsMinutos, resetsTexto };
        log(`[Claim] Resets do dia (${chave}): ${resetsTexto.join(", ")}.`);
        return state.claimResetAgenda;
    };

    const getNextClaimReset = (date = new Date()) => {
        const agenda = updateClaimResetAgenda(date);
        const agoraMs = date.getTime();
        for (const minutos of agenda.resetsMinutos) {
            const candidato = new Date(date);
            candidato.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
            if (candidato.getTime() > agoraMs) {
                return candidato;
            }
        }

        const base = new Date(date);
        base.setDate(base.getDate() + 1);
        const primeiro = agenda.resetsMinutos[0];
        base.setHours(Math.floor(primeiro / 60), primeiro % 60, 0, 0);
        return base;
    };

    const getLastClaimReset = (date = new Date()) => {
        const proximo = getNextClaimReset(date);
        const { intervalHours } = getClaimResetConfig();
        return new Date(proximo.getTime() - intervalHours * 60 * 60 * 1000);
    };

    const getTimeToClaimReset = (status, agora = new Date()) => {
        if (status && status.claimAvailable === false && typeof status.claimCooldownMinutes === "number") {
            const baseMs = Math.max(status.claimCooldownMinutes, 0) * 60000;
            const capturadoEm = typeof state.ultimoTuStatusEm === "number" ? state.ultimoTuStatusEm : null;
            const elapsedMs = capturadoEm ? Math.max(agora.getTime() - capturadoEm, 0) : 0;
            if (elapsedMs < baseMs) {
                const ms = Math.max(baseMs - elapsedMs, 0);
                return { ms, minutos: Math.ceil(ms / 60000), origem: "tu" };
            }
        }

        const proximo = getNextClaimReset(agora);
        const ms = Math.max(proximo.getTime() - agora.getTime(), 0);
        return { ms, minutos: Math.ceil(ms / 60000), origem: "agenda" };
    };

    DA.core = DA.core || {};
    DA.core.clock = {
        describeSchedule,
        isWithinSchedule,
        minutesUntilSchedule,
        updateClaimResetAgenda,
        getNextClaimReset,
        getLastClaimReset,
        getTimeToClaimReset,
        formatScheduleTime: formatarHorario,
        getClaimResetConfig
    };
})();
