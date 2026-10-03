// POST /api/vcard  (form field "vcf") -> the same vCard back as text/vcard.
// iPhone Safari only shows its "Add Contact / Add All Contacts" screen for a
// vCard that arrives as a real page response; a blob download lands in Files
// instead. Contact details come in by POST (never in the URL), are echoed
// straight back, and are not stored or logged.

const MAX = 200 * 1024;

export async function onRequestPost({ request }) {
  const form = await request.formData().catch(() => null);
  const vcf = form && String(form.get('vcf') || '');
  if (!vcf || vcf.length > MAX || !vcf.startsWith('BEGIN:VCARD') || !vcf.trimEnd().endsWith('END:VCARD')) {
    return new Response('Not a contact file.', { status: 400 });
  }
  const count = (vcf.match(/^BEGIN:VCARD/gm) || []).length;
  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `inline; filename="${count > 1 ? `${count}-contacts` : 'contact'}.vcf"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
