# FEATURE SPEC: Decentralized P2P Collaboration (The "Baton" System)

## 1. Overview
This feature enables two users to connect directly (P2P) to share a screenplay session.
- **Architecture:** Local-First, Serverless (via `trystero` + BitTorrent trackers).
- **Model:** Turn-Based (Token Passing). Only one user edits at a time.
- **Security:** End-to-End Encrypted (DTLS-SRTP).
- **Network:** Uses `trystero` library (locally loaded from `assets/js-mod/trystero.min.js`).

## 2. Core Experience & UX
### A. The "Session" Concept
- **Start:** Host creates a session, gets a "Room ID" (random 4-word string).
- **Join:** Guest enters the "Room ID".
- **Visuals:**
    - **Active Mode:** When user holds the Baton, the editor looks normal but has a "Passing..." button.
    - **Passive Mode:** When user is watching, the editor is `readOnly` (greyed out toolbar), and a "🔒 WATCHING" badge is visible.
    - **Video Chat:** A floating, draggable "Mini-Window" shows the peer's video. Includes Mic/Cam toggle buttons.
- **LAN workaround:**
    - It is expected that BitTorrent trystero mechanism to connect client will not work when both clients are on the same LAN. A passive "plan B" should exist for these situations, such as LAN multicast or different method to find and connect clients on LAN. This shouldn't be implemented now but the code should have a placeholder for this.
- **More than 2 collaborators:**
    - For first implementation the feature should only support 2 collaborators, but in the future there's no reason to not allow the shared link at least pasively (read only) to work for a larger number of collaborators, so just make sure the code can take such an update in the future. 

### B. Mobile "Spectator" Mode
- If Mobile/Tablet:
    - User effectively joins as "Observer".
    - They receive updates but **cannot** request or accept the baton. They only view the screenplay beeing edited in real time.

## 3. Technical Architecture

### A. Dependency
- **Library:** `trystero` (loaded via ES6 import from local assets).
- **Transport:** We use `trystero.send()` for data serialization (chunking large JSONs), but the pipe is direct WebRTC.

### B. Module: `CollaborationManager.js`
A singleton class in `js-mod/` responsible for:
1.  **Connection:** `joinRoom({ appId: 'sfss-v1', password: 'optional-pin' }, roomId)`.
2.  **State:** `isHost`, `hasBaton`, `peerId`.
3.  **Heartbeat:** Sends `PING` every 2s. If no `PING` received for 5s -> **Hard Disconnect**.

### C. The Protocol (JSON Payloads)
| Msg Type | Payload | Description |
| :--- | :--- | :--- |
| `PING` | `null` | Keep-alive heartbeat. |
| `SYNC_FULL` | `{ script: JSON, cursor: int }` | Sent on join & on baton pass. Replaces entire script state. |
| `GRANT_BATON` | `null` | Tells peer: "You are now the writer." |
| `BATON_ACK` | `null` | Tells sender: "I took control. You can lock now." |
| `VIDEO_SIGNAL`| *(handled by Trystero)* | WebRTC media streams. |

## 4. Implementation Steps for Gemini CLI

### Step 1: The Manager (`CollaborationManager.js`)
- Implement `connect(roomId, isHost)`.
- Implement `sendBaton()`.
- Implement `handleData(data)` switch case.
- **Crucial:** Implement the "Heartbeat Loop" to detect disconnects instantly.

### Step 2: The Editor Integration (`EditorHandler.js`)
- Add `toggleReadOnly(boolean)`:
    - `true`: Disable `contenteditable`, add `.locked-mode` CSS class (dim opacity).
    - `false`: Enable edit, remove CSS class.
- Add `getSnapshot()`: Returns full script JSON + current cursor position (caret).

### Step 3: The GUI Manager (`SidebarManager.js` or new `CollabUI.js`)
- **Connection Modal:** Input for Room ID, "Create" vs "Join" buttons.
- **The "HUD":**
    - **Status Bar:** "Connected to [PeerID] | Ping: 45ms".
    - **Video Container:** Draggable `<div>` with `<video>` element and Mute/Stop buttons.
    - **Notifications:** Toast messages for "Baton Received", "Connection Lost".

### Step 4: Security & Permissions
- When starting video, standard browser prompt requests Cam/Mic access.
- If denied, session continues (Data-only mode).
- **Encryption:** Use `appId` as the salt. All traffic is encrypted by WebRTC default standards.

## 5. Edge Cases to Handle
1.  **"The Orphaned Baton":** If connection dies while passing, both revert to "Owner" (Unlocked) and are alerted.
2.  **Browser Refresh:** If user refreshes, they generate a new Peer ID. Old session is dead. They must re-join.
3.  **Mobile Input:** On mobile, hide the "Pass Baton" button completely.