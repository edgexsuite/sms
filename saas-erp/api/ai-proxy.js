/**
 * Vercel Serverless Function — AI Proxy
 * Keeps Gemini & Groq API keys server-side (never exposed to the browser).
 * 
 * In Vercel Dashboard → Settings → Environment Variables, add:
 *   GEMINI_API_KEY  (without VITE_ prefix — server-only)
 *   GROQ_API_KEY    (without VITE_ prefix — server-only)
 * 
 * Remove VITE_GEMINI_API_KEY and VITE_GROQ_API_KEY from your env vars.
 */

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { provider, endpoint, payload } = await req.json();

  let targetUrl, authHeader;

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'Gemini not configured' }), { status: 500 });
    // Gemini 2.0 uses 'streamGenerateContent' for streaming
    const method = payload.stream ? 'streamGenerateContent' : 'generateContent';
    targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${payload.model}:${method}?key=${apiKey}`;
    authHeader = null;
  } else if (provider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'Groq not configured' }), { status: 500 });
    targetUrl = `https://api.groq.com/openai/v1/${endpoint}`;
    authHeader = `Bearer ${apiKey}`;
  } else {
    return new Response(JSON.stringify({ error: 'Unknown provider' }), { status: 400 });
  }

  const headers = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(provider === 'gemini' ? (({ stream, ...rest }) => rest)(payload) : payload),
  });

  // Proxy the stream or JSON response
  return new Response(response.body, {
    status: response.status,
    headers: { 
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
      ...(payload.stream ? { 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } : {})
    },
  });
}
