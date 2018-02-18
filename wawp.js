// use eslint wawp.js
// Discord API & bot init
"use strict"
const Discord = require("discord.js")
const bot = new Discord.Client()
// 3rd party libs
const fs = require("fs")
var request = require("request")
var _ = require("underscore")
var glob = require("glob")
var google = require("googleapis")
const json2csv = require("json2csv")
var winston = require("winston")
var Buffer = require("buffer").Buffer
// local dependencies (steam/discord/gcloud api tokens)
const {gcpstorageBucket, steamapikey, discordapikey} = require("./config.json")
const version = require("./package.json").version
var serviceAccount = require("./serviceAccountKey.json")
// Scopes required for Storage, though this may not be necessary
var scopes = [
  "https://www.googleapis.commands/auth/devstorage.full_control",
  "https://www.googleapis.com/auth/userinfo.email"
]
// Generate GCP tokens
var jwtClient = new google.auth.JWT(
  serviceAccount.client_email,
  null,
  serviceAccount.private_key,
  scopes
)
// Logging
var logging = new (winston.Logger)({
exitOnError: false,
transports: [
  new (winston.transports.Console)({level: "debug",handleExceptions: true,prettyPrint: true,silent:false,timestamp: true,colorize: true,json: false}),
  new (winston.transports.File)({ filename: "./logs/debug.log",name:"file.all",level:"debug",maxsize: 1024000,maxFiles: 10, handleExceptions: true,json: false}),
  new (winston.transports.File)({ filename: "./logs/error.log",name:"file.warn",level:"warn",maxsize: 1024000,maxFiles: 10, handleExceptions: true,json: false})
 ]
})

// When true, it runs sqlite3 in verbose and enables console.log (false still prints warn/error)
const DEBUG_MODE = true

// When bot is ready to accept commands, you will see this banner - until then, wait.
bot.on("ready", function () {

    logging.debug(`Connected - Logged in as un: ${bot.user.username} id: ${bot.user.id} version: ${version}`)

    var sql = (DEBUG_MODE) ? require("sqlite3").verbose() : require("sqlite3")
    var db = new sql.Database("./wawp.sqlite")

   // Database init
    ;(function createTable() {
        db.run("CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY AUTOINCREMENT,appid TEXT UNIQUE,name TEXT,tags TEXT);")
        db.run("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,datetime datetime NOT NULL,players TEXT NOT NULL,game TEXT NOT NULL);")
        db.run("CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,steamid TEXT, discordsnowflake TEXT NOT NULL UNIQUE);")
        db.run("CREATE TABLE IF NOT EXISTS playersgames (id INTEGER PRIMARY KEY AUTOINCREMENT,discordsnowflake TEXT NOT NULL,appid TEXT NOT NULL,FOREIGN KEY(discordsnowflake) REFERENCES players(discordsnowflake),FOREIGN KEY(appid) REFERENCES games(appid));")
        createIndexes()
    })(); // eslint-disable-line semi

    function createIndexes() {
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS players_discordsnowflake ON players (discordsnowflake)")
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS players_discordsnowflake ON players (discordsnowflake)")
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS games_players ON playersgames (discordsnowflake,appid)")
        db.close()
        db = undefined
        sql = undefined
    }
})

// Direct bot logs to logging wrapper
bot.on("error", (e) => logging.error(e))
bot.on("warn", (e) => logging.warn(e))
bot.on("debug", (e) => logging.debug(e))

// We're only going to respond to commands with this prefix
const commandPrefix = "!"

