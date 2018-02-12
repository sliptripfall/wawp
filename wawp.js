// Discord API library
const Discord = require('discord.js');
// Initialize Discord Bot
const bot = new Discord.Client();
// 3rd party libs needed to perform functions
const fs = require('fs');
var request = require('request');
var _ = require('underscore');
var glob = require('glob');
var google = require('googleapis');
const json2csv = require('json2csv');
// local dependencies (steam/discord api tokens)
const config = require('./config.json');
const version = require('./package.json').version;
var serviceAccount = require('./serviceAccountKey.json');
var scopes = [
  "https://www.googleapis.com/auth/firebase.database",
  "https://www.googleapis.com/auth/devstorage.full_control",
  "https://www.googleapis.com/auth/userinfo.email"
];
var jwtClient = new google.auth.JWT(
  serviceAccount.client_email,
  null,
  serviceAccount.private_key,
  scopes
);

// When true, it runs sqlite3 in verbose and enables console.log (false still prints warn/error)
const DEBUG_MODE = true;

    // In debug enable verbose logging (impacts performance)
    if(DEBUG_MODE) {
        var sql = require('sqlite3').verbose();
    } else {
        var sql = require('sqlite3');
    }

// We're only going to respond to commands with this prefix
const commandPrefix = '!';

// Database init
var db = new sql.Database('./wawp.sqlite');
    // Attempt to create tables
    db.run("CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY AUTOINCREMENT,appid TEXT UNIQUE,name TEXT,tags TEXT);");
    db.run("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,datetime datetime NOT NULL,players TEXT NOT NULL,game TEXT NOT NULL);");
    db.run("CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,steamid TEXT, discordsnowflake TEXT NOT NULL UNIQUE);");
    db.run('CREATE TABLE IF NOT EXISTS playersgames (id INTEGER PRIMARY KEY AUTOINCREMENT,discordsnowflake TEXT NOT NULL,appid TEXT NOT NULL,FOREIGN KEY(discordsnowflake) REFERENCES players(discordsnowflake),FOREIGN KEY(appid) REFERENCES games(appid));');
db.close();

// Event hook to all bot setup time needed 
bot.on('ready', function (evt) {
    logging.log(`Connected - Logged in as un: ${bot.user.username} id: ${bot.user.id} version: ${version}`);
});

// Logging wrapper
var logging = (function() {
    return {
        log: function () {
            // Only print if we're debugging
            if(DEBUG_MODE) {
                var args = Array.prototype.slice.call(arguments);
                console.log.apply(console, args);    
            }
        },
        warn: function() {
            var args = Array.prototype.slice.call(arguments);
            console.warn.apply(console, args);
        },
        error: function() {
            var args = Array.prototype.slice.call(arguments);
            console.error.apply(console, args);
        }
    }
}());

// Direct bot logs to logging wrapper
bot.on("error", (e) => logging.error(e));
bot.on("warn", (e) => logging.warn(e));
bot.on("debug", (e) => logging.log(e));


