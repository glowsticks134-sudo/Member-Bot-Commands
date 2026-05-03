const ownerSessions = new Set<string>();
const superOwnerSessions = new Set<string>();

export function grantOwnerSession(userId: string): void {
  ownerSessions.add(userId);
}

export function grantSuperOwnerSession(userId: string): void {
  superOwnerSessions.add(userId);
  ownerSessions.add(userId);
}

export function revokeSession(userId: string): void {
  ownerSessions.delete(userId);
  superOwnerSessions.delete(userId);
}

export function hasOwnerSession(userId: string): boolean {
  return ownerSessions.has(userId);
}

export function hasSuperOwnerSession(userId: string): boolean {
  return superOwnerSessions.has(userId);
}
