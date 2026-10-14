# Messages, blocking and reporting (phase 2)

Status: built on `claude/messages` (stacked on `claude/club-profile` and `claude/club-chat`); not deployed. Needs migration `drizzle/0031_direct_messages.sql` (and 0030 for chat).

- **Who can message whom:** people who share an active club, plus club leaders and people who have asked to join that club. Guest records and deleted accounts cannot be messaged. A block in either direction always wins.
- **Messages tab** (everyone, in the main navigation): conversation list, new message with name lookup, live delivery, unread counts, per-person alert toggle (on by default, one push per conversation per 5 minutes, none while you are in the tab), blocked-people list. Text only for now.
- **Message button** on player profiles (when allowed), with Block and Report. Club chat messages also offer Message and Block.
- **Blocking:** one way. The blocker stops seeing the person's direct messages and club chat messages; the blocked person cannot start or continue a conversation. Unblocking restores it.
- **Reporting:** reporting a direct message sends that message and the five before it, plus the reason, to Rally administrators (`RALLY_ADMIN_EMAILS`). Administrators review them from the shield button in Messages. Profile reports go to the same list. Club chat reports still go to club organizers.
- **Account deletion** removes the person's direct conversations, blocks and reports.
- **Not yet:** photos or videos in direct messages, leader chat rooms across clubs (phase 3), message requests, reactions.
