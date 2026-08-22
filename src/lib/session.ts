import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function getCurrentUser(): Promise<{id: string; role: 'USER' | 'ADMIN'} | null> {
    const session = await getServerSession(authOptions)
    if(!session?.user) return null
    return {id: session.user.id, role: session.user.role}
} 