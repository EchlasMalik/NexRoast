import dns from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

export class InvalidUrlError extends Error {}

/**
 * Most people type "domain.com" or "www.domain.com", not a full URL — being
 * strict about the scheme here is exactly the kind of friction that makes
 * someone bounce instead of submitting. If there's no http(s) scheme
 * already, assume https:// rather than rejecting it; every check below
 * (protocol, private IPs, DNS rebinding) still runs on the result, so this
 * only relaxes what counts as *well-formed* input, not what's allowed.
 */
function normalizeUrlInput(input: string): string {
  return /^https?:\/\//i.test(input) ? input : `https://${input}`;
}

function isPrivateIpv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    // Carrier-grade NAT. Used as internal address space by several hosting
    // providers, so it is reachable from a serverless function and must not be.
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // IPv4 mapped into IPv6 — the embedded address is what actually gets
  // dialled, so it has to go through the IPv4 rules rather than a prefix
  // string match. Node normalises ::ffff:127.0.0.1 to ::ffff:7f00:1, so a
  // "::ffff:127." prefix test misses it entirely.
  const mapped = normalized.match(/^::ffff:(.+)$/);
  if (mapped) {
    const embedded = mapped[1];
    if (isIP(embedded) === 4) return isPrivateIpv4(embedded);
    // Hex form: ::ffff:7f00:1 -> 127.0.0.1
    const hex = embedded.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const high = parseInt(hex[1], 16);
      const low = parseInt(hex[2], 16);
      const dotted = [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
      return isPrivateIpv4(dotted);
    }
  }

  if (normalized === "::1" || normalized === "::") return true;

  // Unique local is fc00::/7 — fc and fd only.
  if (/^f[cd]/.test(normalized)) return true;

  // Link-local is fe80::/10, which spans fe80 through febf. Matching only the
  // literal "fe80" left fe90::, fea0:: and feb0:: reachable.
  const linkLocal = normalized.match(/^fe([89ab])[0-9a-f]/);
  if (linkLocal) return true;

  return false;
}

function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return false;
}

/**
 * Parses and validates a user-submitted URL, rejecting anything that isn't a
 * public http(s) address. This guards against SSRF: a submitted URL is later
 * loaded by a server-side browser, so it must not be able to reach localhost,
 * private/link-local networks, or the cloud metadata endpoint — including via
 * a hostname that only resolves to one of those ranges (DNS rebinding).
 */
export async function parseAndValidatePublicUrl(input: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(normalizeUrlInput(input));
  } catch {
    throw new InvalidUrlError("That doesn't look like a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidUrlError("URL must start with http:// or https://.");
  }

  // URL.hostname keeps the brackets on an IPv6 literal ("[::1]"), and isIP()
  // rejects that form — so without stripping them first, every IPv6 literal
  // skipped the private-address check and fell through to a DNS lookup that
  // only happened to fail. Strip once, here, before any comparison.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new InvalidUrlError("That host isn't allowed.");
  }

  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new InvalidUrlError("That host isn't allowed.");
    }
    return parsed;
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new InvalidUrlError("That host could not be resolved.");
  }

  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new InvalidUrlError("That host isn't allowed.");
  }

  return parsed;
}
