import { describe, it, expect } from 'vitest'
import { autoDetectColumns, applyMapping } from '../utils/columnMapping'
import { parseCSV } from '../services/importService'

describe('autoDetectColumns', () => {
  it('detects common column names', () => {
    const mapping = autoDetectColumns(['Name', 'Skill', 'Role'])
    expect(mapping.name).toBe('Name')
    expect(mapping.skill).toBe('Skill')
    expect(mapping.role).toBe('Role')
  })

  it('detects aliases', () => {
    const mapping = autoDetectColumns(['Player', 'Rating', 'Position'])
    expect(mapping.name).toBe('Player')
    expect(mapping.skill).toBe('Rating')
    expect(mapping.role).toBe('Position')
  })

  it('returns null for unrecognized columns', () => {
    const mapping = autoDetectColumns(['foo', 'bar', 'baz'])
    expect(mapping.name).toBeNull()
    expect(mapping.skill).toBeNull()
    expect(mapping.role).toBeNull()
  })

  it('handles case insensitivity', () => {
    const mapping = autoDetectColumns(['NAME', 'POINTS', 'CLASS'])
    expect(mapping.name).toBe('NAME')
    expect(mapping.skill).toBe('POINTS')
    expect(mapping.role).toBe('CLASS')
  })

  it('handles underscores and hyphens', () => {
    const mapping = autoDetectColumns(['full_name', 'skill-points'])
    expect(mapping.name).toBe('full_name')
    // 'skill-points' normalizes to 'skill points', not in aliases
    expect(mapping.skill).toBeNull()
  })
})

describe('applyMapping', () => {
  it('maps rows to standardized fields', () => {
    const rows = [
      { Player: 'Alice', Rating: '80', Position: 'Forward' },
      { Player: 'Bob', Rating: '70', Position: 'Guard' },
    ]
    const result = applyMapping(rows, { name: 'Player', skill: 'Rating', role: 'Position' })
    expect(result).toEqual([
      { name: 'Alice', skill: '80', role: 'Forward' },
      { name: 'Bob', skill: '70', role: 'Guard' },
    ])
  })

  it('handles null mappings', () => {
    const rows = [{ Player: 'Alice', Something: '5' }]
    const result = applyMapping(rows, { name: 'Player', skill: null, role: null })
    expect(result[0]).toEqual({ name: 'Alice', skill: '0', role: '' })
  })
})

describe('parseCSV', () => {
  it('parses valid CSV with known headers', () => {
    const csv = 'Name,Skill\nAlice,80\nBob,70\n'
    const result = parseCSV(csv)

    expect(result.headers).toEqual(['Name', 'Skill'])
    expect(result.rows).toHaveLength(2)
    expect(result.mapping.name).toBe('Name')
    expect(result.mapping.skill).toBe('Skill')
    expect(result.errors).toHaveLength(0)
  })

  it('detects errors in rows', () => {
    const csv = 'Name,Skill\nAlice,abc\n,80\n'
    const result = parseCSV(csv)

    expect(result.errors).toHaveLength(2)
    expect(result.errors[0].field).toBe('skill')
    expect(result.errors[1].field).toBe('name')
  })

  it('handles empty CSV', () => {
    const csv = 'Name,Skill\n'
    const result = parseCSV(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })
})
