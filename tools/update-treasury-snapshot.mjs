#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TREASURY_ADDRESS = "BADDoGmLTiLyv1wZjVqjzcYKz6WKkNYUZ8";
const MAX_BAD = 1000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "badcoin-treasury.json");
const URL = `https://explorer.badcoin.dev/ext/getbalance/${TREASURY_ADDRESS}`;

const res = await fetch(URL, { headers: { Accept: "text/plain" } });
if (!res.ok) {
  throw new Error(`Treasury balance lookup failed: HTTP ${res.status}`);
}
const text = (await res.text()).trim();
const balanceBad = Number(text);
if (!Number.isFinite(balanceBad)) {
  throw new Error(`Treasury balance lookup returned a non-number: ${text}`);
}

const snapshot = {
  ok: true,
  source: "explorer.badcoin.dev",
  network: "mainnet",
  treasuryAddress: TREASURY_ADDRESS,
  balanceBad,
  maxBad: MAX_BAD,
  checkedAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Treasury snapshot: ${balanceBad} BAD`);
