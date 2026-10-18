// /kits/<kit>/<file> — installers for tools people run on their own computers
// (e.g. /kits/chief-of-staff/install.ps1). The files live in public/kits/, but
// every request comes through here first, so this is the one place to add a
// paid check later: look up the X-Kit-Key header before handing anything out.
// Free for now.

const TEXT = /\.(ps1|mjs|js|json|md|txt|html|sh)$|(^|\/)LICENSE$/;

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Paid kits, later: check request.headers.get('X-Kit-Key') here and return 402 if it is not valid.

  // Cloudflare redirects x.html to x (308), which Windows PowerShell won't
  // follow, so ask for the asset by its short name directly.
  const url = new URL(request.url);
  const path = url.pathname;
  const isHtml = /\.html$/.test(path);
  if (isHtml) url.pathname = path.replace(/\.html$/, '');
  const res = await env.ASSETS.fetch(new Request(url, request));
  if (!res.ok) return res;

  // A missing file comes back as the site's fallback HTML page with a 200;
  // make it a real 404 so the installer stops instead of saving a web page.
  if (!isHtml && (res.headers.get('Content-Type') || '').includes('text/html')) {
    return new Response('Not found', { status: 404 });
  }

  // Plain text, so PowerShell's Invoke-RestMethod gets a string it can run.
  const headers = new Headers(res.headers);
  if (TEXT.test(path)) headers.set('Content-Type', 'text/plain; charset=utf-8');
  headers.set('Cache-Control', 'no-cache');
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(res.body, { status: res.status, headers });
}
