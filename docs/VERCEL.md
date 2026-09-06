# Vercel static deployment

Vercel uses the opt-in `npm run build:static` path. It enables Vinext's static
export, skips the Sites and Cloudflare plugins, and copies the generated
`dist/client` files to `out`, which is the directory configured in
`vercel.json`.

The regular `npm run build` command remains the Cloudflare/Sites build used by
the existing private Site. The Vercel project should use the free plan with
the repository's default build settings; no server runtime or database
bindings are required.
