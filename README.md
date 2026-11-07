# LAN Kart

Browser-based 3D kart racer for a LAN. FastAPI + WebSockets backend, Three.js frontend.

## Run (dev)

```sh
./start-dev.sh
```

Then open http://<your-ip>:8000. build.sh prints the IP for guests.

## Run (docker, prod)

```sh
./build.sh
```

## Controls

- W / Arrow Up: accelerate
- S / Arrow Down: brake / reverse
- A,D / arrows: steer
- Space: shoot shell
- R: reset race

Enter your name on the overlay, then START RACE.

## Notes

- Track is procedurally generated on the server per race.
- Wins are kept in memory (reset on server restart).
