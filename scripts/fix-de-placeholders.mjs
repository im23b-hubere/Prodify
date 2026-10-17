/**
 * Restore {{placeholders}} in de.json that machine translation literalized to 0/1/2…
 * Prefer repairing the German string; fall back to the English template when repair fails.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const enPath = path.join(root, "mobile/locales/en.json");
const dePath = path.join(root, "mobile/locales/de.json");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const de = JSON.parse(fs.readFileSync(dePath, "utf8"));

function placeholders(value) {
  return [...String(value).matchAll(/\{\{[^}]+\}\}/g)].map((m) => m[0]);
}

function restoreMtPlaceholders(enStr, deStr) {
  const phs = placeholders(enStr);
  if (phs.length === 0) return deStr;
  if (phs.every((ph) => deStr.includes(ph))) return deStr;

  let result = deStr;
  // MT typically replaced the n-th placeholder with the digit n (0, 1, 2…).
  for (let i = phs.length - 1; i >= 0; i -= 1) {
    const re = new RegExp(`(?<!\\d)${i}(?!\\d)`);
    if (!re.test(result)) continue;
    result = result.replace(re, phs[i]);
  }

  if (phs.every((ph) => result.includes(ph))) return result;
  return enStr;
}

function fixNode(enNode, deNode) {
  if (typeof enNode === "string") {
    return typeof deNode === "string" ? restoreMtPlaceholders(enNode, deNode) : enNode;
  }
  if (Array.isArray(enNode)) {
    return enNode.map((value, index) => fixNode(value, Array.isArray(deNode) ? deNode[index] : undefined));
  }
  if (enNode && typeof enNode === "object") {
    const out = {};
    for (const key of Object.keys(enNode)) {
      out[key] = fixNode(enNode[key], deNode?.[key]);
    }
    return out;
  }
  return deNode ?? enNode;
}

const fixed = fixNode(en, de);
fs.writeFileSync(dePath, JSON.stringify(fixed, null, 2) + "\n");

let repaired = 0;
let fallbackEn = 0;
function count(enNode, before, after) {
  if (typeof enNode === "string") {
    const phs = placeholders(enNode);
    if (!phs.length) return;
    const beforeOk = phs.every((ph) => String(before).includes(ph));
    const afterOk = phs.every((ph) => String(after).includes(ph));
    if (!beforeOk && afterOk) {
      if (after === enNode) fallbackEn += 1;
      else repaired += 1;
    }
    return;
  }
  if (Array.isArray(enNode)) {
    enNode.forEach((v, i) => count(v, before?.[i], after?.[i]));
    return;
  }
  if (enNode && typeof enNode === "object") {
    for (const key of Object.keys(enNode)) count(enNode[key], before?.[key], after?.[key]);
  }
}
count(en, de, fixed);
console.log({ repaired, fallbackEn, time: fixed.time?.hoursAndMinutes, streak: fixed.streakMilestones?.message });
