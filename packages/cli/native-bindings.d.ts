/**
 * Type declarations for native Node.js bindings (.node files)
 *
 * This file ensures TypeScript recognizes .node files from napi-rs bindings
 * used by packages like @infisical/quic (which uses Cloudflare's quiche library via napi-rs)
 *
 * The @infisical/quic package provides its own TypeScript definitions,
 * so we only need to declare support for .node file imports here.
 */

declare module '*.node' {
  // biome-ignore lint/suspicious/noExplicitAny: Native bindings are platform-specific and cannot be typed
  const value: any
  export default value
}
