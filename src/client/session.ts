const TOKEN_PREFIX = 'unsaid:participant:';

export function storeParticipantToken(slug: string, token: string) {
  sessionStorage.setItem(`${TOKEN_PREFIX}${slug}`, token);
}

export function getParticipantToken(slug: string) {
  return sessionStorage.getItem(`${TOKEN_PREFIX}${slug}`);
}

export function clearParticipantToken(slug: string) {
  sessionStorage.removeItem(`${TOKEN_PREFIX}${slug}`);
}
