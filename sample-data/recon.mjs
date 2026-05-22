import { readFileSync } from 'node:fs';
import gtfs from 'gtfs-realtime-bindings';

const { FeedMessage } = gtfs.transit_realtime;

function load(path) {
  const buf = readFileSync(path);
  return FeedMessage.decode(new Uint8Array(buf));
}

function header(feed) {
  return {
    gtfs_realtime_version: feed.header.gtfsRealtimeVersion,
    incrementality: feed.header.incrementality,
    timestamp: feed.header.timestamp?.toString(),
    timestamp_iso: feed.header.timestamp
      ? new Date(Number(feed.header.timestamp) * 1000).toISOString()
      : null,
    entity_count: feed.entity.length,
  };
}

function tallyPopulated(entities, picker) {
  const tally = {};
  for (const e of entities) {
    const obj = picker(e);
    if (!obj) continue;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === null || v === undefined) continue;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      tally[k] = (tally[k] ?? 0) + 1;
    }
  }
  return tally;
}

console.log('=== ALERTS ===');
const alerts = load('al.pb');
console.log(JSON.stringify(header(alerts), null, 2));
if (alerts.entity.length) {
  console.log('Sample entity:');
  console.log(JSON.stringify(alerts.entity[0], null, 2));
}

console.log('\n=== VEHICLE POSITIONS ===');
const vp = load('vp.pb');
console.log(JSON.stringify(header(vp), null, 2));
console.log('Populated VehiclePosition fields (out of', vp.entity.length, 'entities):');
console.log(JSON.stringify(tallyPopulated(vp.entity, e => e.vehicle), null, 2));
console.log('Sample entity (first):');
console.log(JSON.stringify(vp.entity[0], null, 2));

console.log('\n=== TRIP UPDATES ===');
const tu = load('tu.pb');
console.log(JSON.stringify(header(tu), null, 2));

console.log('Populated TripUpdate fields:');
console.log(JSON.stringify(tallyPopulated(tu.entity, e => e.tripUpdate), null, 2));

const SR = gtfs.transit_realtime.TripDescriptor.ScheduleRelationship;
const SR_BY_VAL = Object.fromEntries(Object.entries(SR).map(([k, v]) => [v, k]));
const schedRel = {};
for (const e of tu.entity) {
  const sr = e.tripUpdate?.trip?.scheduleRelationship ?? 0;
  const name = SR_BY_VAL[sr] ?? `unknown(${sr})`;
  schedRel[name] = (schedRel[name] ?? 0) + 1;
}
console.log('Trip schedule_relationship distribution:');
console.log(JSON.stringify(schedRel, null, 2));

// Find a CANCELED trip update, if any
const canceled = tu.entity.find(e => e.tripUpdate?.trip?.scheduleRelationship === SR.CANCELED);
if (canceled) {
  console.log('\nSample CANCELED trip update:');
  console.log(JSON.stringify(canceled, null, 2));
} else {
  console.log('\nNo CANCELED trip updates in this snapshot.');
}

const scheduled = tu.entity.find(e =>
  (e.tripUpdate?.trip?.scheduleRelationship ?? 0) === SR.SCHEDULED &&
  (e.tripUpdate?.stopTimeUpdate?.length ?? 0) > 0
);
if (scheduled) {
  console.log('\nSample SCHEDULED trip update (truncated stop_time_updates):');
  const copy = JSON.parse(JSON.stringify(scheduled));
  if (copy.tripUpdate.stopTimeUpdate.length > 3) {
    copy.tripUpdate.stopTimeUpdate = copy.tripUpdate.stopTimeUpdate.slice(0, 3);
    copy._note = `truncated; original length was ${scheduled.tripUpdate.stopTimeUpdate.length}`;
  }
  console.log(JSON.stringify(copy, null, 2));
}

// What route_ids appear?
const routes = new Set();
for (const e of tu.entity) {
  const r = e.tripUpdate?.trip?.routeId;
  if (r) routes.add(r);
}
console.log('\nUnique route_ids in trip_updates:', routes.size);
console.log('First 30 route_ids:', [...routes].slice(0, 30));

// StopTimeUpdate field population
const stuTally = {};
let stuTotal = 0;
for (const e of tu.entity) {
  for (const stu of e.tripUpdate?.stopTimeUpdate ?? []) {
    stuTotal++;
    for (const k of Object.keys(stu)) {
      const v = stu[k];
      if (v === null || v === undefined) continue;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      stuTally[k] = (stuTally[k] ?? 0) + 1;
    }
  }
}
console.log(`\nStopTimeUpdate population across ${stuTotal} stop-time-updates:`);
console.log(JSON.stringify(stuTally, null, 2));

// Are predictions in arrival, departure, or both?
let withArrival = 0, withDeparture = 0, withBoth = 0;
for (const e of tu.entity) {
  for (const stu of e.tripUpdate?.stopTimeUpdate ?? []) {
    const a = stu.arrival && Object.keys(stu.arrival).length > 0;
    const d = stu.departure && Object.keys(stu.departure).length > 0;
    if (a) withArrival++;
    if (d) withDeparture++;
    if (a && d) withBoth++;
  }
}
console.log(`\nstop_time_update prediction coverage: arrival=${withArrival} departure=${withDeparture} both=${withBoth} total=${stuTotal}`);
