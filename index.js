const fs = require('fs');
var config = require('./credentials.json');
if (!config.google.client_id || !config.google.client_secret || !config.spotify.clientID || !config.spotify.clientSecret) return console.warn("\033[37;1;4mcredentials.json file is corrupted/missing info!\nPlease double check that everything is correctly filled in.\033[0m")
var database = {
    SplaylistID: "",
    GplaylistID: "",
    songs: []
}

process.on('SIGINT', function () {
    console.log("sigint")
    fs.writeFile(DBfilename, JSON.stringify(database), (err) => {
        if (err) console.warn("There was a problem saving the database file: ", err);
        process.exit()
    });
})
process.on('SIGTERM', function () {
    console.log("sigterm")
    fs.writeFile(DBfilename, JSON.stringify(database), (err) => {
        if (err) console.warn("There was a problem saving the database file: ", err);
        process.exit()
    });
})
process.on('SIGQUIT', function () {
    console.log("sigquit")
    fs.writeFile(DBfilename, JSON.stringify(database), (err) => {
        if (err) console.warn("There was a problem saving the database file: ", err);
        process.exit()
    });
})

var DBfilename = "default.pl"
if (process.argv.slice(2)[0] !== undefined) DBfilename = process.argv.slice(2)[0] + ".pl"
console.log("Config file: " + DBfilename)
fs.readFile(DBfilename, function (err, data) {
    if (err) return;
    database = JSON.parse(data)
});
var ftcpl = ""

// Wipeclean vars
const BRUSH_WIDTH = 6,
    DEFORMATION_FACTOR = 2,
    DELAY = 3
// Spotify API
var SpotifyWebApi = require('spotify-web-api-node'),
    spotifyApi = new SpotifyWebApi({
        clientId: config.spotify.clientID,
        clientSecret: config.spotify.clientSecret
    });

// Spotify to YT
const YoutubeMusicApi = require('youtube-music-api-update');
const ytsearch = new YoutubeMusicApi()

// Google API -----------------------------
var { google } = require('googleapis'),
    OAuth2 = google.auth.OAuth2,
    Gscopes = ['https://www.googleapis.com/auth/youtube'],
    Gtokenpath = './.gtoken.json',
    newsongsYT = [];

// Spotify token grant
spotifyApi.clientCredentialsGrant().then(
    function (data) {
        // console.log('The access token is ' + data.body['access_token']);
        // console.log('The access token expires in ' + data.body['expires_in']);
        spotifyApi.setAccessToken(data.body['access_token']);

    },
    function (err) {
        console.log('Something went wrong when retrieving a spotify access token', err);
    })
    .then(function () {
        if (!fs.existsSync(DBfilename)) firsttimer();
        else main();
    })

