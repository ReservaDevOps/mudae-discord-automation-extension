(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});
    const { utils } = DA;
    const { log } = utils;

    DA.adapters = DA.adapters || {};

    const findChatInput = () => document.querySelector('[data-slate-editor="true"][role="textbox"]');

    const clearEditor = (editor) => {
        if (!editor) return;

        const textoAtual = editor.textContent || "";
        if (!textoAtual.length) return;

        const selectAllDown = new KeyboardEvent("keydown", {
            key: "a",
            code: "KeyA",
            which: 65,
            keyCode: 65,
            ctrlKey: true,
            metaKey: navigator.platform.includes("Mac"),
            bubbles: true,
            cancelable: true,
            composed: true
        });
        const selectAllUp = new KeyboardEvent("keyup", {
            key: "a",
            code: "KeyA",
            which: 65,
            keyCode: 65,
            ctrlKey: true,
            metaKey: navigator.platform.includes("Mac"),
            bubbles: true,
            cancelable: true,
            composed: true
        });
        editor.dispatchEvent(selectAllDown);
        editor.dispatchEvent(selectAllUp);

        const before = new InputEvent("beforeinput", {
            inputType: "deleteContentBackward",
            bubbles: true,
            cancelable: true
        });
        const input = new InputEvent("input", {
            inputType: "deleteContentBackward",
            bubbles: true,
            cancelable: true
        });
        editor.dispatchEvent(before);
        editor.dispatchEvent(input);
    };

    const typeText = (editor, texto) => {
        if (!editor) return false;
        for (const char of texto) {
            const keyCode = char.charCodeAt(0);
            const keyOpts = {
                key: char,
                code: /[a-z]/i.test(char) ? `Key${char.toUpperCase()}` : undefined,
                which: keyCode,
                keyCode,
                bubbles: true,
                cancelable: true,
                composed: true
            };
            const keydown = new KeyboardEvent("keydown", keyOpts);
            const keypress = new KeyboardEvent("keypress", keyOpts);
            const before = new InputEvent("beforeinput", {
                data: char,
                inputType: "insertText",
                bubbles: true,
                cancelable: true
            });
            const input = new InputEvent("input", {
                data: char,
                inputType: "insertText",
                bubbles: true,
                cancelable: true
            });
            const keyup = new KeyboardEvent("keyup", keyOpts);

            editor.dispatchEvent(keydown);
            editor.dispatchEvent(keypress);
            editor.dispatchEvent(before);
            editor.dispatchEvent(input);
            editor.dispatchEvent(keyup);
        }
        return true;
    };

    const sendCommand = (comando) => {
        const editor = findChatInput();
        if (!editor) {
            log("Editor do chat não encontrado para enviar comando:", comando);
            return false;
        }

        if (document.activeElement === editor && editor.textContent.trim().length > 0) {
            log("Editor em uso pelo usuário; pulando envio automático:", comando);
            return false;
        }

        editor.focus({ preventScroll: true });

        if (editor.textContent.trim().length > 0) {
            clearEditor(editor);
        }

        const digitado = typeText(editor, comando);
        if (!digitado) return false;

        const keydown = new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            which: 13,
            keyCode: 13,
            bubbles: true,
            cancelable: true,
            composed: true
        });
        const keypress = new KeyboardEvent("keypress", {
            key: "Enter",
            code: "Enter",
            which: 13,
            keyCode: 13,
            bubbles: true,
            cancelable: true,
            composed: true
        });
        const keyup = new KeyboardEvent("keyup", {
            key: "Enter",
            code: "Enter",
            which: 13,
            keyCode: 13,
            bubbles: true,
            cancelable: true,
            composed: true
        });

        editor.dispatchEvent(keydown);
        editor.dispatchEvent(keypress);
        editor.dispatchEvent(keyup);

        setTimeout(() => clearEditor(editor), 50);

        log(`Comando enviado: ${comando}`);
        return true;
    };

    DA.adapters.actions = {
        findChatInput,
        clearEditor,
        typeText,
        sendCommand
    };
})();
