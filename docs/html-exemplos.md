# Exemplos de HTML (Discord Web)

Este arquivo documenta a estrutura de mensagens que aparecem como resposta do `$wa`, para ajudar a manter os seletores da extensao estaveis quando as classes mudam.

## Resposta tipica do `$wa` (rolagem)
Pontos importantes:
- O conteudo do texto pode vir vazio (`div#message-content-*`), e o resultado aparece no embed dentro de `div#message-accessories-*`.
- A descricao do embed usa classes com hash, mas sempre contem o sufixo `embedDescription`.
- O valor de kakera fica antes do emoji; o emoji tem `data-id` fixo (configuravel no `CONFIG.kakeraEmojiId`).
- Os botoes de reacao geralmente usam uma classe contendo `lookFilled` e trazem um `img.emoji`.

Exemplo reduzido (focado nos elementos relevantes):
```html
<article data-list-item-id="chat-messages__...">
  <div id="message-content-..."></div>
  <div id="message-accessories-...">
    <article class="_623de...-embed">
      <div class="_623de...-embedDescription">
        <span>Akikan!</span>
        <strong><span>28</span></strong>
        <span class="...-emojiContainer">
          <img class="emoji"
               data-id="469835869059153940"
               data-name=":kakera:"
               alt=":kakera:" />
        </span>
      </div>
    </article>
    <button class="_201d5...-button _201d5...-lookFilled">
      <img class="emoji" data-name="❤️" alt="❤️" />
    </button>
  </div>
</article>
```

## Seletores recomendados
- Embed description: `*[class*="embedDescription"]`
- Emoji kakera: `img.emoji[data-id="<KAKERA_EMOJI_ID>"]`
- Botoes de reacao: `button[class*="lookFilled"] img.emoji`

## Observacao sobre classes
As classes do Discord mudam com frequencia e sao hasheadas. Evite seletores rigidos e prefira:
- `class*="embedDescription"` para o bloco de descricao.
- `class*="lookFilled"` para botoes de reacao.
- `data-id` e `data-name` para identificar emojis.
