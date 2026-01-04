(() => {
    const DA = (globalThis.DiscordAutomation = globalThis.DiscordAutomation || {});
    const { utils } = DA;

    utils.log("Content script carregado!");

    window.addEventListener("load", () => {
        utils.log("Página carregada, iniciando observador.");
        DA.adapters.observer.startObserver();
        DA.core.tu.scheduleTu(15000);
    });
})();
