// "KF Futsal The Grand Stage V12.xlsx", used for seeding, the replay script and tests.

export const V12_RULES = { budget: 8000, squadSize: 8, bidIncrement: 25, basePrice: 50 }

export const V12_TIERS = [
  { name: 'Apex', color: '#f59e0b' },
  { name: 'Prestige', color: '#38bdf8' },
  { name: 'Dominion', color: '#a78bfa' },
] as const

export const V12_POOL: Record<(typeof V12_TIERS)[number]['name'], string[]> = {
  Apex: ['Anam', 'Anan', 'Faruk', 'Jawad', 'JH Sajid', 'Labib', 'Muaz', 'Ratul', 'Smit', 'Sojib', 'Tamal', 'Xibon'],
  Prestige: ['Afif', 'Alamin', 'Mehedi', 'Ruhit', 'Sajid', 'Siam', 'Sunando', 'Tahazib'],
  Dominion: ['Anabil', 'Arafat', 'Arif', 'Fahim S Sakib', 'Hridoy', 'Inan', 'Pappu', 'Rabby', 'Ridwan', 'Shajol', 'Tamim', 'Tonmoy'],
}

export const V12_TEAMS = [
  {
    name: 'The KF Syndicate', short: 'Syndicate', color: '#7c3aed', captain: 'Rafi',
    squad: { Labib: 1850, Ratul: 1300, Anan: 2600, Jawad: 1200, Mehedi: 200, Ruhit: 400, Shajol: 175, Hridoy: 50 },
    spent: 7775, remaining: 225,
  },
  {
    name: 'Khulna Footballers Royale CF', short: 'Royale', color: '#eab308', captain: 'Rayhan',
    squad: { Smit: 1500, Sojib: 3025, Sajid: 525, Siam: 125, Afif: 475, Sunando: 350, Rabby: 1700, Tonmoy: 300 },
    spent: 8000, remaining: 0,
  },
  {
    name: 'Real Madrid KF', short: 'R.Madrid', color: '#e2e8f0', captain: 'Rohan',
    squad: { 'JH Sajid': 2950, Xibon: 1675, Muaz: 825, Tahazib: 325, 'Fahim S Sakib': 150, Inan: 1950, Arif: 50, Anabil: 75 },
    spent: 8000, remaining: 0,
  },
  {
    name: 'The Mob KF', short: 'The Mob', color: '#dc2626', captain: 'Sakib',
    squad: { Tamal: 1950, Faruk: 2750, Anam: 2300, Alamin: 275, Ridwan: 150, Arafat: 300, Pappu: 100, Tamim: 50 },
    spent: 7875, remaining: 125,
  },
] as const

/** Who bought a player and for how much, per the sheet. */
export function v12Sale(player: string): { team: string; price: number } | null {
  for (const t of V12_TEAMS) {
    const price = (t.squad as Record<string, number>)[player]
    if (price != null) return { team: t.name, price }
  }
  return null
}
