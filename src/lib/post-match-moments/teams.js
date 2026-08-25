// Fixed v1 team list (see build brief) — API-Football team IDs.
//
// FLAG: these IDs are the commonly-published API-Football/API-SPORTS IDs for
// these clubs, but they were not verified against a live `/teams?search=`
// call in this environment (no API-Football key configured here). Confirm
// each one against the real API before relying on it — a wrong ID will
// silently return another club's fixtures.
export const TEAMS = [
  { id: 40, name: "Liverpool" },
  { id: 42, name: "Arsenal" },
  { id: 47, name: "Tottenham" },
  { id: 49, name: "Chelsea" },
  { id: 50, name: "Manchester City" },
  { id: 33, name: "Manchester United" },
  { id: 51, name: "Brighton" },
  { id: 35, name: "Bournemouth" },
];

export function isCoveredTeamId(id) {
  return TEAMS.some((t) => t.id === Number(id));
}
