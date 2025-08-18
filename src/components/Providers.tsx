'use client'

import { PricingProvider } from '@/contexts/PricingContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PricingProvider>
      {children}
    </PricingProvider>
  )
}