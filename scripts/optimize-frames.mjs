import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const frames2Dir = path.resolve('client/public/frames2');
const files = fs.readdirSync(frames2Dir).filter(f => f.endsWith('.png'));

console.log(`Found ${files.length} PNG frames in ${frames2Dir}`);

async function convert() {
  let totalOldSize = 0;
  let totalNewSize = 0;

  for (const file of files) {
    const pngPath = path.join(frames2Dir, file);
    const webpName = file.replace('.png', '.webp');
    const webpPath = path.join(frames2Dir, webpName);

    const oldStat = fs.statSync(pngPath);
    totalOldSize += oldStat.size;

    await sharp(pngPath)
      .webp({ quality: 82, effort: 4 })
      .toFile(webpPath);

    const newStat = fs.statSync(webpPath);
    totalNewSize += newStat.size;

    // Remove old bulky PNG
    fs.unlinkSync(pngPath);
  }

  console.log(`Conversion complete!`);
  console.log(`Old PNG total: ${(totalOldSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`New WebP total: ${(totalNewSize / (1024 * 1024)).toFixed(2)} MB`);
}

convert().catch(console.error);
