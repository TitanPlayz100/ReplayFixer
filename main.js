/**
 * @type {{f: File, status: string}[]}
 */
let files = [];

function droppedFiles(event) {
    event.preventDefault();
    files = [...event.dataTransfer.items]
        .filter(file => file.kind === "file") // ensure each item is a file
        .map(file => { return { f: file.getAsFile(), status: "Loaded" } });

    setInfo();
}

function manageReplays() {
    files.forEach(async (file, index) => {
        const ext = file.f.name.split(".")[1];

        if (ext !== "ttrm") { // check file extension
            files[index].status = "Not A TTRM Replay";
            setInfo();
            return;
        }

        const data = await file.f.text();

        let jsondata = null;
        try {
            jsondata = JSON.parse(data);
        } catch (error) {
            files[index].status = "Invalid JSON";
            setInfo()
            return;
        }

        const time = Date.parse(jsondata.ts)
        if (time < 1632787200000) { // before new graphics update
            files[index].status = "Way Too Old";
        } else if (time < 1701302400000) { // small differences in formats
            files[index].status = "Format too different";
        } else if (time < 1721952000000) {
            fixOldReplay(jsondata, file);
            files[index].status = "Fixed";
        } else { // beta release or other
            files[index].status = "Already Fixed";
        }

        setInfo();
    })
}