function firsttimer() {
    // First time setup!
    var readlineSync = require('readline-sync')
    console.log("\033[36;49;1mFirst time running Synth detected.\033[0m\n")
    console.log("Let's start with \033[32;49;1mSpotify\033[0m. What playlist do you want to use?")
    console.log("example: \033[36;49mhttps://open.spotify.com/playlist/1CBeITAfdIFxVAo2t7WqAn\033[0m")

    var waiting = true
    while (waiting) {
        var resp = readlineSync.question('> ')
        function rls(resp) {
            if (!resp.includes("open.spotify.com/playlist/")) return console.warn("\033[31;49mThat's not a supported link!\033[0m")
            var segurl = resp.replace("https://", "").replace("http://", "").replace("www.", "").replace("open.spotify.com/playlist/", "").split("&")
            if (segurl[0].length == 0) return console.warn("\033[31;49mPlaylist id cannot be empty!\033[0m")
            database.SplaylistID = segurl[0]
            waiting = false
        };
        rls(resp)
    }
    console.log("\033[32;49;1mSpotify\033[0m playlist saved!")
    console.log("\nNow let's set up your \033[31;49;1mYouTube\033[0m playlist.")
    if (!fs.existsSync(Gtokenpath)) {
        console.log("Seems like you're missing google api token. Generating auth link...");
    }
    Gauthorize(config.google, function FTdbCreate(auth) {
        // got the authorization of both, now let's roll
        const youtube = google.youtube({ version: 'v3', auth: auth });
        var resp = readlineSync.keyInYNStrict("Do you already have a \033[31;49;1mYouTube\033[0m playlist you wanna use? ")
        function rls(resp) {
            if (resp) {
                console.log("I see... so it's like that, huh. Alright, send me the link to it.")
                console.log("example: \033[36;49mhttps://www.youtube.com/playlist?list=PLMFoDoF5WCjivNyZjSOWfzjD4TyFbvqhu\033[0m")
                var waiting = true
                while (waiting) {
                    var url = readlineSync.question('> ')
                    function rls(resp) {
                        if (!resp.includes("youtube.com/playlist?list=")) return console.warn("\033[31;49mThat's not a supported link!\033[0m")
                        var segurl = resp.replace("https://", "").replace("http://", "").replace("www.", "").replace("youtube.com/playlist?list=", "").split("&")
                        if (segurl[0].length == 0) return console.warn("\033[31;49mPlaylist id cannot be empty!\033[0m")
                        database.GplaylistID = segurl[0]
                        waiting = false
                    };
                    rls(url)
                }
                console.log("\033[31;49;1mYouTube\033[0m playlist saved!")
                console.log("\nAnyways, since you already made your playlist, you definitely have some songs in here already.")

                var initdb = []
                spotifyApi.getPlaylist(database.SplaylistID)
                    .then(function (data) {
                        var songs = data.body.tracks.items
                        for (let i = 0; i < songs.length; i++) {
                            var sartist = songs[i].track.artists[0].name;
                            var sname = songs[i].track.name;
                            var suri = songs[i].track.uri;
                            initdb.push({ index: (i + 1), picked: false, nameplate: `${sartist} - ${sname}`, suri: suri })
                        }
                    }, function (err) {
                        console.log("\033[31;49mSomething went wrong when fetching Spotify playlist!", err, "\033[0m");
                    }).then(function () {
                        var loopers = true
                        while (loopers) {
                            console.log("\nHere is the list of your \033[32;49;1mSpotify\033[0m songs, please \033[37;49;1mselect those you already have\033[0m in your \033[31;49;1mYouTube\033[0m playlist.")
                            for (let i = 0; i < initdb.length; i++) {
                                var item = initdb[i]
                                if (item.picked) console.log(`\x1b[32;49m[${item.index}] \x1b[0m ${item.nameplate}`)
                                else console.log(`\x1b[31;49m[${item.index}] \x1b[0m ${item.nameplate}`)
                            }
                            console.log("\n[0] I'm done with changes. Let's continue!")
                            var resp = readlineSync.question('> ')
                            function rls(resp) {
                                if (resp == "0") {
                                    for (let i = 0; i < initdb.length; i++) {
                                        if (initdb[i].picked) database.songs.push(initdb[i].suri)
                                    }
                                    console.log("Alright, that's all for the initial setup.")
                                    loopers = false
                                } else {
                                    if (resp == "") return console.log("Your input cannot be empty.\n")
                                    if (isNaN(resp)) return console.log("That's not a valid number.\n")
                                    if (resp > (initdb.length)) return console.log("That's not a valid option.\n")
                                    var v = initdb[(resp - 1)]
                                    if (!v.picked) {
                                        v.picked = true;
                                    }
                                    else {
                                        v.picked = false;
                                    }
                                }
                            };
                            rls(resp)
                        }
                    }).then(function () {
                        fs.writeFile(DBfilename, JSON.stringify(database), (err) => {
                            if (err) return console.log("There was a problem saving the database file: ", err);
                            console.log("Alright, saving your preferences...")
                            wipeclean()
                        })
                    })
            } else {
                console.log("Alright, I'll create one for you.")
                var resname = readlineSync.question('Name: ')
                var resdesc = readlineSync.question('Description: ')
                var respriv = readlineSync.question('Privacy settings (public/unlisted/private): ', {
                    limit: ['public', 'unlisted', 'private'],
                    limitMessage: 'Sorry, $<lastInput> is not a valid option.'
                })
                // create plist
                youtube.playlists.insert({
                    part: "snippet, status",
                    requestBody: {
                        snippet: {
                            title: resname,
                            description: resdesc
                        },
                        status: {
                            privacyStatus: respriv
                        }
                    }
                }, function (err, res) {
                    if (err) {
                        console.log('The API returned an error: ' + err);
                        return;
                    }
                    database.GplaylistID = res.data.id
                    console.log("Playlist created successfully.")
                    ftcpl = "https://www.youtube.com/playlist?list=" + database.GplaylistID
                    fs.writeFile(DBfilename, JSON.stringify(database), (err) => {
                        if (err) return console.log("There was a problem saving the database file: ", err);
                        console.log("Alright, saving your preferences...")
                        wipeclean()
                    })
                    setTimeout(() => { return }, 6000);
                })
            }
        };
        rls(resp)
    });
}

