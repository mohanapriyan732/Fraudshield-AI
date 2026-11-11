import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const modules = join(root, 'node_modules')
const output = join(root, 'public', 'ocr')
const dataVersion = '4.0.0_best_int'
const languages = ['eng', 'hin', 'tam']
const cores = [
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js',
]
const assets = [
  {
    source: join(modules, 'tesseract.js', 'dist', 'worker.min.js'),
    destination: join(output, 'worker.min.js'),
  },
  ...cores.map((filename) => ({
    source: join(modules, 'tesseract.js-core', filename),
    destination: join(output, 'core', filename),
  })),
  ...languages.map((language) => ({
    source: join(
      modules,
      '@tesseract.js-data',
      language,
      dataVersion,
      `${language}.traineddata.gz`,
    ),
    destination: join(output, `${language}.traineddata.gz`),
  })),
]

for (const asset of assets) {
  await mkdir(dirname(asset.destination), { recursive: true })
  await copyFile(asset.source, asset.destination)
}

console.log(`Prepared local OCR worker, core, and ${languages.length} language models.`)
