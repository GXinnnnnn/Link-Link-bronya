#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { parseFigBytes } from '../lib/fig.js'
import { buildOverview, buildPageIr, buildVehicleSettingsModel, attachSettingsHero, pageInspection } from '../lib/ir.js'
import { generateSettingsFiles, genericProjectFiles } from '../lib/generate.js'

const args = parseArgs(process.argv.slice(2))
if (!args.fig || !args.op) {
  console.error('Usage: vehicle-ui --op overview|inspect|generate-ir|generate-h5|validate --fig <file> [--page <name-or-id>] [--out <dir>] [--target settings-h5|generic-h5]')
  process.exit(2)
}

const document = parseFigBytes(await readFile(args.fig))
if (args.op === 'overview') output(buildOverview(document))
else if (args.op === 'inspect') output(pageInspection(document, args.page))
else if (args.op === 'generate-ir') output(buildPageIr(document, args.page))
else if (args.op === 'generate-h5') {
  const ir = buildPageIr(document, args.page)
  const target = args.target || (ir.source.pageName === '设置UI' ? 'settings-h5' : 'generic-h5')
  const model = target === 'settings-h5' ? attachSettingsHero(document, ir, buildVehicleSettingsModel(ir)) : null
  const files = target === 'settings-h5' ? await generateSettingsFiles(ir, model) : genericProjectFiles(ir)
  const out = args.out || `${args.fig.replace(/\.[^.]+$/, '')}-${ir.source.pageName}-h5`
  const { mkdir, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  await mkdir(out, { recursive: true })
  for (const [name, content] of files) await writeFile(join(out, name), content, 'utf8')
  output({ok:true, operation:'generate-h5', target, outputDir:out, files:[...files.keys()], page:ir.source, interactionTypes:[...new Set(ir.interactions.map((item)=>item.type))], warnings:ir.warnings})
} else if (args.op === 'validate') {
  const ir = buildPageIr(document, args.page)
  const required = ir.source.pageName === '设置UI' ? ['index.html','styles.css','app.js','lucide.min.js','ui-ir.json','interaction-contract.json','vehicle-ui.d.ts'] : ['index.html','styles.css','app.js','ui-ir.json','interaction-contract.json','vehicle-ui.d.ts']
  const { access } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const missing=[]
  for(const file of required){try{await access(join(args.out,file))}catch{missing.push(file)}}
  output({ok:missing.length===0,outputDir:args.out,expectedFiles:required,missing,page:ir.source,interactionTypes:[...new Set(ir.interactions.map((item)=>item.type))],screenCount:ir.screens.length,warnings:ir.warnings})
} else {
  console.error(`Unknown operation: ${args.op}`)
  process.exit(2)
}

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith('--')) continue
    const key = value.slice(2)
    result[key] = values[index + 1]?.startsWith('--') ? true : values[++index]
  }
  return result
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}
