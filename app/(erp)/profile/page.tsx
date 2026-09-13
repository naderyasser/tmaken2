'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LoginPage } from '@/components/login-page'
import { SelfServiceProfile } from '@/components/self-service-profile'

export default function ProfilePage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <LoginPage />

  return <SelfServiceProfile onBack={() => router.push('/')} />
}
