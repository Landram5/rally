import Link from "next/link";
import { CircleDot, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return <main className="offline-page">
    <span className="brand-mark"><CircleDot size={28}/></span>
    <WifiOff size={34}/>
    <p className="eyebrow">RALLY</p>
    <h1>You’re offline.</h1>
    <p>Reconnect to load your clubs, matches, and tournaments. Rally does not store private account pages in the offline cache.</p>
    <Link className="primary-action offline-retry" href="/">Try again</Link>
  </main>;
}
