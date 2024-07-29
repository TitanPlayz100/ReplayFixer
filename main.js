import { readFileSync } from 'fs'
const data = readFileSync('./snippets/oldReplay.ttrm', 'utf8');
const newdata = readFileSync('./snippets/leagueReplay.ttrm', 'utf8');

const jsondata = JSON.parse(data);
const newjsondata = JSON.parse(newdata);

const eventlist = jsondata.data[0].replays[0].events;
const eventlistnew = newjsondata.replay.rounds[0][0].replay.events;

console.log(eventlist[eventlist.length - 1].data.export.game.board);
console.log(eventlistnew[eventlistnew.length - 1].data.game.board);