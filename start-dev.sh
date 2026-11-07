#!/bin/sh
cd "$(dirname "$0")"
exec .venv/bin/python -m uvicorn server.main:app --reload --ws-max-size 2048
