export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Browsers may omit Origin on same-origin safe requests such as GET.
  // Mutating requests must still provide and match it.
  if (!origin) return ["GET", "HEAD", "OPTIONS"].includes(request.method);
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
