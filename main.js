import { readFileSync, writeFileSync } from 'fs'
const oldReplay = JSON.parse(readFileSync('./snippets/oldReplay.ttrm', 'utf8'));
const newReplay = JSON.parse(readFileSync('./snippets/leagueReplay.ttrm', 'utf8'));

// explanation: data = list of rounds, replays = user infos, events = list of actions
const eventlist = oldReplay.data[0].replays[0].events;

// explanation: rounds = list of rounds, each round has list of user info, replay = replay info, events = list of actions
const eventlistnew = newReplay.replay.rounds[0][0].replay.events;

const board1 = eventlist[eventlist.length - 1].data.export.stats.clears;
const board2 = eventlistnew[eventlistnew.length - 1].data.stats.clears;

writeFileSync('./out.json', JSON.stringify([board1, board2], null, 2));