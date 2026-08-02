// Registry-restricted gTLDs reserved for adult content — blocking the TLD
// itself is precise (no false positives) since registration is gated.
const DENYLISTED_TLDS = new Set(["xxx", "porn", "adult", "sex", "sexy"]);

// Hostname-label keywords for adult content. Checked against individual
// dot/hyphen-separated labels, not raw substring-of-everything, so this
// doesn't false-positive on an unrelated word that merely contains one of
// these as a substring (e.g. "essexroofing" not matching "sex").
const DENYLISTED_LABEL_KEYWORDS = [
  "porn",
  "pornhub",
  "xvideos",
  "xnxx",
  "xxx",
  "nsfw",
  "escort",
  "escorts",
  "onlyfans",
];

function hostnameLabels(hostname: string): string[] {
  return hostname.toLowerCase().split(/[.-]/).filter(Boolean);
}

function loadExtraDenylist(): Set<string> {
  const raw = process.env.URL_DENYLIST_DOMAINS ?? "";
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Basic brand-safety / abuse guard for submitted URLs — checked before a
 * roast is created, so obviously adult or operator-denylisted sites never
 * get screenshotted, critiqued, or shared. This is a coarse heuristic, not
 * a threat-intel feed: it catches the obvious cases (adult gTLDs, a short
 * list of well-known adult sites, and whatever the operator adds via
 * URL_DENYLIST_DOMAINS) rather than claiming to catch everything malicious.
 */
export function isUrlDenylisted(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  const labels = hostnameLabels(hostname);
  const tld = labels[labels.length - 1];

  if (tld && DENYLISTED_TLDS.has(tld)) return true;
  if (labels.some((label) => DENYLISTED_LABEL_KEYWORDS.includes(label))) {
    return true;
  }

  const extra = loadExtraDenylist();
  if (extra.has(hostname)) return true;
  // Also match subdomains of a denylisted registrable-ish domain, e.g.
  // "www.bad.com" when the operator denylisted "bad.com".
  if ([...extra].some((domain) => hostname.endsWith(`.${domain}`))) {
    return true;
  }

  return false;
}