function main() {
    // now proceed with casual spotify check, comparison, convert, add
    spotifyApi.getPlaylist(database.SplaylistID)
        .then(async function (data) {
            var songs = data.body.tracks.items
            console.log("\nSearching for new \033[32;49;1mSpotify\033[0m songs...")
            var skipped = 0
            for (let i = 0; i < songs.length; i++) {
                var suri = songs[i].track.uri;
                if (database.songs.includes(suri)) skipped++;
                else {
                    var sname = songs[i].track.name
                    var sartist = songs[i].track.artists[0].name
                    newsongsYT.push({ suri: suri, artist: sartist, name: sname, album: songs[i].track.album.name, yid: "" })
                    console.log(`\x1b[32;49;1mSpotify\x1b[0m: ${sartist} - ${sname}`)
                }
            }
            if (newsongsYT.length === 1) console.log(`${newsongsYT.length} new song found (${songs.length} total)`)
            else console.log(`${newsongsYT.length} new songs found (${songs.length} total)`)
            if (newsongsYT.length === 0) console.log("\nNothing to add, job's done.");
            else Gauthorize(config.google, ytMain)
        }, function (err) {
            if (err.body.error.message.toString() == "Invalid playlist Id") {
                console.log("\x1b[31;49;1mERROR: \x1b[32;49;1mSpotify\x1b[0m\x1b[31;49m Playlist not found - did you enter it correctly? Please delete '" + DBfilename + "' file and try again.\x1b[0m")
                console.log("Exiting...")
                return process.exit(1)
            } else console.log('Something went wrong!', err);
        });
}

async function ytMain(auth) {
    var youtube = google.youtube({ version: 'v3', auth: auth });
    console.log("\nSearching for the songs on \033[31;49;1mYouTube\033[0m")
    await ytsearch.initalize()
    await comboPiece(youtube, 0)
}

async function processor(filtered, type, index, result, sample) {
    var interest, typerino
    switch (type) {
        case 0:
            var scope = filtered.song
            if (index < scope.length) interest = scope[index];
            else {
                await processor(filtered, (type + 1), 0, result, sample)
                return;
            }
            typerino = "song"
            break;
        case 1:
            var scope = filtered.video
            if (index < scope.length) interest = scope[index];
            else {
                await processor(filtered, (type + 1), 0, result, sample)
                return;
            }
            typerino = "video"
            break;
        case 2:
            var scope = filtered.other
            if (index < scope.length) interest = scope[index];
            else return;
            typerino = "other"
            break;
        default: return
    }
    interest.type = typerino
    if (interest.name.toLowerCase().includes(sample.name.toLowerCase())) {
        result.picked = await interest
        return;
    } else {
        await result.helpchoose.push(interest)
    }
    await processor(filtered, type, (index + 1), result, sample)
}
function externalhelp(arr, t) {
    var readlineSync = require('readline-sync')
    console.log("I'm having trouble assigning this: " + t.artist + " - " + t.name)
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].type == "song") console.log(`\x1b[37;1m[${(i + 1)}]\x1b[0m (music)  \x1b[36m${arr[i].name}\x1b[0m (by \x1b[33m${arr[i].artist}\x1b[0m)`)
        if (arr[i].type == "video") console.log(`\x1b[37;1m[${(i + 1)}]\x1b[0m (video)  \x1b[36m${arr[i].name}\x1b[0m (by \x1b[33m${arr[i].author}\x1b[0m)`)
        if (arr[i].type == "other") console.log(`\x1b[37;1m[${(i + 1)}]\x1b[0m (other)  \x1b[36m${arr[i].name}\x1b[0m`)
    }
    console.log("\n\x1b[37;1m[0]\x1b[0m Nothing from this list.\n\x1b[37;1m[never]\x1b[0m Nothing from this list, don't ever ask me again on this song.")
    var resp = readlineSync.question('> ')
    return resp
}

