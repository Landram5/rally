# One place for chats: direct messages, club chats and group chats

Status: built on `claude/unified-inbox`; not deployed. Needs migrations 0030 to 0033 (and the R2 bucket `rally-chat-media`).

The Messages tab is one Instagram-style list. It mixes:

- **Direct messages** (people who share a club).
- **Club chats**, one for every club you are an active member of (marked "Club"). The Chat button on a club page still opens the same chat.
- **Group chats** (what used to be leader rooms), with a Users icon.

Newest activity first, unread dots, and a pencil to start a new message or a new group chat.

## Group chats
- **Anyone** can start one and name it. The owner invites people they could message (they share a club). Club organizers and board members can also invite leaders of other clubs, so inter-club leader chats still work: just invite the other leaders.
- Invitations are accepted or declined (they show at the top of the list). Blocks stop invitations both ways. Up to 60 members.
- **Owner:** rename, add and remove people, archive. If the owner leaves, the longest-standing member becomes owner; if nobody is left the chat is archived.
- Text, photos and videos, live delivery, unread counts, optional alerts per chat (off by default). Authors and the owner can delete messages. Reports go to Rally administrators with the message and the five before it. Blocked people's messages are hidden from the person who blocked them.
- Losing a club leadership role no longer removes anyone from a chat.
- **Account deletion:** ownership passes on, emptied chats are archived, messages stay labelled "Deleted User (name)".

## Under the hood
- Group chats are still stored in the `leader_rooms` / `room_*` tables and served from `/api/rooms`; only the product name and rules changed (no migration needed).
- `GET /api/chat?clubs=1` lists a person's club chats with the latest message and unread count for the combined list.
- Components: `app/messages-tab.tsx` (the list and direct messages), `app/group-chat.tsx`, `app/club-chat.tsx` (the `embedded` mode is the Instagram-style view), `app/chat-attach.tsx` (shared attachments).
