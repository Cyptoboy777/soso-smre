/** Client-side referral helpers. Never invents users or volume. */

const REF_KEY = "fs_ref";
const REF_RE = /^[a-zA-Z0-9_-]{2,64}$/;
const IDEA_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function normalizeRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!REF_RE.test(t)) return null;
  return t;
}

export function normalizeIdeaId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().slice(0, 64);
  if (!IDEA_RE.test(t)) return null;
  return t;
}

export function readStoredRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeRef(window.localStorage.getItem(REF_KEY));
  } catch {
    return null;
  }
}

export function persistRefFromUrl(search: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(search);
  const ref = normalizeRef(params.get("ref"));
  if (!ref) return readStoredRef();
  try {
    window.localStorage.setItem(REF_KEY, ref);
  } catch {
    /* ignore */
  }
  return ref;
}

export function buildShareUrl(opts: {
  origin: string;
  path?: string;
  ideaId?: string;
  ref?: string | null;
}): string {
  const url = new URL(opts.path || "/", opts.origin);
  const idea = normalizeIdeaId(opts.ideaId ?? null);
  if (idea) url.searchParams.set("idea", idea);
  const ref = normalizeRef(opts.ref ?? null);
  if (ref) url.searchParams.set("ref", ref);
  return url.toString();
}
