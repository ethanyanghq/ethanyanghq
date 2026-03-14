import { readFileSync, writeFileSync } from "node:fs";

const sourcePath = new URL("../src/main.ts", import.meta.url);
const outputPath = new URL("../favicon.svg", import.meta.url);
const source = readFileSync(sourcePath, "utf8");

function extractHexColor(tokenName) {
  const match = source.match(new RegExp(`${tokenName}:\\s*"(#[0-9A-Fa-f]{6})"`));

  if (!match) {
    throw new Error(`Could not find "${tokenName}" color token in src/main.ts`);
  }

  return match[1];
}

const background = extractHexColor("background");
const diamond = extractHexColor("diamond");

const iconSize = 64;
const cornerRadius = 12;
const padding = 8;
const center = iconSize / 2;
const halfDiagonal = center - padding;
const diamondPoints = [
  `${center},${center - halfDiagonal}`,
  `${center + halfDiagonal},${center}`,
  `${center},${center + halfDiagonal}`,
  `${center - halfDiagonal},${center}`,
].join(" ");

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${iconSize} ${iconSize}">`,
  `  <rect width="${iconSize}" height="${iconSize}" rx="${cornerRadius}" fill="${background}" />`,
  `  <polygon points="${diamondPoints}" fill="${diamond}" />`,
  "</svg>",
  "",
].join("\n");

writeFileSync(outputPath, svg, "utf8");
