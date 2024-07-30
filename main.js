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
        let data = await file.f.text();
        let jsondata = null;
        try {
            jsondata = JSON.parse(data);
        } catch (error) {
            files[index].status = "Invalid JSON";
            setInfo()
            return;
        }

        switch (jsondata.gamemode) {
            case null:
                fixCustomReplay(jsondata, file);
                files[index].status = "Done";
                break;
            case undefined:
                fixOldReplay(jsondata);
                files[index].status = "Old Replay";
                break;
            default:
                files[index].status = "Cannot Fix";
                break;
        }
        setInfo();
    })
}

function fixCustomReplay(data, file) {
    data.gamemode = 'league'
    const users = data.users[0]
    data.users = users
    downloadFile(JSON.stringify(data), file.f.name);
}

function fixOldReplay(data) {
    
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
    let info = 'Current Files:\n';
    files.forEach(file => {
        info += `${file.f.name.split(".")[0]}: ${file.status}` + '\n';
    });
    document.getElementById('info').innerHTML = info;
}
