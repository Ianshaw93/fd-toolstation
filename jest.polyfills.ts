// jsdom does not expose TextDecoder/TextEncoder; browsers (and the vendored directory client) rely on them.
import { TextDecoder, TextEncoder } from 'util';

if (typeof globalThis.TextDecoder === 'undefined') {
  Object.assign(globalThis, { TextDecoder, TextEncoder });
}
