
# What Are We Playing?

A Discord bot that assists in deciding what games to play.

## Why?

Do you spend all your free time deciding what multiplayer game to play with your friends? 
Do you often forget which games your friends have or do you enjoy the PUG life?

We had those problems too... and out of that common shared frustration for lack of such a system - many ideas flourished into the start of this project. 

## What?

This bot has higher ambitions than it's current potential. In current form, it is a Node.JS app that uses a local sqlite3 database to store information about players, and games. It compares data collected about players, and multiplayer games, and allows for quick scheduling of games - attempting to reduce the amount of time spent finding the commonality in all players. This database does not require a backend server, and is handled through the sqlite3 library in Node.JS. 
 	are 792kb and are manageable at small scale. 

 	What the bot does:
 		* Add/Delete yourself from the database
 		* 

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes

### Prerequisites

tl;dr
 * Google Storage (just need a bucket, can do for free)
 * Steam API Key
 * Discord Bot Token

You will need to obtain API keys from Google Cloud, Discord, and Steam. You will also need to sign up for a free GCP account to take advantage of the Storage hosting (not app hosting). You are also welcome to run this on your local pc, but you will will need GCP Storage (which does not require a paid account) in any circumstance. The reason for this is the size of the output from !getallgames, most text hosting services wouldn't store the entire contents. If you have a good alternate solution, hmu. Alternatively, you don't have to use Cloud Storage, but the !getallgames command will not work. You can view the wawp.sqlite in the repo to see the default games list, and you can also view this via an sqlite3 cli client in windows/linux. The caveat to this, is if any player adds more games, you won't know without running a sql query, or dumping it out via the !getallgames command.

### Installing

See the wiki for Setup

## Versioning

We use [SemVer](http://semver.org/) for versioning, or attempt to.

## License

This project is licensed under the MIT License - see the [LICENSE.md](https://github.com/sliptripfall/wawp/blob/master/LICENSE) file for details

