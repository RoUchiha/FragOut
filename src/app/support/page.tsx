import type {Metadata} from 'next';

export const metadata: Metadata = {title: 'FragOut Support'};
export const dynamic = 'force-dynamic';

export default function SupportPage() {
  const contact = process.env.FRAGOUT_SUPPORT_CONTACT_EMAIL?.trim()
    || process.env.FRAGOUT_PRIVACY_CONTACT_EMAIL?.trim();

  return (
    <main className="policy-page">
      <a className="text-button" href="/">Back to FragOut</a>
      <h1>FragOut support</h1>
      {contact ? (
        <p>For help with your collection, outfit photos, or account, email <a className="policy-link" href={'mailto:' + contact}>{contact}</a>. Include your app version and a brief description of the issue.</p>
      ) : (
        <p>For help, open an issue on <a className="policy-link" href="https://github.com/RoUchiha/FragOut/issues">the FragOut repository</a>.</p>
      )}
      <p>Keep passwords, API keys, and private photos out of support requests.</p>
      <p><a className="policy-link" href="/privacy">Privacy policy</a> · <a className="policy-link" href="/delete-account">Delete your account</a></p>
    </main>
  );
}
