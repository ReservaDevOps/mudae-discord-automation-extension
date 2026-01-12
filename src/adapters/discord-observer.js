(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});
    const { config, state, selectors, utils } = DA;
    const { log } = utils;

    DA.adapters = DA.adapters || {};
    const core = DA.core;
    const parser = DA.adapters.parser;

    const processKakeraEmbed = (node) => {
        if (!(node instanceof HTMLElement)) return;
        if (!core.clock.isWithinSchedule()) return;

        const descricao = node.matches(selectors.embedDescription)
            ? node
            : node.querySelector(selectors.embedDescription);
        const emoji = node.querySelector(`[data-id="${config.kakeraEmojiId}"]`);

        if (!descricao && !emoji) return;

        const messageContainer = (descricao || emoji)?.closest(selectors.messageContainer) || node.closest(selectors.messageContainer);
        const messageId = messageContainer?.id || messageContainer?.getAttribute("data-list-item-id");
        const containerValor = descricao || emoji?.closest(selectors.embedDescription) || emoji?.closest("div") || node;
        const jaProcessado =
            (messageId && state.embedsProcessados.has(messageId)) ||
            (containerValor?.dataset && containerValor.dataset.kakeraProcessed === "1");

        if (jaProcessado) return;

        const valor = parser.extractKakeraValue(containerValor, emoji);
        if (valor === null || Number.isNaN(valor)) return;
        core.rollSession.updateSessionEvent("roll");

        const botoesReacao = parser.findReactionButtons(descricao || containerValor || node);
        const reacaoPorIcone = parser.detectReactionByIcon(descricao || containerValor || node);
        if (!botoesReacao.length && !reacaoPorIcone) return;

        let botaoParaClicar = null;
        let motivoReacao = "";
        let reacaoEspecial = false;
        let usarResetClaimTimer = false;

        if (reacaoPorIcone) {
            const cooldown = core.reaction.canReactNow();
            if (!cooldown.ok) {
                log(`[Kakera] Reação em cooldown por ${Math.ceil(cooldown.restanteMs / 60000)} min, ignorando.`);
                return;
            }
            botaoParaClicar = reacaoPorIcone.botao;
            const emojiNome = reacaoPorIcone.emojiNome || "ícone especial";
            motivoReacao = `ícone especial (${emojiNome})`;
            reacaoEspecial = true;
        }

        if (messageId) state.embedsProcessados.add(messageId);
        if (!messageId && containerValor?.dataset) containerValor.dataset.kakeraProcessed = "1";
        log(`Valor do kakera detectado: ${valor}`);

        if (!reacaoEspecial) {
            const agora = new Date();
            const status = state.ultimoTuStatus;
            const podeClaim = core.claim.canAttemptClaim(status, agora);
            const resetCheck = core.claim.canResetClaimTimer(status);
            const podeUsarReset = resetCheck.ok && status?.claimAvailable !== true && !state.reacaoPendente;

            if (!podeClaim.ok && !podeUsarReset) {
                log(`[Kakera] Claim indisponível (${podeClaim.motivo}), ignorando reação.`);
                return;
            }

            const limites = core.claim.getClaimLimits();
            const limiteRt = limites.hour1;
            const { limite: limiteKakeraAtual, fase } = core.policies.getCurrentKakeraLimit();
            const limiteKakera = podeUsarReset ? limiteRt : limiteKakeraAtual;
            const faseInfo = podeUsarReset ? ", limite hora-1" : fase ? `, fase ${fase}` : "";

            if (valor > limiteKakera) {
                if (botoesReacao.length === 1) {
                    botaoParaClicar = botoesReacao[0];
                    usarResetClaimTimer = podeUsarReset;
                    const infoReset = usarResetClaimTimer ? ", usando $rt" : "";
                    motivoReacao = `kakera alto (${valor}, limite ${limiteKakera}${faseInfo}${infoReset})`;
                } else if (botoesReacao.length === 0) {
                    log("Botão de reação não encontrado para kakera alto.");
                } else {
                    log("Ignorando kakera alto: múltiplos botões de reação encontrados.");
                }
            }

            const sessao = state.rollSession;
            const fallbackAtivo = sessao?.ativa && sessao.forceClaimFallback === true;
            if (fallbackAtivo && podeClaim.ok && botoesReacao.length === 1) {
                core.rollSession.registerFallbackCandidate({
                    botao: botoesReacao[0],
                    valor,
                    score: valor,
                    motivo: `fallback ultima rodada (${valor})`,
                    criadoEm: Date.now(),
                    usaResetClaimTimer: false
                });
            }
        }

        if (botaoParaClicar) {
            if (reacaoEspecial) {
                botaoParaClicar.click();
                log(`Reagindo automaticamente: ${motivoReacao}.`);
                if (!state.reacaoPendente) {
                    core.reaction.startRetry(botaoParaClicar, motivoReacao);
                }
                return;
            }
            const sessao = state.rollSession;
            if (sessao?.ativa) {
                const score = reacaoEspecial ? Number.POSITIVE_INFINITY : valor;
                core.rollSession.registerClaimCandidate({
                    botao: botaoParaClicar,
                    valor,
                    score,
                    motivo: motivoReacao,
                    criadoEm: Date.now(),
                    usaResetClaimTimer: usarResetClaimTimer
                });
            } else {
                if (usarResetClaimTimer) {
                    const ok = core.claim.executeClaimWithReset({
                        botao: botaoParaClicar,
                        valor,
                        score: valor,
                        motivo: motivoReacao,
                        criadoEm: Date.now(),
                        usaResetClaimTimer: true
                    });
                    if (!ok) return;
                } else {
                    botaoParaClicar.click();
                    log(`Reagindo automaticamente: ${motivoReacao}.`);
                    core.reaction.startRetry(botaoParaClicar, motivoReacao);
                }
            }
        }
    };

    const processMessage = (node) => {
        if (!node?.innerText) return;
        if (!node.id?.startsWith("message-content-")) return;
        if (state.mensagensProcessadas.has(node.id)) return;

        state.mensagensProcessadas.add(node.id);

        const texto = node.innerText.trim();
        const autor = parser.getMessageAuthor(node);

        core.reaction.detectConfirmation(texto);
        core.rollsReset.trackRollsMessage(node, texto, autor);

        if (texto.includes(config.palavraChave)) {
            log("Detectei a palavra-chave:", config.palavraChave);
            log("Mensagem:", texto);
        }

        core.tu.processTuMessage(texto, autor);
    };

    const startObserver = () => {
        const alvo = document.body;

        if (!alvo) {
            log("document.body ainda não disponível, tentando de novo...");
            setTimeout(startObserver, 1000);
            return;
        }

        log("Iniciando MutationObserver para novas mensagens...");

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof HTMLElement)) return;

                    if (node.id && node.id.startsWith("message-content-")) {
                        processMessage(node);
                    }

                    const internos = node.querySelectorAll('div[id^="message-content-"]');
                    internos.forEach((msg) => processMessage(msg));

                    core.rollsReset.detectRollsConfirmation(node);

                    processKakeraEmbed(node);
                    const embeds = node.querySelectorAll(selectors.embedDescription);
                    embeds.forEach((embed) => processKakeraEmbed(embed));
                });
            }
        });

        observer.observe(alvo, {
            childList: true,
            subtree: true
        });
    };

    DA.adapters.observer = {
        startObserver,
        processMessage,
        processKakeraEmbed
    };
})();
