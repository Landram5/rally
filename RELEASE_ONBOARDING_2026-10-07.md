# Getting-started checklist

Published to rallytt.net, version `9585d4c4-0cdd-4ce7-bf80-6a349f34f6b8`.

Profile completion now requires both a saved photo and nonblank bio. The authenticated viewer retains a profileComplete flag in full and compact clubhouse responses; the sample demo derives completion from its saved player fields. Dismissal uses an accessible X button with the existing per-user persistence.

Home Screen completion detects standalone display mode, the iOS navigator.standalone flag, or the appinstalled event, and remembers that installation in browser-local storage. Visiting the install instructions alone never checks it off. iOS cannot confirm a Home Screen installation from an ordinary Safari tab; launch Rally from the Home Screen icon for detection. Different browsers and isolated Safari/Home Screen storage do not share the remembered flag.

Validation: TypeScript, lint, production build, the SQLite service suite, and the new runnable onboarding checklist check passed. Tests cover compact profile metadata, photo-only/blank-bio states, sample profile fallback, browser/iOS installation signals, install events and persistence, and X dismissal. The new check is included in the reliability runner. Actual physical iPhone installation was not tested.
