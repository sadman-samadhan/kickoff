/* eslint-disable @next/next/no-img-element */
// Ball mark + wordmark as live text, so it reads in light (ink) and dark (white) mode.
export function BrandLogo({ size = 64 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <img src="/icons/logo-mini.png" alt="" width={size} height={size} className="rounded-full" style={{ width: size, height: size }} />
      <span className="font-display font-extrabold leading-none" style={{ fontSize: Math.round(size * 0.36) }}>
        Khela<span className="text-app-primary">Hobe</span>
      </span>
    </div>
  )
}
