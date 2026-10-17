import '@/app/auction.css'

// Live scoring uses the same theme as the auction: Clean Pitch in light, Floodlight in dark.
export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <div className={`ka min-h-[calc(100dvh-130px)]`}>{children}</div>
}
