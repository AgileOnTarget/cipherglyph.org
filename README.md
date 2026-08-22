# cipherglyph.org

Public site for CipherGlyph. Hosted on GitHub Pages. Custom domain `cipherglyph.org`.

This is not the iPhone viewer source. That stays in the local CipherGlyph folder and is not pushed.

| Path | Role |
|------|------|
| `index.html` | Public static CipherGlyph creator, encoder, receipt export, and disabled coming-soon inscription surface |
| `about.html` | About CipherGlyph and BadGlyph |
| `cipherglyph.html` | CipherGlyph teaching page and simulator |
| `faucet.html` | BadCoin Faucet POC page using HPP as the planned rate limiter, with local cold-wallet generation |
| `privacy.html` | Privacy policy for App Store Connect |
| `support.html` | Support page for App Store Connect |
| `CNAME` | `cipherglyph.org` |

Pages: branch `main`, root `/`.

Namecheap should use DNS A and AAAA records to GitHub Pages, not URL Redirect.

## Live

| Field | Value |
|-------|-------|
| URL | https://cipherglyph.org |
| Host | GitHub Pages, branch `main`, root |
| DNS | Namecheap BasicDNS. Four A records at GitHub, `www` CNAME to `agileontarget.github.io.` |
| Certificate | Let's Encrypt, apex and `www`, Enforce HTTPS on |
| Since | 2026-08-19 |

2026-08-21 launch update: the home page is now the static creator and encoder. The previous explanatory home-page direction lives at `about.html`. INSCRIBE remains visible but disabled as coming soon. The public site does not request HPP burns, connect to a treasury, sign, send, or broadcast.

2026-08-22 faucet start: `faucet.html` is the public page shell for the BadCoin Faucet POC. It copies the HPP landing-page gate pattern into CipherGlyph branding and states the planned flow: 10 BAD per HPP request, 1 Presence Credit burned as the rate limiter, treasury deposit after verification. The page now includes a browser-local BadCoin cold-wallet generator based on the BadCoin vanity generator path: fresh secp256k1 key, canonical P2SH-wrapped SegWit `B...` address, `C...` WIF, PNG download, and print-to-PDF. It still does not send BAD until the HPP verifier, treasury sender, and balance lookup are wired.

If the certificate ever goes missing after a DNS change, do not start moving records. Check for
a CAA record, check that plain HTTP is not redirecting, then unbind and rebind the custom
domain in Settings, Pages. Pages leaves stale validation behind when a domain is bound before
DNS is correct, and it does not retry on its own.

## Contact on these pages

Support offers the BadCoin Telegram and `support@cipherglyph.org`. Privacy offers only the
role address, deliberately: a data request should not have to be made in a public chat. No
personal mailbox goes on these pages.
