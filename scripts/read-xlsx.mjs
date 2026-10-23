// Read-only OOXML reader for migration. No macros, formula evaluation or external requests.
import { readFile } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'
import path from 'node:path'

const decode = s => s.replace(/&#x([\da-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi, (_, hex, num, named) =>
  hex || num ? String.fromCodePoint(parseInt(hex || num, hex ? 16 : 10)) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named]))
const attr = (s, key) => decode(new RegExp(`(?:^|\\s)${key}="([^"]*)"`).exec(s)?.[1] || '')
const texts = xml => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => decode(m[1])).join('')

export async function readWorkbook(file) {
  const buffer = await readFile(file)
  if (buffer.length > 25 * 1024 * 1024) throw new Error('Excel excede 25 MB')
  let end = buffer.length - 22
  while (end >= Math.max(0, buffer.length - 65558) && buffer.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0 || buffer.readUInt32LE(end) !== 0x06054b50) throw new Error('Archivo ZIP/XLSX inválido')
  const count = buffer.readUInt16LE(end + 10)
  let pos = buffer.readUInt32LE(end + 16)
  const entries = new Map()
  let total = 0
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) throw new Error('Directorio ZIP inválido')
    const compression = buffer.readUInt16LE(pos + 10), size = buffer.readUInt32LE(pos + 20)
    const expanded = buffer.readUInt32LE(pos + 24)
    total += expanded
    if (total > 80 * 1024 * 1024) throw new Error('Excel descomprimido excede el límite')
    const n = buffer.readUInt16LE(pos + 28), extra = buffer.readUInt16LE(pos + 30), comment = buffer.readUInt16LE(pos + 32)
    const name = buffer.toString('utf8', pos + 46, pos + 46 + n)
    const local = buffer.readUInt32LE(pos + 42)
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    const data = buffer.subarray(start, start + size)
    if (compression !== 0 && compression !== 8) throw new Error('Compresión no admitida')
    entries.set(name, (compression === 8 ? inflateRawSync(data, { maxOutputLength: expanded + 1 }) : data).toString('utf8'))
    pos += 46 + n + extra + comment
  }
  const strings = [...(entries.get('xl/sharedStrings.xml') || '').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m => texts(m[1]))
  const relationships = xml => new Map([...xml.matchAll(/<Relationship\s([^>]+)\/?\s*>/g)].map(m => [attr(m[1], 'Id'), attr(m[1], 'Target')]))
  const rels = relationships(entries.get('xl/_rels/workbook.xml.rels') || '')
  const sheets = []
  for (const sheet of (entries.get('xl/workbook.xml') || '').matchAll(/<sheet\s([^>]+)\/?\s*>/g)) {
    const name = attr(sheet[1], 'name'), target = rels.get(attr(sheet[1], 'r:id'))
    if (!target) continue
    const filePath = target.startsWith('/') ? target.slice(1) : path.posix.normalize('xl/' + target)
    const xml = entries.get(filePath) || ''
    const linkRels = relationships(entries.get(path.posix.dirname(filePath) + '/_rels/' + path.posix.basename(filePath) + '.rels') || '')
    const links = new Map([...xml.matchAll(/<hyperlink\s([^>]+)\/?\s*>/g)].map(m => [attr(m[1], 'ref'), linkRels.get(attr(m[1], 'r:id'))]))
    const rows = []
    for (const row of xml.matchAll(/<row\s([^>]*)>([\s\S]*?)<\/row>/g)) {
      const cells = {}
      for (const cell of row[2].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(cell[1], 'r'), body = cell[2] || '', type = attr(cell[1], 't')
        const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1] || ''
        const value = type === 's' ? strings[Number(raw)] : type === 'inlineStr' ? texts(body) : decode(raw)
        cells[ref.replace(/\d+/g, '')] = { value: value ?? '', ...(links.has(ref) ? { hyperlink: links.get(ref) } : {}) }
      }
      rows.push({ number: Number(attr(row[1], 'r')), cells })
    }
    sheets.push({ name, rows })
  }
  return sheets
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const sheets = await readWorkbook(process.argv[2])
  console.log(JSON.stringify(sheets.map(s => ({ name: s.name, rows: s.rows.length, sample: s.rows.slice(0, 4) })), null, 2))
}
