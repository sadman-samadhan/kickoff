// Geometry for the KhelaHbe football (classic 32-panel look, flattened): a centre pentagon, five outer pentagons
// in line with its corners (cut off by the rim), seams from each centre corner out to them, and seams joining
// neighbouring outer pentagons. Shared by the logo, app icons and landing page so the ball is identical everywhere.

type Pt = [number, number]

const pent = (cx: number, cy: number, r: number, rot: number): Pt[] =>
  Array.from({ length: 5 }, (_, k) => {
    const a = ((rot + 72 * k) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })

const f = (n: number) => n.toFixed(2)
const poly = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + ' Z'

/** Path data for a ball of radius R centred on 0,0: `patches` are filled, `seams` are stroked. */
export function ballPaths(R: number) {
  const centre = pent(0, 0, R * 0.3, -90)
  const outer = centre.map((_, k) => {
    const a = -90 + 72 * k
    const rad = (a * Math.PI) / 180
    return pent(R * 0.97 * Math.cos(rad), R * 0.97 * Math.sin(rad), R * 0.26, a + 180)
  })
  const seams: string[] = []
  for (let k = 0; k < 5; k++) {
    seams.push(`M${f(centre[k][0])} ${f(centre[k][1])} L${f(outer[k][0][0])} ${f(outer[k][0][1])}`)
    // join to the next outer pentagon through the closest pair of corners
    const p = outer[k]
    const q = outer[(k + 1) % 5]
    let best: [Pt, Pt] = [p[0], q[0]]
    let d = Infinity
    for (const a of p) for (const b of q) {
      const dd = Math.hypot(a[0] - b[0], a[1] - b[1])
      if (dd < d) [d, best] = [dd, [a, b]]
    }
    seams.push(`M${f(best[0][0])} ${f(best[0][1])} L${f(best[1][0])} ${f(best[1][1])}`)
  }
  return { patches: [poly(centre), ...outer.map(poly)].join(' '), seams: seams.join(' ') }
}
