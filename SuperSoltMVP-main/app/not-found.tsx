import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h2 className="mb-4 text-2xl font-bold">404 - Page Not Found</h2>
      <p className="mb-8 text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        Go Home
      </Link>
    </div>
  )
}
