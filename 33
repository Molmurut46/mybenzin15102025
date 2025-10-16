import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const svgPath = path.join(root, 'public', 'icons', 'app-icon.svg')
const out192 = path.join(root, 'public', 'icon-192.png')
const out512 = path.join(root, 'public', 'icon-512.png')

async function ensureSvgExists() {
  if (!fs.existsSync(svgPath)) {
    throw new Error(`SVG source not found at ${svgPath}. Please add public/icons/app-icon.svg`)
  }
}

async function generate() {
  await ensureSvgExists()
  await sharp(svgPath)
    .resize(192, 192, { fit: 'cover' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(out192)
  await sharp(svgPath)
    .resize(512, 512, { fit: 'cover' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(out512)
  console.log('✅ Generated icons:', out192, out512)
}

generate().catch((e) => {
  console.error('❌ Icon generation failed:', e)
  process.exit(1)
})