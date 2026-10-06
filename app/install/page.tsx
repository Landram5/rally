import { CircleDot, Share, PlusSquare, EllipsisVertical, Download } from "lucide-react";
import PublicHeader from "@/app/public-header";

export default function InstallPage() {
  return <><PublicHeader/><main className="install-page">
    <div className="install-hero"><span className="brand-mark"><CircleDot size={28}/></span><p className="eyebrow">RALLY FOR IPHONE & ANDROID</p><h1>Put Rally on your Home Screen.</h1><p>Open Rally in its own app window with the same live clubs, players, and tournaments as the website.</p></div>
    <section className="install-platform" aria-labelledby="android-install"><h2 id="android-install">Android</h2><ol className="install-steps">
      <li><span>1</span><CircleDot size={24}/><div><strong>Open rallytt.net in Chrome</strong><p>If you opened the link in a chat app, open it in Chrome first.</p></div></li>
      <li><span>2</span><EllipsisVertical size={24}/><div><strong>Open Chrome’s menu</strong><p>Tap the three dots and choose “Add to Home screen” or “Install app.”</p></div></li>
      <li><span>3</span><Download size={24}/><div><strong>Tap Install</strong><p>Launch Rally from its icon on your Home Screen or in your app list.</p></div></li>
    </ol></section>
    <section className="install-platform" aria-labelledby="iphone-install"><h2 id="iphone-install">iPhone</h2><ol className="install-steps">
      <li><span>1</span><Share size={24}/><div><strong>Open Rally in Safari</strong><p>Tap Safari’s Share button at the bottom of the screen.</p></div></li>
      <li><span>2</span><PlusSquare size={24}/><div><strong>Add to Home Screen</strong><p>Scroll through the share actions and choose “Add to Home Screen.”</p></div></li>
      <li><span>3</span><span className="mini-app-icon"><CircleDot size={22}/></span><div><strong>Tap Add</strong><p>Rally will appear on your Home Screen and launch in its own window.</p></div></li>
    </ol></section>
  </main></>;
}
