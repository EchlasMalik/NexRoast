import dns from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

export class InvalidUrlError extends Error {}

function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split(".").map(Number);
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    normalized.startsWith("::ffff:127.")
  );
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
    parsed = new URL(input);
  } catch {
    throw new InvalidUrlError("That doesn't look like a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidUrlError("URL must start with http:// or https://.");
  }

  const hostname = parsed.hostname;
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