// Event hook for new message
bot.on('message', message => {
    // if we see ourselves, abort
    if (message.author.bot) return;

    // If something other than text is seen, abort
    if (message.channel.type !== 'text') return;

    // It will listen for messages that will start with the `commandPrefix`
    if (message.content.startsWith(commandPrefix)) {

        // Break <command> and <args[0]> <args[1]> <args[2]> ...
        var args = message.content.slice(commandPrefix.length).trim().split(/ +/g);
        const command = args.shift().toLowerCase();
       
        logging.log(`Command was: ${command} and args were ${args}`);

       // The god function
        switch(command) {
            case 'debug':
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
                        name: "Arg 1",
                        value: args[0] || 'undefined'
                    },
                    {
                        name: "__Arg 2__",
                        value: args[1] || 'undefined'
                    }],
                    timestamp: new Date(),
                    footer: {
                        icon_url: bot.user.avatarURL,
                        text: "Aaaaawwwwwww yea"
                    }
                }});
                logging.log("Debug logging is working");

                break;
            case 'help':
                // The help menu
                var consoleOutput = message.channel.send({embed: {
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
                        value: "The bot has a database that has to be initialized. If this is your first time, you'll want to add yourself to the players table."
                    },
                    {
                        name: "Commands 1/2",
                        value: "`!help` - this menu \n"+
                        "`!myinfo` - __shows your discord identification__\n"+
                        "`!getinfo <name>` - __displays discord snowflake and steam64id from players name__\n"+
                        "`!ping` - __checks responsiveness of bot__\n"+
                        "`!addme <steam64id> [opt]` - __adds yourself to the player database, omitting steam64id limits functionality__\n"+
                        "`!getplayers` - __retreive players in player database__\n"+
                        "`!deleteme` - __deletes you from player database__\n"+
                        "`!updatename` - __updates database with discord nickname, must run if nick is changed__\n"+
                        "`!getallgames <csv> [opt]` - __all games in database, by default in JSON but can pass CSV option__\n"+
                        "`!addsteamgames <discordsnowflake> [opt]` - __adds owned games of player against games db, runs on self without argument__\n"+
                        "`!addgame <appid> <name>` - __manually add games to database__\n"
                    },
                    {
                        name: "Commands 2/2",
                        value: "`!compare <name> <name> ... <name>` - __compare inventory between <n> players__\n"+
                        "`!getplayersbygame <appid>` - __provide appid to get a list of players, use getgames to find appid__\n"+
                        "`!getgames <name|steam64id|discordsnowflake> [opt]` - __queries all games, performs on self without argument__\n"+
                        "`!iplay <appid>` - __manually adds games to your profile__\n"+
                        "`!gettags <appid>` - __shows tags for a given game__\n"+
                        "`!addtags <appid> <tags>` - __adds tags for a given game__\n"+
                        "`!deletetags <appid> <tags>` - __removes tags for a given game__\n"+
                        "`!searchtag <tag>` - __searches games for matching tag__\n",
                    }],
                    timestamp: new Date(),
                    footer: {
                        icon_url: bot.user.avatarURL,
                        text: "Aaaaawwwwwww yea"
                    }
                    }
                 });

                break;                
            case 'myinfo':
                // Discord specific identification
                logging.log("Display name is: ", message.member.displayName);
                logging.log("Nickname is: ", message.member.nickname);
                logging.log("Username is: ", message.member.user.username);
                logging.log("Snowflake is: ", message.member.id)

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
                }});

                break;
            case 'getinfo':
                //!getinfo <name>

                if(!args[0]) {
                    logging.warn("No name/id specified");
                    message.reply("Give me a name...");
                }

                var name = args[0];
                var db = new sql.Database('./wawp.sqlite');

                logging.log(`SQL: SELECT discordsnowflake,steamid FROM players WHERE name = ${name}`);
                db.get(`SELECT discordsnowflake,steamid FROM players WHERE name = ?`, name,function(err,row){
                    if(err) {
                        logging.error(err.message);
                    } else {
                        if(row) {
                            var discordSnowFlake = row.discordsnowflake;
                            var steam64id = row.steamid;

                            logging.log(`For ${name} their discordsnowflake is: ${discordSnowFlake} and their Steam64ID is: ${steam64id}`);

                            message.channel.send({embed: {
                                color: 3447003,
                                title: `Identity for ${name}`,
                                fields: [{
                                    name: 'Discord Snowflake',
                                    value: discordSnowFlake,
                                    inline: true
                                },
                                {
                                    name: 'Steam64ID',
                                    value: steam64id,
                                    inline: true
                                }]
                            }});
                        } else {
                            message.reply("That name doesn't exist, have them run !updatename if nick was changed")
                        }
                    }

                });

                db.close();
                break;
            case 'ping':
                // Simple ping/pong with the bot to see if it's responsive
                // if you !ping ping, it will pong pong!
                if(args[0] === 'ping') {
                    var consoleOutput = message.channel.send('pong pong!');
                } else {
                    var consoleOutput = message.channel.send('pong!');
                }
                logging.log('Bot says: Ping/Pong');

                break;
            case 'pretendbot':
                // Steam user Kongzoola, owning the most games (bot mock for debugging)

                var db = new sql.Database('./wawp.sqlite');
                var steamid = '76561197979408421';

                db.run("CREATE UNIQUE INDEX IF NOT EXISTS players_discordsnowflake ON players (discordsnowflake)");

                logging.log(`User ${bot.user.username} ${bot.user.id} made the following request:`);
                logging.log(`   SQL: 'INSERT INTO players (name, steamid, discordsnowflake) VALUES (${bot.user.username},${steamid},${bot.user.id})`);

                db.run('INSERT INTO players (name, steamid, discordsnowflake) VALUES (?,?,?)',[bot.user.username,steamid,bot.user.id], function(err){
                    if(err){
                        logging.error(`ERROR: ${err}`);
                        message.channel.send("Something went wrong, likely it already exists in the db...");
                    } else {
                        message.channel.send("Uhhh, nothing to see here, but I'm Kongzoola now");                        
                    }
                });

                db.close();
                break;
            case 'unpretendbot':
                // Steam user Kongzoola, owning the most games (bot mock for debugging)

                var db = new sql.Database('./wawp.sqlite');
                logging.log(`SQL: DELETE FROM playersgames WHERE discordsnowflake = ${bot.user.id}`);
                db.run("DELETE FROM playersgames WHERE discordsnowflake = ?", bot.user.id);
                db.run("DELETE FROM players WHERE name = ?", "wawp");

                message.channel.send("I'm not Kongzoola anymore.");

                db.close();
                break;
            case 'addme':
                // Adds a player by steamid (optional) and common name (mandatory/automatic)
                // !addme <steamid>[opt] {username/nickname}

                var db = new sql.Database('./wawp.sqlite');

                if(args[0]) {
                    var steamid = args[0];
                } else {
                    // 0ds is 0 for numeric sorting, and ds for discord snowflake - if you don't have a steam64id you still have to be unique
                    var steamid = `0ds${message.author.id}`;
                }

                if(!message.member.nickname) {
                    var name = message.author.username;
                } else {
                    var name = message.member.nickname
                }

                db.run("CREATE UNIQUE INDEX IF NOT EXISTS players_discordsnowflake ON players (discordsnowflake)");
                logging.log(`SQL: INSERT INTO players (name, steamid, discordsnowflake) VALUES (${name},${steamid},${message.author.id})`);
                db.run('INSERT INTO players (name, steamid, discordsnowflake) VALUES (?,?,?)',[name,steamid,message.author.id]);
                message.channel.send(`Player ${name} has been inserted!`);

                db.close();
                break;
            case 'getplayers':
                // Gets all players registered
                
                var db = new sql.Database('./wawp.sqlite');

                logging.log(`SQL: SELECT name FROM players`);
                db.all("SELECT name FROM players", function(err, rows) {
                    if(!rows) {
                        logging.log("There are no players in the database");
                        message.reply("There are no players in the database");
                    }

                    // Pull out names in array from the SQL results
                    var names = _.pluck(rows, 'name');

                    // Case Insensitive sort
                    names = names.sort(function(x,y){
                        var a = String(x).toUpperCase();
                        var b = String(y).toUpperCase();
                        if(a>b){
                            return 1
                        } else if (a<b) {
                            return -1
                        } else {
                            return 0;
                        }
                    });
                
                    // Todo - when it reaches a large size, we need to offload to a text hosting service
                    message.reply(`These people: ${names}`);
                });

                db.close();
                break;
            case 'deleteme':
                // Remove user from the database

                var db = new sql.Database('./wawp.sqlite');

                // Delete owned games in the playersgames table first, to not violate foreign key
                logging.log(`SQL: DELETE FROM playersgames WHERE discordsnowflake = ${message.author.id}`);
                db.run('DELETE FROM playersgames WHERE discordsnowflake = ?', [message.author.id], function(err) {
                    if(err) {
                        logging.error(`Clound not delete from playersgames ${err.message}`);
                        message.reply('Something bad happened... playersgames not empty');
                    } else {
                        // Now we delete the player from the players table
                        logging.log(`SQL: DELETE FROM players WHERE discordsnowflake = ${message.author.id}`);
                        db.run('DELETE FROM players WHERE discordsnowflake = ?', [message.author.id], function(err){
                            if (err) {
                                logging.error(`Could not delete player from players table ${err.message}`);
                                message.reply("Unbound games from player, but couldn't remove from players table");
                            } else {
                                logging.warn(`Row deleted for ${message.member.nickname} or ${message.author.username}`);
                                message.reply('Deleted from database');
                            }
                        });
                    }
                });

                db.close();
                break;
            case 'updatename':
                // Update users username based on their discordsnowflake, because fucking discord...

                var db = new sql.Database('./wawp.sqlite');

                logging.log(`SQL: UPDATE players SET name = ${message.member.displayName} WHERE discordsnowflake = ${message.author.id}`);
                db.run('UPDATE players SET name = ? WHERE discordsnowflake = ?', [message.member.displayName, message.author.id], function(err){
                    if (err) {
                        logging.error(err.message);
                        message.reply("Could not update, maybe you don't exist...");
                    } else {
                        logging.log(`Row updated for ${message.member.displayName}`);
                        message.reply(`Updated ${message.member.displayName} in database`);
                    }
                });

                db.close();
                break;
            case 'getallgames':
                // Retrives all games in database

                if(args[0] == 'csv') {
                    var useCsv = true;
                } else {
                    var useCsv = false;
                }

                var db = new sql.Database('./wawp.sqlite');
                
                db.all("SELECT appid,name,tags FROM games", function(err, rows) {
                    if(rows) {

                        if(useCsv) {
                            var jsonOutput = json2csv({ data: rows, fields: ['appid', 'name', 'tags'] });
                            var fileext = 'csv';
                        } else {
                            var jsonOutput = JSON.stringify(rows, null, 4);
                            var fileext = 'json';
                        }

                        var dataSize = Buffer.byteLength(jsonOutput, 'utf8');

                        jwtClient.authorize(function(error, tokens) {
                          if (error) {
                            logging.error("GCP DB ERROR: Error making request to generate access token:", error);
                          } else if (tokens.access_token === null) {
                            logging.error("GCP DB ERROR: Provided service account does not have permission to generate access tokens");
                          } else {
                            // Assign access token for store to GCP Realtime DB
                            var accessToken = tokens.access_token;
                           
                            var headers = {
                                    'Content-Type': 'application/json',
                                    'User-Agent': `Discord Bot/${version}`,
                                    'Content-Length': dataSize,
                                    'Authorization': `Bearer ${accessToken}`
                                }

                            var options = {
                                url: `https://www.googleapis.com/upload/storage/v1/b/${config.gcpstorageBucket}/o?uploadType=media&name=gameList.${fileext}`,
                                method: 'POST',
                                headers: headers,
                                body: jsonOutput
                            }

                            request(options, function(err, res, body){
                                logging.log(`Statuscode was: ${res.statusCode} \n res is: ${JSON.stringify(res)}\n`);
                                if(err) {
                                    logging.error(`Error was: ${JSON.stringify(err)} and body was: ${JSON.stringify(body)}`);
                                } else if ( res.statusCode == 200) {

                                    var body = JSON.parse(body);
                                    var link = body.mediaLink.toString();

                                    logging.log(`Medialink is: ${link}`);
                                    message.reply(`Over char limit, games here: ${link} `);
                                } else {
                                    logging.error(`Error was: ${JSON.stringify(err)} and body was: ${JSON.stringify(body)}`);
                                }
                            });      
                          }
                        });
                   

                    } else {
                        logging.log("There's no games yet");
                        message.channel.send("There's no games yet");
                    }
                });

                db.close();
                break;
            case 'addsteamgames':
                //!addsteamgames <discordsnowflake> [opt]
                // Adds all multiplayer games to steam profile

                if(args[0]) {
                    var updateId = args[0];
                    logging.log(`Update ID is: ${updateId}`);
                } else {
                    var updateId = message.author.id;
                    logging.log('Author ID is being used instead of args[0]');
                }
                
                var db = new sql.Database('./wawp.sqlite');

                function getSteamID(id) {
                    logging.log(`SQL: SELECT DISTINCT steamid FROM players WHERE discordsnowflake = ${id}`);
                    db.get("SELECT DISTINCT steamid FROM players WHERE discordsnowflake = ?", [id], function(err, row) {
                        if(row) {
                            logging.log(`Steam64ID is: ${row.steamid}`);
                            setSteam64(row.steamid);
                        } else {
                            logging.warn("Use the players discordsnowflake id, use !getinfo <player> to find it ");
                            message.reply('Use the players discordsnowflake id, use !getinfo <player> to find it ');
                        }
                    });
                }

                // USE SteamAPI to get list of games for player
                // config.steamapikey
                function setSteam64(row) {
                    var Steam64ID = row;
                    var steamurl = 'http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key='+config.steamapikey+'&format=json&input_json={"steamid": '+Steam64ID+'}';    

                    logging.log(steamurl);

                    request.get({
                        url: steamurl,
                        json: true,
                        headers: {'User-Agent': 'request'}
                    }, (err, res, data) => {
                        if(err) {
                            logging.error('Error: ', err);
                        } else if (res.statusCode !== 200) {
                            logging.log(`Status: ${res.statusCode}`);
                            message.reply('Your Steam64ID is probably not correct. Delete and readd yourself with your Steam64ID https://steamidfinder.com/');
                        } else {

                          // Pulls appids from json API query, reflecting owned games
                          var appids = _.map(data.response.games, function(o) {return _.pick(o, "appid"); });

                          buildCompatList(appids);
                        }
                    });
                }

                function buildCompatList(steamGames) {

                    db.all("SELECT CAST(appid as int) AS appid FROM games", function(err, rows) {
                        if(err) {
                            logging.error(err.message);
                        } else {
                            if(rows) {
                                
                                var dbGames = _.pluck(rows, 'appid');
                                var userGames = _.pluck(steamGames, 'appid');
                                var compatList = _.intersection(dbGames, userGames);

                                if(dbGames.length < 1) {
                                    logging.warn("Compat list missing, likely haven't ran multiplayer seeder");
                                    message.reply("Hey, run the seeder or add games to the db");
                                } else {
                                    logging.log(`Created compat list: ${compatList}`);
                                    showCompatGames(compatList);
                                }

                            } else {
                                logging.warn("There are no players in the database");
                                message.reply("There are no players in the database");
                            }
                        }
                    });
                    // URL to get multiplayer games http://steamspy.com/api.php?request=tag&tag=Multiplayer
                }

                function showCompatGames(compatList) {             

                    if(compatList.length < 1) {
                        logging.log("Compat list missing, likely haven't ran multiplayer seeder");
                        message.reply("Hey, run the seeder or add games to the db");
                    } else {

                        logging.log(`SQL: SELECT name,appid FROM games WHERE appid IN (${compatList})`);

                        db.all(`SELECT name,appid FROM games WHERE appid IN (${compatList})`, function(err, rows) {
                            if(err) {
                                logging.error(`Warning SQL error: ${err.message}`);
                            } else {

                                logging.log(`The data is: ${_.pluck(rows, 'name')}`);
                                logging.log(`The compat list is ${compatList}`);

                                var start = Date.now();
                                db.serialize(function() {
                                   db.run("begin transaction");
                                   rows.forEach(function (arrayItem){

                                        var name = arrayItem.name;
                                        var appid = arrayItem.appid;

                                        db.run("CREATE UNIQUE INDEX IF NOT EXISTS games_players ON playersgames (discordsnowflake,appid)");
                                        logging.log(`SQL: INSERT OR IGNORE INTO playersgames (discordsnowflake,appid) VALUES (${updateId},${appid})`);
                                        db.run('INSERT OR IGNORE INTO playersgames (discordsnowflake,appid) VALUES (?,?)',[updateId,appid]);
                                    });

                                    db.run("commit");
                                });
                                db.close(function(){
                                    logging.log((Date.now() - start) + "ms to finish");
                                    message.reply('Database seeded!');
                                });

                                var headers = {
                                    'User-Agent': `Discord Bot/${version}`,
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }

                                var options = {
                                    url: 'http://text-share.com/api/create',
                                    method: 'POST',
                                    headers: headers,
                                    form: 'text='+encodeURIComponent(JSON.stringify(rows))
                                }

                                request(options, function(err, res, body){
                                    if(!err && res.statusCode == 200) {
                                        logging.log(body);
                                        message.reply(`Here's the list: ${body} take this data and go here http://json2table.com or search for json beautifiers`);
                                    } else {
                                        logging.error(err.message);
                                    }
                            });
                            }
                        });
                    }
                }
                logging.log(`The ID being used is: ${updateId}`);
                getSteamID(updateId);

                //db.close on inner callback
                break;
            case 'addgame':
                // Gets steamid from discordname then retrives all games, adds multiplayer games to playersgames database
                //  !addgame <appid> <name>

                var db = new sql.Database('./wawp.sqlite');

                var gameappid = args[0];
                args.shift();
                var name = args.join(" ");
                logging.log(`Name: ${name} AppID: ${gameappid}`);

                if(!gameappid || !name) { message.reply("Doin it wrong, !addgame <appid> <name>"); return false; };

                logging.log(`SQL: INSERT OR IGNORE INTO games (appid, name) VALUES (${gameappid},${name})`);
                db.run('INSERT OR IGNORE INTO games (appid, name) VALUES (?,?)',[gameappid,name]);

                logging.log(`SQL: SELECT id, name, appid FROM games WHERE name = ${name}`);
                db.get("SELECT id, name, appid FROM games WHERE name = ?", [name], function(err, row) {
                    if(row) {
                            logging.log(`DB ID: ${row.id} Game Name: ${row.name} App ID: ${row.appid}`);
                            message.reply(`Game Name: ${row.name} App ID: ${row.appid} added!`);
                    } else {
                        logging.error("That appid may already exist, check !getallgames");
                        message.reply("That appid may already exist, check !getallgames");
                    }
                });

                db.close();
                break;
            case 'compare':
                // compare games between players, use name from !getplayers
                //!compare <name> <name> <name> ... 
                var db = new sql.Database('./wawp.sqlite');

                if(args.length < 2) {
                    message.reply("At least two names");
                } else {

                    var snowflakelookup = args;

                    logging.log(`SQL: SELECT discordsnowflake FROM players WHERE name IN (${snowflakelookup})`);
                    db.all(`SELECT discordsnowflake FROM players WHERE name IN (${snowflakelookup.map(function() { return '?' }).join(',')})`, snowflakelookup, function(err, rows){
                        if(err){
                            logging.error(err.message);
                            message.reply('One or more of the names is not valid');
                        } else {
                            if(rows) {

                                // We may only get 1 result back from the database, verify we have something to compare against
                                if( _.pluck(rows, 'discordsnowflake') > 2) {
                                    logging.log('No games matched');
                                    message.reply(`No games matched, ensure players are in !getplayers and that you aren't comparing yourself`);
                                    return false;
                                }

                                var snowflakeIDs = _.pluck(rows, 'discordsnowflake');

                                logging.log(`SNOWFLAKE IDS ARE: ${snowflakeIDs}`);

                                var totalCount = snowflakeIDs.length;

                                logging.log(`SQL: SELECT appid FROM playersgames WHERE discordsnowflake IN (${snowflakeIDs.map(function() { return '?' }).join(',')}) GROUP BY appid HAVING COUNT(*) = ?`, [snowflakeIDs, totalCount]);

                                db.all(`SELECT appid FROM playersgames WHERE discordsnowflake IN (${snowflakeIDs.map(function() { return '?' }).join(',')}) GROUP BY appid HAVING COUNT(*) = ${totalCount}`, snowflakeIDs, function(err,rows){
                                    if(err){
                                        logging.error(err.message);
                                        message.reply('Bad times, much bad');
                                    } else {
                                            
                                        //logging.log(`ROWS are: ${JSON.stringify(rows)}`);

                                        if(rows.length > 0) {

                                            var listOfApps = _.pluck(rows, 'appid');

                                            logging.log(`SQL: SELECT name FROM games WHERE appid IN ('${listOfApps.join("','")}'')`);
                                            db.all(`SELECT name FROM games WHERE appid IN (${listOfApps.map(function() { return '?' }).join(',')})`, listOfApps, function(err, rows){
                                                if(err){
                                                    logging.error(err.message);
                                                    message.reply('ohhnnnooo');
                                                } else {
                                                    if(rows) {

                                                        var namesOfGames = _.pluck(rows, 'name').sort().join(' , ');

                                                        logging.log(`Names of Games: ${namesOfGames}`);
                                                        // Max body length is 2k
                                                        if(namesOfGames.length <= 1900) {
                                                            logging.log(`The games that returned back are: ${namesOfGames}`);
                                                            message.reply(`The games in common are: ${namesOfGames}`);
                                                        } else {
                                                            logging.log(`The games are too big for console return, over 1.9k chars`);

                                                            // We're going to send the data to a text hosting service instead, because it's too big for discord
                                                            var headers = {
                                                                    'User-Agent': `Discord Bot/${version}`,
                                                                    'Content-Type': 'application/x-www-form-urlencoded'
                                                                }

                                                            var options = {
                                                                url: 'http://text-share.com/api/create',
                                                                method: 'POST',
                                                                headers: headers,
                                                                form: 'text='+encodeURIComponent(namesOfGames)
                                                            }

                                                            request(options, function(err, res, body){
                                                                if(!err && res.statusCode == 200) {
                                                                    logging.log(body);
                                                                    message.reply(`Over char limit, games here: ${body} `);
                                                                } else {
                                                                    logging.error(err.message);
                                                                }
                                                            });
                                                        }
                                                    }
                                                }
                                            });
                                        } else {
                                            logging.log('No match :(');
                                            message.reply('No match :(');
                                        }
                                    }

                                
                                });
                            }
                       }
                    });
                }

                db.close();
                break;
            case 'getplayersbygame':
                // !getPlayersByGame <appid>

                if(!args[0]) {
                    logging.warn('Ugnnhhh scrub, you gotta give me an appid');
                    message.reply('Ugnnhhh scrub, you gotta give me an appid');
                    return false;
                } else {
                    var gameid = args[0];    
                }

                var db = new sql.Database('./wawp.sqlite');

                logging.log(`SQL: SELECT discordsnowflake FROM playersgames WHERE appid = ${gameid}`);
                db.all(`SELECT discordsnowflake FROM playersgames WHERE appid = ${gameid}`, function(err, rows) {
                    if(err) {
                        logging.error(err.message);
                        message.reply("Make sure the game has an appid, and is valid. Use !getallgames to see the list.");
                        return false;
                    } else {
                        if(rows) {
                            var thesnowflake = _.pluck(rows, 'discordsnowflake');

                            logging.log(`SQL: SELECT name FROM players WHERE discordsnowflake IN ('${thesnowflake.join("','")}')`);
                            db.all(`SELECT name FROM players WHERE discordsnowflake IN ('${thesnowflake.join("','")}')`, function(err,rows){
                                if(err){
                                    logging.error(`SQL ERROR: ${err.message}`);
                                    message.reply("I failed");
                                }

                                if(rows){
                                    var thenames = _.pluck(rows, 'name');
                                    logging.log(`These people: ${thenames}`);
                                    message.reply(`These people: ${thenames}`);
                                }
                            })

                            db.close();
                        } else {
                            logging.warn("There's no games yet");
                            message.channel.send("There's no games yet");
                        }
                    }
                });

                // db.close on inner callback
                break;
            case 'getgames':
                // !getgames <name|discordsnowflake|steamid>

                if(!args[0]) {
                    var searchTerm = message.author.id;
                } else {
                    var searchTerm = args[0];    
                }

                var db = new sql.Database('./wawp.sqlite');

                logging.log(`SQL: SELECT name,discordsnowflake FROM players WHERE ? IN (name, discordsnowflake, steamid)`, searchTerm);
                db.get(`SELECT name,discordsnowflake FROM players WHERE ? IN (name, discordsnowflake, steamid)`, searchTerm, function(err, row) {

                    if(err || row == undefined) {
                            if(!err) {
                                var errorMessage = " No Error"
                            } else {
                                var errorMessage = err.message;
                            }
                        logging.error(`Either name was undefined and doesn't exist, or :${errorMessage}`);
                        message.reply('not found...');
                    } else {

                        var playerName = row.name;
                        var discordSnowFlake = row.discordsnowflake;
                        logging.log(`Players name is: ${playerName} and snowflake is :${discordSnowFlake}`);
                    
                        if(row) {
                            
                            logging.log(`SQL: SELECT pg.appid,g.name FROM playersgames AS pg INNER JOIN games AS g ON pg.appid = g.appid WHERE discordsnowflake = ${row.discordsnowflake}`);
                            db.all("SELECT pg.appid,g.name FROM playersgames AS pg INNER JOIN games AS g ON pg.appid = g.appid WHERE discordsnowflake = ?",[row.discordsnowflake], function(err, rows){
                                if(err) {
                                    logging.error(err.message);
                                } else {
                                    var names = _.pluck(rows, 'name');
                                    names = names.sort().join(', ');

                                    // Max body length is 2k
                                    if(names.length <= 1900) {
                                        logging.log(`The games that returned back are: ${names}`);
                                        message.reply(`The games that ${playerName} has are: ${names}`);
                                    } else {
                                        logging.log(`The games are too big for console return, over 2k chars: `);


                                        // We're going to send the data to a text hosting service instead, because it's too big for discord
                                        var headers = {
                                                'User-Agent': `Discord Bot/${version}`,
                                                'Content-Type': 'application/x-www-form-urlencoded'
                                            }

                                            var options = {
                                                url: 'http://text-share.com/api/create',
                                                method: 'POST',
                                                headers: headers,
                                                form: 'text='+encodeURIComponent(JSON.stringify(rows))
                                            }

                                            request(options, function(err, res, body){
                                                if(!err && res.statusCode == 200) {
                                                    logging.log(body);
                                                    message.reply(`Go here: ${body}`);
                                                } else {
                                                    logging.error(err.message);
                                                }
                                            });

                                    }
                                }
                            });
                        } else {
                            logging.warn("Nothing game back on the search...");
                            message.channel.send("Nothing game back on the search...");
                        }
                    }
                });

                db.close();
                break;
            case 'iplay':
                //!iplay <appid>
                var gameappid = args[0];

                if(!gameappid)  return;

                var db = new sql.Database('./wawp.sqlite');

                logging.log(`SQL: INSERT OR REPLACE INTO playersgames (appid, discordsnowflake) VALUES (${gameappid},${message.author.id})`);
                db.run('INSERT OR REPLACE INTO playersgames (appid, discordsnowflake) VALUES (?,?)',[gameappid,message.author.id]);

                logging.log(`SQL: SELECT pg.appid,g.name FROM playersgames AS pg INNER JOIN games AS g ON pg.appid = g.appid WHERE g.appid = ${gameappid}`);
                db.get("SELECT pg.appid,g.name FROM playersgames AS pg INNER JOIN games AS g ON pg.appid = g.appid WHERE g.appid = ?", [gameappid], function(err, row) {
                    if(row) {
                            logging.log(`Game Name: ${row.name} App ID: ${row.appid}`);
                            message.reply(`Game Name: ${row.name} App ID: ${row.appid}`);
                    } else {
                        logging.warn("You are not in the database, or that appid doesn't exist");
                        message.reply("You are not in the database, or that appid doesn't exist");
                    }
                });

                db.close();
                break;
            case 'gettags':
                //!gettags <appid>

                var db = new sql.Database('./wawp.sqlite');
                var appid = args[0];

                logging.log(`SQL: SELECT name,tags FROM games WHERE appid = ${appid}`);
                db.get(`SELECT name,tags FROM games WHERE appid = ?`, [appid], function(err,row){
                    if(err) {
                        logging.error(err.message);
                    } else {
                        if(!row) {
                            message.reply('No game found for that appid...');
                        } else {
                            var gameName = row.name;
                            var gameTags = row.tags || "No tags yet... consider contributing";
                            var gameArray = gameTags.split(',').sort(function (a,b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); });
                            

                            logging.log(`Game Array is: ${JSON.stringify(gameArray)} and is of type: ${typeof(gameArray)}`);

                            logging.log(`Tags for ${gameName} are: ${gameArray}`);
                            message.reply(`Tags for ${gameName} are ${gameArray}`);
                        }
                    }
                });

                db.close();
                break;
            case 'addtag':
            case 'addtags':
                //!addtags <appid> <tags>

                var db = new sql.Database('./wawp.sqlite');
                var appid = args.shift();

                logging.log(`ARGS: ${JSON.stringify(args)}`);

                var newtags = args.sort().toString().replace(/['"]+/g, '');

                logging.log(`Tags are: ${newtags}`);
                logging.log(`SQL: SELECT tags FROM games WHERE appid = ${appid}`);
                db.get(`SELECT appid,tags FROM games WHERE appid = ?`, appid, function(err, row){
                    if(err) {
                        logging.error(err.message);
                        message.reply("Couldn't add tag, something went wrong");
                    } else {
                        if (!row) {
                            logging.warn("appid doesn't exist for tag update");
                            message.reply("That appid doesn't exist");
                        } else {

                            var oldtags = row.tags;

                            if(oldtags !== "null" && oldtags) {
                                var combinedtags = oldtags.concat(','+newtags).split(',').sort(function (a,b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); });
                                var updatedtags = combinedtags.filter((v, i, a) => a.indexOf(v) === i).toString();
                                logging.log(`Old tags are: ${oldtags} and new tags are ${newtags} and together they are ${updatedtags}`);
                            } else {
                                var updatedtags = newtags;
                            }

                            logging.log(`Old tags are: ${oldtags} and updated tags are: ${updatedtags}`, [updatedtags, appid]);

                            logging.log(`SQL: UPDATE games SET tags = ${updatedtags} WHERE appid = ${appid}`);
                            db.get(`UPDATE games SET tags = ? WHERE appid = ?`, [updatedtags,appid], function(err){
                                if (err) {
                                    logging.error(err.message);
                                    message.reply("Could not update tags, report this...");
                                } else {
                                    logging.log(`AppID: ${appid} now has tags: ${updatedtags}`);
                                    message.reply(`AppID: ${appid} now has tags: ${updatedtags}`);
                                }
                            });

                        }
                    }

                });

                db.close();
                break;
            case 'deletetags':
                //!deletetags <appid> <tags>
                var db = new sql.Database('./wawp.sqlite');
                var appid = args.shift();
                var removetags = args;

                logging.log(`SQL: SELECT appid,tags FROM games WHERE appid = ${appid}`);
                db.get(`SELECT appid,tags FROM games WHERE appid = ?`,appid, function(err,row){
                    if(err){
                        logging.error(err.message);
                        message.reply("Couldn't remove tag, something went wrong");
                    } else {
                        if(!row) {
                            logging.warn("appid doesn't exist for tag removal");
                            message.reply("That appid doesn't exist");
                        } else {

                            if (row.tags) {
                                var arrayTags = row.tags.split(',') || "";
                                logging.log(`Tags are: ${arrayTags} and we're removing: ${removetags}`);
                                
                                var filteredTags = _.without(arrayTags, ...removetags).sort(function (a,b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); }).toString();

                                logging.log(`UPDATE games SET tags = ? WHERE appid = ?`, [filteredTags,appid]);
                                db.get(`UPDATE games SET tags = ? WHERE appid = ?`, [filteredTags,appid],function(err){
                                    if (err) {
                                        logging.error(err.message);
                                        message.reply("Could not update tags, report this...");
                                    } else {
                                        logging.log(`AppID: ${appid} now has tags: ${filteredTags}`);
                                        message.reply(`AppID: ${appid} now has tags: ${filteredTags}`);
                                    }
                                });
                            } else {
                                logging.log(`SQL Row returned null for row.tags: ${row.tags}`);
                                message.reply("Nothing more to delete, tags are gone");
                            }
                        }
                    }
                    db.close();
                });
                
                //db.close on inner callback
                break;
            case 'searchtag':
            case 'searchtags':
                //!searchtag <tag>

                var db = new sql.Database('./wawp.sqlite');
                var tag = args[0];

                logging.log(`SQL: SELECT name FROM games WHERE tags LIKE '%${tag}%'`);
                db.all(`SELECT name FROM games WHERE tags LIKE ?`, '%'+tag+'%', function(err, rows){
                    if(!rows || _.pluck(rows,'name').length == 0) {
                        logging.log("There are no games with that tag, consider contributing");
                        message.reply("There are no games with that tag, consider contributing");
                        return false;
                    } else {

                        var names = _.pluck(rows, 'name').sort().join(' , ');

                        logging.log(`Games are: ${names}`);
                        message.reply(`Games are: ${names}`);
                    }
                });

                db.close();
                break;
            case 'getdatetime':
                // Get a specific date time and print ranges of groups of games

                break;
            case 'getevent':
            case 'getevents':
                // Queries all datetimes

                break;
            case 'createevent':
                // !createEvent <name> <datetime> <game> 

                break;
            case 'attendevent':
                //!attendEvent <event name/id>

                break;
            case 'seedgames':
                // Need to think about how to onboard games, maybe from a URL, currently from a local file

                var db = new sql.Database('./wawp.sqlite');

                fs.readFile('./gamesdbseed.sql', function(err, data){

                    if(err) {
                        logging.error(`Seeding Error: ${err.message}`);
                        message.reply('Seeding error...');
                    } else {

                        var start = Date.now();
                        var games = data.toString().split("\n");

                        db.serialize(function(){
                            games.forEach(function(game){
                                db.run(`${game}`);
                                logging.log(`SQL: ${game}`);
                            });
                        });

                        db.close(function(){
                            logging.log("SQL: " + (Date.now() - start) + "ms to finish");
                            message.reply('Database seeded!');
                        });
                    }
                });

                //db.close on inner callback
                break;
            case 'backupgames':

                var db = new sql.Database('./wawp.sqlite');
                var backedupgames = [];

                db.all("SELECT appid,name,tags from games", function(err, rows){
                    if(err){
                        logging.log(`SQL ERROR: ${err.message}`);
                        message.reply('Something went wrong...');
                    } else {
                        if(rows){
                            backedupgames.push(`BEGIN TRANSACTION;`);
                            backedupgames.push(`DELETE FROM games;`);
                            backedupgames.push(`DELETE FROM SQLITE_SEQUENCE WHERE name='games';`);
                            _.each(rows, function(row, index){
                                backedupgames.push(`INSERT OR REPLACE INTO games (appid,name,tags) VALUES("${row.appid}","${row.name}","${row.tags}");`);
                            })
                            backedupgames.push(`COMMIT;`);
                        }

                        // This is what we can restore from
                        logging.log(`Backuped backedupgames script is: \n ${backedupgames.join('\n')} `);
                        fs.writeFile('backup.dump', backedupgames.join('\n'), function(err){
                            if (err) {
                                logging.error('Could not write file to filesystem.');
                            } else {
                                logging.log('Wrote backup script');
                                message.reply('Backup successful');
                            }
                        });

                        // This is for long term storage
                        logging.log(`Creating unique backup for DR`);
                        var fileName = 'backup.dump.' + Math.floor(new Date() / 1000);
                        fs.writeFile(fileName,backedupgames.join('\n'), function(err){
                            if (err) {
                                logging.error('Could not write file to filesystem.');
                            } else {
                                logging.log('Wrote DR backup script too');
                            }
                        });

                        logging.log('Cleaning up old backups');

                        glob('./backup.dump.*', function(err, files) {
                            logging.log(JSON.stringify(files));

                            if(files.length > 10) {
                                logging.log('BACKUPS: We are over 10 backups.. purging extras');
                                files.sort().reverse();

                                var removeList = files.slice(10)
                                logging.log(`The files we are to removing are: ${removeList}`);

                                removeList.forEach(function(file){
                                    fs.unlink(file, function(error){
                                        if(error) {
                                            logging.error('Unable to delete additional backup.dump configs...');
                                        } else {
                                            logging.log(`Deleted overflowing backup.dump configs ${file}`);
                                        }
                                    });
                                });
                            } else {
                                // Do nothing for now
                            }
                        });                        
                    }
                });

                db.close();
                break;
            case 'restoregames':

                var db = new sql.Database('./wawp.sqlite');

                fs.readFile('./backup.dump', function(err, data){
                    if(err) {
                        logging.error(`Restoral Error: ${err.message}`);
                        message.reply('Restoral error...');
                    } else {

                        var start = Date.now();
                        var queries = data.toString().split("\n");

                        db.serialize(function(){
                            queries.forEach(function(query){
                                db.run(`${query}`);
                                logging.log(`SQL: ${query}`);
                            });
                        });
                        db.close(function(){
                            logging.log("SQL: " + (Date.now() - start) + "ms to finish");
                            message.reply('Database restored!');
                        });
                    }
                });

