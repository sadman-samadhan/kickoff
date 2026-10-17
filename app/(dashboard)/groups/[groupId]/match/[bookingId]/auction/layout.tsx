import '@/app/auction.css'
import { auctionFontVars } from '@/components/auction/fonts'

export default function AuctionLayout({ children }: { children: React.ReactNode }) {
  return <div className={`ka min-h-[calc(100dvh-130px)] ${auctionFontVars}`}>{children}</div>
}
