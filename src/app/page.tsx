import { Suspense } from 'react'
import { HomeClient } from './page-client'

export default function Home() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <HomeClient />
    </Suspense>
  )
}