async function comboPiece(youtube, i) {
    if (i < newsongsYT.length) {
        // first search check
        await ytsearch.search(`${newsongsYT[i].artist} - ${newsongsYT[i].name}`).then(async r => {
            //    console.log(`searching: ${newsongsYT[i].artist} - ${newsongsYT[i].name}\nResults:`)
            //    console.log(r)
            var filtered = {
                count: 0,
                song: [],
                video: [],
                other: []
            }
            await finders(r, 0, i, filtered)
            if (filtered.count == 0) {
                console.log(`Couldn't find any valid match for ${newsongsYT[isong].name}!`);
                await comboPiece(youtube, (i + 1))
            }
            else {
                //zpracovat
                var ytname = "", ytid = "", yttype = ""
                //console.log(filtered)
                var result = {
                    picked: false,
                    // { name, videoId, type(song/video/other) }
                    helpchoose: []
                    // [{interest},..]
                }
                await processor(filtered, 0, 0, result, newsongsYT[i])
                if (!result.picked) {
                    var res = await externalhelp(result.helpchoose, newsongsYT[i])
                    if (res == 0) {
                        console.log(`Couldn't find any valid match for ${newsongsYT[i].name}!`)
                        if (newsongsYT.length == (i + 1)) return;
                        await comboPiece(youtube, (i + 1))
                        return;
                    }
                    if (res == "never") {
                        console.log(`Alright, I won't ask you again about ${newsongsYT[i].name}.`)
                        database.songs.push(newsongsYT[i].suri)
                        if (newsongsYT.length == (i + 1)) return;
                        await comboPiece(youtube, (i + 1))
                        return;
                    }
                    result.picked = result.helpchoose[(res - 1)]
                }
                ytname = result.picked.name;
                ytid = result.picked.videoId;
                yttype = result.picked.type;

                // then add
                switch (yttype) {
                    case 'song': console.log(`\x1b[31;49;1mYouTube\x1b[0m: (music) ${ytname}`); break;
                    case 'video': console.log(`\x1b[31;49;1mYouTube\x1b[0m: (video) ${ytname}`); break;
                    default: console.log(`\x1b[31;49;1mYouTube\x1b[0m: (other) ${ytname}`); break;
                }

                var request = youtube.playlistItems.insert({
                    part: 'snippet', //removed id part
                    resource: {
                        snippet: {
                            playlistId: database.GplaylistID,
                            resourceId: {
                                videoId: ytid,
                                kind: "youtube#video"
                            }
                        }
                    }
                }, async function (err, res) {
                    if (err) {
                        switch (err.toString()) {
                            case "Error: The request cannot be completed because you have exceeded your <a href=\"/youtube/v3/getting-started#quota\">quota</a>.":
                                console.log("\x1b[31;49;1mERROR: \x1b[31;49mAPI limit - This app reached its quota of actions it can do. The limit is per day, so come back tommorow and try again.\x1b[0m")
                                fs.writeFile(DBfilename, JSON.stringify(database), (err) => {
                                    if (err) return console.log("There was a problem saving the database file: ", err);
                                    console.log("Exiting...")
                                    return process.exit(1)
                                })
                                break
                            case "Error: Playlist not found.":
                                console.log("\x1b[31;49;1mERROR: \x1b[31;49;1mYouTube\x1b[0m\x1b[31;49m Playlist not found - did you enter it correctly? Please delete '" + DBfilename + "' file and try again.\x1b[0m")
                                console.log("Exiting...")
                                return process.exit(1)
                                break
                            case "Error: Forbidden":
                                console.log("\x1b[31;49;1mERROR:\x1b[31;49m Forbidden action - you probably didn't pick a google account containing a youtube channel. Please delete '.gtoken.json' file and try again.\x1b[0m")
                                console.log("Exiting...")
                                return process.exit(1)
                                break
                            default:
                                console.log('The API returned an error: ' + err);
                                comboPiece(youtube, (i + 1))
                                break
                        }
                    }
                    else {
                        database.songs.push(newsongsYT[i].suri)
                        console.log(`[${(i + 1)}/${(newsongsYT.length)}] Successfully added ${ytname} to \x1b[31;49;1mYouTube\x1b[0m playlist`)
                        await comboPiece(youtube, (i + 1))
                    }
                })
            }
        })
    } else {
        if (ftcpl !== "") console.log("\nDone! You can find your new \033[31;49;1mYouTube\033[0m playlist here: \033[36;49m" + ftcpl + "\033[0m");
        else console.log("\nDone!");
        fs.writeFile(DBfilename, JSON.stringify(database), (err) => {
            if (err) console.warn("There was a problem saving the database file: ", err);
        });
    }
}
async function finders(r, t, isong, filtered) {
    //console.log("finders() ", `${newsongsYT[isong].artist} - ${newsongsYT[isong].name}`, t, isong)
    if (t > 7) return;
    var item = r.content[t]
    if (item.videoId === undefined) return await finders(r, (t + 1), isong, filtered)
    filtered.count++
    switch (item.type) {
        case 'song': filtered.song.push({
            videoId: item.videoId,
            name: item.name,
            artist: item.artist.name,
            album: item.album.name,
            duration: item.duration
        }); break;
        case 'video': filtered.video.push({
            videoId: item.videoId,
            name: item.name,
            author: item.author,
            duration: item.duration
        }); break;
        default: filtered.other.push({
            videoId: item.videoId,
            name: item.name
        }); break;
    }
    await finders(r, (t + 1), isong, filtered)
}


