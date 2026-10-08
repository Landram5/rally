import PublicHeader from "../public-header";
import {SUPPORT_EMAIL} from "@/lib/support";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service · Rally",
  description: "The terms that apply when using Rally.",
};

export default function TermsPage() {
  return <>
    <PublicHeader />
    <main className="legal-page">
      <p className="eyebrow">RALLY · LEGAL</p>
      <h1>Terms of Service</h1>
      <p className="legal-updated">Effective September 29, 2026</p>
      <section><h2>Using Rally</h2><p>Rally helps table tennis communities manage clubs, players, matches, statistics, and tournaments. You must provide accurate account information, keep your sign-in credentials secure, and use the service lawfully.</p></section>
      <section><h2>Accounts and organizers</h2><p>You are responsible for activity performed through your account. Club and tournament organizers are responsible for managing membership, results, and event information fairly and accurately.</p></section>
      <section><h2>Content and results</h2><p>You retain ownership of information you submit. You grant Rally permission to store, process, and display that information as needed to operate the service, including on public player and tournament pages. Do not submit content you do not have the right to use.</p></section>
      <section><h2>Acceptable use</h2><p>Do not misuse Rally, interfere with its operation, attempt unauthorized access, impersonate another person, submit fraudulent results, or use the service to harm others.</p></section>
      <section><h2>Availability and changes</h2><p>Rally is provided on an as-available basis. Features may change, and the service may occasionally be interrupted for maintenance, security, or reasons outside our control.</p></section>
      <section><h2>Disclaimer and liability</h2><p>To the extent permitted by law, Rally is provided without warranties of any kind. Rally is not responsible for tournament rulings, disputes between users, lost profits, or indirect or consequential damages arising from use of the service.</p></section>
      <section><h2>Suspension and termination</h2><p>Access may be limited or ended when an account violates these terms, threatens the service, or creates risk for other users. You may stop using Rally at any time.</p></section>
      <section><h2>Contact</h2><p>Questions about these terms can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p></section>
    </main>
    <footer className="public-footer"><Link className="footer-brand" href="/">rally.</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
  </>;
}
