require("dotenv").config();
var Discord = require("discord.io");
var logger = require("winston");
var fs = require("fs");
const { parse } = require("path");

var bot = new Discord.Client({
  token: process.env.DISCORDBOTTOKEN,
  autorun: true,
});
var prefix = "^";

logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true,
});
logger.level = "debug";

bot.on("ready", function (evt) {
  logger.info(bot.username + " - (" + bot.id + ")");
  bot.setPresence({
    game: {
      name: "the BEST server!",
      type: 3,
    },
  });
  setCounter();
  setCounterFragile();
  dunceCheck();
  setInterval(dunceCheck, 1000 * 60 * 60);

  var memberCount = bot.servers["442754791563722762"].member_count;
  logger.info("Member Count: " + memberCount);
});

bot.on("message", function (user, userID, channelID, message, evt) {
  if (userID != "720120584155168771" && evt.d.type == 0) {
    if (message.substring(0, 1) == ";") {
      var args = message.substring(1).split(" ");
      var cmd = args[0];
      args = args.splice(1);
      var cl = message.substring(1).split("|");
      var cld = cl[0];
      clargs = cl.splice(1);

      var serverID = bot.channels[channelID].guild_id;
      var listOf = bot.servers[serverID].members[userID];

      if (listOf != undefined) {
        var listOfRoles = listOf.roles;
        var isHyper = false;
        var isPresident = listOfRoles.includes("445482959085240331");
        var isEboard = listOfRoles.includes("442756821590081537");
        var isPastEboard = listOfRoles.includes("588114684318580770");

        if (userID == "196685652249673728") {
          isHyper = true;
        }
      }

      switch (cmd) {
        case "purge":
          if (isHyper || isPresident) {
            var bl = [];
            deletemsg(channelID, evt.d.id, 0);
            bot.getMessages(
              {
                channelID: channelID,
                limit: parseInt(args[0]) + 1,
              },
              function (e, a) {
                for (i = 0; i < a.length; i++) {
                  bl.push(a[i].id);
                }
                bot.deleteMessages({
                  channelID: channelID,
                  messageIDs: bl,
                });
              }
            );
          } else {
            deletemsg(channelID, evt.d.id, 0);
            noperm(channelID, evt.d.id);
          }

          break;
        case "bc":
          if (isHyper || isPresident || isEboard) {
            bot.sendMessage({
              to: channelID,
              embed: {
                color: 0x2f190e,
                title: message.substring(4),
                footer: {
                  icon_url:
                    "https://cdn.discordapp.com/avatars/" +
                    userID +
                    "/" +
                    bot.users[userID].avatar,
                  text: "Broadcast issued by " + user,
                },
              },
            });
            deletemsg1(channelID, evt.d.id, 0);
          } else {
            deletemsg(channelID, evt.d.id, 5000);
            noperm(channelID, evt.d.id);
          }

          break;
        case "kill":
          if (isHyper) {
            success(channelID, evt.d.id);
            bot.disconnect();
            process.exit();
          } else {
            noperm(channelID, userID);
          }

          break;
        case "resetpin":
          if (isHyper) {
            bot.deletePinnedMessage(
              {
                channelID: "720133492939161661",
                messageID: "720133540137664603",
              },
              function (e) {
                bot.pinMessage({
                  channelID: "720133492939161661",
                  messageID: "720133540137664603",
                });
              }
            );
          }
          break;
        case "noperm":
          if (isHyper) {
            noperm(channelID, evt.d.id);
          }
          break;
        case "changelog":
          if (isHyper) {
            bot.sendMessage({
              to: channelID,
              message: "@everyone Please welcome our 2020-2021 Eboard!",
              embed: {
                color: 0x972525,
                title: clargs[0],
                description: clargs[1],
                timestamp: new Date(),
                author: {
                  //name: user,
                  name: "Griffin Beels and Isaac Kim",
                  icon_url:
                    /*"https://cdn.discordapp.com/avatars/" +
                    userID +
                    "/" +
                    bot.users[userID].avatar,*/
                    "https://media.discordapp.net/attachments/611791584190791682/720167116741017620/unknown.png",
                },
                footer: {
                  icon_url:
                    "https://media.discordapp.net/attachments/611791584190791682/720149464467243069/BEST_logo_transparent_1.png",
                  text: "* = Head",
                },
                fields: [
                  {
                    name: clargs[2],
                    value: clargs[3],
                    inline: clargs[4],
                  },
                  {
                    name: clargs[5],
                    value: clargs[6],
                    inline: clargs[7],
                  },
                  {
                    name: "\u200B",
                    value: "\u200B",
                    inline: true,
                  },
                  {
                    name: clargs[8],
                    value: clargs[9],
                    inline: clargs[10],
                  },
                  {
                    name: clargs[11],
                    value: clargs[12],
                    inline: clargs[13],
                  },
                  {
                    name: clargs[14],
                    value: clargs[15],
                    inline: clargs[16],
                  },
                  {
                    name: "\u200B",
                    value: "\u200B",
                    inline: true,
                  },
                  {
                    name: clargs[17],
                    value: clargs[18],
                    inline: clargs[19],
                  },
                  {
                    name: clargs[20],
                    value: clargs[21],
                    inline: clargs[22],
                  },
                  {
                    name: "\u200B",
                    value: "\u200B",
                    inline: true,
                  },
                  {
                    name: clargs[23],
                    value: clargs[24],
                    inline: clargs[25],
                  },
                  {
                    name: clargs[26],
                    value: clargs[27],
                    inline: clargs[28],
                  },
                  {
                    name: "\u200B",
                    value: "\u200B",
                    inline: true,
                  },
                  {
                    name: clargs[29],
                    value: clargs[30],
                    inline: clargs[31],
                  },
                  {
                    name: clargs[32],
                    value: clargs[33],
                    inline: clargs[34],
                  },
                  {
                    name: "\u200B",
                    value: "\u200B",
                    inline: true,
                  },
                  {
                    name: clargs[35],
                    value: clargs[36],
                    inline: clargs[37],
                  },
                ],
              }, //-changelog |1|2|3|true|5|6|7|true|8|9|true
            });
            deletemsg(channelID, evt.d.id, 0);
          } else {
            deletemsg(channelID, evt.d.id, 5000);
            noperm(channelID, evt.d.id);
          }
          break;
      }
    }
  }

  // The Counting Game Infinity
  if (channelID == "720133492939161661") {
    if (isNaN(message.split(" ")[0])) {
      bot.sendMessage({
        to: userID,
        message:
          "Please only type consecutive numbers in The Counting Game ∞. Your deleted message: `" +
          message +
          "`",
      });
      deletemsg1(channelID, evt.d.id, 0);
    } else if (userID == lastUser) {
      bot.sendMessage({
        to: userID,
        message:
          "Please do not send consecutive messages in The Counting Game ∞. Your deleted message: `" +
          message +
          "`",
      });
      deletemsg1(channelID, evt.d.id, 0);
    } else {
      isLastNum(channelID, evt.d.id, userID, evt.d.type);
    }
  }

  // Fragile Counting Game
  if (channelID == "720323796111851572") {
    if (isNaN(message.split(" ")[0])) {
      bot.sendMessage({
        to: userID,
        message:
          "Make sure the first word of your message is a number! Your deleted message: `" +
          message +
          "`",
      });
      deletemsg1(channelID, evt.d.id, 0);
    } else if (userID == lastUserFragile) {
      bot.sendMessage({
        to: userID,
        message:
          "Please do not send consecutive messages in The Hardcore Counting Game. Your deleted message: `" +
          message +
          "`",
      });
      deletemsg1(channelID, evt.d.id, 0);
    } else {
      isLastNumFragile(channelID, evt.d.id, userID, evt.d.type, evt); // I know this is terrible, I don't want to refactor now
    }
  }
});

