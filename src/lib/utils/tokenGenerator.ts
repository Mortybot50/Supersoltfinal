export function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function generateInviteUrl(token: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/onboarding/portal/${token}`;
}

export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt);
}
