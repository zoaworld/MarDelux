/**
 * Converte logos PNG para SVG com cor rosa do site.
 * Potrace traça pixels escuros; pré-processamos para dourado=preto, fundo=branco.
 *
 * Uso: node scripts/png-to-svg.js
 * Requer: public/logo/logo-texto.png, logo-lotus.png, logo-completo.png
 * Saída:  public/logo/*.svg
 */

const path = require("path");
const fs = require("fs");
const potrace = require("potrace");
const sharp = require("sharp");

const ROSE_GOLD = "#b76e79";
const BASE = path.resolve(__dirname, "..");
const LOGO_DIR = path.join(BASE, "public", "logo");
const LOGOS = ["logo-texto", "logo-lotus", "logo-completo"];

async function convertToSvg(name) {
  const inputPath = path.join(LOGO_DIR, `${name}.png`);
  const outputPath = path.join(LOGO_DIR, `${name}.svg`);
  const tempPath = path.join(LOGO_DIR, `_temp-${name}.png`);

  if (!fs.existsSync(inputPath)) {
    console.warn(`Ignorado (não existe): ${inputPath}`);
    return;
  }

  const threshold = 220;
  await sharp(inputPath)
    .ensureAlpha()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .grayscale()
    .threshold(threshold)
    .toFile(tempPath);

  const svg = await new Promise((resolve, reject) => {
    potrace.trace(
      tempPath,
      { threshold: 128, color: ROSE_GOLD, background: "transparent" },
      (err, svgString) => (err ? reject(err) : resolve(svgString))
    );
  });

  fs.unlinkSync(tempPath);

  const svgWithColor = svg.replace(
    /fill="#[0-9a-fA-F]{6}"/g,
    `fill="${ROSE_GOLD}"`
  );

  fs.writeFileSync(outputPath, svgWithColor, "utf8");
  console.log(`OK: ${outputPath}`);
}

async function main() {
  for (const name of LOGOS) {
    await convertToSvg(name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
