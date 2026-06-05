import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err; // a corrupt/unreadable file should be loud, not silent
  }
}

export async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}

export async function writeText(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}
