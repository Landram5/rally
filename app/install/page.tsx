import { CircleDot, Share, PlusSquare } from "lucide-react";
import PublicHeader from "@/app/public-header";

export default function InstallPage() {
  return <><PublicHeader/><main className="install-page">
    <div className="install-hero"><span className="brand-mark"><CircleDot size={28}/></span><p className="eyebrow">RALLY FOR IPHONE</p><h1>Put Rally on your Home Screen.</h1><p>Rally opens full screen and stays signed in like an app. It uses the same live clubs, players, and tournaments as the website.</p></div>
    <ol className="install-steps">
      <li><span>1</span><Share size={24}/><div><strong>Open Rally in Safari</strong><p>Tap Safari’s Share button at the bottom of the screen.</p></div></li>
      <li><span>2</span><PlusSquare size={24}/><div><strong>Add to Home Screen</strong><p>Scroll through the share actions and choose “Add to Home Screen.”</p></div></li>
      <li><span>3</span><span className="mini-app-icon"><CircleDot size={22}/></span><div><strong>Tap Add</strong><p>Rally will appear on your Home Screen and launch in its own window.</p></div></li>
    </ol>
  </main></>;
}
