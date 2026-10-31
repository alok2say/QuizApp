import { safeCallbackUrl } from '@/lib/safeRedirect'
import { LoginForm } from './LoginForm'

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { callbackUrl, created } = await searchParams

  return (
    <LoginForm
      callbackUrl={safeCallbackUrl(typeof callbackUrl === 'string' ? callbackUrl : null)}
      justCreated={created === '1'}
    />
  )
}
