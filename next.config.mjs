/** @type {import("next").NextConfig} */
const nextConfig = {
  // Surfaces unsafe lifecycles / double-invokes effects in development so
  // mount-time side effects (auto-analysis POSTs, registration calls) are
  // caught locally rather than in production. No effect on the built app.
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Every route, including /api/*.
        source: "/:path*",
        headers: [
          {
            // Telegram Mini App URLs carry `initData` (an HMAC-signed login
            // credential) in the fragment/query, and the Strava OAuth round
            // trip carries `code` and `state`. Sending no Referer at all is
            // the only setting that keeps those out of third-party logs.
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            // Stop browsers MIME-sniffing a JSON API response into something
            // executable.
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Pin the app to HTTPS for two years so a downgraded first request
            // can never leak Telegram `initData` or a Strava OAuth `code`.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            // Framing policy only. Deliberately NOT `X-Frame-Options: DENY`:
            // the app runs inside Telegram's web client in an iframe, which
            // DENY would break outright.
            //
            // `frame-ancestors` is not enforced for a document with no
            // ancestors, so the Telegram desktop/mobile clients — which load
            // the Mini App top-level in a native webview — are unaffected.
            // Only the web client is actually constrained, and it is allowed.
            //
            // No other CSP directives: a `script-src` here would need tuning
            // for Next's inline bootstrap scripts and is not worth breaking
            // the app over.
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
          },
          {
            // Deny the powerful features this app never uses. Camera is
            // intentionally absent: meal photos come from a plain
            // `<input type="file" accept="image/*">`, and denying camera can
            // remove the "Take Photo" option from the picker on some clients.
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
