// Token Image Swap (simple) — v1.0.0
// SilverGlad & ChatGPT
const MODULE_ID = "token-image-swap";
const fu = foundry.utils;

// Flags: guardamos a lista de imagens no ATOR
const FLAG_SCOPE = MODULE_ID;
const FLAG_KEY = "images"; // array<string> com paths

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);

  // Preferências padrão (o usuário pode alterar no diálogo a cada uso)
  game.settings.register(MODULE_ID, "defaultUpdatePortrait", {
    name: "Atualizar retrato da ficha por padrão",
    hint: "Ao trocar a imagem do token, também aplicar no retrato do ator (img).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "defaultUpdatePrototype", {
    name: "Salvar no prototype por padrão",
    hint: "Ao trocar a imagem do token, também atualizar o prototypeToken.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // Atalho: Alt+I → alterna para a próxima imagem (se existir)
  game.keybindings.register(MODULE_ID, "cycle-next", {
    name: "Token Image Swap: Alternar para a próxima imagem",
    hint: "Com 1 token selecionado, alterna para a próxima imagem configurada para o ator.",
    editable: [{ key: "KeyI", modifiers: ["Alt"] }],
    onDown: () => cycleSelectedTokenNextImage(),
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
});

/** Adiciona o botão na HUD do token */
Hooks.on("renderTokenHUD", (app, html) => {
  try {
    const token = app.object; // PlaceableObject
    const actor = token?.actor;
    if (!actor) return;

    // Evita duplicar botão ao re-renderizar
    if (html.find(`.${MODULE_ID}-btn`).length) return;

    // Botão na coluna esquerda da HUD
    const btn = document.createElement("div");
    btn.classList.add("control-icon", `${MODULE_ID}-btn`);
    btn.title = "Trocar imagem do token";
    btn.innerHTML = `<i class="fas fa-images"></i>`;

    const leftCol = html[0].querySelector(".col.left");
    if (!leftCol) return;
    leftCol.appendChild(btn);

    // Clique: abre o diálogo
    btn.addEventListener("click", () => {
      new ImageSwapDialog(actor, token.document).render(true);
    });

    // Clique direito: alterna para próxima imagem (qualquer lista existente)
    btn.addEventListener("contextmenu", async (ev) => {
      ev.preventDefault();
      await cycleTokenNextImage(actor, token.document);
    });
  } catch (e) {
    console.error(`${MODULE_ID} | HUD error`, e);
  }
});

/** Util: ler/gravar imagens no flag do ator */
async function getImages(actor) {
  const arr = actor.getFlag(FLAG_SCOPE, FLAG_KEY) || [];
  return fu.duplicate(arr);
}
async function setImages(actor, arr) {
  return actor.setFlag(FLAG_SCOPE, FLAG_KEY, arr || []);
}

/** Alterna para a próxima imagem cadastrada (ordem da lista) */
async function cycleTokenNextImage(actor, tokenDoc) {
  const list = await getImages(actor);
  if (!list.length) {
    ui.notifications.warn("Nenhuma imagem cadastrada neste ator.");
    return;
  }
  const current = tokenDoc.texture?.src;
  let idx = list.indexOf(current);
  if (idx === -1) idx = 0; else idx = (idx + 1) % list.length;
  const next = list[idx];

  try {
    await tokenDoc.update({ "texture.src": next });
    ui.notifications.info(`Imagem aplicada: ${next.split("/").pop()}`);
  } catch (e) {
    console.error(e);
    ui.notifications.error("Não foi possível aplicar a imagem (permissões?).");
  }
}

/** Alterna para a próxima imagem do primeiro token selecionado */
async function cycleSelectedTokenNextImage() {
  const tok = canvas?.tokens?.controlled?.[0];
  if (!tok) return ui.notifications.warn("Selecione 1 token.");
  return cycleTokenNextImage(tok.actor, tok.document);
}

/** Dialog simples com lista de imagens + adicionar/remover + opções */
class ImageSwapDialog extends Application {
  static get defaultOptions() {
    return fu.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-dialog`,
      title: "Token Image Swap",
      template: null, // vamos montar manualmente
      width: 440,
      height: "auto",
      classes: [MODULE_ID, "image-swap-dialog"],
      resizable: true
    });
  }

  /** @param {Actor} actor @param {TokenDocument} tokenDoc */
  constructor(actor, tokenDoc, options = {}) {
    super(options);
    this.actor = actor;
    this.tokenDoc = tokenDoc;
    this.images = [];
    this.updatePortrait = game.settings.get(MODULE_ID, "defaultUpdatePortrait");
    this.updatePrototype = game.settings.get(MODULE_ID, "defaultUpdatePrototype");
  }

  async getData() {
    this.images = await getImages(this.actor);
    return {
      images: this.images,
      actorName: this.actor.name,
      updatePortrait: this.updatePortrait,
      updatePrototype: this.updatePrototype
    };
  }

  /** Render do HTML (sem template externo) */
  async _renderInner(data) {
    const wrap = document.createElement("div");
    wrap.classList.add(`${MODULE_ID}-content`);
    wrap.innerHTML = `
      <div class="header">
        <b>${fu.escapeHTML(this.actor.name)}</b>
      </div>
      <div class="options">
        <label><input type="checkbox" name="updatePortrait" ${this.updatePortrait ? "checked" : ""}/> Atualizar retrato da ficha</label>
        <label><input type="checkbox" name="updatePrototype" ${this.updatePrototype ? "checked" : ""}/> Salvar no prototype</label>
      </div>
      <div class="list"></div>
      <div class="actions">
        <button type="button" class="add"><i class="fas fa-plus"></i> Adicionar</button>
        <button type="button" class="cycle"><i class="fas fa-sync-alt"></i> Alternar</button>
        <button type="button" class="close"><i class="fas fa-times"></i> Fechar</button>
      </div>
    `;

    const list = wrap.querySelector(".list");
    if (!this.images?.length) {
      list.innerHTML = `<p class="empty">Nenhuma imagem adicionada ainda.</p>`;
    } else {
      for (const img of this.images) {
        const card = document.createElement("div");
        card.classList.add("img-item");
        card.dataset.img = img;
        card.innerHTML = `
          <img src="${img}" title="${fu.escapeHTML(img)}"/>
          <div class="row">
            <button type="button" class="apply"><i class="fas fa-check"></i> Usar</button>
            <button type="button" class="remove" title="Remover"><i class="fas fa-trash"></i></button>
          </div>
        `;
        list.appendChild(card);
      }
    }
    return wrap;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];

    root.querySelector('input[name="updatePortrait"]').addEventListener("change", (ev) => {
      this.updatePortrait = ev.currentTarget.checked;
    });
    root.querySelector('input[name="updatePrototype"]').addEventListener("change", (ev) => {
      this.updatePrototype = ev.currentTarget.checked;
    });

    root.querySelector(".actions .close").addEventListener("click", () => this.close());

    // Adicionar imagem via FilePicker
    root.querySelector(".actions .add").addEventListener("click", () => {
      new FilePicker({
        type: "image",
        callback: async (path) => {
          this.images.push(path);
          await setImages(this.actor, this.images);
          this.render(true);
        }
      }).render(true);
    });

    // Alternar (próxima) direto pela janela
    root.querySelector(".actions .cycle").addEventListener("click", async () => {
      await cycleTokenNextImage(this.actor, this.tokenDoc);
      this.close();
    });

    // Delegação para botões nos cards
    root.querySelectorAll(".img-item .remove").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        const path = ev.currentTarget.closest(".img-item").dataset.img;
        this.images = this.images.filter((p) => p !== path);
        await setImages(this.actor, this.images);
        this.render(true);
      });
    });

    root.querySelectorAll(".img-item .apply").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        const path = ev.currentTarget.closest(".img-item").dataset.img;
        await this.applyImage(path);
      });
    });
  }

  async applyImage(path) {
    const ops = [];

    // Atualiza token na cena
    ops.push(this.tokenDoc.update({ "texture.src": path }));

    // Retrato do ator (opcional)
    if (this.updatePortrait) ops.push(this.actor.update({ img: path }));

    // Prototype (opcional) — pode exigir permissão de GM
    if (this.updatePrototype) ops.push(this.actor.prototypeToken.update({ "texture.src": path }));

    try {
      await Promise.all(ops);
      ui.notifications.info(`Imagem aplicada: ${path.split("/").pop()}`);
      this.close();
    } catch (e) {
      console.error(e);
      ui.notifications.error("Não foi possível aplicar a imagem (permissões?).");
    }
  }
}
