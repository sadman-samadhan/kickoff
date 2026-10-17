// Splits players into N even teams: equal sizes (±1), near-equal average strength, and positions spread
// out (goalkeepers especially). Snake draft for a good start, then pairwise swaps while they help.
// Several seeded restarts give different, equally fair options for the "Shuffle" button.

export type BalancePlayer = { id: string; name: string; strength: number; position: string | null }
export type BalancedTeam = { players: BalancePlayer[]; avgStrength: number; totalStrength: number }
export type BalanceResult = { teams: BalancedTeam[]; spread: number; cost: number }

const POSITION_WEIGHT: Record<string, number> = { GK: 60, DEF: 12, MID: 8, ATT: 8 }

/** Small, fast seeded random generator so a given seed always gives the same teams. */
export function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function variance(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length
}

function cost(teams: BalancePlayer[][]) {
  const avgs = teams.map((t) => t.reduce((s, p) => s + p.strength, 0) / Math.max(1, t.length))
  let c = variance(avgs)
  for (const [pos, w] of Object.entries(POSITION_WEIGHT)) {
    c += w * variance(teams.map((t) => t.filter((p) => p.position === pos).length))
  }
  return c
}

function improve(teams: BalancePlayer[][]) {
  let best = cost(teams)
  let changed = true
  let guard = 0
  while (changed && guard++ < 200) {
    changed = false
    for (let a = 0; a < teams.length; a++) {
      for (let b = a + 1; b < teams.length; b++) {
        for (let i = 0; i < teams[a].length; i++) {
          for (let j = 0; j < teams[b].length; j++) {
            const pa = teams[a][i]
            teams[a][i] = teams[b][j]
            teams[b][j] = pa
            const c = cost(teams)
            if (c < best - 1e-9) {
              best = c
              changed = true
            } else {
              teams[b][j] = teams[a][i]
              teams[a][i] = pa
            }
          }
        }
      }
    }
  }
  return best
}

export function balanceTeams(players: BalancePlayer[], numTeams: number, seed = 1): BalanceResult {
  const n = Math.max(2, Math.min(numTeams, players.length))
  const rand = seededRandom(seed)
  const candidates: { teams: BalancePlayer[][]; cost: number }[] = []

  for (let attempt = 0; attempt < 24; attempt++) {
    // Jitter strengths a little so each attempt drafts in a slightly different order.
    const order = [...players]
      .map((p) => ({ p, key: p.strength + (rand() - 0.5) * 80 }))
      .sort((x, y) => y.key - x.key)
      .map((x) => x.p)
    const teams: BalancePlayer[][] = Array.from({ length: n }, () => [])
    order.forEach((p, i) => {
      const round = Math.floor(i / n)
      const slot = i % n
      teams[round % 2 === 0 ? slot : n - 1 - slot].push(p)
    })
    candidates.push({ teams, cost: improve(teams) })
  }

  // Pick at random among the options that are (almost) as fair as the best one.
  candidates.sort((a, b) => a.cost - b.cost)
  const fair = candidates.filter((c) => c.cost <= candidates[0].cost * 1.05 + 1)
  const chosen = fair[Math.floor(rand() * fair.length)]
  return summarize(chosen.teams)
}

export function summarize(teams: BalancePlayer[][]): BalanceResult {
  const out = teams.map((t) => {
    const total = t.reduce((s, p) => s + p.strength, 0)
    return { players: [...t].sort((a, b) => b.strength - a.strength), totalStrength: total, avgStrength: total / Math.max(1, t.length) }
  })
  const avgs = out.map((t) => t.avgStrength)
  return { teams: out, spread: Math.max(...avgs) - Math.min(...avgs), cost: cost(teams) }
}
