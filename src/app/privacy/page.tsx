import type {Metadata} from 'next';

export const metadata: Metadata = {title: 'FragOut Privacy Policy'};
export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  const contact = process.env.FRAGOUT_PRIVACY_CONTACT_EMAIL?.trim();

  return (
    <main className="policy-page">
      <a className="text-button" href="/">Back to FragOut</a>
      <h1>FragOut Privacy Policy</h1>
      <p>This policy covers the FragOut mobile apps and the FragOut website and server they connect to.</p>

      <section>
        <h2>Account and fragrance data</h2>
        <p>When you create an account, FragOut stores the name and email address you enter and a salted password hash. FragOut uses session tokens to keep you signed in, with a browser cookie on the website and protected device storage in the native app. The server uses short-lived rate limits to protect account and analysis requests.</p>
        <p>Your collection, private notes, preferences, journal, recommendations, and any wearing conditions you enter are stored in the database used by your FragOut server. Hosted deployments can use a managed database such as Supabase. FragOut uses these details to maintain your collection and journal and tailor recommendations. To find reference photos and ratings, FragDex may send public fragrance names and edition details to retailers or Fragella.</p>
      </section>

      <section>
        <h2>Photos, dictation, and model providers</h2>
        <p>When you request a bottle scan or outfit analysis, FragOut sends the photo you take or select, or the outfit description you enter, to your FragOut server. Photos are resized and stripped of image metadata before model processing. Default Qwen bottle scans may also include a bounded OCR transcript read from the same photo. Dictation uses your device or browser speech recognition service. FragOut receives the transcript, and you can review it before submitting.</p>
        <p>Qwen is the default photo model and can run locally, through Groq Free, or through optional paid Vercel AI Gateway hosting, as shown in model settings. Hosted photos require your approval for the current destination before sending. Groq hosting requires the operator to confirm a Free account and enable account-level Zero Data Retention; FragOut cannot independently verify that account setting through the inference API. Paid Gateway hosting restricts routing to providers selected for zero data retention and no prompt training. The model receives the resized photo and any description you include, without your account identity or fragrance collection. Provider policies govern processing and operational metadata; see <a className="policy-link" href="https://console.groq.com/docs/your-data">Groq data handling</a> and <a className="policy-link" href="https://vercel.com/docs/ai-gateway/security-and-compliance/zdr">Vercel AI Gateway data handling</a>. Typed Qwen outfit descriptions use local rules without an external model request.</p>
        <p>If you choose OpenAI or Anthropic Claude and approve a cloud analysis, that provider receives the photo or description used for the request under its own policy. Disconnecting stops future requests to that provider. API keys you connect are stored encrypted on the FragOut server. The hosted default does not require your own provider key.</p>
        <p>FragOut processes bottle scans and non-archived outfit photos in memory. If you turn on outfit archiving, FragOut can temporarily hold an outfit photo encrypted for up to 15 minutes while you review it. Choosing Archive look keeps the selected photo and look until you delete the look, turn off archiving, or delete your account. FragOut leaves your photo-library originals untouched.</p>
      </section>

      <section>
        <h2>Mobile ads</h2>
        <p>When mobile advertising is enabled, FragOut uses Google AdMob to serve non-personalized banners. FragOut gives AdMob a banner unit ID and the non-personalized ad setting. The Google SDK may collect IP addresses, device identifiers, diagnostic data, and ad interactions for delivery, measurement, and fraud prevention. Where Google makes privacy choices available, you can manage them under Ad privacy in mobile Settings. <a className="policy-link" href="https://policies.google.com/technologies/partner-sites">How Google handles this information</a></p>
      </section>

      <section>
        <h2>Retention, export, and deletion</h2>
        <p>Account and collection data stays in the active database until you remove it or delete your account. Sessions expire after seven days, and demo accounts expire after seven days. Unsaved outfit descriptions expire after 15 minutes. Export your account data in Settings. The export excludes passwords, tokens, provider keys, and photo files.</p>
        <p>In mobile Settings, choose Delete account, or <a className="policy-link" href="/delete-account">delete your FragOut account in a browser</a>. Deletion removes the account and its data from the active FragOut database, including sessions, settings, collection, journal, model connections, and saved looks and photos. Encrypted operational snapshots use a seven-day remote retention window and local pruning after verified replacement. Sessions, pending selfies and unsaved analyses are excluded. Deleted records can remain in a snapshot until it expires; recovery must reapply later deletions before reopening access. Separate copies may also remain in exports you keep or with providers you chose.</p>
      </section>

      {contact && <section>
        <h2>Privacy contact</h2>
        <p>For privacy questions, email <a className="policy-link" href={'mailto:' + contact}>{contact}</a>.</p>
      </section>}
      <p>For help with the app, visit <a className="policy-link" href="/support">FragOut support</a>.</p>
    </main>
  );
}