bot.on("disconnect", function (msg, code) {
  if (code === 0) return console.error(msg);
  bot.connect();
});

// The Counting Game
function setCounter() {
  bot.getMessages(
    {
      channelID: "720133492939161661",
      limit: 2,
    },
    function (e, m) {
      setTimeout(function () {
        if (isNaN(parseInt(m[0].content))) {
          bot.deleteMessage({
            channelID: "720133492939161661",
            messageID: m[0].id,
          });
          setCounter();
        } else {
          ccounter = parseInt(m[0].content);
          lcounter = parseInt(m[1].content);
          if (parseInt(ccounter) != parseInt(lcounter) + 1) {
            bot.deleteMessage({
              channelID: "720133492939161661",
              messageID: m[0].id,
            });
            setCounter();
          } else {
            counter = parseInt(m[0].content);
            lastUser = m[0].author.id;
            logger.info("Last Counting Game Number: " + counter + "");
          }
        }
      }, 1000);
    }
  );
}

function setCounterFragile() {
  bot.getMessages(
    {
      channelID: "720323796111851572",
      limit: 2,
    },
    function (e, m) {
      setTimeout(function () {
        if (isNaN(parseInt(m[0].content))) {
          bot.deleteMessage({
            channelID: "720323796111851572",
            messageID: m[0].id,
          });
          setCounterFragile();
        } else {
          counter = parseInt(m[0].content);
          lastUserFragile = m[0].author.id;
          logger.info("Last Counting Game Number: " + counter + "");
        }
      }, 10);
    }
  );
}