/*          case 'seedmultiplayer':
                // This was the initial function to seed the database, you shouldn't use this now
                // It is unreliable, but leaving in case a future http endpoint can be used to autoseed

                var seedurl = 'http://steamspy.com/api.php?request=tag&tag=Multiplayer';
                var db = new sql.Database('./wawp.sqlite');

               request.get({
                    url: seedurl,
                    json: true,
                    headers: {'User-Agent': 'request'}
                }, (err, res, data) => {
                    if(err) {
                        logging.error(`Error: ${err}`);
                    } else if (res.statusCode !== 200) {
                        logging.log(`Status: ${res.statusCode}`);
                        message.reply('Your Steam64ID is probably not correct');
                    } else {

                        var appAndName = _.map(data, function(o) {return _.pick(o, 'appid', 'name'); });

                    var start = Date.now();

                    db.serialize(function() {
                       db.run("begin transaction");
                       appAndName.forEach(function (arrayItem){
                            var appid = arrayItem.appid;
                            var name = arrayItem.name;
                            var tags = '';

                            if(!name) {
                                var name = "NO NAME GIVEN"+Math.floor(Math.random()*90000) + 10000;
                            }

                            logging.log(`SQL: INSERT OR REPLACE INTO games (appid,name,tags) VALUES (${appid},${name},${tags})`);
                            db.run('INSERT OR REPLACE INTO games (appid,name,tags) VALUES (?,?,?)',[appid,name,tags]);
                        });

                        db.run("CREATE UNIQUE INDEX IF NOT EXISTS games_appid ON games (appid)");
                        db.run("commit");
                    });
                    db.close(function(){
                        logging.log((Date.now() - start) + "ms to finish");
                        message.reply('Database seeded!');
                    });
                    }
                });

                break;
*/                
            default:
                // do nothing
                break;
         }
     }
     
});

bot.login(config.discordapikey);