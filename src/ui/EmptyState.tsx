// What a list shows when it has nothing in it
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-muted-foreground">{children}</p>
}
