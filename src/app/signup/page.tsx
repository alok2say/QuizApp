import { safeCallbackUrl } from '@/lib/safeRedirect'
import { SignupForm } from '@/features/auth/SignupForm'

export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const { callbackUrl } = await searchParams

  return <SignupForm callbackUrl={safeCallbackUrl(typeof callbackUrl === 'string' ? callbackUrl : null)} />
}