// ---------‐‐--‐----------- GOOGLE AUTH --------------------------------------
function Gauthorize(credentials, callback) {
    var GclientSecret = credentials.client_secret;
    var GclientId = credentials.client_id;
    var GredirectUrl = "http://localhost:5000/"
    var Goauth2Client = new OAuth2(GclientId, GclientSecret, GredirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(Gtokenpath, function (err, token) {
        if (err) {
            getNewToken(Goauth2Client, callback);
        } else {
            Goauth2Client.credentials = JSON.parse(token);
            callback(Goauth2Client);
        }
    });
}

async function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: Gscopes
    });
    var http = require('http');
    var url = require('url');
    var authorized = false
    var server = http.createServer(function (request, response) {
        var parsedUrl = url.parse(request.url, true);
        var callbackCode = parsedUrl.query.code;
        response.writeHead(200, { "Content-Type": "text/plain" });
        if (authorized) return response.end("You already authorized this application. You can close this page.");
        if (!callbackCode) return response.end("Error: no callback code.");
        oauth2Client.getToken(callbackCode, function (err, token) {
            if (err) {
                response.end("Authorization failed... Error: " + err);
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            response.end("Authorized successfully. You can close this window now."); //\n\n Also, if you see this vi von zulul.
            console.log("Authorized successfully."); //\n\n Also, if you see this vi von zulul.
            authorized = true
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
            server.close()
        });
    });
    server.listen(5000);
    var grabtheparams = url.parse(authUrl, true);
    var webAuth = "https://xaarii.github.io/Synth/signin.html?client_id=" + grabtheparams.query.client_id + "&redirect_uri=" + grabtheparams.query.redirect_uri;
    console.log("Opening the link in the browser to authorize the app...\nIf it doesn't open automagically, use this URL:\033[36;49m", webAuth, "\033[0m\n\nWaiting for authentification...");
    const open = require('open');
    await open(webAuth);
};

function storeToken(token) {
    fs.writeFile(Gtokenpath, JSON.stringify(token), (err) => {
        if (err) throw err;
        console.log('User token stored to ' + Gtokenpath);
    });
}


