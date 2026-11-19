// Re-mounts on every navigation (unlike layout.tsx), so this is the one place
// the page entrance plays: a single short fade-rise per screen.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>
}
