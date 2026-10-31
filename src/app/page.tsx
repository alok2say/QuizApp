import { getCurrentUser } from '@/lib/session'
import { HomeView } from '@/features/home/HomeView'

export default async function Home() {
  const user = await getCurrentUser()

  return <HomeView signedIn={user !== null} />
}
