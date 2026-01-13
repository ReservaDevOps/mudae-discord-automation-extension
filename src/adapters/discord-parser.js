(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});
    const { config, utils } = DA;
    const { normalizarTexto, minutosDeMatch, log } = utils;

    DA.adapters = DA.adapters || {};

    const getMessageAuthor = (node) => {
        if (!(node instanceof Element)) return null;
        const container =
            node.closest(".message__5126c") ||
            node.closest('div[id^="chat-messages-"]') ||
            node.closest('div[id^="message-accessories-"]');
        if (!container) return null;
        const usuario = container.querySelector(
            ".username_c19a55, .username_f9f2ca, [class^='username_'], [id^='message-username-'], .headerText_d9a90f"
        );
        return usuario?.textContent?.trim() ?? null;
    };

    const parseTuStatus = (texto) => {
        const normalized = normalizarTexto(texto);
        const status = {
            claimAvailable: null,
            claimCooldownMinutes: null,
            rollsLeft: null,
            nextRollResetMinutes: null,
            reactCooldownMinutes: null,
            reactAvailable: null,
            powerPercent: null,
            reactionPowerCostPercent: null,
            reactionPowerReducedCostPercent: null,
            stockKakera: null,
            stockSoulPoints: null,
            rtAvailable: false,
            rtCooldownMinutes: null,
            dailyAvailable: null,
            nextDailyMinutes: null,
            dkAvailable: null,
            nextDkMinutes: null,
            voteAvailable: null,
            nextVoteMinutes: null,
            ohLeft: null,
            ocLeft: null,
            oqLeft: null,
            refillMinutes: null
        };

        const claimMatch = normalized.match(/you can't claim for another\s+(?:(\d+)h\s+)?(\d+)\s*min/i);
        if (claimMatch) {
            status.claimAvailable = false;
            status.claimCooldownMinutes = minutosDeMatch(claimMatch);
        } else if (/you can claim/i.test(normalized)) {
            status.claimAvailable = true;
            status.claimCooldownMinutes = 0;
        }

        const rollsMatch = normalized.match(/you have\s+(\d+)\s+rolls left/i);
        if (rollsMatch) status.rollsLeft = Number(rollsMatch[1]);

        const rollsResetMatch = normalized.match(/next rolls reset in\s+(?:(\d+)h\s+)?(\d+)\s*min/i);
        status.nextRollResetMinutes = minutosDeMatch(rollsResetMatch);

        const reactMatch = normalized.match(/you can't react to kakera for\s+(?:(\d+)h\s+)?(\d+)\s*min/i);
        status.reactCooldownMinutes = minutosDeMatch(reactMatch);
        if (/you can react to kakera right now/i.test(normalized)) {
            status.reactAvailable = true;
            if (status.reactCooldownMinutes === null) status.reactCooldownMinutes = 0;
        } else if (Number.isFinite(status.reactCooldownMinutes)) {
            status.reactAvailable = status.reactCooldownMinutes <= 0;
        }

        const powerMatch = normalized.match(/power:\s*(\d+)%/i);
        status.powerPercent = powerMatch ? Number(powerMatch[1]) : null;
        const reactCostMatch = normalized.match(/each kakera button consumes\s*(\d+)%/i);
        status.reactionPowerCostPercent = reactCostMatch ? Number(reactCostMatch[1]) : null;
        const reactReducedMatch = normalized.match(/half the power\s*\((\d+)%\)/i);
        status.reactionPowerReducedCostPercent = reactReducedMatch ? Number(reactReducedMatch[1]) : null;

        const stockKakeraMatch = normalized.match(/stock:\s*([\d.,]+)\s*:kakera:/i);
        if (stockKakeraMatch) {
            status.stockKakera = Number(stockKakeraMatch[1].replace(/[^\d]/g, ""));
        } else {
            const stockMatch = normalized.match(/stock:\s*([\d.,]+)/i);
            if (stockMatch) status.stockKakera = Number(stockMatch[1].replace(/[^\d]/g, ""));
        }
        const stockSpMatch = normalized.match(/stock:\s*([\d.,]+)\s*:sp:/i);
        if (stockSpMatch) status.stockSoulPoints = Number(stockSpMatch[1].replace(/[^\d]/g, ""));

        const parseAvailability = (token) => {
            const result = { available: null, nextMinutes: null };
            const availableMatch = normalized.match(
                new RegExp(
                    `\\${token}\\s+is\\s+(?:available|ready)|you\\s+(?:can|may)\\s+use\\s+\\${token}(?!\\s+again in)`,
                    "i"
                )
            );
            if (availableMatch) result.available = true;

            const timeMatch = normalized.match(
                new RegExp(
                    `(?:next\\s+\\${token}(?:\\s+reset)?\\s+in|you\\s+(?:can|may)\\s+use\\s+\\${token}\\s+again\\s+in)\\s+(?:(\\d+)\\s*h\\s*)?(?:(\\d+)\\s*m(?:in(?:ute)?s?)?)?`,
                    "i"
                )
            );
            if (timeMatch && (timeMatch[1] || timeMatch[2])) {
                const horas = timeMatch[1] ? Number(timeMatch[1]) : 0;
                const minutos = timeMatch[2] ? Number(timeMatch[2]) : 0;
                const total = horas * 60 + minutos;
                if (Number.isFinite(total)) {
                    result.nextMinutes = total;
                    if (result.available !== true) {
                        result.available = total <= 0;
                    }
                }
            }
            return result;
        };

        const dailyInfo = parseAvailability("$daily");
        status.nextDailyMinutes = dailyInfo.nextMinutes;
        status.dailyAvailable = dailyInfo.available;

        const dkInfo = parseAvailability("$dk");
        status.nextDkMinutes = dkInfo.nextMinutes;
        status.dkAvailable = dkInfo.available;

        const voteMatch = normalized.match(/you (?:may|can) vote again in\s+(?:(\d+)h\s+)?(\d+)\s*min/i);
        status.nextVoteMinutes = minutosDeMatch(voteMatch);
        if (/you (?:may|can) vote right now/i.test(normalized)) {
            status.voteAvailable = true;
        } else if (Number.isFinite(status.nextVoteMinutes)) {
            status.voteAvailable = status.nextVoteMinutes <= 0;
        }

        status.rtAvailable = /\$rt\s+is\s+available/i.test(normalized);
        const rtCooldownMatch = normalized.match(/cooldown of \$rt is not over.*?time left:\s+(?:(\d+)h\s+)?(\d+)\s*min/i);
        status.rtCooldownMinutes = minutosDeMatch(rtCooldownMatch);
        if (Number.isFinite(status.rtCooldownMinutes) && status.rtCooldownMinutes > 0) {
            status.rtAvailable = false;
        }

        const oxMatch = normalized.match(/(\d+)\s+\$oh left for today,\s+(\d+)\s+\$oc\s+and\s+(\d+)\s+\$oq/i);
        if (oxMatch) {
            status.ohLeft = Number(oxMatch[1]);
            status.ocLeft = Number(oxMatch[2]);
            status.oqLeft = Number(oxMatch[3]);
        }
        const refillMatch = normalized.match(/(?:(\d+)h\s+)?(\d+)\s*min before the refill/i);
        status.refillMinutes = minutosDeMatch(refillMatch);

        if (status.rollsLeft === null && status.claimAvailable === null) return null;
        return status;
    };

    const extractLastNumber = (texto) => {
        if (!texto) return null;
        const matches = [...String(texto).matchAll(/(\d[\d.,]*)/g)];
        if (!matches.length) return null;
        const bruto = matches[matches.length - 1][1];
        const digits = bruto.replace(/[^\d]/g, "");
        if (!digits) return null;
        return Number(digits);
    };

    const extractTextBeforeEmoji = (container, emoji) => {
        if (!container || !emoji) return "";
        try {
            const range = document.createRange();
            range.setStart(container, 0);
            range.setEndBefore(emoji);
            return range.toString();
        } catch {
            return "";
        }
    };

    const extractKakeraValue = (container, emojiNode) => {
        const emoji = emojiNode || container.querySelector(`[data-id="${config.kakeraEmojiId}"]`);
        if (!emoji) return null;

        const textoAntes = extractTextBeforeEmoji(container, emoji);
        const valorAntes = extractLastNumber(textoAntes);
        if (valorAntes !== null) return valorAntes;

        const holder = emoji.closest("span") || emoji.parentElement;
        const arredores = [holder?.previousSibling, emoji.previousSibling, holder?.previousElementSibling]
            .map((n) => n?.textContent ?? n?.data ?? "")
            .filter(Boolean);

        for (const trecho of arredores) {
            const valor = extractLastNumber(trecho);
            if (valor !== null) return valor;
        }

        const valorTextoCompleto = extractLastNumber(container.textContent ?? "");
        if (valorTextoCompleto !== null) return valorTextoCompleto;

        log("Emoji de kakera encontrado, mas não consegui extrair valor.");
        return null;
    };

    const findReactionButtons = (descricao) => {
        if (!(descricao instanceof Element)) return [];
        const raizMensagem =
            descricao.closest(".message__5126c") ||
            descricao.closest('div[id^="chat-messages-"]') ||
            descricao.closest('div[id^="message-accessories-"]');

        if (!raizMensagem) return [];

        const accessories = raizMensagem.querySelector('div[id^="message-accessories-"]') || raizMensagem;
        const candidatos = Array.from(accessories.querySelectorAll("button"));
        return candidatos.filter((botao) => {
            if (botao.matches("button.button__201d5.lookFilled__201d5")) return true;
            if (botao.matches("button[class*='lookFilled']")) return true;
            return !!botao.querySelector("img.emoji");
        });
    };

    const detectReactionByIcon = (descricao) => {
        if (!(descricao instanceof Element)) return null;
        const botoes = findReactionButtons(descricao);
        if (!botoes.length) return null;

        const botoesComEmoji = botoes
            .map((botao) => ({
                botao,
                emoji: botao.querySelector("img.emoji, div[role='img']")
            }))
            .filter((item) => item.emoji);

        if (botoesComEmoji.length !== 1) return null;

        const { botao, emoji } = botoesComEmoji[0];
        const nomeEmoji =
            emoji.getAttribute("data-name") ||
            emoji.getAttribute("aria-label") ||
            emoji.getAttribute("alt") ||
            emoji.textContent ||
            "";

        const normalizedName = (nomeEmoji || "").replace(/\s+/g, "");
        const isCoracaoPadrao = /❤️|❤|♥/u.test(normalizedName);

        if (isCoracaoPadrao) return null;

        return { botao, emojiNome: nomeEmoji || "emoji desconhecido" };
    };

    const findReactionButton = (descricao) => {
        if (!(descricao instanceof Element)) return null;
        const raizMensagem =
            descricao.closest(".message__5126c") ||
            descricao.closest('div[id^="chat-messages-"]') ||
            descricao.closest('div[id^="message-accessories-"]');

        if (!raizMensagem) return null;

        return raizMensagem.querySelector('button.button__201d5.lookFilled__201d5');
    };

    DA.adapters.parser = {
        getMessageAuthor,
        parseTuStatus,
        extractLastNumber,
        extractTextBeforeEmoji,
        extractKakeraValue,
        findReactionButtons,
        detectReactionByIcon,
        findReactionButton
    };
})();
