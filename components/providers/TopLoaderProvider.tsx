'use client';

import NextTopLoader from 'nextjs-toploader';

export function TopLoaderProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NextTopLoader
        height={3}
        color="#16a34a"
        showSpinner={false}
      />
      {children}
    </>
  );
}
