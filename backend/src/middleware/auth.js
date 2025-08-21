// Placeholder auth (optional). Could extend with JWT if user accounts added later.
export function authOptional(req, _res, next) {
  // For now sessions are anonymous; client handles encryption keys.
  next();
}

export function verifySocketAuth(socket, next) {
  // Accept all for MVP; production: validate a signature proving possession of room secret hash.
  next();
}
