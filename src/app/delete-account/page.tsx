import type {Metadata} from 'next';

export const metadata: Metadata = {title: 'Delete your FragOut account'};
export const dynamic = 'force-dynamic';

export default function DeleteAccountPage() {
  return (
    <main className="policy-page">
      <a className="text-button" href="/">Back to FragOut</a>
      <h1>Delete your FragOut account</h1>
      <p>You can delete your FragOut account in this browser. Open account settings and sign in with the email and password you use for FragOut on this server.</p>
      <p>Choose <strong>Delete account</strong> and type <strong>DELETE</strong> to confirm. You can export your data from Settings first if you want a copy.</p>
      <a className="button primary" href="/?delete-account=1">Open account settings</a>
      <section>
        <h2>What gets deleted</h2>
        <p>Your account, active sessions, collection, settings, journal, connected API keys, and saved looks and photos are removed from the active FragOut database. Read the <a className="policy-link" href="/privacy">FragOut Privacy Policy</a> for retention details.</p>
      </section>
    </main>
  );
}
