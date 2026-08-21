/**
 * BadCoin Chrome wallet handoff for GLY1 prepare.
 *
 * The page never signs and never broadcasts. It passes the GLY1 bytes to the
 * wallet provider, and the wallet prepares a fee-funded BadCoin transaction
 * from the user's own UTXOs.
 */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function payloadHex() {
  return ($("[data-payload-hex]")?.textContent ?? "").replace(/\s+/g, "").toLowerCase();
}

function anchorAddress() {
  const value = ($("[data-address]")?.value ?? "").trim();
  return value.length ? value : null;
}

function note(text, tone = "") {
  const el = $("[data-handoff-note]");
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
}

function output(text) {
  const el = $("[data-handoff-url]");
  if (!el) return;
  el.textContent = text;
}

function provider() {
  const p = window.badcoin;
  return p && typeof p.prepareGlyph === "function" ? p : null;
}

function providerErrorMessage(error) {
  const code = error?.code ?? "";
  if (code === "WALLET.PASSPHRASE_REQUIRED") {
    return "BadCoin wallet found. Unlock it, then prepare again.";
  }
  if (code === "WALLET.IMPORT_FAILED" || code === "WALLET.NO_WALLET") {
    return "BadCoin wallet found, but no wallet is ready yet.";
  }
  if (code === "INVALID_INPUT.ADDRESS") {
    return "The BadCoin address is not valid. Check the address field and try again.";
  }
  if (code === "INVALID_INPUT.MEMO_TOO_LONG") {
    return error?.message ?? "The GLY1 payload is not valid.";
  }
  return error?.message ?? "BadCoin wallet prepare failed.";
}

async function prepareBadCoin(btn) {
  const p = provider();
  if (!p) {
    note("BadCoin Chrome wallet not detected. Reload this page after loading the extension.", "warn");
    return;
  }
  const hex = payloadHex();
  if (!hex) {
    note("Create a GLY1 message first.", "warn");
    return;
  }

  const prior = btn.textContent;
  btn.disabled = true;
  btn.textContent = "PREPARING";
  note("Asking the BadCoin wallet to prepare the inscription transaction.", "");
  output("");
  try {
    const prepared = await p.prepareGlyph({
      payloadHex: hex,
      recipient: anchorAddress(),
    });
    const fee = Number(prepared?.feeBad ?? 0);
    const txid = String(prepared?.txid ?? "");
    const unsigned = String(prepared?.unsignedTxHex ?? "");
    const changeAddress = String(prepared?.changeAddress ?? "");
    if (!unsigned) {
      note("Wallet connected, but no spendable BadCoin UTXO was available for the miner fee.", "warn");
    } else {
      note("BadCoin wallet prepared the inscription. Confirm, sign, and broadcast remains inside the wallet.", "ok");
    }
    output([
      `feeBad: ${Number.isFinite(fee) ? fee.toFixed(8) : "unknown"}`,
      `changeAddress: ${changeAddress || "unknown"}`,
      `txid: ${txid || "pending"}`,
      `unsignedTxHex: ${unsigned ? `${unsigned.slice(0, 48)}...` : "not built"}`,
    ].join("\n"));
  } catch (error) {
    note(providerErrorMessage(error), "warn");
    output("");
  } finally {
    btn.disabled = false;
    btn.textContent = prior;
  }
}

function refreshButton() {
  const p = provider();
  for (const btn of $$("[data-wallet-badcoin]")) {
    btn.disabled = !p;
    btn.setAttribute("aria-disabled", p ? "false" : "true");
    btn.textContent = p ? "PREPARE WITH BADCOIN WALLET" : "LOAD BADCOIN WALLET";
  }
  if (p) {
    note("BadCoin Chrome wallet detected. Create a Glyph, then prepare the inscription.", "ok");
  } else {
    note("Load the BadCoin Chrome wallet extension, then reload this page.", "warn");
  }
}

export function initWalletHandoff(root = document) {
  const buttons = $$("[data-wallet-badcoin]", root);
  if (!buttons.length) return;
  for (const btn of buttons) {
    btn.addEventListener("click", () => prepareBadCoin(btn));
  }
  window.addEventListener("badcoin#initialized", refreshButton);
  refreshButton();
  setTimeout(refreshButton, 250);
}

if (typeof document !== "undefined") initWalletHandoff();
