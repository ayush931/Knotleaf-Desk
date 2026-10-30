# Call signaling continuity

`/classroom/ROOM_UUID` retains its origin, room-expiry, capacity, host-token and moderation checks.

New clients opt in with `join: {type:"join", name, resume:true, resumeToken?, hostToken?}`. `welcome` includes a random 256-bit `resumeToken`, sent only to that socket; it must never enter invites, presence broadcasts, chat or persisted board state. Store it only in the in-memory call session.

On transient socket loss the client keeps capture and WebRTC peers and retries with exponential backoff (500ms to 10s). No blur/hidden callback closes the session. Online/visible/focus callbacks accelerate recovery only for a closed socket; they do not replace an open connection. A 15s welcome deadline prevents stalled attempts. Welcome republishes media state and recovers pending offers/failed ICE. Explicit Leave cancels all timers and lifecycle listeners and releases capture.

For opted-in sockets, abnormal close reserves membership for 120s. A matching room-scoped token resumes the same ID and current role even at capacity; it replaces the old socket and does not broadcast another join. Late callbacks/messages from the old socket cannot remove or control the resumed peer. Host mute during the gap is acknowledged by `muted:true` in welcome. Leave, normal close and terminal policy closures remove membership immediately. Host removal revokes that token for the room lifetime, including while disconnected; it cannot automatically resume. Expired rooms clear pending reservations. Server shutdown clears timers.

After reservation expiry or a process restart, an unknown token falls back to a fresh join with ordinary capacity and verified host checks; a co-host role is not trusted from client input. No media permission is reacquired automatically during recovery. Close codes 4001 (expiry), 4003 (removal), 4004 (replaced connection), and 1008 (rejected join/policy) are terminal. Older clients without resume opt-in retain immediate-disconnect behavior.

Join requests mic/camera by default only after the user's Join action. Capture denial is recoverable without leaving. `joined` and remote `chat` events notify the UI; resumed identity does not generate another join sound. Shared CRDT room chat notifications use message IDs and self author ID rather than another signaling connection.

Physical continuity still depends on the browser/OS and network: a terminated browser or suspended device cannot transmit media. Recovery never overrides room expiry or moderation.