// ------------------- Wipeclean ripoff ---------------------------
function wipeclean(speed = (process.stdout.columns + process.stdout.rows)) { // 110 optimal for small
    const COLUMNS = process.stdout.columns
    const ROWS = process.stdout.rows
    const msPerFrame = 1000 / speed
    const zigZagPath = getZigZagPath(COLUMNS, ROWS)
    const rectangulaPath = getRectangularPath(zigZagPath[zigZagPath.length - 1], COLUMNS, ROWS)
    const finalPath = [...zigZagPath, ...rectangulaPath]

    finalPath.forEach((point, index) => {
        const BurshPoints = getBrushPoints(point.x, point.y, point.angle)

        //draw Brush
        setTimeout(() => {
            drawPoints(COLUMNS, ROWS, BurshPoints)
        }, index * msPerFrame)

        //erase brush with a DELAY
        if (index + DELAY >= 0)
            setTimeout(() => {
                drawPoints(COLUMNS, ROWS, BurshPoints, ' ')
            }, (index + DELAY) * msPerFrame)
    })

    //clear the screen and remove all log
    setTimeout(() => {
        process.stdout.cursorTo(0, 0)
        process.stdout.write('\x1Bc')
        main()
    }, (finalPath.length + DELAY) * msPerFrame)
}

function getZigZagPath(COLUMNS, ROWS) {
    //get half circle path
    const circlePointsLeft = getCirclefPoints(
        Math.floor(BRUSH_WIDTH / 2),
        Math.PI / 2,
        (Math.PI * 3) / 2,
    ).reverse()
    const circlePointsRight = getCirclefPoints(
        Math.floor(BRUSH_WIDTH / 2),
        (Math.PI * 3) / 2,
        (Math.PI * 5) / 2,
    )

    //points by which the squeegee
    const keyPoints = getKeyPoints(COLUMNS, ROWS)

    let points = []
    for (let step = 0; step < keyPoints.length; step++) {
        const linePoints = getLinePoints(
            keyPoints[step][0].x,
            keyPoints[step][0].y,
            keyPoints[step][1].x,
            keyPoints[step][1].y,
        )
        const turnPoints = (
            step % 2 == 0 ? circlePointsRight : circlePointsLeft
        ).map((point) => ({
            x: point.x + keyPoints[step][1].x,
            y: point.y + keyPoints[step][1].y + BRUSH_WIDTH / 2,
            angle: point.angle,
        }))
        points = [...points, ...linePoints, ...turnPoints]
    }
    return points
}

function getRectangularPath(closestStartPoint, COLUMNS, ROWS) {
    let points = []
    const verticalMargin = BRUSH_WIDTH / 2
    const horizontalMargin = (BRUSH_WIDTH * DEFORMATION_FACTOR) / 2
    const startPoint = { x: closestStartPoint.x, y: ROWS - verticalMargin }

    for (let x = startPoint.x; x > -2; x--) {
        points.push({ y: ROWS - verticalMargin + 1, x, angle: Math.PI / 2 })
    }

    let anglePoints = getCirclefPoints(
        Math.floor(BRUSH_WIDTH / 2),
        0,
        Math.PI / 2,
    )
    anglePoints = anglePoints
        .map((point) => ({
            x: point.x,
            y: point.y + ROWS - verticalMargin * 2,
            angle: point.angle,
        }))
        .reverse()
    points = [...points, ...anglePoints]

    for (let y = ROWS - verticalMargin - 3; y > -1; y--) {
        points.push({ y, x: horizontalMargin - 1, angle: Math.PI })
        points.push({ y, x: horizontalMargin - 1, angle: Math.PI })
    }

    let anglePoints2 = getCirclefPoints(
        Math.floor(BRUSH_WIDTH / 2),
        Math.PI,
        (Math.PI * 3) / 2,
    ).reverse()
    anglePoints2 = anglePoints2
        .map((point) => ({
            x: point.x + horizontalMargin * 2,
            y: point.y,
            angle: point.angle,
        }))
        .reverse()
    points = [...points, ...anglePoints2]

    for (let x = horizontalMargin + 3; x < COLUMNS; x++) {
        points.push({ y: verticalMargin - 1, x, angle: Math.PI / 2 })
    }

    let anglePoints3 = getCirclefPoints(
        Math.floor(BRUSH_WIDTH / 2),
        Math.PI,
        (Math.PI * 3) / 2,
    ).reverse()
    anglePoints3 = anglePoints3.map((point) => ({
        x: point.x + COLUMNS,
        y: point.y + verticalMargin * 2,
        angle: point.angle,
    }))
    points = [...points, ...anglePoints3]

    for (let y = verticalMargin + 3; y < ROWS; y++) {
        points.push({ y, x: COLUMNS - horizontalMargin, angle: Math.PI })
        points.push({ y, x: COLUMNS - horizontalMargin, angle: Math.PI })
    }

    let anglePoints4 = getCirclefPoints(
        Math.floor(BRUSH_WIDTH / 2),
        (Math.PI * 3) / 2,
        (Math.PI * 4) / 2,
    )
    anglePoints4 = anglePoints4
        .map((point) => ({
            x: point.x + COLUMNS - horizontalMargin * 2,
            y: point.y + ROWS,
            angle: point.angle,
        }))
        .reverse()
    points = [...points, ...anglePoints4]

    for (let x = COLUMNS - horizontalMargin - 3; x > startPoint.x; x--) {
        points.push({ y: ROWS - verticalMargin, x, angle: Math.PI / 2 })
    }
    return points
}

