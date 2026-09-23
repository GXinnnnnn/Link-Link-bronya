import { parseFig, nodeId } from 'openfig-core'

export function parseFigBytes(bytes) {
  return parseFig(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
}

export function idOf(node) {
  return nodeId(node)
}

export function childrenOf(document, nodeOrId) {
  const id = typeof nodeOrId === 'string' ? nodeOrId : idOf(nodeOrId)
  return id ? document.childrenMap.get(id) ?? [] : []
}

export function descendantsOf(document, rootOrId, includeRoot = false) {
  const root = typeof rootOrId === 'string' ? document.nodeMap.get(rootOrId) : rootOrId
  if (!root) return []
  const result = includeRoot ? [root] : []
  const queue = [...childrenOf(document, root)]
  while (queue.length) {
    const node = queue.shift()
    result.push(node)
    queue.push(...childrenOf(document, node))
  }
  return result
}

export function pageList(document) {
  return document.nodes
    .filter((node) => node.type === 'CANVAS')
    .map((node) => ({
      id: idOf(node),
      name: node.name || 'Untitled',
      childCount: childrenOf(document, node).length,
    }))
}

export function findPage(document, selector) {
  const pages = document.nodes.filter((node) => node.type === 'CANVAS')
  if (!selector) return pages[0]
  const exactId = document.nodeMap.get(selector)
  if (exactId?.type === 'CANVAS') return exactId
  const exactName = pages.find((node) => node.name === selector)
  if (exactName) return exactName
  const folded = String(selector).toLocaleLowerCase()
  const partial = pages.filter((node) => String(node.name || '').toLocaleLowerCase().includes(folded))
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) throw new Error(`Page selector ${JSON.stringify(selector)} is ambiguous: ${partial.map((node) => node.name).join(', ')}`)
  throw new Error(`Page ${JSON.stringify(selector)} was not found`)
}

export function screenFrames(document, page) {
  return childrenOf(document, page).filter((node) => {
    if (node.type !== 'FRAME' || !node.size) return false
    return node.size.x >= 1000 && node.size.y >= 600 && node.size.x <= 4096 && node.size.y <= 4096
  })
}

export function uniqueTexts(document, root) {
  const values = []
  const seen = new Set()
  for (const node of descendantsOf(document, root, true)) {
    if (node.type !== 'TEXT') continue
    const value = String(node.textData?.characters || node.name || '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    values.push(value)
  }
  return values
}

export function hashToHex(hash) {
  if (!hash) return null
  const values = Array.isArray(hash) ? hash : Object.keys(hash)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => hash[key])
  if (!values.length) return null
  return values.map((value) => Number(value).toString(16).padStart(2, '0')).join('')
}

export function imageReferences(document, root) {
  const references = []
  const seen = new Set()
  for (const node of descendantsOf(document, root, true)) {
    for (const paint of node.fillPaints ?? []) {
      if (paint.type !== 'IMAGE') continue
      const hash = hashToHex(paint.image?.hash)
      if (!hash || seen.has(hash)) continue
      seen.add(hash)
      references.push({
        hash,
        name: paint.image?.name || node.name || hash,
        width: paint.image?.originalImageWidth ?? null,
        height: paint.image?.originalImageHeight ?? null,
        sourceNodeId: idOf(node),
      })
    }
  }
  return references
}

export function mediaType(bytes) {
  if (!bytes?.length) return 'application/octet-stream'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  return 'application/octet-stream'
}

export function imageDataUrl(document, reference) {
  const bytes = document.images.get(reference.hash)
  if (!bytes) return null
  return `data:${mediaType(bytes)};base64,${Buffer.from(bytes).toString('base64')}`
}

export function compactNode(node) {
  return {
    id: idOf(node),
    type: node.type,
    name: node.name || '',
    text: node.type === 'TEXT' ? String(node.textData?.characters || node.name || '') : null,
    x: node.transform?.m02 ?? 0,
    y: node.transform?.m12 ?? 0,
    width: node.size?.x ?? 0,
    height: node.size?.y ?? 0,
  }
}
