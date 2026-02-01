export function generateToken(): string {
  return `${crypto.randomUUID()}-${Date.now()}`
}

export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt)
}

export function generateInviteLink(token: string): string {
  return `${window.location.origin}/onboarding/portal/${token}`
}
