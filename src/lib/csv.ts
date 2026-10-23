import { isDateOnly } from './lifecycle.ts'

export function parseCSV(input: string): Record<string, string>[] {
  const text = input.replace(/^\uFEFF/, '')
  const firstLine = text.split(/\r?\n/)[0] || ''
  const delimiter = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], value = '', quoted = false, closed = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++ }
      else if (c === '"') { quoted = false; closed = true }
      else value += c
    } else if (c === '"' && !value && !closed) quoted = true
    else if (c === delimiter) { row.push(value); value = ''; closed = false }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(value); if (row.some(Boolean)) rows.push(row)
      row = []; value = ''; closed = false
    } else if (closed) { if (!/\s/.test(c)) throw new Error('CSV inválido después de una comilla de cierre.') }
    else value += c
  }
  if (quoted) throw new Error('CSV con comillas sin cerrar.')
  row.push(value); if (row.some(Boolean)) rows.push(row)
  if (!rows.length) return []
  const headers = rows.shift()!.map(h => h.trim().toLowerCase())
  if (new Set(headers).size !== headers.length || headers.some(h => !h)) throw new Error('El CSV tiene encabezados vacíos o repetidos.')
  return rows.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`La fila ${i + 2} tiene ${values.length} columnas; se esperaban ${headers.length}.`)
    return Object.fromEntries(headers.map((h, index) => [h, values[index].trim()]))
  })
}

export function serializeCSV(rows: Record<string, unknown>[], headers: string[]) {
  const escape = (input: unknown) => {
    let value = String(input ?? '')
    // Prevent spreadsheet formula injection when exported text is opened in Excel.
    if (/^[=+@\-\t\r]/.test(value)) value = "'" + value
    return /[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value
  }
  return '\uFEFF' + [headers, ...rows.map(row => headers.map(h => row[h]))].map(row => row.map(escape).join(',')).join('\r\n')
}

export function parseSourceDate(input: string): string {
  const value = input.trim()
  if (isDateOnly(value)) return value
  const short = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (short) {
    const date = `${short[3]}-${short[2].padStart(2, '0')}-${short[1].padStart(2, '0')}`
    if (isDateOnly(date)) return date
  }
  if (/^\d+(?:\.\d+)?$/.test(value) && Number(value) >= 61 && Number(value) <= 100000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(value)) * 86400000).toISOString().slice(0, 10)
  }
  throw new Error(`Fecha no reconocida: ${value || '(vacía)'}`)
}

export function parsePrice(input: string): number {
  let value = input.trim().replace(/US\$|USD|PEN|S\/\.?|\$|\s/gi, '')
  if (!/^\d[\d.,]*$/.test(value)) throw new Error(`Precio no válido: ${input}`)
  if (value.includes(',') && value.includes('.')) {
    value = value.lastIndexOf(',') > value.lastIndexOf('.') ? value.replaceAll('.', '').replace(',', '.') : value.replaceAll(',', '')
  } else if (value.includes(',')) value = /,\d{1,2}$/.test(value) ? value.replace(',', '.') : value.replaceAll(',', '')
  const price = Number(value)
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Precio no válido: ${input}`)
  return price
}
