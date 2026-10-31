'use client'

import { signOut } from 'next-auth/react'
import { NavButton } from '@/ui'

export function SignOutButton() {
  return <NavButton onClick={() => signOut({ callbackUrl: '/' })}>Log out</NavButton>
}
