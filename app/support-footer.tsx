'use client';
import {usePathname} from 'next/navigation';
export default function SupportFooter(){const demo=usePathname().startsWith('/demo');return <footer className="support-footer" aria-label="Help and legal"><a href="/help">Help</a><a href={demo?'/demo/feedback':'/feedback'}>Contact / feedback</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/install">Install Rally</a></footer>}
