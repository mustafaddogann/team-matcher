import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ImportPreview, ImportError } from '../types'
import { autoDetectColumns } from '../utils/columnMapping'

export function parseCSV(text: string): ImportPreview {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  const headers = result.meta.fields ?? []
  const rows = result.data
  const mapping = autoDetectColumns(headers)
  const errors = detectErrors(rows, mapping)

  return { headers, rows, mapping, errors }
}

export function parseXLSX(buffer: ArrayBuffer): ImportPreview {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })

  // Extract headers from first row keys
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const mapping = autoDetectColumns(headers)

  // Convert all values to strings
  const stringRows = rows.map(row => {
    const stringRow: Record<string, string> = {}
    for (const key of Object.keys(row)) {
      stringRow[key] = String(row[key])
    }
    return stringRow
  })

  const errors = detectErrors(stringRows, mapping)

  return { headers, rows: stringRows, mapping, errors }
}

export async function parseFile(file: File): Promise<ImportPreview> {
  const ext = file.name.toLowerCase().split('.').pop()

  if (ext === 'csv') {
    const text = await file.text()
    return parseCSV(text)
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    return parseXLSX(buffer)
  }

  throw new Error(`Unsupported file type: .${ext}`)
}

function detectErrors(
  rows: Record<string, string>[],
  mapping: { name: string | null; skill: string | null },
): ImportError[] {
  const errors: ImportError[] = []

  rows.forEach((row, i) => {
    if (mapping.name) {
      const name = row[mapping.name]?.trim()
      if (!name) {
        errors.push({ row: i + 1, field: 'name', message: 'Name is empty' })
      }
    }

    if (mapping.skill) {
      const skill = row[mapping.skill]?.trim()
      if (skill && isNaN(Number(skill))) {
        errors.push({ row: i + 1, field: 'skill', message: `Invalid skill value: "${skill}"` })
      }
    }
  })

  return errors
}
