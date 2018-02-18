
# What Are We Playing?

A Discord bot that assists in deciding what games to play.

## Why?

Do you spend all your free time deciding what multiplayer game to play with your friends? 
Do you often forget which games your friends have or do you enjoy the PUG life?

We had those problems too... and out of that common shared frustration for lack of such a system - many ideas flourished into the start of this project. 

## What?

This bot has higher ambitions than it's current potential. In current form, it is a Node.JS app that uses a local sqlite3 database to store information about players, and games. It compares data collected about players, and multiplayer games, and allows for quick scheduling of games - attempting to reduce the amount of time spent finding the commonality in all players. This database does not require a backend server, and is handled through the sqlite3 library in Node.JS. 

 	What the bot does:
 		* Add/Delete yourself from the database
 		* Get a list of players/games
 		* Get a list of players by game
 		* Get an intersection of games between n number of players
 		* Automatically add Steam games to profile (compares compatible against games database)
 		* Manually add games to the games database
 		* Manually assign games to your profile
 		* Add/Delete/Search for games by custom tags
 		* Create backups/restores of database

 ### Future Potential

Ideally, this bot should also have an event system where a player can associate a game they play, with a timeframe they wouldn't mind playing it in. This would give the flexibility to do things like !getdatetime mm/dd/yy hh:mm and be returned a list of available games and players that are available to play. This allows for interactive scheduling without requiring the parties to be in constant conversation.

It should also have permission based roles, allowing customization to who can run commands.

To take another step, the bot should also be able to recommend games, randomly or intuitively - especially when they're on sale.

The bot also has a todo/wish list on the wiki, that should grow over time.

### Prerequisites

Check out the wiki for more information

tl;dr
 * Google Storage (just need a bucket, can do for free)
 * Steam API Key
 * Discord Bot Token

You will need to obtain API keys from Google Cloud, Discord, and Steam. You will also need to sign up for a free GCP account to take advantage of the Storage hosting (not app hosting). You are also welcome to run this on your local pc, but you will need GCP Storage (which does not require a paid account) in either circumstance. The reason for this is the size of the output from !getallgames, most text hosting services wouldn't store the entire contents above 5k characters. If you have a good alternate solution for 10k-30k+, hmu. Alternatively, you don't have to use Cloud Storage, but the !getallgames command will not work if you don't. You can view the wawp.sqlite in the repo to see the default games list, and you can also view this via an sqlite3 cli client in windows/linux. The caveat to this, is if any player adds more games, you won't know without running a sql query, or dumping it out via the !getallgames command.

### Installing

See the wiki for Setup

## Versioning

We use [SemVer](http://semver.org/) for versioning, or attempt to.

## License

This project is licensed under the MIT License - see the [LICENSE.md](https://github.com/sliptripfall/wawp/blob/master/LICENSE) file for details