// Event hook for a new message
bot.on("message", message => {
    // Early abort
    if (message.author.bot) return
    if (message.channel.type !== "text") return

    // Handle DB Queries
    function queryThis(opcmd, sqlQuery, params, callback) {
        var sql = (DEBUG_MODE) ? require("sqlite3").verbose() : require("sqlite3")
        var db = new sql.Database("./wawp.sqlite")

        logging.debug(`Op: ${opcmd} Action: ${JSON.stringify(sqlQuery)} Params ${params}`)

        if(!sqlQuery) {
            logging.error("You did not send a sqlQuery along with the call...")
            return false
        }

        if(opcmd === "exec"){
            db.serialize(function(){
                db.exec("begin transaction")
                    sqlQuery.forEach(function(query){
                        query.toString().replace(";", "")
                        db.run(query, function(err){
                            if(err) { logging.debug(`EXEC SQL: Error: ${JSON.stringify(err)}`) }
                        })
                    })
                db.exec("commit")
                logging.debug("Bulk DB Insert Completed")
                callback("Bulk DB Insert Completed")
            })
        } else {
            if(params) {
                db[opcmd](sqlQuery, params, function(err, row){
                    if(err) {
                        logging.error(`DB.${opcmd} Query: ${sqlQuery} PARAM: ${params} Error: ${JSON.stringify(err)}`)
                        callback(err,row)
                    } else {
                        logging.debug(`DB.${opcmd} Query: ${sqlQuery} PARAM: ${params} ERROR ${JSON.stringify(err)}}`)
                        callback(null,row)
                    }
                })
            } else {
                db[opcmd](sqlQuery, function(err, row){
                    if(err) {
                        logging.error(`DB.${opcmd} QUERY No PARAM: ${sqlQuery} Error: ${JSON.stringify(err)}`)
                        callback(err,row)
                    } else {
                        logging.debug(`DB.${opcmd} Query No PARAM: ${sqlQuery} ERROR ${JSON.stringify(err)}}`)
                        callback(null,row)
                    }
                })
            }
        }
        db.close()
    }

    // Listen to commands with the prefix
    if (message.content.startsWith(commandPrefix)) {

        // Break <command> and <args[0]> <args[1]> <args[2]> ... <args[n]>
        var args = message.content.slice(commandPrefix.length).trim().split(/ +/g)
        const command = args.shift().toLowerCase()
       
        logging.debug(`Command was: ${command} and args were ${args}`)

       // The god function
        switch(command) {
            case "debug": {
            // Example of embed and echo's back first to args
                message.channel.send({embed: {
                    color: 3447003,
                    author: {
                        name: bot.user.username,
                        icon_url: bot.user.avatarURL
                    },
                    title: "Debug Message",
                    url: "https://google.com",
                    description: "A debug message has been summoned",
                    fields: [{
                        name: "Arg 1", // eslint-disable-line no-redeclare
                        value: args[0] || "undefined"
                    },
                    {
                        name: "__Arg 2__", // eslint-disable-line no-redeclare
                        value: args[1] || "undefined"
                    }],
                    timestamp: new Date(),
                    footer: {
                        icon_url: bot.user.avatarURL,
                        text: "Aaaaawwwwwww yea"
                    }
                }})
                logging.debug("Debug logging is working")
                logging.warn("Warn logging is working")
                logging.error("Error logging is working")

            break}
            case "help": {
            // The help menu
                message.channel.send({embed: {
                    color: 3447003,
                    author: {
                        name: bot.user.username,
                        icon_url: bot.user.avatarURL
                    },
                    title: "WAWP (wha-whip) - What Are We Playing?",
                    url: "https://github.com/sliptripfall/wawp/wiki/Operating",
                    description: "This is still a work in progress, report issues to https://github.com/sliptripfall/wawp/issues",
                    fields: [{
                        name: "Getting Started",
                        value: "If this is your first time, you'll want to read this https://github.com/sliptripfall/wawp/wiki/Operating."
                    },
                    {
                        name: "Commands 1/2",
                        value: `\`${commandPrefix}help\` - this menu \n`+
                        `\`${commandPrefix}myinfo\` - _shows your discord identification_\n`+
                        `\`${commandPrefix}getinfo <name>\` - _displays discord snowflake and steam64id from players name_\n`+
                        `\`${commandPrefix}ping\` - _checks responsiveness of bot_\n`+
                        `\`${commandPrefix}addme <steam64id> [opt]\` - _adds yourself to the player database, omitting steam64id limits functionality_\n`+
                        `\`${commandPrefix}getplayers\` - _retreive players in player database_\n`+
                        `\`${commandPrefix}deleteme\` - _deletes you from player database_\n`+
                        `\`${commandPrefix}updatename\` - _updates database with discord nickname, must run if nick is changed_\n`+
                        `\`${commandPrefix}getallgames <csv> [opt]\` - _all games in database, by default in JSON but can pass CSV option_\n`+
                        `\`${commandPrefix}addsteamgames <discordsnowflake> [opt]\` - _adds owned games of player against games db, runs on self without argument_\n`+
                        `\`${commandPrefix}addgame <appid> <name>\` - _manually add games to database_\n`
                    },
                    {
                        name: "Commands 2/2",
                        value: `\`${commandPrefix}compare <name> <name> ... <name>\` - _compare inventory between <n> players_\n`+
                        `\`${commandPrefix}getplayersbygame <appid>\` - _provide appid to get a list of players, use getgames to find appid_\n`+
                        `\`${commandPrefix}getgames <name|steam64id|discordsnowflake> [opt]\` - _queries all games, performs on self without argument_\n`+
                        `\`${commandPrefix}iplay <appid>\` - _manually adds games to your profile_\n`+
                        `\`${commandPrefix}gettags <appid>\` - _shows tags for a given game_\n`+
                        `\`${commandPrefix}addtags <appid> <tags>\` - _adds tags for a given game_\n`+
                        `\`${commandPrefix}deletetags <appid> <tags>\` - _removes tags for a given game_\n`+
                        `\`${commandPrefix}searchtag <tag>\` - _searches games for matching tag_\n`
                    }],
                    timestamp: new Date(),
                    footer: {
                        icon_url: bot.user.avatarURL,
                        text: "Aaaaawwwwwww yea"
                    }
                    }
                 })

            break}
            case "myinfo": {
            // myinfo - Discord specific identification
                logging.debug(`Display name is: ${message.member.displayName} and Nick is: ${message.member.nickname}`)
                logging.debug(`Username is: ${message.member.user.username} and Snowflake is: ${message.member.id}`)

                message.channel.send({embed: {
                    color: 3447003,
                    title: "Your Discord Identity",
                    fields: [{
                        name: "Display: ",
                        value: message.member.displayName || "null",
                        inline: true
                    },
                    {
                        name: "Nick: ",
                        value: message.member.nickname || "null",
                        inline: true,
                    },
                    {
                        name: "User: ",
                        value: message.member.user.username || "null",
                        inline: true,
                    },
                    {
                        name: "Snowflake: ",
                        value: message.member.id,
                        inline:true
                    }]
                }})

            break}
            case "getinfo": {
            // getinfo <name> returns discordsnowflake and steam64id
                if(args.length == 1) {
                    var name = args[0]
                    logging.debug(`Name set to first args ${args[0]}`)
                } else if(args.length > 1 ) {
                    var name = args.toString().replace(/,/g," ") // eslint-disable-line no-redeclare
                    logging.debug(`Multiword name is '${args.toString().replace(/,/g," ")}'`)
                } else {
                    var name = message.author.username // eslint-disable-line no-redeclare
                    logging.debug(`Name set to self ${message.author.username}`)
                }

                logging.debug(`SQL: SELECT discordsnowflake,steamid FROM players WHERE ${name} IN (name,discordsnowflake,steamid)`)
                var sqlQuery = "SELECT discordsnowflake,steamid,name FROM players WHERE ? IN (name,discordsnowflake,steamid)"

                queryThis("get", sqlQuery, name, function(err,row){
                    logging.debug(`Row is: ${row}`)
                        if(row) {
                            var discordSnowFlake = row.discordsnowflake
                            var steam64id = row.steamid
                            var name = row.name

                            logging.debug(`For ${name} their discordsnowflake is: ${discordSnowFlake} and their Steam64ID is: ${steam64id}`)

                            message.channel.send({embed: {
                                color: 3447003,
                                title: `Identity for ${name}`,
                                fields: [{
                                    name: "Discord Snowflake",
                                    value: discordSnowFlake,
                                    inline: true
                                },
                                {
                                    name: "Steam64ID",
                                    value: steam64id,
                                    inline: true
                                },
                                {
                                    name: "Display: ",
                                    value: message.guild.member(discordSnowFlake).displayName || "null",
                                    inline: true
                                },
                                {
                                    name: "Nick: ",
                                    value: message.guild.member(discordSnowFlake).nickname || "null",
                                    inline: true,
                                },
                                {
                                    name: "User: ",
                                    value: message.guild.member(discordSnowFlake).user.username || "null",
                                    inline: true,
                                }]
                            }})
                        } else {
                            logging.debug(`SQL: ${sqlQuery} and Name: ${name}`)
                            message.reply(`That name doesn't exist, have them run ${commandPrefix}updatename if nick was changed`)
                        }
                })

            break}
            case "ping": {
            // ping - Simple ping/pong with the bot to see if it's responsive
            // if you <prefix>ping ping, it will pong pong!
                (args[0] == "ping") ? message.channel.send("pong pong!") : message.channel.send("pong!")

                logging.debug("Bot says: Ping/Pong")

            break}
            case "pretendbot": {
            // pretendbot - Steam user Kongzoola, owning the most games (bot mock for debugging)
                var steamid = "76561197979408421"

                logging.debug(`User ${bot.user.username} ${bot.user.id} made the following request:`)
                logging.debug(`SQL: 'INSERT INTO players (name, steamid, discordsnowflake) VALUES (${bot.user.username},${steamid},${bot.user.id})`)

                var insertIntoPlayers = "INSERT INTO players (name, steamid, discordsnowflake) VALUES (?,?,?)"

                queryThis("run", insertIntoPlayers, [bot.user.username,steamid,bot.user.id], function(err){
                    if(err){
                        logging.error(`ERROR: ${err}`)
                        message.channel.send("Something went wrong, likely it already exists in the db...")
                        return false
                    } else {
                        message.channel.send("Uhhh, nothing to see here, but I'm Kongzoola now")
                    }
                })

            break}
            case "unpretendbot": {
            // unpretendbot - Steam user Kongzoola, owning the most games (bot mock for debugging)

                logging.debug(`SQL: DELETE FROM playersgames WHERE discordsnowflake = ${bot.user.id}`)

                var delPlayerGames = `DELETE FROM playersgames WHERE discordsnowflake = ${bot.user.id}`
                var delPlayer = "DELETE FROM players WHERE name = 'wawp'"

                queryThis("run", delPlayerGames, null, function(err){
                    if(err){
                        logging.error(`unpretendbot error: ${err}`)
                        message.channel.send("Something went wrong, likely wawp doesn't exist anymore")
                        return false
                    } else {
                       queryThis("run", delPlayer, null, function(err){
                            if(err){
                                logging.error(`unpretendbot error: ${err}`)
                                message.channel.send("Removed the playersgames, but not the player")
                                return false
                            } else {
                                message.channel.send("I'm not Kongzoola anymore.")
                            }
                       })                       
                    }
                })

            break}
            case "addme": {
            // addme <steamid>[opt] - Adds a player by steamid (optional) and user, or nick, name.

                // 0ds is 0 for numeric sorting, and ds for discord snowflake - if you don't have a steam64id you still have to be unique
                var steam64id = (args[0]) ? args[0] : `0ds${message.author.id}`
                var myname = (!message.member.nickname) ? message.author.username : message.member.nickname 

                logging.debug(`SQL: INSERT INTO players (name, steamid, discordsnowflake) VALUES (${myname},${steam64id},${message.author.id})`)
                queryThis("run", "INSERT INTO players (name, steamid, discordsnowflake) VALUES (?,?,?)", [myname,steam64id,message.author.id], function(err){
                    if(err) {
                        logging.error(`ADDME: could not add you ${JSON.stringify(err)}`)
                        message.channel.send("Could not insert you into the database")
                    } else {
                        message.channel.send(`Player ${myname} has been inserted!`)                        
                    }
                })

            break}
            case "getplayers": {
            // getplayers - List all players registered
                var selectPlayersNames = "SELECT name FROM players"

                logging.debug("SQL: SELECT name FROM players")
                queryThis("all", selectPlayersNames, null, function(err, rows) {
                    if(err){
                        logging.error(`GETPLAYERS: could not get players ${JSON.stringify(err)}`)
                        message.channel.send("Could not get players")
                    } else {
                        if(!rows){
                            logging.debug("There are no players in the database")
                            message.reply("There are no players in the database")
                            return false
                        }
                        // Pull name from aray results
                        var names = _.pluck(rows, "name")

                        // Case insensitive sort
                        names = names.sort(function(x,y){
                            var a = String(x).toUpperCase()
                            var b = String(y).toUpperCase()
                            if(a>b){
                                return 1
                            } else if (a<b) {
                                return -1
                            } else {
                                return 0
                            }
                        })
                        message.reply(`These people: ${names}`)
                    }
                })

            break}
            case "deleteme": {
            // deleteme - Remove user from the database
                var deletePlayersGames = "DELETE FROM playersgames WHERE discordsnowflake = ?"
                var deletePlayers = "DELETE FROM players WHERE discordsnowflake = ?"

                // Delete owned games in the playersgames table first, to not violate foreign key
                logging.debug(`SQL: DELETE FROM playersgames WHERE discordsnowflake = ${message.author.id}`)
                queryThis("run", deletePlayersGames, message.author.id, function(err) {
                    if(err) {
                        logging.error(`Could not delete from playersgames ${err.message}`)
                        message.reply("Something bad happened... playersgames not empty")
                        return false
                    } else {
                        // Now we delete the player from the players table
                        logging.debug(`SQL: DELETE FROM players WHERE discordsnowflake = ${message.author.id}`)
                         queryThis("run", deletePlayers, [message.author.id], function(err){
                            if (err) {
                                logging.error(`Could not delete player from players table ${err.message}`)
                                message.reply("Unbound games from player, but couldn't remove from players table")
                                return false
                            } else {
                                logging.warn(`Row deleted for ${message.member.nickname} or ${message.author.username}`)
                                message.reply("Deleted from database")
                            }
                        })
                    }
                })

            break}
            case "updatename": {
            // updatename - Update users username based on their discordsnowflake, because discord lets you change this
                var updateName = "UPDATE players SET name = ? WHERE discordsnowflake = ?"

                logging.debug(`SQL: UPDATE players SET name = ${message.member.displayName} WHERE discordsnowflake = ${message.author.id}`)
                queryThis("run", updateName, [message.member.displayName, message.author.id], function(err){
                    if (err) {
                        logging.error(err)
                        message.reply("Could not update, maybe you don't exist...")
                        return false
                    } else {
                        logging.debug(`Row updated for ${message.member.displayName}`)
                        message.reply(`Updated ${message.member.displayName} in database`)
                    }
                })
            break}
            case "getallgames": {
            // getallgames - Retrives all games in database, uses GC Storage
                var useCsv = (args[0] == "csv") ? true : false
                var allGames = "SELECT appid,name,tags FROM games"

                queryThis("all", allGames, null, function(err, rows) {
                    if(rows) {
                        if(useCsv) {
                            var jsonOutput = json2csv({ data: rows, fields: ["appid", "name", "tags"] })
                            var fileext = "csv"
                        } else {
                            var jsonOutput = JSON.stringify(rows, null, 4)  // eslint-disable-line no-redeclare
                            var fileext = "json"                            // eslint-disable-line no-redeclare
                        }

                        var dataSize = Buffer.byteLength(jsonOutput, "utf8")

                        jwtClient.authorize(function(error, tokens) {
                          if (error) {
                            logging.error("GC Storage ERROR: Error making request to generate access token:", error)
                            return false
                          } else if (tokens.access_token === null) {
                            logging.error("GC Storage ERROR: Provided service account does not have permission to generate access tokens")
                            return false
                          } else {
                            // Assign access token for GC Storage
                            var accessToken = tokens.access_token
                           
                            var headers = {
                                    "Content-Type": "application/json",
                                    "User-Agent": `Discord Bot/${version}`,
                                    "Content-Length": dataSize,
                                    "Authorization": `Bearer ${accessToken}`
                                }

                            var options = {
                                url: `https://www.googleapis.com/upload/storage/v1/b/${gcpstorageBucket}/o?uploadType=media&name=gameList.${fileext}`,
                                method: "POST",
                                headers: headers,
                                body: jsonOutput
                            }

                            request(options, function(err, res, body){
                                logging.debug(`Statuscode was: ${res.statusCode} \n res is: ${JSON.stringify(res)}\n`)
                                if(err) {
                                    logging.error(`Error was: ${JSON.stringify(err)} and body was: ${JSON.stringify(body)}`)
                                    return false
                                } else if ( res.statusCode == 200) {
                                    var body = JSON.parse(body) // eslint-disable-line no-redeclare
                                    var link = body.mediaLink.toString()

                                    logging.debug(`Medialink is: ${link}`)
                                    message.reply(`Over char limit, games here: ${link} `)
                                } else {
                                    logging.error(`Error was: ${JSON.stringify(err)} and body was: ${JSON.stringify(body)}`)
                                    return false
                                }
                            })
                          }
                        })
                    } else {
                        logging.debug("There's no games yet")
                        message.channel.send("There's no games yet")
                    }
                })

            break}
            case "addsteamgames": { 
            // addsteamgames <discordsnowflake> [opt] - Adds all multiplayer games to steam profile
                var updateId = (args[0]) ? args[0] : message.author.id
                logging.debug(`Update ID is: ${updateId}`)

                function getSteamID(id) { // eslint-disable-line no-inner-declarations

                    var findDiscordSnowflake = "SELECT DISTINCT steamid FROM players WHERE discordsnowflake = ?"

                    logging.debug(`SQL: SELECT DISTINCT steamid FROM players WHERE discordsnowflake = ${id}`)
                    queryThis("get", findDiscordSnowflake, id, function(err, row) {
                        if(row) {
                            logging.debug(`Steam64ID is: ${row.steamid}`)
                            setSteam64(row.steamid)
                        } else {
                            logging.warn(`Use the players discordsnowflake id, use ${commandPrefix}getinfo <player> to find it `)
                            message.reply(`Use the players discordsnowflake id, use ${commandPrefix}getinfo <player> to find it `)
                            return false
                        }
                    })
                }

                // Use SteamAPI to get list of games for player
                function setSteam64(Steam64ID) { // eslint-disable-line no-inner-declarations
                    var steamurl = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key="+steamapikey+'&format=json&input_json={"steamid": '+Steam64ID+"}" // eslint-disable-line quotes
                    logging.debug(`STEAM URL: ${steamurl}`)

                    request.get({
                        url: steamurl,
                        json: true,
                        headers: {"User-Agent": "request"}
                    }, (err, res, data) => {
                        if(err) {
                            logging.error("Error: ", err)
                            return false
                        } else if (res.statusCode !== 200) {
                            logging.debug(`Status: ${res.statusCode}`)
                            message.reply("Your Steam64ID is probably not correct. Delete and readd yourself with your Steam64ID https://steamidfinder.com/")
                        } else {
                          // Pulls appids from json API query, reflecting owned games
                          var appids = _.map(data.response.games, function(o) {return _.pick(o, "appid") })

                          buildCompatList(appids)
                        }
                    })
                }

                function buildCompatList(steamGames) { // eslint-disable-line no-inner-declarations

                    var steamSQL = "SELECT CAST(appid as int) AS appid FROM games"

                    queryThis("all", steamSQL, null, function(err, rows) {
                        if(err) {
                            logging.error(err.message)
                            message.reply("Couldn't cast appids to integers to build the list...")
                            return false
                        } else {
                            if(rows) {
                                var dbGames = _.pluck(rows, "appid")
                                var userGames = _.pluck(steamGames, "appid")
                                var compatList = _.intersection(dbGames, userGames)

                                if(dbGames.length < 1) {
                                    logging.warn("Compat list missing, likely haven't ran multiplayer seeder")
                                    message.reply("Hey, run the seeder or add games to the db")
                                    return false
                                } else {
                                    logging.debug(`Created compat list: ${compatList}`)
                                    showCompatGames(compatList)
                                }
                            } else {
                                logging.warn("There are no players in the database")
                                message.reply("There are no players in the database")
                                return false
                            }
                        }
                    })
                }

                function showCompatGames(compatList) {  // eslint-disable-line no-inner-declarations 

                    if(compatList.length < 1) {
                        logging.debug("Compat list missing, likely haven't ran multiplayer seeder")
                        message.reply("Hey, run the seeder or add games to the db")
                        return false
                    } else {
                        var gameSQL = `SELECT name,appid FROM games WHERE appid IN (${compatList})`

                        logging.debug(`SQL: SELECT name,appid FROM games WHERE appid IN (${compatList})`)
                        queryThis("all", gameSQL, null, function(err, rows) {
                            logging.debug(`The data is: ${_.pluck(rows, "name")}`)
                            logging.debug(`The compat list is ${compatList}`)

                            var start = Date.now()
                            var gameSQL = []

                            rows.forEach(function (arrayItem){
                                var appid = arrayItem.appid

                                gameSQL.push(`INSERT OR IGNORE INTO playersgames (discordsnowflake,appid) VALUES ('${updateId}','${appid}')`)
                            })

                            queryThis("exec", gameSQL, null, function(err){
                                if(!err){
                                    logging.error(`Warning SQL error: ${err}`)
                                    return false                                      
                                } else {

                                    logging.debug((Date.now() - start) + "ms to finish")

                                    var headers = {
                                        "User-Agent": `Discord Bot/${version}`,
                                        "Content-Type": "application/x-www-form-urlencoded"
                                    }

                                    var options = {
                                        url: "http://text-share.com/api/create",
                                        method: "POST",
                                        headers: headers,
                                        form: "text="+encodeURIComponent(JSON.stringify(rows))
                                    }

                                    request(options, function(err, res, body){
                                        if(!err && res.statusCode == 200) {
                                            logging.debug(body)
                                            message.reply(`Here's the list: ${body} take this data and go here http://json2table.com or search for json beautifiers`)
                                        } else {
                                            logging.error(err.message)
                                            message.reply("I wasn't able to upload the data, maybe the text host is down...")
                                            return false
                                        }
                                    })
                                }
                            })
                        })
                    }
                }
                logging.debug(`The ID being used is: ${updateId}`)
                getSteamID(updateId)

            break}
            case "addgame": {
            // addgame <appid> <name> - adds multiplayer games to database. Consider updating gamesdbseed.sql and submitting a pull request.

                var addGameApp = args[0]
                args.shift()
                var gameName = args.join(" ")
                logging.debug(`gameName: ${gameName} AppID: ${addGameApp}`)

                if(!addGameApp || !gameName) { message.reply(`Doin it wrong, ${commandPrefix}addgame <appid> <name>`); return false }

                var insertGame = "INSERT OR IGNORE INTO games (appid, name) VALUES (?,?)"

                logging.debug(`SQL: INSERT OR IGNORE INTO games (appid, name) VALUES (${addGameApp},${gameName})`)
                queryThis("run", insertGame,[addGameApp,gameName], function(err){
                    if(err) {
                        logging.error(`INSERT ERROR: ${JSON.stringify(err)}`)
                    }
                })

                var selectGames = "SELECT id, name, appid FROM games WHERE name = ?"

                logging.debug(`SQL: SELECT id, name, appid FROM games WHERE name = ${gameName}`)
                queryThis("get", selectGames, gameName, function(err, row) {
                    if(row) {
                            logging.debug(`DB ID: ${row.id} Game Name: ${row.name} App ID: ${row.appid}`)
                            message.reply(`Game Name: ${row.name} App ID: ${row.appid} added!`)
                    } else {
                        logging.error(`That appid may already exist, check ${commandPrefix}getallgames`)
                        message.reply(`That appid may already exist, check ${commandPrefix}getallgames`)
                    }
                })

            break}
            case "compare": {
            // compare <name> <name> ... <name> - compare games between players, use name from getplayers
                if(args.length < 2) {
                    message.reply("At least two names...")
                } else {

                    var snowflakelookup = args
                    var getSnowFlake = `SELECT discordsnowflake FROM players WHERE name IN (${snowflakelookup.map(function() { return "?" }).join(",")})`

                    logging.debug(`SQL: SELECT discordsnowflake FROM players WHERE name IN (${snowflakelookup})`)
                    queryThis("all", getSnowFlake, snowflakelookup, function(err, rows){
                        if(err){
                            logging.error(err.message)
                            message.reply("One or more of the names is not valid")
                            return false
                        } else {
                            if(rows) {
                                // We may only get 1 result back from the database, verify we have something to compare against
                                if( _.pluck(rows, "discordsnowflake") > 2) {
                                    logging.debug(`No games matched, ensure players are in ${commandPrefix}getplayers and that you aren't comparing yourself`)
                                    message.reply(`No games matched, ensure players are in ${commandPrefix}getplayers and that you aren't comparing yourself`)
                                    return false
                                }

                                var snowflakeIDs = _.pluck(rows, "discordsnowflake")
                                logging.debug(`SNOWFLAKE IDS ARE: ${snowflakeIDs}`)

                                var totalCount = snowflakeIDs.length
                                logging.debug(`SQL: SELECT appid FROM playersgames WHERE discordsnowflake IN (${snowflakeIDs.map(function() { return "?" }).join(",")}) GROUP BY appid HAVING COUNT(*) = ?`, [snowflakeIDs, totalCount])

                                var getAppID = `SELECT appid FROM playersgames WHERE discordsnowflake IN (${snowflakeIDs.map(function() { return "?" }).join(",")}) GROUP BY appid HAVING COUNT(*) = ${totalCount}`

                                logging.debug(`GetAppID is: ${getAppID} and SnowflakeIDs are: ${snowflakeIDs} and TotalCount is ${totalCount}`)

                                queryThis("all", getAppID, snowflakeIDs, function(err,rows){
                                    if(err){
                                        logging.error(err.message)
                                        message.reply("Bad times, much bad")
                                        return false
                                    } else {

                                        logging.debug(`Compare Rows are: ${rows}`)

                                        if(rows.length > 0) {

                                            var listOfApps = _.pluck(rows, "appid")
                                            var selectName = `SELECT name FROM games WHERE appid IN (${listOfApps.map(function() { return "?" }).join(",")})`

                                            logging.debug(`SQL: SELECT name FROM games WHERE appid IN ('${listOfApps.join("','")}')`, listOfApps)
                                            queryThis("all", selectName, listOfApps, function(err, rows){
                                                if(err){
                                                    logging.error(err.message)
                                                    message.reply("ohhnnnooo")
                                                    return false
                                                } else {
                                                    if(rows) {
                                                        var namesOfGames = _.pluck(rows, "name").sort().join(" , ")
                                                        logging.debug(`Names of Games: ${namesOfGames}`)

                                                        // Max body length is 2k
                                                        if(namesOfGames.length <= 1900) {
                                                            logging.debug(`The games that returned back are: ${namesOfGames}`)
                                                            message.reply(`The games in common are: ${namesOfGames}`)
                                                        } else {
                                                            logging.debug("The games are too big for console return, over 1.9k chars")

                                                            // We're going to send the data to a text hosting service instead, because it's too big for discord
                                                            var headers = {
                                                                    "User-Agent": `Discord Bot/${version}`,
                                                                    "Content-Type": "application/x-www-form-urlencoded"
                                                                }

                                                            var options = {
                                                                url: "http://text-share.com/api/create",
                                                                method: "POST",
                                                                headers: headers,
                                                                form: "text="+encodeURIComponent(namesOfGames)
                                                            }

                                                            request(options, function(err, res, body){
                                                                if(!err && res.statusCode == 200) {
                                                                    logging.debug(body)
                                                                    message.reply(`Over char limit, games here: ${body} `)
                                                                } else {
                                                                    logging.error(err.message)
                                                                    message.reply("Couldn't create the list, check if text hosting is down")
                                                                    return false
                                                                }
                                                            })
                                                        }
                                                    }
                                                }
                                            })
                                        } else {
                                            logging.debug("No match :(")
                                            message.reply("No match :(")
                                        }
                                    }
                                })
                            }
                       }
                    })
                }

            break}
            case "getplayersbygame": {
            // getplayersbygame <appid> - returns mapping from playersgames table

                if(!args[0]) {
                    logging.warn("Ugnnhhh scrub, you gotta give me an appid")
                    message.reply("Ugnnhhh scrub, you gotta give me an appid")
                    return false
                } else {
                    var gameid = args[0]
                }

                var getPlayersByGame = "SELECT discordsnowflake FROM playersgames WHERE appid = ?"

                logging.debug(`SQL: SELECT discordsnowflake FROM playersgames WHERE appid = ${gameid}`)
                queryThis("all", getPlayersByGame, gameid, function(err, rows) {
                    if(err) {
                        logging.error(err.message)
                        message.reply(`Make sure the game has an appid, and is valid. Use ${commandPrefix}getallgames to see the list.`)
                        return false
                    } else {
                        if(rows) {
                            var thesnowflake = _.pluck(rows, "discordsnowflake")
                            var nameFromPlayers = `SELECT name FROM players WHERE discordsnowflake IN (${thesnowflake.map(function() { return "?" }).join(",")})`

                            logging.debug(`SQL: SELECT name FROM players WHERE discordsnowflake IN ('${thesnowflake.join("','")}')`)
                            queryThis("all", nameFromPlayers, thesnowflake, function(err,rows){
                                if(err){
                                    logging.error(`SQL ERROR: ${err.message}`)
                                    message.reply("I failed")
                                    return false
                                }

                                if(rows){
                                    var thenames = _.pluck(rows, "name")
                                    logging.debug(`These people: ${thenames}`)
                                    message.reply(`These people: ${thenames}`)
                                }
                            })
                        } else {
                            logging.warn("There's no games yet")
                            message.channel.send("There's no games yet")
                        }
                    }
                })

            break}
            case "getgames": {
            // getgames <name|discordsnowflake|steamid> - get games based on any id
                var searchTerm = (!args[0]) ? message.author.id : args[0]

                var getGames = "SELECT name,discordsnowflake FROM players WHERE ? IN (name, discordsnowflake, steamid)"

                logging.debug("SQL: SELECT name,discordsnowflake FROM players WHERE ? IN (name, discordsnowflake, steamid)", searchTerm)
                queryThis("get",getGames, searchTerm, function(err, row) {
                    if(err || row == undefined) {
                        var errorMessage = (!err) ? " No Error" : err.message

                        logging.error(`Either name was undefined and doesn't exist, or :${errorMessage}`)
                        message.reply("not found...")
                    } else {
                        var playerName = row.name
                        var discordSnowFlake = row.discordsnowflake
                        logging.debug(`Players name is: ${playerName} and snowflake is :${discordSnowFlake}`)
                    
                        if(row) {
                            var getPlayerGames = "SELECT pg.appid,g.name FROM playersgames AS pg INNER JOIN games AS g ON pg.appid = g.appid WHERE discordsnowflake = ?" 
                            
                            logging.debug(`SQL: SELECT pg.appid,g.name FROM playersgames AS pg INNER JOIN games AS g ON pg.appid = g.appid WHERE discordsnowflake = ${row.discordsnowflake}`)
                            queryThis("all", getPlayerGames,[row.discordsnowflake], function(err, rows){
                                if(err) {
                                    logging.error(err.message)
                                } else {
                                    var names = _.pluck(rows, "name")
                                    names = names.sort().join(", ")

                                    // Max body length is 2k
                                    if(names.length <= 1900) {
                                        logging.debug(`The games that returned back are: ${names}`)
                                        message.reply(`The games that ${playerName} has are: ${names}`)
                                    } else {
                                        logging.debug("The games are too big for console return, over 2k chars: ")

                                        // We're going to send the data to a text hosting service instead, because it's too big for discord
                                        var headers = {
                                                "User-Agent": `Discord Bot/${version}`,
                                                "Content-Type": "application/x-www-form-urlencoded"
                                        }

                                        var options = {
                                            url: "http://text-share.com/api/create",
                                            method: "POST",
                                            headers: headers,
                                            form: "text="+encodeURIComponent(JSON.stringify(rows))
                                        }

                                        request(options, function(err, res, body){
                                            if(!err && res.statusCode == 200) {
                                                logging.debug(body)
                                                message.reply(`Go here: ${body}`)
                                            } else {
                                                logging.error(err.message)
                                            }
                                        })
                                    }
                                }
                            })
                        } else {
                            logging.warn("Nothing game back on the search...")
                            message.channel.send("Nothing game back on the search...")
                        }
                    }
                })

            break}
            case "iplay": {
            // iplay <appid> - Manually subscribe to a game
                var gameappid = args[0]

                if(!gameappid) {message.reply("You need to give me an appid..."); return false}

                var playSQL = "INSERT OR REPLACE INTO playersgames (appid, discordsnowflake) VALUES (?,?)"

                logging.debug(`SQL: INSERT OR REPLACE INTO playersgames (appid, discordsnowflake) VALUES (${gameappid},${message.author.id})`)
                queryThis("run",playSQL,[gameappid,message.author.id], function(err){
                    if(err) {
                        logging.error(`Error: ${err}`)
                        message.reply("Could not add that game for you...")
                    } else {
                        var iPlaySQL = "SELECT pg.appid,g.name FROM playersgames AS pg INNER JOIN games AS g ON pg.appid = g.appid WHERE g.appid = ?"

                        logging.debug(`SQL: SELECT pg.appid,g.name FROM playersgames AS pg INNER JOIN games AS g ON pg.appid = g.appid WHERE g.appid = ${gameappid}`)
                        queryThis("get", iPlaySQL, [gameappid], function(err, row) {
                            if(row) {
                                    logging.debug(`Game Name: ${row.name} App ID: ${row.appid}`)
                                    message.reply(`Game Name: ${row.name} App ID: ${row.appid}`)
                            } else {
                                logging.warn("You are not in the database, or that appid doesn't exist")
                                message.reply("You are not in the database, or that appid doesn't exist")
                            }
                        })
                    }
                })

            break}
            case "gettags": {
            //gettags <appid> - list all tags for an appid

                var appid = args[0]
                var getTagsSQL = "SELECT name,tags FROM games WHERE appid = ?"

                logging.debug(`SQL: SELECT name,tags FROM games WHERE appid = ${appid}`)
                queryThis("get", getTagsSQL, [appid], function(err,row){
                    if(err) {
                        logging.error(err.message)
                    } else {
                        if(!row) {
                            message.reply("No game found for that appid...")
                        } else {
                            var gameName = row.name
                            var gameTags = row.tags || "No tags yet... consider contributing"
                            var gameArray = gameTags.split(",").sort(function (a,b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }) })

                            logging.debug(`Game Array is: ${JSON.stringify(gameArray)} and is of type: ${typeof(gameArray)}`)

                            logging.debug(`Tags for ${gameName} are: ${gameArray}`)
                            message.reply(`Tags for ${gameName} are ${gameArray}`)
                        }
                    }
                })

            break}
            case "addtag":
            case "addtags":
            // addtags <appid> <tags> - Append tags to an appid
                var applicationId = args.shift()
                logging.debug(`ARGS: ${JSON.stringify(args)}`)

                var newtags = args.sort().toString().replace(/['"]+/g, "")
                var tagsSQL = "SELECT appid,tags FROM games WHERE appid = ?"

                logging.debug(`Tags are: ${newtags}`)
                logging.debug(`SQL: SELECT tags FROM games WHERE appid = ${applicationId}`)
                queryThis("get",tagsSQL, applicationId, function(err, row){
                    if(err) {
                        logging.error(err.message)
                        message.reply("Couldn't add tag, something went wrong")
                    } else {
                        if (!row) {
                            logging.warn("appid doesn't exist for tag update")
                            message.reply("That appid doesn't exist")
                        } else {

                            var oldtags = row.tags

                            if(oldtags !== "null" && oldtags) {
                                var combinedtags = oldtags.concat(","+newtags).split(",").sort(function (a,b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }) })
                                var updatedtags = combinedtags.filter((v, i, a) => a.indexOf(v) === i).toString()
                                logging.debug(`Old tags are: ${oldtags} and new tags are ${newtags} and together they are ${updatedtags}`)
                            } else {
                                var updatedtags = newtags // eslint-disable-line no-redeclare
                            }

                            var updateGamesSQL = "UPDATE games SET tags = ? WHERE appid = ?"

                            logging.debug(`Old tags are: ${oldtags} and updated tags are: ${updatedtags}`, [updatedtags, applicationId])
                            logging.debug(`SQL: UPDATE games SET tags = ${updatedtags} WHERE appid = ${applicationId}`)
                            queryThis("get", updateGamesSQL, [updatedtags,applicationId], function(err){
                                if (err) {
                                    logging.error(err.message)
                                    message.reply("Could not update tags, report this...")
                                } else {
                                    logging.debug(`AppID: ${applicationId} now has tags: ${updatedtags}`)
                                    message.reply(`AppID: ${applicationId} now has tags: ${updatedtags}`)
                                }
                            })
                        }
                    }
                })

            break
            case "deletetag":
            case "deletetags":
            //deletetags <appid> <tags> - remove tag(s) from an appid
                var deleteAppId = args.shift()
                var removetags = args

                var removeTagsSQL = "SELECT appid,tags FROM games WHERE appid = ?"

                logging.debug(`SQL: SELECT appid,tags FROM games WHERE appid = ${deleteAppId}`)
                queryThis("get", removeTagsSQL, deleteAppId, function(err,row){
                    if(err){
                        logging.error(err.message)
                        message.reply("Couldn't remove tag, something went wrong")
                        return false
                    } else {
                        if(!row) {
                            logging.warn("appid doesn't exist for tag removal")
                            message.reply("That appid doesn't exist")
                        } else {
                            if (row.tags) {
                                var arrayTags = row.tags.split(",") || ""
                                logging.debug(`Tags are: ${arrayTags} and we're removing: ${removetags}`)
                                
                                var filteredTags = _.without(arrayTags, ...removetags).sort(function (a,b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }) }).toString()

                                var updateGameSQL = "UPDATE games SET tags = ? WHERE appid = ?"

                                logging.debug("UPDATE games SET tags = ? WHERE appid = ?", [filteredTags,deleteAppId])
                                queryThis("get", updateGameSQL, [filteredTags,deleteAppId],function(err){
                                    if (err) {
                                        logging.error(err.message)
                                        message.reply("Could not update tags, report this...")
                                        return false
                                    } else {
                                        logging.debug(`AppID: ${deleteAppId} now has tags: ${filteredTags}`)
                                        message.reply(`AppID: ${deleteAppId} now has tags: ${filteredTags}`)
                                    }
                                })
                            } else {
                                logging.debug(`SQL Row returned null for row.tags: ${row.tags}`)
                                message.reply("Nothing more to delete, tags are gone")
                            }
                        }
                    }
                })
                
            break
            case "searchtag":
            case "searchtags":
            // searchtag <tag> - Lazy searches the tags column for matching games
                var tag = args[0]

                var searchTagsSQL = "SELECT name FROM games WHERE tags LIKE ?"

                logging.debug(`SQL: SELECT name FROM games WHERE tags LIKE '%${tag}%'`)
                queryThis("all", searchTagsSQL, "%"+tag+"%", function(err, rows){
                    if(!rows || _.pluck(rows,"name").length == 0) {
                        logging.debug("There are no games with that tag, consider contributing")
                        message.reply("There are no games with that tag, consider contributing")
                        return false
                    } else {

                        var names = _.pluck(rows, "name").sort().join(" , ")

                        logging.debug(`Games are: ${names}`)
                        message.reply(`Games are: ${names}`)
                    }
                })
            break
            case "getdatetime": {
            // Get a specific date time and print ranges of groups of games

            break}
            case "getevent":
            case "getevents":
            // Queries all datetimes

            break
            case "createevent": {
            // createEvent <name> <datetime> <game> 

            break}
            case "attendevent": {
            // attendEvent <event name/id>

            break}
            case "seedgames": {
            // seedgames - Local file holds inserts, pull requests for tag updates are appreciated
                fs.readFile("./gamesdbseed.sql", function(err, data){
                    if(err) {
                        logging.error(`Seeding Error: ${err.message}`)
                        message.reply("Seeding error...")
                    } else {
                        var start = Date.now()
                        var games = data.toString().split("\n")
                        
                        queryThis("exec", games, null, function(success){
                            if(success){
                                logging.debug("SQL: " + (Date.now() - start) + "ms to finish")
                                message.reply("Database seeded!")                                
                            } else {
                                logging.debug(`SEEDING: Error seeing games ${JSON.stringify(err)}`)
                            }
                        })
                    }
                })

            break}
            case "backupgames": {
            // backupgames - creates a sql dump of the last 1 (current) + 10 (historical) backups. Script will delete the [12] backup by age.
                logging.error(`${message.member.displayName} with snowflake ${message.member.id} executed a db backup`)
                logging.debug(`${message.member.displayName} with snowflake ${message.member.id} executed a db backup`)

                var backedupgames = []

                var selectAll = "SELECT appid,name,tags from games"

                queryThis("all", selectAll, null, function(err, rows){
                    if(err){
                        logging.debug(`SQL ERROR: ${err.message}`)
                        message.reply("Something went wrong...")
                    } else {
                        if(rows){
                            backedupgames.push("DELETE FROM games;")
                            backedupgames.push("DELETE FROM SQLITE_SEQUENCE WHERE name='games';")
                            _.each(rows, function(row){
                                backedupgames.push(`INSERT OR REPLACE INTO games (appid,name,tags) VALUES("${row.appid}","${row.name}","${row.tags}");`)
                            })
                        }

                        // This is what we can restore from
                        logging.debug(`Backuped backedupgames script is: \n ${backedupgames.join("\n")} `)
                        fs.writeFile("./backups/backup.dump", backedupgames.join("\n"), function(err){
                            if (err) {
                                logging.error("Could not write file to filesystem.")
                            } else {
                                logging.debug("Wrote backup script")
                                message.reply("Backup successful")
                            }
                        })

                        // This is for long term storage
                        logging.debug("Creating unique backup for DR")
                        var fileName = "./backups/backup.dump." + Math.floor(new Date() / 1000)
                        fs.writeFile(fileName,backedupgames.join("\n"), function(err){
                            if (err) {
                                logging.error("Could not write file to filesystem.")
                            } else {
                                logging.debug("Wrote DR backup script too")
                            }
                        })

                        logging.debug("Cleaning up old db backups")
                        glob("./backups/backup.dump.*", function(err, files) {
                            logging.debug(JSON.stringify(files))

                            if(files.length > 10) {
                                logging.debug("BACKUPS: We are over 10 backups.. purging extras")
                                files.sort().reverse()

                                var removeList = files.slice(10)
                                logging.debug(`The files we are to removing are: ${removeList}`)

                                removeList.forEach(function(file){
                                    fs.unlink(file, function(error){
                                        if(error) {
                                            logging.error("Unable to delete additional backup.dump configs...")
                                        } else {
                                            logging.debug(`Deleted overflowing backup.dump configs ${file}`)
                                        }
                                    })
                                })
                            } else {
                                // Do nothing for now
                            }
                        })
                    }
                })

            break}
            case "restoregames": {
            // restoregames - restores from the latest backup, not any with timestamps
                logging.error(`${message.member.displayName} with snowflake ${message.member.id} executed a db restore`)
                logging.debug(`${message.member.displayName} with snowflake ${message.member.id} executed a db restore`)

                fs.readFile("./backups/backup.dump", function(err, data){
                    if(err) {
                        logging.error(`Restoral Error: ${err.message}`)
                        message.reply("Restoral error...")
                    } else {
                        var start = Date.now()
                        var gameSQL = data.toString().split("\n")

                        queryThis("exec", gameSQL, null, function(success){
                            if(success) {
                                logging.debug("SQL: " + (Date.now() - start) + "ms to finish")
                                message.reply("Database restored!")
                            } else {
                                message.reply("Failed to restore games")
                                logging.error("Failed to restore games")
                                return false
                            }
                        })
                    }
                })
            break}
            default: {
                // do nothing
            break}
         }
     }
})

bot.login(discordapikey)