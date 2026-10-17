import { Archivo, Barlow, Barlow_Condensed, Figtree } from 'next/font/google'

// Clean Pitch (light): Archivo + Figtree. Floodlight (dark): Barlow Condensed + Barlow.
const archivo = Archivo({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-ka-archivo', display: 'swap' })
const figtree = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-ka-figtree', display: 'swap' })
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-ka-barlow-condensed', display: 'swap' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-ka-barlow', display: 'swap' })

export const auctionFontVars = [archivo.variable, figtree.variable, barlowCondensed.variable, barlow.variable].join(' ')
