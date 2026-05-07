const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

const sizes = [192, 512]
const outDir = path.join(__dirname, '..', 'public', 'icons')

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

for (const size of sizes) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Green circle background
  ctx.fillStyle = '#16a34a'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()

  // White football text
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${size * 0.45}px sans-serif`
  ctx.fillText('⚽', size / 2, size / 2 + size * 0.02)

  const buf = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buf)
  console.log(`✅ Created icon-${size}.png`)
}
