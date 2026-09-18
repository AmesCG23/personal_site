// app.js — wires the pieces together.
import * as S from "./state.js";
import * as C from "./catalog.js";
import * as UI from "./ui.js";

const $ = (sel) => document.querySelector(sel);

async function main() {
  try {
    await C.loadCatalog();
  } catch (e) {
    $("#board-empty").textContent = "Couldn't load the token list (data/tokens.json). Reload the page.";
    console.error(e);
    return;
  }
  UI.renderPalette();
  UI.bindBoard();
  UI.bindTray();

  S.onChange((state) => { UI.renderBoard(state); UI.renderChrome(state); });
  S.init();

  $("#btn-undo").onclick = () => S.undo();
  $("#btn-next").onclick = () => { S.nextTurn(); UI.toast(`Turn ${S.state.turn}: everything untapped.`); };
  $("#btn-more").onclick = () => UI.moreMenu();
  $("#btn-any").onclick = () => UI.searchSheet();
  $("#btn-custom").onclick = () => UI.editSheet(null);
  $("#sheet-close").onclick = () => UI.closeSheet();
  $("#sheet-backdrop").onclick = () => UI.closeSheet();
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") UI.closeSheet(); });

  // iOS kills background tabs without warning: save on every hide, and re-arm the wake lock on return.
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") S.flush(); else UI.reapplyWake(); });
  window.addEventListener("pagehide", () => S.flush());
  UI.reapplyWake();

  // Expose a little for the smoke tests.
  window.__tt = { S, C };
}

main();
