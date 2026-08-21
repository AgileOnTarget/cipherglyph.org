/**
 * Persist the CipherGlyph message while the visitor goes to get HPP.
 * ND-SITE-004, updated by ND-SITE-012. Local storage only.
 */
import { isValidMessage } from "./gly1.mjs";

export const CHOICE_STORAGE_KEY = "badglyph.v1.message";

function storageAvailable(storage) {
  return storage && typeof storage.getItem === "function" && typeof storage.setItem === "function";
}

export function loadChoice(storage = globalThis.localStorage) {
  if (!storageAvailable(storage)) return { message: "" };
  try {
    const message = storage.getItem(CHOICE_STORAGE_KEY);
    if (typeof message !== "string" || !isValidMessage(message)) return { message: "" };
    return { message };
  } catch {
    return { message: "" };
  }
}

export function saveChoice(choice, storage = globalThis.localStorage) {
  if (!storageAvailable(storage)) return false;
  const message = typeof choice === "string" ? choice : choice?.message;
  if (typeof message !== "string" || !isValidMessage(message)) return false;
  try {
    storage.setItem(CHOICE_STORAGE_KEY, message);
    return true;
  } catch {
    return false;
  }
}
