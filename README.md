# LAN Tron

**LAN TRON** is a browser-based multiplayer kart racer for a local network. Open it
in a desktop browser, pick a name, and race up to three laps around a procedurally
generated circuit while other players drive alongside you.

The game is intentionally lightweight:

- **FastAPI + WebSockets** handle the race room and real-time player updates.
- **Three.js** renders the 3D track, karts, shells, particles, and minimap.
- No frontend build step is required; Three.js is loaded from a CDN.
- Race state is kept in memory, so restarting the server starts a fresh room.

## Here's how it looks:
<img width="1538" height="755" alt="image" src="https://github.com/user-attachments/assets/86057458-b0db-4b0e-8337-66fab41711c8" />


## Quick start

### Local development

Requirements:

- Python 3.12 or newer
- A modern browser with WebGL support

From the repository root:

```sh
./start-dev.sh
```

The development server runs on port `8000`. Open
<http://localhost:8000> on the host machine.

To let people on the same network join, find the host machine's LAN address and
share:

```text
http://<host-lan-ip>:8000
```

The host firewall must allow inbound TCP traffic on port `8000`.

### Docker

Docker and Docker Compose are required. Start the production-style container with:

```sh
./build.sh
```

The script prints the address to share and runs `docker compose up --build`.
You can also start it directly:

```sh
docker compose up --build
```

Stop the container with `Ctrl-C`, or run it in the background with
`docker compose up --build -d`.

## How to play

1. Open the shared URL.
2. Enter an optional name and choose **START RACE**.
3. Drive through three laps, collect mushrooms for a temporary boost, and fire
   shells at other players.
4. The first player to finish wins. After a short winner screen, the server
   generates a new track and starts the next race.

### Controls

| Action | Keyboard |
| --- | --- |
| Accelerate | `W` or `↑` |
| Brake / reverse | `S` or `↓` |
| Steer | `A` / `D` or `←` / `→` |
| Fire shell | `Space` |
| Reset your kart | `R` |

The HUD shows speed, lap, current time, best time, connected players, and the
live scoreboard. A minimap provides an overview of the current circuit.

## Project layout

```text
.
├── server/
│   └── main.py          FastAPI app and WebSocket race room
├── static/
│   ├── index.html       Game shell and HUD markup
│   ├── main.js          Three.js renderer and client-side game loop
│   └── style.css        Overlay and HUD styling
├── Dockerfile           Production container image
├── docker-compose.yml   Port mapping and service definition
├── requirements.txt     Python dependencies
├── start-dev.sh         Local development launcher
└── build.sh             Docker launcher and LAN address helper
```

## Architecture

Each browser connects to the server at `/ws`. The server assigns a short player
ID, broadcasts player names and kart state, relays shell events, and announces
the winner. The browser performs rendering, movement, collision handling, track
visualization, and local effects.

The server generates track parameters for each race and sends them to every
client. This keeps all players on the same procedurally generated circuit
without storing a database or requiring an account system.

## Development notes

- Install dependencies manually when needed with:

  ```sh
  python -m pip install -r requirements.txt
  ```

- The local launcher uses `.venv/bin/python`. Create that environment first if
  `.venv` is not present:

  ```sh
  python -m venv .venv
  .venv/bin/python -m pip install -r requirements.txt
  ```

- Change gameplay tuning such as speed, steering, lap count, boost strength,
  and shell behavior in the `CONFIG` object near the top of
  [`static/main.js`](static/main.js).
- The server listens on all interfaces in Docker. The direct `python
  server/main.py` entry point is intended for local-only use; prefer
  `./start-dev.sh` for development.

## Troubleshooting

### Other players cannot connect

Confirm that everyone is on the same LAN, the host is sharing its LAN IP
instead of `localhost`, and port `8000` is allowed through the host firewall.

### The game shows “Connecting...”

Check that the server is running and that the browser can load
`http://<host>:8000`. If the page loads but the connection does not, inspect the
browser console for a blocked WebSocket or network error.

### The Docker address is wrong

`build.sh` uses the first address returned by `hostname -I`. On machines with
multiple network interfaces, share the address belonging to the same LAN as the
players.
