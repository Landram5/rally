import PublicHeader from "../public-header";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · Rally",
  description: "How Rally collects and uses account and table tennis data.",
};

export default function PrivacyPage() {
  return <>
    <PublicHeader />
    <main className="legal-page">
      <p className="eyebrow">RALLY · LEGAL</p>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Effective October 5, 2026</p>
      <section><h2>Information we collect</h2><p>Rally stores the account information you provide, such as your email address, username, optional bio, and optional profile photo. Each player profile receives a unique Rally ID. If you sign in with Google, we receive your basic Google profile information, including your name, email address, and profile identifier. We also store the clubs, player profiles, match results, and tournaments you create or manage, including club photos and banners. If you submit feedback, we store the report or request, its page path, review status, and your player profile link.</p></section>
      <section><h2>How we use information</h2><p>We use this information to authenticate your account, operate the clubhouse, publish the player and tournament pages you choose to create, calculate statistics, protect the service, and respond to support requests.</p></section>
      <section><h2>Public information</h2><p>Player usernames, optional bios and uploaded profile photos, confirmed match statistics, club names, and tournament details may appear on public Rally pages. Club photos and banners may also be public. Feedback is visible only to its submitter and Rally site administrators. Account email addresses are not displayed on public player pages.</p></section>
      <section><h2>Service providers</h2><p>Rally uses Supabase for authentication and Cloudflare for hosting and database services. These providers process information only as needed to operate and secure Rally. We do not sell personal information.</p></section>
      <section><h2>Cookies and security</h2><p>Rally uses essential cookies to keep you signed in and protect account sessions. We use reasonable technical safeguards, but no online service can guarantee absolute security.</p></section>
      <section><h2>Retention and your choices</h2><p>You can delete your account from Account settings. Club owners must first transfer ownership to another eligible active member. Deletion removes your sign-in account, username, bio, photo, Rally ID, submitted feedback, memberships, and public player profile. You may keep linked past results under “Deleted player,” or remove your original player record and personal history links. Club branding, shared match scores and tournament draws remain for other players; the latter option uses separate deleted-player placeholders for each match or tournament. Event context may still identify a past participant. If our sign-in provider is temporarily unavailable, Rally blocks account access and retries deletion automatically, retaining the account identifier needed to complete it. A temporary identifier-only safety record is retained for at least 24 hours and removed after deletion finishes, to prevent requests already in flight from restoring account data. Existing provider backups and operational logs expire under provider retention policies. Contact us for access, correction, or questions about retained records.</p></section>
      <section><h2>Children</h2><p>Rally is not directed to children under 13. If you believe a child has provided personal information without appropriate consent, contact us so we can address it.</p></section>
      <section><h2>Contact</h2><p>Questions or privacy requests can be sent to <a href="mailto:adamlandrum25@gmail.com">adamlandrum25@gmail.com</a>.</p></section>
    </main>
    <footer className="public-footer"><Link className="footer-brand" href="/">rally.</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
  </>;
}
