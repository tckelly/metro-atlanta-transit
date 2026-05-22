# Sample Data

Frozen snapshots of MARTA's public feeds, captured for reference during development. **Not authoritative** — these are point-in-time samples used to understand feed shape, populated fields, and edge cases.

## Why this exists

When designing the app, we need to make decisions based on what MARTA *actually* publishes, not what we *hope* they publish. The recon snapshots here let agents and humans answer questions like "does the alerts feed contain anything?" and "what does a cancelled trip look like?" without re-fetching live data.

Findings derived from these snapshots are written into `docs/data-and-apis.md`.

## Layout

```
sample-data/
├── README.md                    # this file
├── recon.mjs                    # decoding + analysis script
└── marta-gtfs-rt-YYYY-MM-DD/    # one folder per snapshot
    ├── README.md                # human-readable summary of the snapshot
    ├── vp.pb                    # vehicle_positions feed (binary)
    ├── tu.pb                    # trip_updates feed (binary)
    └── al.pb                    # alerts feed (binary)
```

The `.pb` files are Protocol Buffers; they need a GTFS-RT decoder to read. The accompanying `README.md` in each snapshot folder contains the decoded highlights so you don't need to run the script to learn what's there.

## Regenerating a snapshot

```bash
# From the repo root:
SNAP="sample-data/marta-gtfs-rt-$(date -u +%Y-%m-%d)"
mkdir -p "$SNAP"
curl -sS -o "$SNAP/vp.pb" https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb
curl -sS -o "$SNAP/tu.pb" https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/tripupdate/tripupdates.pb
curl -sS -o "$SNAP/al.pb" https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/alert/alerts.pb

# Then decode (requires gtfs-realtime-bindings):
cd "$SNAP" && cp ../recon.mjs . && node recon.mjs
```

After regenerating, hand-edit the snapshot's `README.md` with the highlights. Don't auto-overwrite — the human-curated framing is what makes the file useful, not the raw decode dump.

## When to add a new snapshot

- Sampling the alerts feed at different times of day or during a known disruption (one of our open questions in `docs/data-and-apis.md`).
- Verifying behavior changes after MARTA updates their feeds.
- Before/after comparisons when investigating a bug.

Don't bother regenerating snapshots on a schedule. They're reference data, not test fixtures.
