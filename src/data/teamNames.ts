import type { TeamNameLanguage } from '../types'

const TEAM_NAMES: Record<TeamNameLanguage, string[]> = {
  en: [
    // Keep — best originals
    'Dream Team',
    'The Underdogs',
    'The Misfits',
    'Mighty Ducks',
    'Victorious Secret',
    'Game of Throws',
    // Cool / Powerful
    'Dark Knights',
    'Rising Stars',
    'Fire Birds',
    'Black Mambas',
    'Storm Riders',
    'Supernova',
    'Night Owls',
    'Outlaws',
    'Golden Eagles',
    'Sandstorm',
    'Terminators',
    'Alpha Wolves',
    'Iron Wolves',
    'Hawk Eyes',
    'Lightning Bolts',
    // Funny / Creative
    'Error 404',
    'Snack Attack',
    'Trouble Makers',
    'Slow Internet',
    'Coffee Addicts',
    'The Gelato Gang',
    'Walkie Talkies',
    'Lucky Charms',
    'Jazz Hands',
    'Dirty Dozen',
    'Goal Diggers',
    'Too Hot to Handle',
    'Chill Club',
    'One-Hit Wonders',
  ],
  ar: [
    // Original 15
    'الصقور',
    'النسور',
    'الأسود',
    'النجوم',
    'الرعد',
    'البرق',
    'الفرسان',
    'الذئاب',
    'النمور',
    'الأبطال',
    'صقور الحارة',
    'أسود الملعب',
    'نجوم الشارع',
    'شباب الحي',
    'الجوهرة السوداء',
    // New 15
    'العقارب',
    'الثعالب',
    'القناصة',
    'الصواعق',
    'النيران',
    'أبطال الليل',
    'فريق الحلم',
    'نجوم الأرض',
    'عمالقة الملعب',
    'أسود الصحراء',
    'صقور السماء',
    'نسور الشمس',
    'فرسان الليل',
    'رعد السماء',
    'أبطال المدينة',
  ],
  tr: [
    // Original 15
    'Real Mardin',
    'Werder Veremem',
    'Atletico Dikmen',
    'Bayern Bagcilar',
    'Nevresim Takimi',
    'Yenilmezler FK',
    'Haddini Bilbao',
    'Isparta Prag',
    'Baston Villa',
    'Asfalt Panterleri',
    'Gece Kartallari',
    'Iman Gucu',
    'Deportivo La Korum Ha',
    'Cenabetis',
    'Yardirancia',
    // New 15
    'Firtina FC',
    'Yildiz Takimi',
    'Aslanlar',
    'Kurt Surusu',
    'Sahin Gozler',
    'Celik Adam',
    'Gol Makinasi',
    'Buz Kiricilar',
    'Alev Topu',
    'Kara Simekler',
    'Gece Avcilari',
    'Ruzgar Gucu',
    'Dag Kartallari',
    'Demir Yumruk',
    'Son Saniye',
  ],
}

/** Fisher-Yates shuffle, return `count` random unique names for the given language. */
export function getRandomTeamNames(language: TeamNameLanguage, count: number): string[] {
  const pool = [...TEAM_NAMES[language]]

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  return pool.slice(0, count)
}
