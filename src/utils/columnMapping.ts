import type { ColumnMapping } from '../types'

const NAME_ALIASES = ['name', 'player', 'participant', 'member', 'person', 'full name', 'fullname']
const SKILL_ALIASES = ['skill', 'skills', 'points', 'rating', 'score', 'level', 'rank', 'elo', 'mmr', 'ability']
const ROLE_ALIASES = ['role', 'position', 'pos', 'class', 'type']

function normalize(header: string): string {
  return header.toLowerCase().trim().replace(/[_\-]/g, ' ')
}

function findMatch(headers: string[], aliases: string[]): string | null {
  for (const header of headers) {
    const normalized = normalize(header)
    if (aliases.includes(normalized)) {
      return header
    }
  }
  return null
}

export function autoDetectColumns(headers: string[]): ColumnMapping {
  return {
    name: findMatch(headers, NAME_ALIASES),
    skill: findMatch(headers, SKILL_ALIASES),
    role: findMatch(headers, ROLE_ALIASES),
  }
}

export function applyMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): { name: string; skill: string; role: string }[] {
  return rows.map(row => ({
    name: mapping.name ? (row[mapping.name] ?? '').trim() : '',
    skill: mapping.skill ? (row[mapping.skill] ?? '').trim() : '0',
    role: mapping.role ? (row[mapping.role] ?? '').trim() : '',
  }))
}
