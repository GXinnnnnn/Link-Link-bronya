import { access, readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { parseFigBytes, findPage, pageList } from './fig.js'
import { buildOverview, buildPageIr, buildVehicleSettingsModel, attachSettingsHero, pageInspection } from './ir.js'
import { generateSettingsFiles, genericProjectFiles } from './generate.js'

export const name = 'vehicle-ui-tool'
export const inject = ['tools']

const operationValues = ['overview', 'inspect', 'generate-ir', 'generate-h5', 'validate']

const vehicleUiOutput = {
  schema: {
    type: 'object',
    additionalProperties: true,
  },
  render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  presentationMeta: (_args, value) => value,
}

export function createVehicleUiTool(fsService) {
  return defineTool({
  name: 'vehicle_ui',
  description: 'Read a local Figma .fig file, inspect vehicle UI pages, produce platform-neutral UI-IR with interaction contracts, generate an interactive H5 prototype, or validate generated outputs. Use operation overview first, then inspect or generate-ir before generate-h5. The generated runtime exposes window.VehicleUI for tap, longPress, drag, swipe, valueChange, navigation, and stateChange events.',
  parameters: {
    operation: { type: 'string', required: true, enum: operationValues, description: 'Requested operation.' },
    figPath: { type: 'string', required: true, description: 'Absolute or session-relative path to a local .fig file.' },
    page: { type: 'string', description: 'Page name or node id, for example 设置UI or 41:1274.' },
    outputDir: { type: 'string', description: 'Directory for generated H5/IR files. It is created when missing.' },
    target: { type: 'string', enum: ['auto', 'generic-h5', 'settings-h5'], description: 'Generator target. settings-h5 adds the car-settings adapter.' },
    includeAssets: { type: 'boolean', description: 'Reserved for future exported asset folders; the settings H5 embeds its selected Figma hero image.' },
  },
  output: vehicleUiOutput,
  async execute(args, exec) {
    const bytes = await readInputBytes(args.figPath, exec, fsService)
    const document = parseFigBytes(bytes)
    if (args.operation === 'overview') return buildOverview(document)
    const pageSelector = args.page || undefined
    if (args.operation === 'inspect') return pageInspection(document, pageSelector)
    if (args.operation === 'generate-ir') return buildPageIr(document, pageSelector)
    const ir = buildPageIr(document, pageSelector)
    if (args.operation === 'generate-h5') {
      const target = args.target || inferTarget(ir)
      const model = target === 'settings-h5' ? attachSettingsHero(document, ir, buildVehicleSettingsModel(ir)) : null
      const files = target === 'settings-h5' ? await generateSettingsFiles(ir, model) : genericProjectFiles(ir)
      const outputDir = args.outputDir || join(dirname(args.figPath), `${safeName(ir.source.pageName)}-h5`)
      await writeGeneratedFiles(outputDir, files, exec.signal)
      return {
        ok: true,
        operation: args.operation,
        target,
        outputDir,
        files: [...files.keys()],
        page: ir.source,
        interactionContract: ir.contract,
        warnings: ir.warnings,
      }
    }
    if (args.operation === 'validate') {
      const outputDir = args.outputDir
      if (!outputDir) throw new Error('validate requires outputDir')
      return validateGenerated(outputDir, ir)
    }
    throw new Error(`Unsupported operation ${args.operation}`)
  },
  presentCall: (args) => ({ card: 'generic', title: `Vehicle UI: ${args.operation}`, kind: 'other', rawInput: args }),
  presentResult: (_args, result) => ({ card: 'generic', title: result.isError ? 'Vehicle UI failed' : 'Vehicle UI complete', kind: result.isError ? 'error' : 'other', rawOutput: result.content }),
  })
}

export function apply(ctx) {
  const dispose = ctx.tools.register(createVehicleUiTool(ctx.get('fs')))
  return dispose
}

async function readInputBytes(filePath, exec, fsService) {
  if (fsService) {
    const target = await fsService.resolve(filePath, { cwd: exec.agent?.session?.header?.cwd, signal: exec.signal })
    return fsService.readBytes(target, exec.signal, 1024 * 1024 * 1024)
  }
  return readFile(filePath, { signal: exec?.signal })
}

async function writeGeneratedFiles(outputDir, files, signal) {
  await mkdir(outputDir, { recursive: true })
  for (const [name, content] of files) {
    if (signal?.aborted) throw new Error('vehicle_ui generation aborted')
    await writeFile(join(outputDir, name), content, 'utf8')
  }
}

function inferTarget(ir) {
  return ir.source.pageName === '设置UI' ? 'settings-h5' : 'generic-h5'
}

function safeName(value) {
  return String(value || 'vehicle-ui').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').slice(0, 80)
}

async function validateGenerated(outputDir, ir) {
  const required = ir.source.pageName === '设置UI'
    ? ['index.html', 'styles.css', 'app.js', 'lucide.min.js', 'ui-ir.json', 'interaction-contract.json', 'vehicle-ui.d.ts']
    : ['index.html', 'styles.css', 'app.js', 'ui-ir.json', 'interaction-contract.json', 'vehicle-ui.d.ts']
  const missing = []
  for (const file of required) {
    try { await access(join(outputDir, file)) } catch { missing.push(file) }
  }
  return {
    ok: missing.length === 0,
    outputDir,
    expectedFiles: required,
    missing,
    page: ir.source,
    interactionTypes: [...new Set(ir.interactions.map((item) => item.type))],
    screenCount: ir.screens.length,
    warnings: ir.warnings,
  }
}

export { buildOverview, buildPageIr, buildVehicleSettingsModel, attachSettingsHero, generateSettingsFiles, genericProjectFiles, pageList }
