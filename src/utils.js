(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});

    const log = (...args) => {
        const agora = new Date();
        const mm = String(agora.getMinutes()).padStart(2, "0");
        const ss = String(agora.getSeconds()).padStart(2, "0");
        console.log(`[Discord Automação ${mm}:${ss}]`, ...args);
    };

    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const normalizarTexto = (texto) => String(texto || "").replace(/\s+/g, " ").trim();

    const minutosDesdeMeiaNoite = (date = new Date()) => date.getHours() * 60 + date.getMinutes();

    function horarioParaMinutos(horario, fallbackMinutos) {
        if (typeof horario === "number" && Number.isFinite(horario)) {
            const minutos = Math.floor(horario);
            if (minutos >= 0 && minutos < 24 * 60) return minutos;
        }

        if (typeof horario === "string") {
            const match = horario.trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/);
            if (match) {
                let horas = Number(match[1]);
                const minutos = Number(match[2] ?? 0);
                if (horas === 24 && minutos === 0) horas = 0;
                if (horas >= 0 && horas < 24 && minutos >= 0 && minutos < 60) {
                    return horas * 60 + minutos;
                }
            }
        }

        return fallbackMinutos;
    }

    function formatarHorarioMinutos(minutos) {
        const normalizado = ((minutos % 1440) + 1440) % 1440;
        const horas = Math.floor(normalizado / 60);
        const mins = normalizado % 60;
        return `${String(horas).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    }

    function formatarHorario(date = new Date()) {
        return formatarHorarioMinutos(minutosDesdeMeiaNoite(date));
    }

    function clampInt(valor, min, max, fallback) {
        const num = Number(valor);
        if (!Number.isFinite(num)) return fallback;
        return Math.min(Math.max(Math.floor(num), min), max);
    }

    function normalizarHora(valor, fallback) {
        const base = clampInt(valor, -24 * 7, 24 * 7, fallback);
        if (!Number.isFinite(base)) return fallback;
        return ((base % 24) + 24) % 24;
    }

    function minutosDeMatch(match) {
        if (!match) return null;
        const horas = Number(match[1] ?? 0);
        const minutos = Number(match[2] ?? 0);
        return horas * 60 + minutos;
    }

    DA.utils = {
        log,
        randomInt,
        normalizarTexto,
        minutosDesdeMeiaNoite,
        horarioParaMinutos,
        formatarHorarioMinutos,
        formatarHorario,
        clampInt,
        normalizarHora,
        minutosDeMatch
    };
})();
