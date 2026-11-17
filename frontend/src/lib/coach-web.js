// The browser-only build (VITE_LOCAL=1) can run the Coach itself, with the person's own API key,
// the same way the phone app does (lib/coach-local.js). This file is the one place that says so.
import { MOBILE } from './mobile.js'

// True only in the browser local build. MOBILE and server builds are unaffected.
// Read straight from the build variable that demo.js reads (not imported from it), so tests that
// mock demo.js without this export keep working.
export const WEB_COACH = import.meta.env.VITE_LOCAL === '1' && !MOBILE

// Providers that answer a browser's CORS preflight with the headers the adapters send:
//  openai     api.openai.com: Authorization: Bearer <key>. Works from a browser.
//  anthropic  adapter already sends 'anthropic-dangerous-direct-browser-access: true'. Works.
//  gemini     adapter sends the key as 'x-goog-api-key' header. Works.
//  openrouter adapter sends Bearer + http-referer + x-title; OpenRouter allows browser calls. Works.
// Left out on the web: minimax (no CORS promise we can verify) and compatible (an Ollama or LM
// Studio on your network is plain http:// from an https page, which a browser blocks as mixed
// content, and needs the server to allow this origin). Both stay available in the phone app.
// OpenAI first: it is the default.
export const WEB_PROVIDERS = ['openai', 'anthropic', 'gemini', 'openrouter']
export const WEB_DEFAULT_PROVIDER = 'openai'
export const webProviderOk = id => WEB_PROVIDERS.includes(id)