function getCirclefPoints(radius, start, end) {
    const angleStep = 5
    let points = []
    for (
        let angle = start;
        angle < end;
        angle += ((2 * Math.PI) / 360) * angleStep
    ) {
        points.push({
            x: Math.cos(angle) * radius * DEFORMATION_FACTOR,
            y: Math.sin(angle) * radius,
            angle,
        })
    }
    return points
}

function getKeyPoints(COLUMNS, ROWS) {
    let points = []
    const halfBrushDeformed = (BRUSH_WIDTH * DEFORMATION_FACTOR) / 2
    let step = 0

    while ((BRUSH_WIDTH / 2) * 3 + (step - 1) * BRUSH_WIDTH < ROWS) {
        points.push([
            {
                x: halfBrushDeformed * 2,
                y: (BRUSH_WIDTH / 2) * 2 + step * BRUSH_WIDTH,
            },
            {
                x: COLUMNS - halfBrushDeformed * 2,
                y: (BRUSH_WIDTH / 2) * 1 + step * BRUSH_WIDTH,
            },
        ])
        points.push([
            {
                x: COLUMNS - halfBrushDeformed * 2,
                y: (BRUSH_WIDTH / 2) * 3 + step * BRUSH_WIDTH,
            },
            {
                x: halfBrushDeformed * 2,
                y: (BRUSH_WIDTH / 2) * 2 + step * BRUSH_WIDTH,
            },
        ])
        step++
    }
    return points
}

function getLinePoints(startX, startY, endX, endY) {
    let points = []
    const Ystep = (endY - startY) / Math.abs(endX - startX)
    const Xdirection = endX > startX ? 1 : -1
    const angle = -Math.atan((endY - startX) / startY - endY)
    for (let step = 0; step < Math.abs(endX - startX); step++) {
        points.push({
            x: step * Xdirection + startX,
            y: startY + Ystep * step,
            angle,
        })
    }
    return points
}

function getBrushPoints(x, y, angle) {
    let newX = 0
    let newY = 0
    let points = []
    const halfBrushWidth = BRUSH_WIDTH / 2

    const oppositeAngle = angle + Math.PI

    for (let step = 0; step < halfBrushWidth * DEFORMATION_FACTOR; step++) {
        newX =
            x +
            Math.cos(angle) *
            ((halfBrushWidth / (halfBrushWidth * DEFORMATION_FACTOR)) * step) *
            DEFORMATION_FACTOR
        newY =
            y +
            Math.sin(angle) *
            ((halfBrushWidth / (halfBrushWidth * DEFORMATION_FACTOR)) * step)
        points.push({ x: newX, y: newY })

        newX =
            x +
            Math.cos(oppositeAngle) *
            ((halfBrushWidth / (halfBrushWidth * DEFORMATION_FACTOR)) * step) *
            DEFORMATION_FACTOR
        newY =
            y +
            Math.sin(oppositeAngle) *
            ((halfBrushWidth / (halfBrushWidth * DEFORMATION_FACTOR)) * step)
        points.push({ x: newX, y: newY })
    }
    return points
}

function drawnStringAt(x, y, str) {
    process.stdout.cursorTo(Math.round(x), Math.round(y))
    process.stdout.write(str)
}

function drawPoints(COLUMNS, ROWS, list, character = '#') {
    list.forEach((point) => {
        if (point.y < ROWS && point.x < COLUMNS)
            drawnStringAt(point.x, point.y, character)
    })
}