function isLastNum(channelID, messageID, userID, type) {
  bot.getMessages(
    {
      channelID: "720133492939161661",
      limit: 2,
    },
    function (e, m) {
      ccounter = parseInt(m[0].content.split(" ")[0]); //m[0] returns the newest message
      lcounter = parseInt(m[1].content.split(" ")[0]); //m[1] returns the second newest message
      if (parseInt(ccounter) != parseInt(lcounter) + 1) {
        if (type == 0) {
          bot.sendMessage({
            to: userID,
            message:
              "Please only type consecutive numbers in The Counting Game ∞. Your deleted message: `" +
              m[0].content +
              "`",
          });
        }
        deletemsg1(channelID, messageID, 0);
      } else if (parseInt(ccounter) % 100 === 0) {
        bot.deletePinnedMessage(
          {
            channelID: "720133492939161661",
            messageID: "720133540137664603",
          },
          function (e) {
            bot.pinMessage({
              channelID: "720133492939161661",
              messageID: "720133540137664603",
            });
          }
        );
        bot.pinMessage({
          channelID: channelID,
          messageID: messageID,
        });
        bot.pinMessage({
          channelID: "720133492939161661",
          messageID: "720133540137664603",
        });
        lastUser = userID;
      } else {
        lastUser = userID;
      }
    }
  );
}

function isLastNumFragile(channelID, messageID, userID, type, evt) {
  bot.getMessages(
    {
      channelID: "720323796111851572",
      limit: 2,
    },
    function (e, m) {
      ccounter = parseInt(m[0].content.split(" ")[0]);
      lcounter = parseInt(m[1].content.split(" ")[0]);
      if (parseInt(ccounter) != parseInt(lcounter) + 1) {
        if (
          /*parseInt(ccounter) !== 0 &&*/ userID !== "720120584155168771" &&
          ccounter !== NaN
        ) {
          if (type == 0) {
            bot.sendMessage({
              to: "720323796111851572",
              message:
                "0 <@" +
                userID +
                "> broke the " +
                lcounter +
                " long chain by typing " +
                ccounter +
                "! Starting from the top.",
            });
            new Promise(function resetdunce(resolve, reject) {
              resolve(removeDunce());
            }).then(function () {
              bot.addToRole({
                serverID: evt.d.guild_id,
                userID: userID,
                roleID: "721563745343504384",
              });
              fs.writeFile("dunce-timestamp.txt", Date.now(), (err) => {
                if (err) return console.log(err);
                console.log("Logged current timestamp");
              });
            });
          } else if (type == 6) {
            deletemsg1(channelID, messageID, 0);
          }
          //deletemsg1(channelID, messageID, 0);}
        }
      } else {
        lastUserFragile = userID;
      }
    }
  );
}

function dunceCheck() {
  console.log("Activated dunce check at "+Date.now().toString())
  // check for dunce role and remove it if it's >1d
  fs.access("dunce-timestamp.txt", fs.F_OK, (err) => {
    if (err) {
      fs.writeFile("dunce-timestamp.txt", Date.now(), (err) => {
        console.log("Created dunce-timestamp.txt");
      });
    }
    fs.readFile("dunce-timestamp.txt", "utf8", (err, data) => {
      if (err) return console.log(err);
      if (parseInt(data) < Date.now() - 1000 * 60 * 60 * 24) {
        removeDunce();
      }
    });
  });
}

function removeDunce() {
  console.log("Dunce removal fired at "+Date.now().toString())
  var duncearr = Object.values(bot.servers["442754791563722762"].members)
    .filter((m) => m.roles.includes("721563745343504384"))
    .map((m) => m.id);
  duncearr.forEach((dunceid, i) => {
    bot.removeFromRole({
      serverID: "442754791563722762",
      userID: dunceid,
      roleID: "721563745343504384",
    });
    if (duncearr.length == i + 1) {
      return true;
    }
  });
  if (duncearr.length == 0) {
    return true;
  }
}

// Utilities
function deletemsg(channelID, messageID, length) {
  /*setTimeout(function() {
      bot.deleteMessage({
          channelID: channelID,
          messageID: messageID
      })
  }, length);*/
}

function deletemsg1(channelID, messageID, length) {
  setTimeout(function () {
    bot.deleteMessage({
      channelID: channelID,
      messageID: messageID,
    });
  }, length);
}

function noperm(channelID, id) {
  bot.sendMessage({
    to: channelID,
    embed: {
      color: 0x25a397,
      title: "I'm sorry, but you don't have permission to do that.",
      footer: {
        icon_url:
          "https://cdn.discordapp.com/attachments/312758904821907456/405511101934075924/og_image.png",
        text: "Message auto-generated by BESTBot",
      },
    },
  });
  /*setTimeout(function() {
      bot.deleteMessage({
          channelID: channelID,
          messageID: id
      })
  }, 5000);*/
}

function success(channelID, messageID) {
  bot.addReaction({
    channelID: channelID,
    messageID: messageID,
    reaction: ":greenTick:407311488013828119",
  });
}
function failure(channelID, messageID) {
  bot.addReaction({
    channelID: channelID,
    messageID: evt.d.id,
    reaction: ":redTick:407311235822911488",
  });
}
