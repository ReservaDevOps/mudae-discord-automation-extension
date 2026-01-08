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
            powerPercent: null,
            stockKakera: null,
            rtAvailable: false,
            nextDailyMinutes: null,
            nextDkMinutes: null,
            nextVoteMinutes: null
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

        const powerMatch = normalized.match(/power:\s*(\d+)%/i);
        status.powerPercent = powerMatch ? Number(powerMatch[1]) : null;

        const stockMatch = normalized.match(/stock:\s*([\d.,]+)/i);
        if (stockMatch) status.stockKakera = Number(stockMatch[1].replace(/[^\d]/g, ""));

        const dailyMatch = normalized.match(/next \$daily reset in\s+(?:(\d+)h\s+)?(\d+)\s*min/i);
        status.nextDailyMinutes = minutosDeMatch(dailyMatch);

        const dkMatch = normalized.match(/next \$dk in\s+(?:(\d+)h\s+)?(\d+)\s*min/i);
        status.nextDkMinutes = minutosDeMatch(dkMatch);

        const voteMatch = normalized.match(/you may vote again in\s+(?:(\d+)h\s+)?(\d+)\s*min/i);
        status.nextVoteMinutes = minutosDeMatch(voteMatch);

        status.rtAvailable = /\$rt\s+is\s+available/i.test(normalized);

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
