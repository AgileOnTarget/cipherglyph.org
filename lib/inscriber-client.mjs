/**
 * Loopback inscriber client. ND-SITE-007.
 *
 * The page holds no secrets. It asks the local inscriber to prepare a burn,
 * then polls status. Default origin is the loopback process on 8766.
 */
export const INSCRIBER_ORIGIN = "http://127.0.0.1:8766";

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function unreachable() {
  return {
    ok: false,
    reason: "inscriber_unreachable",
    message:
      "Cannot reach the inscriber on this computer. Start it with npm run app, then try again.",
  };
}

export async function prepareClaimRequest({
  address,
  message,
  name,
  kind = "glyph",
  origin = INSCRIBER_ORIGIN,
  fetchImpl = globalThis.fetch,
} = {}) {
  const msg = message ?? name ?? "";
  try {
    const res = await fetchImpl(`${origin}/claim/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, message: msg, name: msg, kind }),
    });
    const body = await readJson(res);
    return { httpStatus: res.status, ...body };
  } catch {
    return unreachable();
  }
}

export async function getClaimRequest({
  burnId,
  origin = INSCRIBER_ORIGIN,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!burnId) return { ok: false, reason: "missing_burn_id" };
  try {
    const res = await fetchImpl(`${origin}/claim/${encodeURIComponent(burnId)}`);
    const body = await readJson(res);
    return { httpStatus: res.status, ...body };
  } catch {
    return unreachable();
  }
}

export async function verifyClaimRequest({
  burnId,
  origin = INSCRIBER_ORIGIN,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!burnId) return { ok: false, reason: "missing_burn_id" };
  try {
    const res = await fetchImpl(`${origin}/claim/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ burn_id: burnId }),
    });
    const body = await readJson(res);
    return { httpStatus: res.status, ...body };
  } catch {
    return unreachable();
  }
}

export function prepareFailureMessage(result) {
  if (!result || result.ok) return "";
  if (result.reason === "inscriber_unreachable") return result.message;
  if (result.reason === "kill_switch_active") {
    const extra = (result.failures || [])
      .map((f) => f.message || f.reason)
      .filter(Boolean)
      .join(" ");
    const head =
      result.message ||
      "BadGlyph cannot accept an HPP burn until the inscription path is ready.";
    return extra ? `${head} ${extra}` : head;
  }
  if (result.message) return result.message;
  if (result.reason) return `Cannot start the handoff (${result.reason}).`;
  return "Cannot start the handoff.";
}

export function isTerminalClaimStatus(status) {
  return ["burned", "inscribing", "broadcast", "confirmed"].includes(status);
}

export async function lookupAddressRequest({
  address,
  origin = INSCRIBER_ORIGIN,
  fetchImpl = globalThis.fetch,
} = {}) {
  const pasted = String(address || "").trim();
  if (!pasted) {
    return { ok: false, reason: "bad_address", message: "Enter a BadCoin address.", items: [] };
  }
  try {
    const res = await fetchImpl(`${origin}/index/address/${encodeURIComponent(pasted)}`);
    const body = await readJson(res);
    return { httpStatus: res.status, ...body };
  } catch {
    return {
      ok: false,
      reachable: false,
      reason: "inscriber_unreachable",
      message: "Cannot reach the index right now. This does not mean there are none.",
      items: [],
    };
  }
}
