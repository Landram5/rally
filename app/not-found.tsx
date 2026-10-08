import Link from 'next/link';
import PublicHeader from './public-header';
export const metadata={title:'Page not found · Rally'};
export default function NotFound(){
 return <><PublicHeader/><main className="not-found"><div className="not-found-inner"><p className="not-found-code">404</p><h1>We can&rsquo;t find that page</h1><p>The link may be out of date, or the club, player or tournament may have been removed.</p><div className="intro-actions"><Link className="primary-action" href="/">Back to Rally</Link><Link className="intro-secondary" href="/clubs">Find a club</Link></div></div></main></>;
}