function fixOldReplay(data, file) {
    const [user1, user2] = data.endcontext
        .toSorted((a, b) => b.naturalorder - a.naturalorder); // sort by order

    const users = [
        {
            id: user1.id,
            username: user1.username,
            avatar_revision: 0,
            banner_revision: 0,
            flags: 0,
            country: null
        },
        {
            id: user2.id,
            username: user2.username,
            avatar_revision: 0,
            banner_revision: 0,
            flags: 0,
            country: null
        }
    ]

    function statsTotal(ind) { // AVERAGE OF STATS (includes 0s)
        // accumilate stats through each round
        let totals = data.data.reduce((total, round) => {
            // sort by natural order
            round.board = round.board.toSorted((a, b) => b.naturalorder - a.naturalorder);
            if (round.replays[ind].events[0].data.options.username != round.board[ind].username) {
                [round.replays[ind], round.replays[+!ind]] = [round.replays[+!ind], round.replays[ind]]; // swap if wrong order
            }

            const stats = round.replays[ind].events.filter(e => e.type == 'end')[0].data.export.aggregatestats; // get stats for round
            return Object.fromEntries(Object.keys(total).map(val => [val, total[val] + stats[val]])); // add them to running total
        }, { apm: 0, pps: 0, vsscore: 0 });

        Object.keys(totals).forEach(key => {
            totals[key] = totals[key] / data.data.length; // divide to get average
        });
        return totals;
    }

    const leaderboard = [
        {
            id: user1.id,
            username: user1.username,
            active: user1.active,
            naturalorder: user1.naturalorder,
            wins: user1.wins,
            stats: statsTotal(0),
            shadows: [],
            shadowedBy: [null, null]
        },
        {
            id: user2.id,
            username: user2.username,
            active: user2.active,
            naturalorder: user2.naturalorder,
            wins: user2.wins,
            stats: statsTotal(1),
            shadows: [],
            shadowedBy: [null, null]
        }
    ]

    // fix each round
    const rounds = data.data.map(round => {
        // one function for both players
        jfunc = ind => {
            round.board = round.board.toSorted((a, b) => b.naturalorder - a.naturalorder); // sort by natural order
            if (round.replays[ind].events[0].data.options.username != round.board[ind].username) {
                [round.replays[ind], round.replays[+!ind]] = [round.replays[+!ind], round.replays[ind]]; // swap if wrong order
            }

            let lastIndex = round.replays[ind].events.length - 1
            let lastEvent = round.replays[ind].events[lastIndex];

            // loop to find index of 'end' event
            while (lastEvent.type != 'end') {
                lastIndex--;
                lastEvent = round.replays[ind].events[lastIndex];
            }

            const fixGameid = id => { return parseInt(id.slice(-4), 16) % 8192 }; // IDK WHAT THIS IS (the slice is added)
            const fixIGEEvents = ev => { // reformat garbage and kev events
                return (ev.type == "ige")
                    ? (ev.data.data.type != 'kev')
                        ? {
                            ...ev,
                            data: {
                                ...ev.data,
                                type: ev.data.data.type,
                                frame: ev.data.data.frame, // IDK WHAT THIS IS
                                data: {
                                    ...ev.data.data.data,
                                    gameid: fixGameid(ev.data.data.gameid),
                                    frame: ev.data.data.frame,
                                    cid: ev.data.data.cid,
                                }
                            }
                        }
                        : {
                            ...ev,
                            data: {
                                ...ev.data,
                                type: data.data.type,
                                data: {
                                    ...ev.data.data,
                                    victim: {
                                        gameid: fixGameid(ev.data.data.victim.gameid)
                                    },
                                    killer: {
                                        gameid: fixGameid(ev.data.data.killer.gameid)
                                    },
                                    type: undefined,
                                    frame: ev.data.frame - 10 // IDK WHAT THIS IS
                                }
                            }
                        }
                    : ev;
            }

            const startEvents = [ // default start events
                { frame: 0, type: "start", data: {} },
                { frame: 0, type: "ige", data: { id: 0, frame: 0, type: "target", data: { targets: [fixGameid(round.board[+!ind].id)] } } },
                { frame: 0, type: "ige", data: { id: 1, frame: 0, type: "allow_targeting", data: { value: false } } },
                { frame: 0, type: "ige", data: { id: 2, frame: 0, type: "target", data: { targets: [fixGameid(round.board[+!ind].id)] } } },
                { frame: 0, type: "ige", data: { id: 3, frame: 0, type: "allow_targeting", data: { value: false } } }
            ]
            const midEvents = round.replays[ind].events.slice(4, lastIndex).map(fixIGEEvents); // original events, fixing garbage and kev
            const endEvents = [{ frame: lastEvent.frame, type: "end", data: {} }]

            const newEvents = startEvents.concat(midEvents).concat(endEvents); // adding events together

            const booltoint = val => { return val === true ? 1 : 0 }

            return { // reformatted round data
                id: round.board[ind].id,
                username: round.board[ind].username,
                active: round.board[ind].active,
                naturalorder: round.board[ind].naturalorder,
                alive: round.board[ind].success,
                lifetime: lastEvent.frame * 1000 / 60, // time in seconds using total frames
                shadows: [],
                shadowedBy: [null, null],
                stats: {
                    ...lastEvent.data.export.aggregatestats,
                    garbagesent: lastEvent.data.export.stats.garbage.sent,
                    garbagereceived: lastEvent.data.export.stats.garbage.received,
                    kills: lastEvent.data.export.stats.kills,
                },
                replay: {
                    frames: round.replays[ind].frames,
                    events: newEvents,
                    options: {
                        ...lastEvent.data.export.options,
                        version: 19, // i dont know what this actually does
                        gameid: fixGameid(lastEvent.data.export.options.gameid),
                        garbageabsolutecap: booltoint(lastEvent.data.export.options.garbageabsolutecap), // changing from boolean to int
                        garbagephase: booltoint(lastEvent.data.export.options.garbagephase),
                        garbageattackcap: booltoint(lastEvent.data.export.options.garbageattackcap),
                        presets: undefined, // removing unkonwn events using undefined
                        infinitemovement: undefined,
                        objective: undefined,
                        latencymode: lastEvent.data.export.options.latencypreference,
                        latencypreference: undefined,
                        constants_overrides: undefined,
                        ghostskin: undefined,
                        presets: undefined,
                        spinbonuses: "T-spins", // old ruleset
                        b2bchaining: true,
                        b2bcharging: false,
                        roundmode:"rng", // testing what this does, can change to "down" or "rng"
                        openerphase: 0
                    },
                    results: {
                        aggregatestats: lastEvent.data.export.aggregatestats,
                        stats: {
                            ...lastEvent.data.export.stats,
                            zenith: {},
                            finaltime: lastEvent.frame * 1000 / 60
                        },
                        gameoverreason: lastEvent.data.reason
                    }
                }
            }
        }
        return [jfunc(0), jfunc(1)] // return array of both players rounds
    })

    const replay = { // reformatted replay data YAY
        id: null,
        gamemode: null,
        ts: data.ts,
        users,
        replay: { leaderboard, rounds },
        version: 1
    }

    downloadFile(JSON.stringify(replay), "fixed-" + file.f.name);
}

function downloadFile(data, filename) { // weird code to download files using js
    let el = document.createElement('a');
    el.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
    el.setAttribute('download', filename);
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
}

function setInfo() {
    const text = files.reduce((info, file) => info + `${file.f.name.split(".")[0]}: ${file.status} \n`, '')
    document.getElementById('info').innerHTML = text;
}
