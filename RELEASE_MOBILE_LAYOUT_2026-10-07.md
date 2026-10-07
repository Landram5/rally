# Mobile filters and player selection

Deployed October 7, 2026 to https://rallytt.net.
Cloudflare version: `8ea94ab8-4305-4fae-a61d-0d66e7c757d8`.

- Match player filter placeholder shortened to Player; both search controls have equal height and selected names truncate on one line.
- Native date/datetime inputs and filter selectors constrained to their grid column, including WebKit intrinsic sizing.
- Root horizontal overflow/overscroll constrained; dialog scroll areas and form grids cannot expand sideways. Intentional bracket/table scrolling remains inside its own container.
- Mobile searchable player lists expand below the field within the form instead of using a floating portal that can flip above the field when the keyboard opens. Search, selection, outside dismissal and Escape are supported. Desktop retains the floating picker.
- Prevented enclosing labels from activating the trigger again after an inline option is chosen.

Validation: TypeScript, lint and production build passed. Browser checks at 390px and 320px verified equal filter heights, date widths, no dialog horizontal overflow, search filtering, selection closing, accessible close button in a 500px-high viewport, and desktop popover selection. Live sample form verified the player list below its field and dialog scrollWidth equal to clientWidth (334px).

Actual iPhone Safari/Home Screen keyboard and overscroll behavior remain to be checked on-device. Reduced desktop viewport height is not an iPhone keyboard simulation. No production match or account data was modified during testing.

Local proof images: `.local-backups/screenshots/mobile-filters-2026-10-07.png` and `mobile-player-picker-2026-10-07.png`.

## Follow-up: date overlap

The user reported iPhone date overlap persisted after the initial release. Added a constrained `minmax(0,1fr)` inner grid track to filter labels and switched date filters to separate full-width mobile rows. Published version `80097b10-64a0-4750-b754-fee91554e3d2`.
TypeScript, lint and build passed. Live browser at 390px measured each date input at 347px, matching its parent; vertical bounds 400–446 and 491–537 did not overlap. Actual iPhone confirmation remains pending.
