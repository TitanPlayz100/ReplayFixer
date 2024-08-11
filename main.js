/**
 * @type {{f: File, status: string}[]}
 */
let files = [];

function droppedFiles(event) {
    event.preventDefault();
    files = [...event.dataTransfer.items]
        .filter(file => file.kind === "file")
        .map(file => { return { f: file.getAsFile(), status: "Loaded" } });

    setInfo();
}

function manageReplays() {
    files.forEach(async (file, index) => {
        const ext = file.f.name.split(".")[1];

        if (ext !== "ttrm") {
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
        if (time < 1632787200000) {
            files[index].status = "Way Too Old";
        } else if (time < 1701302400000) {
            files[index].status = "Format too different";
        } else if (time < 1721952000000) {
            fixCustomReplay(jsondata, file);
            files[index].status = "Fixed";
        } else {
            files[index].status = "Already Fixed";
        }

        setInfo();
    })
}

function fixOldReplay(data, file) {
    const defaultStats = { apm: 0, pps: 0, vsscore: 0, garbagesent: 0, garbagereceived: 0, kills: 0, altitude: 0, rank: 0, targetingfactor: 0, targetinggrace: 0 };

    const user1 = data.endcontext[0]
    const user2 = data.endcontext[1]
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

    const leaderboard = [
        {
            id: user1.id,
            username: user1.username,
            active: user1.active,
            naturalorder: user1.naturalorder,
            wins: user1.wins,
            // maybe calculate average stats
            stats: defaultStats,
            shadows: [],
            shadowedBy: [null, null]
        },
        {
            id: user2.id,
            username: user2.username,
            active: user2.active,
            naturalorder: user2.naturalorder,
            wins: user2.wins,
            stats: defaultStats,
            shadows: [],
            shadowedBy: [null, null]
        }
    ]

    const rounds = data.data.map(round => {
        jfunc = ind => {
            let lastIndex = round.replays[ind].events.length - 1
            let lastEvent = round.replays[ind].events[lastIndex];
            while (lastEvent.type != 'end') {
                lastIndex--;
                lastEvent = round.replays[ind].events[lastIndex];
            }

            const changeGarbEvents = ev => {
                return (ev.type == "ige")
                    ? {
                        ...ev,
                        data: {
                            ...ev.data,
                            type: ev.data.data.type,
                            frame: ev.data.data.frame - 5,
                            data: {
                                ...ev.data.data.data,
                                gameid: 1,
                                frame: ev.data.data.frame,
                                cid: ev.data.data.cid,
                            }
                        }
                    }
                    : ev
            }

            const startEvents = [
                { frame: 0, type: "start", data: {} },
                { frame: 0, type: "ige", data: { id: 0, frame: 0, type: "target", data: { targets: [1] } } },
                { frame: 0, type: "ige", data: { id: 1, frame: 0, type: "allow_targeting", data: { value: false } } },
                { frame: 0, type: "ige", data: { id: 2, frame: 0, type: "target", data: { targets: [1] } } },
                { frame: 0, type: "ige", data: { id: 3, frame: 0, type: "allow_targeting", data: { value: false } } }
            ]
            const midEvents = round.replays[ind].events.slice(4, lastIndex).map(changeGarbEvents);
            const endEvents = [{ frame: lastEvent.frame, type: "end", data: {} }]

            const newEvents = startEvents.concat(midEvents).concat(endEvents);

            return {
                id: round.board[ind].id,
                username: round.board[ind].username,
                active: round.board[ind].active,
                naturalorder: round.board[ind].naturalorder,
                alive: true,
                lifetime: null,
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
                        version: 19,
                        gameid: 1,
                        garbageabsolutecap: 0,
                        garbagephase: 0,
                        garbageattackcap: 0
                    },
                    results: {
                        aggregatestats: lastEvent.data.export.aggregatestats,
                        stats: {
                            ...lastEvent.data.export.stats,
                            zenith: {},
                            finaltime: null
                        },
                        gameoverreason: lastEvent.data.reason
                    }
                }
            }
        }
        return [jfunc(0), jfunc(1)]
    })

    const replay = {
        id: null,
        gamemode: null,
        ts: data.ts,
        users,
        replay: { leaderboard, rounds },
        version: 1
    }

    downloadFile(JSON.stringify(replay), "fixed-" + file.f.name);
}

function downloadFile(data, filename) {
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
