# Leader rooms (phase 3) and message attachments

Status: built on `claude/leader-rooms` (stacked on messages, club page and club chat); not deployed. Needs migrations 0030, 0031, 0032 and 0033 (plus R2 bucket `rally-chat-media`).

## Leader rooms
- **Who:** club owners, admins and board members of approved clubs (pending roles and unapproved clubs do not count). Anyone who stops leading a club loses access until they lead one again.
- **Create:** any leader creates a room (name up to 80 characters, optional description) and becomes its owner. Up to 20 active rooms per person.
- **Invite:** only the owner invites, and only other leaders from any club, found by name. Invitations are accepted or declined; blocks stop invitations both ways. Up to 60 members.
- **Owner controls:** rename, remove people, archive. If the owner leaves, the longest-standing member becomes owner; if nobody is left the room is archived.
- **Messages:** text, photos and videos, live over a per-room connection, unread counts, optional alerts per room (off by default). Authors and the room owner can delete messages. Blocked people's messages are hidden from the person who blocked them.
- **Reports:** go to Rally administrators with the message and the five before it (the owner may be the person reported).
- **Where:** Messages tab, "Leader rooms" switch (shown to leaders and anyone with an invitation).
- **Account deletion:** ownership passes on, emptied rooms are archived, messages stay labelled "Deleted User (name)".

## Photos and videos in direct messages
- Same limits as club chat (photos 8 MB, videos 50 MB and about 30 seconds), stored under `dm/<conversation>/`, shown only to the two people, removed from storage when deleted.
- Migration 0032 rebuilds `dm_messages` so a message can be media only.

## Tech debt
Club chat, direct messages and leader rooms each have their own conversation component. They share the attachment code (`app/chat-attach.tsx`) and server media code (`lib/chat-media.ts`), but a shared conversation view would remove a lot of duplication.
