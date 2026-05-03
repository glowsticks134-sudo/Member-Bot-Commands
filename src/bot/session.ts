type TokenTier = "owner" | "super";

interface PendingToken {
  tier: TokenTier;
  expiresAt: number;
}

const pendingTokens = new Map<string, PendingToken>();

export function grantPendingToken(userId: string, tier: TokenTier): void {
  pendingTokens.set(userId, { tier, expiresAt: Date.now() + 20_000 });
}

export function consumeOwnerToken(userId: string): boolean {
  const token = pendingTokens.get(userId);
  if (!token || Date.now() > token.expiresAt) {
    pendingTokens.delete(userId);
    return false;
  }
  pendingTokens.delete(userId);
  return true;
}

export function consumeSuperToken(userId: string): boolean {
  const token = pendingTokens.get(userId);
  if (!token || Date.now() > token.expiresAt || token.tier !== "super") {
    pendingTokens.delete(userId);
    return false;
  }
  pendingTokens.delete(userId);
  return true;
}
