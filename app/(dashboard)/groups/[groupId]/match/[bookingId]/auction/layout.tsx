import '@/app/auction.css'

export default function AuctionLayout({ children }: { children: React.ReactNode }) {
  return <div className={`ka min-h-[calc(100dvh-130px)]`}>{children}</div>
}
