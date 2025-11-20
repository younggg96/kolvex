const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputSvg = path.join(__dirname, "../public/icon.svg");
const outputDir = path.join(__dirname, "../public/icons");

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  console.log("正在生成 PWA 图标...\n");

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

    try {
      await sharp(inputSvg)
        .resize(size, size, {
          fit: "contain",
          background: { r: 10, g: 10, b: 10, alpha: 1 },
        })
        .png()
        .toFile(outputPath);

      console.log(`✓ 已生成 icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`✗ 生成 icon-${size}x${size}.png 失败:`, error.message);
    }
  }

  console.log("\n✓ 所有图标生成完成！");
}

generateIcons().catch(console.error);
