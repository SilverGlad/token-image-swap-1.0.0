// Token Image Swap (simple) — v1.0.1 (Dialog-based)
// SilverGlad & ChatGPT
const MODULE_ID = "token-image-swap";
const fu = foundry.utils;
const FLAG_SCOPE = MODULE_ID;
const FLAG_KEY = "images";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init v1.0.1`);

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

  // API pública simples (opcional)
  const api = {
    async open(actor, tokenDoc) { return openDialog(actor, tokenDoc); },
    async add(actor, path) { return addImageToActor(actor, path); },
    async cycle(actor, tokenDoc) { return cycleTokenNextImage(actor, tokenDoc); }
  };
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = api;
});

Hooks.on("renderTokenHUD", (app, html) => {
  const token = app.object;
  const actor = token?.actor;
  if (!actor) return;
  if (html.find(`.${MODULE_ID}-btn`).length) return;

  const btn = document.createElement("div");
  btn.classList.add("control-icon", `${MODULE_ID}-btn`);
  btn.title = "Token Image Swap";
  btn.innerHTML = `<i class="fas fa-images"></i>`;

  const root = html?.[0] ?? html?.element?.[0] ?? html?.element?.get?.(0);
  const col = root?.querySelector(".col.left") || root?.querySelector(".col.right");
  if (!col) return;
  col.appendChild(btn);

  // Clique ESQUERDO: abre a janela; Shift+Clique: adiciona imagem atual
  btn.addEventListener("click", (ev) => {
    if (ev.shiftKey) {
      const current = token.document.texture?.src ?? token.document.img;
      quickAddCurrent(actor, current);
      return;
    }
    openDialog(actor, token.document);
  });

  // Clique DIREITO: alterna p/ próxima imagem
  btn.addEventListener("contextmenu", async (ev) => {
    ev.preventDefault();
    await cycleTokenNextImage(actor, token.document);
  });
});

// ===== helpers de flags =====
async function getImages(actor) {
  const arr = actor.getFlag(FLAG_SCOPE, FLAG_KEY) || [];
  return fu.duplicate(arr);
}
async function setImages(actor, arr) {
  return actor.setFlag(FLAG_SCOPE, FLAG_KEY, arr || []);
}
async function addImageToActor(actor, path) {
  const list = await getImages(actor);
  if (!list.includes(path)) list.push(path);
  await setImages(actor, list);
  return list;
}
async function quickAddCurrent(actor, current) {
  await addImageToActor(actor, current);
  ui.notifications.info("Imagem atual adicionada na lista.");
}

async function cycleTokenNextImage(actor, tokenDoc) {
  const list = await getImages(actor);
  if (!list.length) return ui.notifications.warn("Nenhuma imagem cadastrada neste ator.");
  const current = tokenDoc.texture?.src ?? tokenDoc.img;
  let idx = list.indexOf(current);
  idx = (idx === -1) ? 0 : (idx + 1) % list.length;
  const next = list[idx];
  try {
    await tokenDoc.update({ "texture.src": next });
    ui.notifications.info(`Imagem aplicada: ${next.split("/").pop()}`);
  } catch (e) {
    console.error(e);
    ui.notifications.error("Não foi possível aplicar a imagem (permissões?).");
  }
}

async function openDialog(actor, tokenDoc) {
  const state = {
    updatePortrait: game.settings.get(MODULE_ID, "defaultUpdatePortrait"),
    updatePrototype: game.settings.get(MODULE_ID, "defaultUpdatePrototype"),
    images: await getImages(actor)
  };

  const buildList = () => {
    if (!state.images.length) return `<p class="empty">Nenhuma imagem adicionada ainda.</p>`;
    return state.images.map(img => `
      <div class="img-item" data-img="${fu.escapeHTML(img)}">
        <img src="${fu.escapeHTML(img)}" title="${fu.escapeHTML(img)}"/>
        <div class="row">
          <button type="button" class="apply"><i class="fas fa-check"></i> Usar</button>
          <button type="button" class="remove" title="Remover"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join("");
  };

  const content = `
    <div class="${MODULE_ID}-content image-swap-dialog">
      <div class="header"><b>${fu.escapeHTML(actor.name)}</b></div>
      <div class="options">
        <label><input type="checkbox" name="updatePortrait" ${state.updatePortrait ? "checked" : ""}/> Atualizar retrato da ficha</label>
        <label><input type="checkbox" name="updatePrototype" ${state.updatePrototype ? "checked" : ""}/> Salvar no prototype</label>
      </div>
      <div class="list">${buildList()}</div>
      <div class="actions">
        <button type="button" data-action="add"><i class="fas fa-plus"></i> Adicionar</button>
        <button type="button" data-action="cycle"><i class="fas fa-sync-alt"></i> Alternar</button>
      </div>
      <p class="hint">Dica: Shift+Clique no botão da HUD adiciona a <i>imagem atual</i> à lista.</p>
    </div>
  `;

  const dlg = new Dialog({
    title: "Token Image Swap",
    content,
    buttons: {},
    default: null,
    render: (html) => {
      const root = html[0].querySelector(`.${MODULE_ID}-content`);
      const refresh = () => {
        root.querySelector(".list").innerHTML = buildList();
        attachListHandlers();
      };
      const attachListHandlers = () => {
        root.querySelectorAll(".img-item .remove").forEach((btn) => {
          btn.addEventListener("click", async (ev) => {
            const path = ev.currentTarget.closest(".img-item").dataset.img;
            state.images = state.images.filter(p => p !== path);
            await setImages(actor, state.images);
            refresh();
          });
        });
        root.querySelectorAll(".img-item .apply").forEach((btn) => {
          btn.addEventListener("click", async (ev) => {
            const path = ev.currentTarget.closest(".img-item").dataset.img;
            applyImage(actor, tokenDoc, path, state.updatePortrait, state.updatePrototype);
            dlg.close();
          });
        });
      };

      // Options
      root.querySelector('input[name="updatePortrait"]').addEventListener("change", (ev) => {
        state.updatePortrait = ev.currentTarget.checked;
      });
      root.querySelector('input[name="updatePrototype"]').addEventListener("change", (ev) => {
        state.updatePrototype = ev.currentTarget.checked;
      });

      // Actions
      root.querySelector('[data-action="add"]').addEventListener("click", () => {
        new FilePicker({
          type: "image",
          callback: async (path) => {
            state.images = await addImageToActor(actor, path);
            refresh();
          }
        }).render(true);
      });
      root.querySelector('[data-action="cycle"]').addEventListener("click", async () => {
        await cycleTokenNextImage(actor, tokenDoc);
        dlg.close();
      });

      attachListHandlers();
    }
  }, { width: 480, height: "auto", jQuery: true });
  dlg.render(true);
}

async function applyImage(actor, tokenDoc, path, updatePortrait, updatePrototype) {
  const ops = [ tokenDoc.update({ "texture.src": path }) ];
  if (updatePortrait) ops.push(actor.update({ img: path }));
  if (updatePrototype) ops.push(actor.prototypeToken.update({ "texture.src": path }));
  try {
    await Promise.all(ops);
    ui.notifications.info(`Imagem aplicada: ${path.split("/").pop()}`);
  } catch (e) {
    console.error(e);
    ui.notifications.error("Não foi possível aplicar a imagem (permissões?).");
  }
}
