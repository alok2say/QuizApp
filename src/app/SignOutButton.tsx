'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => signOut({ callbackUrl: '/' })}>
      Log out
    </button>
  )
}
