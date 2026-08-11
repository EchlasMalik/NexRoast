import { describe, expect, it } from "vitest";
import {
  InvalidUrlError,
  parseAndValidatePublicUrl,
} from "@/lib/url-validation";

/**
 * SSRF is the highest-consequence thing in this codebase: a submitted URL is
 * loaded by a server-side browser, so anything that slips through here can
 * reach the internal network and the cloud metadata endpoint.
 */
describe("parseAndValidatePublicUrl", () => {
  const rejects = async (input: string) => {
    await expect(parseAndValidatePublicUrl(input)).rejects.toBeInstanceOf(
      InvalidUrlError,
    );
  };

  it("assumes https when no scheme is given", async () => {
    const url = await parseAndValidatePublicUrl("example.com");
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("example.com");
  });

  it("rejects non-http schemes", async () => {
    await rejects("file:///etc/passwd");
    await rejects("ftp://example.com");
    // javascript: parses, but must never reach a browser.
    await rejects("javascript:alert(1)");
  });

  it("rejects loopback by name", async () => {
    await rejects("http://localhost");
    await rejects("http://0.0.0.0");
  });

  it("rejects private IPv4 literals", async () => {
    await rejects("http://127.0.0.1");
    await rejects("http://10.0.0.5");
    await rejects("http://192.168.1.1");
    await rejects("http://172.16.0.1");
    await rejects("http://172.31.255.254");
  });

  it("rejects the cloud metadata endpoint", async () => {
    await rejects("http://169.254.169.254/latest/meta-data/");
  });

  it("rejects carrier-grade NAT space", async () => {
    // 100.64.0.0/10 is internal address space at several hosting providers,
    // so it is reachable from a serverless function.
    await rejects("http://100.64.0.1");
    await rejects("http://100.127.255.255");
  });

  it("allows public addresses that merely look adjacent to private ones", async () => {
    await expect(
      parseAndValidatePublicUrl("http://172.32.0.1"),
    ).resolves.toBeInstanceOf(URL);
    await expect(
      parseAndValidatePublicUrl("http://100.128.0.1"),
    ).resolves.toBeInstanceOf(URL);
  });

  it("rejects IPv6 loopback and unique-local literals", async () => {
    await rejects("http://[::1]");
    await rejects("http://[fc00::1]");
    await rejects("http://[fd12:3456::1]");
  });

  it("rejects the whole IPv6 link-local range, not just fe80", async () => {
    // Link-local is fe80::/10 — fe80 through febf.
    await rejects("http://[fe80::1]");
    await rejects("http://[fe90::1]");
    await rejects("http://[fea0::1]");
    await rejects("http://[febf::1]");
  });

  it("rejects IPv4-mapped IPv6 loopback in both notations", async () => {
    await rejects("http://[::ffff:127.0.0.1]");
    await rejects("http://[::ffff:7f00:1]");
    await rejects("http://[::ffff:10.0.0.1]");
  });

  it("rejects hostnames that resolve only to private addresses", async () => {
    // Public DNS name that resolves to 127.0.0.1 — the DNS-rebinding case the
    // hostname resolution step exists to catch.
    await rejects("http://localtest.me");
  });
});
