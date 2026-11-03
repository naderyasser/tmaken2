/**
 * Generate PWA icons for the Sales Rep app.
 * 
 * Run: node scripts/generate-pwa-icons.js
 * 
 * This generates colored placeholder icons. Replace with your actual logo/icon.
 * For production, use a design tool to create proper icons from your brand logo.
 * 
 * Alternative: Use https://realfavicongenerator.net/ or https://maskable.app/
 * to generate icons from your logo.jpeg file.
 */

const fs = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'icons');

// Create SVG icon with the Meena branding
function createSVGIcon(size, isMaskable = false) {
  const padding = isMaskable ? size * 0.1 : 0;
  const innerSize = size - padding * 2;
  const fontSize = Math.round(innerSize * 0.28);
  const subFontSize = Math.round(innerSize * 0.12);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563EB"/>
      <stop offset="50%" style="stop-color:#1D4ED8"/>
      <stop offset="100%" style="stop-color:#3730A3"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${isMaskable ? 0 : Math.round(size * 0.2)}" fill="url(#bg)"/>
  <text x="${size / 2}" y="${size / 2 - subFontSize * 0.3}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">مينا</text>
  <text x="${size / 2}" y="${size / 2 + fontSize * 0.7}" font-family="Arial, sans-serif" font-size="${subFontSize}" fill="rgba(255,255,255,0.8)" text-anchor="middle" dominant-baseline="middle">Sales Rep</text>
</svg>`;
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate regular icons
for (const size of SIZES) {
  const svg = createSVGIcon(size, false);
  const filename = `sales-rep-${size}.svg`;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), svg);
  console.log(`✅ Generated ${filename}`);
}

// Generate maskable icons
for (const size of MASKABLE_SIZES) {
  const svg = createSVGIcon(size, true);
  const filename = `sales-rep-maskable-${size}.svg`;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), svg);
  console.log(`✅ Generated ${filename} (maskable)`);
}

console.log(`\n📱 Icon files generated in: ${OUTPUT_DIR}`);
console.log('\n⚠️  Note: These are SVG placeholders. For production PWA icons:');
console.log('   1. Use your actual logo/brand icon');
console.log('   2. Convert to PNG using a tool like https://realfavicongenerator.net/');
console.log('   3. Or use Sharp/Canvas to convert: npm install sharp');
console.log('   4. Update the manifest to reference .png files');
console.log('\n   For now, update the manifest to use .svg extension instead of .png');
