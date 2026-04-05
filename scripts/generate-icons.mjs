import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'

import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)

const rootDir = process.cwd()
const sourceSvg = path.join(rootDir, 'assets', 'portmaster-icon.svg')
const buildDir = path.join(rootDir, 'build')
const iconsetDir = path.join(buildDir, 'icon.iconset')

const macSizes = [
  16, 32, 64, 128, 256, 512, 1024,
]

async function ensureDirectories() {
  await fs.rm(buildDir, { recursive: true, force: true })
  await fs.mkdir(buildDir, { recursive: true })
  await fs.mkdir(iconsetDir, { recursive: true })
}

async function renderPng(size, targetFile) {
  await sharp(sourceSvg)
    .resize(size, size)
    .png()
    .toFile(targetFile)
}

async function generateMacIconset() {
  const iconsetEntries = [
    { size: 16, file: 'icon_16x16.png' },
    { size: 32, file: 'icon_16x16@2x.png' },
    { size: 32, file: 'icon_32x32.png' },
    { size: 64, file: 'icon_32x32@2x.png' },
    { size: 128, file: 'icon_128x128.png' },
    { size: 256, file: 'icon_128x128@2x.png' },
    { size: 256, file: 'icon_256x256.png' },
    { size: 512, file: 'icon_256x256@2x.png' },
    { size: 512, file: 'icon_512x512.png' },
    { size: 1024, file: 'icon_512x512@2x.png' },
  ]

  await Promise.all(
    iconsetEntries.map(({ size, file }) =>
      renderPng(size, path.join(iconsetDir, file)),
    ),
  )

  await execFileAsync('/usr/bin/iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(buildDir, 'icon.icns')])
}

async function generateCommonPngs() {
  await Promise.all(
    macSizes.map((size) =>
      renderPng(size, path.join(buildDir, `icon-${size}.png`)),
    ),
  )

  await fs.copyFile(path.join(buildDir, 'icon-1024.png'), path.join(buildDir, 'icon.png'))
}

async function generateIco() {
  const icoBuffer = await pngToIco([
    path.join(buildDir, 'icon-16.png'),
    path.join(buildDir, 'icon-32.png'),
    path.join(buildDir, 'icon-64.png'),
    path.join(buildDir, 'icon-128.png'),
    path.join(buildDir, 'icon-256.png'),
  ])

  await fs.writeFile(path.join(buildDir, 'icon.ico'), icoBuffer)
}

async function main() {
  await ensureDirectories()
  await generateCommonPngs()
  await generateMacIconset()
  await generateIco()
  console.log('PortMaster icons generated in build/')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
