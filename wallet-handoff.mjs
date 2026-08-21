/**
 * BadCoin Chrome wallet handoff for GLY1 prepare.
 *
 * The page never signs and never broadcasts. It passes the GLY1 bytes to the
 * wallet provider, and the wallet prepares a fee-funded BadCoin transaction
 * from the user's own UTXOs.
 */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let connection = null;

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

function canConnect(p) {
  return p && typeof p.connect === "function";
}

function setAddressFields(address) {
  if (!address) return;
  for (const selector of ["[data-address]", "[data-lookup-input]"]) {
    const el = $(selector);
    if (!el) continue;
    el.value = address;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function describeConnection(status) {
  if (!status?.walletId) {
    return "BadCoin wallet connected, but no wallet has been created or imported yet.";
  }
  if (status.locked) {
    return "BadCoin wallet connected. Unlock it from the extension popup, then come back here.";
  }
  if (status.primaryAddress) {
    return `BadCoin wallet connected: ${shortAddress(status.primaryAddress)}.`;
  }
  return "BadCoin wallet connected, but no public address is available yet.";
}

function shortAddress(address) {
  if (!address || address.length <= 14) return address || "";
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
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

async function connectBadCoin() {
  const p = provider();
  if (!p) {
    connection = null;
    note("BadCoin Chrome wallet not detected. Reload this page after loading the extension.", "warn");
    refreshButton();
    return null;
  }
  if (!canConnect(p)) {
    connection = null;
    note("BadCoin Chrome wallet detected, but this build needs the connect update. Rebuild and reload the extension.", "warn");
    refreshButton();
    return null;
  }

  note("Connecting to the BadCoin wallet.", "");
  try {
    const status = await p.connect();
    connection = status;
    if (status?.primaryAddress) setAddressFields(String(status.primaryAddress));
    note(describeConnection(status), status?.walletId && !status?.locked ? "ok" : "warn");
    refreshButton();
    return status;
  } catch (error) {
    connection = null;
    note(providerErrorMessage(error), "warn");
    refreshButton();
    return null;
  }
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
  if (!connection || connection.locked || !connection.primaryAddress) {
    const status = await connectBadCoin();
    if (!status || status.locked || !status.primaryAddress) return;
    note("Wallet connected. Click Prepare with BadCoin Wallet again to open the wallet confirm window.", "ok");
    return;
  }

  const prior = btn.textContent;
  const confirmRequestId = typeof p.beginGlyphConfirm === "function" ? p.beginGlyphConfirm() : null;
  btn.disabled = true;
  btn.textContent = "PREPARING";
  note(
    confirmRequestId
      ? "Wallet confirm window opened. Preparing the inscription transaction."
      : "Asking the BadCoin wallet to prepare the inscription transaction. If no wallet window opens, allow popups for cipherglyph.org.",
    "",
  );
  output("");
  try {
    const prepared = await p.prepareGlyph({
      payloadHex: hex,
      recipient: anchorAddress(),
      ...(confirmRequestId ? { confirmRequestId } : {}),
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
    if (!p) {
      btn.textContent = "LOAD BADCOIN WALLET";
    } else if (!connection || connection.locked || !connection.primaryAddress) {
      btn.textContent = "CONNECT BADCOIN WALLET";
    } else {
      btn.textContent = "PREPARE WITH BADCOIN WALLET";
    }
  }
  if (p) {
    if (connection) {
      note(describeConnection(connection), connection.walletId && !connection.locked ? "ok" : "warn");
    } else {
      note("BadCoin Chrome wallet detected. Connect it, then prepare the inscription.", "ok");
    }
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
  setTimeout(() => {
    refreshButton();
    if (provider()) connectBadCoin();
  }, 250);
}

if (typeof document !== "undefined") initWalletHandoff();
