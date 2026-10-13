// card-reader-relay — makes the Name Card Scanner's Gemini call from a fixed
// US location. Google rejects Gemini calls from some Cloudflare edge locations
// ("User location is not supported"); Pages Functions run near each visitor,
// but a Durable Object created with a location hint stays where it was placed.
// The Pages project reaches this through its RELAY binding (wrangler.toml).

export class Relay {
  async fetch(request) {
    const { url, init } = await request.json();
    if (!/^https:\/\/(generativelanguage\.googleapis\.com|gateway\.ai\.cloudflare\.com)\//.test(url)) {
      return new Response('{"error":{"message":"relay: host not allowed"}}', { status: 400 });
    }
    const res = await fetch(url, init);
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export default {
  fetch: () => new Response('Not found', { status: 404 }),
};
