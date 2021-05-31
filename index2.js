require("dotenv").config();
const Discord = require("discord.js");
const axios = require("axios");
const fs = require("fs");
const client = new Discord.Client();
const yaml = require('js-yaml');

const bestcolors = JSON.parse(fs.readFileSync("./best-colors.json", "utf-8"));

// Load configuration file
var config;
try {
  var config = yaml.load(fs.readFileSync("./config.yml", "utf-8"));
} catch (e) {
  console.error("The configuration failed to load!")
  console.error(e)
}

client.on("ready", () => {
  client.user.setActivity("the BEST server!", { type: "WATCHING" });
  console.log(`Logged in as ${client.user.tag}!`);
  updateVerifiedStudents();
  setInterval(() => updateVerifiedStudents(), 1000 * 60 * 60);
  client.guilds.fetch("442754791563722762").then((guild) => {
    guild.members.fetch();
  });
  client.channels.fetch("828810185509961764").then((channel) => {
    // name-colors channel, fetches reaction messages
    channel.messages.fetch();
  });
});

client.on("message", (msg) => {
  if (msg.author.id != "720120584155168771" && msg.type == "DEFAULT") {
    if (msg.content.substring(0, 1) == config.prefix) {
      let message = msg.content;
      var args = message.substring(1).split(" ");
      var cmd = args[0];
      args = args.splice(1);
      var cl = message.substring(1).split("|");
      var cld = cl[0];
      clargs = cl.splice(1);

      var serverID = msg.guild.id;
      msg.guild.members.fetch(msg.author.id).then((res) => {
        var listOfRoles = res._roles;
        var isPresident = listOfRoles.includes("445482959085240331");
        var isEboard = listOfRoles.includes("442756821590081537");
        var isPastEboard = listOfRoles.includes("588114684318580770");
        var isCaptain = listOfRoles.includes("681557519931408397");

        if (msg.author.id == "196685652249673728") {
          isHyper = true;
        }

        switch (cmd) {
          // TODO: Add purge command
          // TODO: Add bc command
          // TODO: Add kill command
          // TODO: Add resetpin command
          // TODO: Add changelog command
          case "noperm":
            noperm(msg.channel.id);
            break;
          case "dev-1":
            if (isHyper) {
              msg.guild.members.fetch().then((members) => {
                console.log(
                  msg.guild.roles.cache
                    .get("756983144900591627")
                    .members.map((m) => m.user.tag)
                );
              });
            }
            break;
          case "deafenall":
            if (isHyper) {
              if (msg.member.voice.sessionID) {
                msg.guild.channels.cache
                  .get(msg.member.voice.channelID)
                  .members.forEach((member) => {
                    member.voice.setDeaf(true);
                    member.voice.setMute(true);
                  });
              } else {
                msg.channel.send(":x: You aren't in a voice channel!");
              }
            }
            break;
          case "undeafenall":
            if (isHyper) {
              if (msg.member.voice.sessionID) {
                msg.guild.channels.cache
                  .get(msg.member.voice.channelID)
                  .members.forEach((member) => {
                    member.voice.setDeaf(false);
                    member.voice.setMute(false);
                  });
              } else {
                msg.channel.send(":x: You aren't in a voice channel!");
              }
            }
            break;
          case "team":
            if (isCaptain || isPresident) {
              const teamroles = [
                { name: "overwatch", id: "756983144900591627" },
                { name: "dota", id: "779479223416389653" },
                { name: "ultimate", id: "779479212222054486" },
                { name: "hearthstone", id: "779479450412122193" },
                { name: "siege", id: "759829367311433800" },
                { name: "valorant", id: "823291439378989106" },
              ];
              if (
                args.length == 2 &&
                args[0].match(/\d+/) &&
                teamroles.map((obj) => obj.name).includes(args[1])
              ) {
                let roleid = teamroles.find((obj) => obj.name == args[1]).id;
                let rolename = msg.guild.roles.cache.get(roleid).name;
                let member = msg.guild.members
                  .fetch(args[0].match(/\d+/)[0])
                  .then((member) => {
                    if (member.roles.cache.has(roleid)) {
                      member.roles.remove(roleid).catch(console.error);
                      msg.channel.send(
                        `:white_check_mark: Successfully removed \`${member.user.username}#${member.user.discriminator} (${member.user.id})\` from \`${rolename}\`.`
                      );
                    } else {
                      member.roles.add(roleid).catch(console.error);
                      msg.channel.send(
                        `:white_check_mark: Successfully added \`${member.user.username}#${member.user.discriminator} (${member.user.id})\` to \`${rolename}\`.`
                      );
                    }
                  })
                  .catch(console.error);
              } else if (
                args.length == 1 &&
                teamroles.map((obj) => obj.name).includes(args[0])
              ) {
                let roleid = teamroles.find((obj) => obj.name == args[0]).id;
                let role = msg.guild.roles.cache.get(roleid);
                let rolename = role.name;
                let rolemembers = role.members;
                msg.guild.members.fetch().then((members) => {
                  let membersWithRole = msg.guild.roles.cache
                    .get(roleid)
                    .members.map((m) => m.user.tag)
                    .join(", ");
                  msg.channel.send(
                    `Members in \`${rolename}\`: ${membersWithRole}`
                  );
                });
              } else {
                msg.channel.send(
                  `:x: You're missing parameters, or your parameters are invalid. Syntax: \`${prefix}team teamname\` to view team members, and \`${prefix}team @username teamname\`, where @username is the user, and teamname is one of \`${teamroles
                    .map((obj) => obj.name)
                    .join("`, `")}\`.`
                );
              }
            } else {
              noperm(msg.channel.id);
            }
            break;
          case "react":
            if (isEboard) {
              let emote = client.emojis.cache.find(
                (emoji) => emoji.name === args[1]
              ).id;
              if (args.length == 2 && args[0].match(/\d+/) && emote) {
                msg.channel.messages
                  .fetch(args[0])
                  .then((message) => {
                    message.react(emote);
                  })
                  .catch((err) => {
                    msg.channel.send(
                      `:x: Invalid MessageID! Make sure the message is in this channel.`
                    );
                  });
              } else {
                msg.channel.send(
                  `:x: You're missing parameters, or your parameters are invalid. Syntax: \`${prefix}react messageid emotename\`.`
                );
              }
            } else {
              noperm(msg.channel.id);
            }
            break;
          case "umd":
            if (isHyper) {
              msg.guild.members
                .fetch(args[0])
                .then((member) => updateMemberDividers(member));
            }
            break;
          case "update-all-dividers":
            if (isHyper) {
              client.guilds.fetch("442754791563722762").then((guild) => {
                guild.members.fetch().then((members) => {
                  members.forEach((member) => {
                    updateMemberDividers(member);
                  });
                });
              });
            }
            break;
          case "best-colors":
            if (isHyper) {
              msg.channel
                .send(
                  "**Name Color React Menu**\nBy being one of the <@&682031537231101957> users in this server, you've unlocked the ability to change your username color!\n\nIf you are a <@&585841945386156033> or a <@&509190343892140033>, you can also see this channel to select your perk color! You can't choose any other colors until you're <@&682031537231101957>, though.\n\nYou're able to select the colors of the roles below your current level."
                )
                .then(() => {
                  bestcolors.forEach((obj) => {
                    msg.channel
                      .send(`<@&${obj.role}> - <@&${obj.color}>`)
                      .then((message) => {
                        message.react("🔸");
                      });
                  });
                });
            }
            break;
          case "bc":
            if (isHyper || isPresident || isEboard) {
              msg.channel
                .send({
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
            } else {
              noperm(msg.channel.id);
            }

            break;
        }
      });
    }
  }
  if (msg.content.toLowerCase().includes("<@&720120584155168771>")) {
    msg.channel.send("pong");
  }
  if (msg.content.toLowerCase().includes("you love me")) {
    const emojis = [":person_shrugging:", ":white_check_mark:", ":x:"];
    msg.channel.send({
      embed: {
        title: `BEST - Love for You:  ${
          emojis[Math.floor(Math.random() * emojis.length)]
        }`,
      },
    });
  }
});

function noperm(channelID) {
  client.channels.cache.get(channelID).send({
    embed: {
      color: 0xc00404,
      title: ":x:  I'm sorry, but you aren't permitted to do that.",
      footer: {
        icon_url:
          "https://cdn.discordapp.com/icons/442754791563722762/a_ba9348709f6497c2dafc6220097de0ff.gif?size=32",
        text: "Message automatically generated by BESTBot",
      },
    },
  });
}

function updateVerifiedStudents() {
  console.log("updateVerifiedStudents was called at " + new Date());
  if (process.env.GCP_API_KEY) {
    axios
      .get(
        `https://sheets.googleapis.com/v4/spreadsheets/1AYBuSmPIvI8iSi5Tnpstzm-wGjEUGiICzO0iZLOYrhA/values/DiscordTags!A:A?majorDimension=COLUMNS&key=${process.env.GCP_API_KEY}`
      )
      .then((res) => {
        client.guilds.fetch("442754791563722762").then((guild) => {
          guild.members.fetch().then((members) => {
            var verifiedrolemembers = guild.roles.cache
              .get("768253432921849876")
              .members.map((m) => m.user.tag.toLowerCase());
            var gsheettags = res.data.values[0].map((v) => v.toLowerCase());
            var posdiff = gsheettags
              .filter((x) => !verifiedrolemembers.includes(x.toLowerCase()))
              .map((v) => v.toLowerCase()); // filters to differences between the two arrays - verifiedrolemembers is
            // current members on the server with the "Verified" role, res.data.values[0]
            // is Google Form list of DiscordTags that should have the role
            // var posdiff = diff // diff.filter((x) => gsheettags.includes(x));
            var negdiff = verifiedrolemembers
              .filter((x) => !gsheettags.includes(x.toLowerCase()))
              .map((v) => v.toLowerCase()); // diff.filter((x) => verifiedrolemembers.includes(x));
            var diff = posdiff.concat(negdiff);
            diff.forEach((DiscordTag) => {
              let user = client.users.cache.find(
                (u) => u.tag.toLowerCase() === DiscordTag.toLowerCase()
              )?.id;
              if (user) {
                let guilduser = guild.members
                  .fetch(user)
                  .then((guilduser) => {
                    let username = guilduser.user.username.toLowerCase();
                    let discrim = guilduser.user.discriminator;
                    if (posdiff.includes(username + "#" + discrim)) {
                      guilduser.roles
                        .add("768253432921849876")
                        .catch(console.error);
                      console.log("+" + username);
                    } else if (negdiff.includes(username + "#" + discrim)) {
                      guilduser.roles
                        .remove("768253432921849876")
                        .catch(console.error);
                      /*client.users.cache
                        .get(guilduser.id)
                        .send(
                          "Hi! Just letting you know that your `Verified Brown` role was removed on the Brown Esports server. This is likely caused by a change in your username, or by you unlinking your Discord account in our membership form. If you changed your username, please update it on the membership registration form at https://bit.ly/brownesports."
                        );*/
                      console.log("-" + username);
                    } else {
                      console.error(
                        `No clue what to do with this user! ${
                          username + "#" + discrim
                        }`
                      );
                    }
                  })
                  .catch(console.error);
              } else {
                console.log(`${DiscordTag} is invalid!`);
              }
            });
          });
        });
      });
  } else {
    console.log(
      "GCP_API_KEY in .env is not defined! Unable to update verified student roles."
    );
  }
}

class TransientArray extends Array {
  push() {
    const i1 = this.length;
    const i2 = super.push(...arguments);
    setTimeout(() => {
      for (let i = i1; i < i2; i++) delete this[i];
    }, 2000);
    return i2;
  }
}

let preventMultipleUpdates = new TransientArray();

client.on("guildMemberUpdate", (oldUser, newUser) => {
  /* April Fools 2021
  if (newUser.nickname?.toLowerCase().startsWith("hi blueno!")) {
    newUser.roles.add("826602708474921000");
    client.guilds.fetch("442754791563722762").then((guild) => {
      let blueno = guild.roles.cache
        .get("826602708474921000")
        .members.map((m) => m.user.tag);
      let bluenolength = blueno.length;
      guild.members.fetch().then((members) => {
        client.channels.cache
          .get("827091079810908210")
          .messages.fetch("827093062328909884")
          .then((message) => {
            message.edit(
              `${bluenolength} users have welcomed Blueno. The newest welcomer was ${newUser} (${new Date().toLocaleString(
                "en-US"
              )}).`
            );
          });
      });
    });
  } else {
    newUser.roles.remove("826602708474921000");
  }
  */
  if (!newUser.user.bot) {
    if (!preventMultipleUpdates.includes(newUser.id)) {
      preventMultipleUpdates.push(newUser.id);
      updateMemberDividers(newUser);
      updateUserColors(newUser);
    }
  }
});

function updateMemberDividers(guildmember) {
  if (guildmember.user.bot === true) {
    return;
  }
  client.guilds.fetch("442754791563722762").then((guild) => {
    guild.roles.fetch().then((roles) => {
      let guildroles = guild.roles.cache.sort((a, b) =>
        a.rawPosition < b.rawPosition ? 1 : -1
      );
      let rankrole = guild.roles.cache.get("828419381414461440"); // rank roles
      let badgerole = guild.roles.cache.get("828418427970387968"); // badges
      let selrole = guild.roles.cache.get("828490418203131934"); // selected roles

      let rankIds = guildmember._roles;
      let rawPositions = guildroles
        .filter(({ id }) => rankIds.includes(id))
        .map(({ rawPosition }) => rawPosition);

      let hasHigherRole = rawPositions.some(
        (pos) => pos > rankrole.rawPosition
      );
      let hasRankRole = rawPositions.some(
        (pos) => pos > badgerole.rawPosition && pos < rankrole.rawPosition
      );
      let hasBadgeRole = rawPositions.some(
        (pos) => pos > selrole.rawPosition && pos < badgerole.rawPosition
      );
      let hasSelRole = rawPositions.some((pos) => pos < selrole.rawPosition);
      /* console.log(
        `rankrole: ${rankrole.rawPosition}\nbadgerole: ${badgerole.rawPosition}\nselrole: ${selrole.rawPosition}`
      );*/

      let hasRankDivider = rawPositions.includes(rankrole.rawPosition);
      let hasBadgeDivider = rawPositions.includes(badgerole.rawPosition);
      let hasSelDivider = rawPositions.includes(selrole.rawPosition);

      if (hasHigherRole && !hasRankDivider) {
        guildmember.roles.add(rankrole);
      } else if (!hasHigherRole && hasRankDivider) {
        guildmember.roles.remove(rankrole);
      }

      if (hasBadgeRole && !hasBadgeDivider) {
        guildmember.roles.add(badgerole);
      } else if (!hasBadgeRole && hasBadgeDivider) {
        guildmember.roles.remove(badgerole);
      }

      if (hasSelRole && !hasSelDivider) {
        guildmember.roles.add(selrole);
      } else if (!hasSelRole && hasSelDivider) {
        guildmember.roles.remove(selrole);
      }

      if (!hasRankRole && (hasSelRole || hasBadgeRole)) {
        guildmember.roles.add("828782852762107964");
      } else if (
        rankIds.includes("828782852762107964") &&
        rawPositions.filter(
          (pos) => pos > badgerole.rawPosition && pos < rankrole.rawPosition
        ).length > 1
      ) {
        guildmember.roles.remove("828782852762107964");
      }
    });
  });
}

function updateUserColors(guildmember) {
  if (guildmember.user.bot === true) {
    return;
  }
  client.guilds.fetch("442754791563722762").then((guild) => {
    guild.roles.fetch().then((roles) => {
      let guildroles = guild.roles.cache.sort((a, b) =>
        a.rawPosition < b.rawPosition ? 1 : -1
      );
      let rankrole = guild.roles.cache.get("828419381414461440"); // rank roles
      let badgerole = guild.roles.cache.get("828418427970387968"); // badges
      let selrole = guild.roles.cache.get("828490418203131934"); // selected roles

      let rankIds = guildmember._roles;
      let rawPositions = guildroles
        .filter(({ id }) => rankIds.includes(id))
        .map(({ rawPosition }) => rawPosition);

      let hasHigherRole = rawPositions.some(
        (pos) => pos > rankrole.rawPosition
      );
      let hasRankRole = rawPositions.some(
        (pos) => pos > badgerole.rawPosition && pos < rankrole.rawPosition
      );
      let hasBadgeRole = rawPositions.some(
        (pos) => pos > selrole.rawPosition && pos < badgerole.rawPosition
      );
      let hasSelRole = rawPositions.some((pos) => pos < selrole.rawPosition);
      /* console.log(
        `rankrole: ${rankrole.rawPosition}\nbadgerole: ${badgerole.rawPosition}\nselrole: ${selrole.rawPosition}`
      );*/

      let hasRankDivider = rawPositions.includes(rankrole.rawPosition);
      let hasBadgeDivider = rawPositions.includes(badgerole.rawPosition);
      let hasSelDivider = rawPositions.includes(selrole.rawPosition);

      if (hasHigherRole && !hasRankDivider) {
        guildmember.roles.add(rankrole);
      } else if (!hasHigherRole && hasRankDivider) {
        guildmember.roles.remove(rankrole);
      }

      if (hasBadgeRole && !hasBadgeDivider) {
        guildmember.roles.add(badgerole);
      } else if (!hasBadgeRole && hasBadgeDivider) {
        guildmember.roles.remove(badgerole);
      }

      if (hasSelRole && !hasSelDivider) {
        guildmember.roles.add(selrole);
      } else if (!hasSelRole && hasSelDivider) {
        guildmember.roles.remove(selrole);
      }

      if (!hasRankRole && (hasSelRole || hasBadgeRole)) {
        guildmember.roles.add("828782852762107964");
      } else if (
        rankIds.includes("828782852762107964") &&
        rawPositions.filter(
          (pos) => pos > badgerole.rawPosition && pos < rankrole.rawPosition
        ).length > 1
      ) {
        guildmember.roles.remove("828782852762107964");
      }
    });
  });
}

client.on("messageReactionAdd", (reaction, user) => {
  if (
    bestcolors.map((obj) => obj.messageID).includes(reaction.message.id) &&
    reaction.emoji.name === "🔸"
  ) {
    client.guilds.fetch("442754791563722762").then((guild) => {
      guild.members.fetch(user.id).then((guser) => {
        let userroles = guser._roles;
        if (
          userroles.includes(
            bestcolors.find((obj) => obj.messageID === reaction.message.id).perm
          )
        ) {
          reaction.message.react("✅");
          reaction.users.remove(user.id);
          setTimeout(() => {
            reaction.message.reactions.cache.get("✅")?.remove();
          }, 5000);
          let oldColors = bestcolors.filter(({ color }) =>
            userroles.includes(color)
          );
          if (
            oldColors &&
            bestcolors.find((obj) => obj.messageID === reaction.message.id)
              .color === oldColors[0]?.color
          ) {
            oldColors.forEach((obj) => {
              guser.roles.remove(obj.color);
            });
          } else if (oldColors) {
            oldColors.forEach((obj) => {
              guser.roles.remove(obj.color);
            });
            guser.roles.add(
              bestcolors.find((obj) => obj.messageID === reaction.message.id)
                .color
            );
          } else {
            guser.roles.add(
              bestcolors.find((obj) => obj.messageID === reaction.message.id)
                .color
            );
          }
        } else {
          reaction.message.react("❌");
          reaction.users.remove(user.id);
          setTimeout(() => {
            reaction.message.reactions.cache.get("❌")?.remove();
          }, 5000);
        }
      });
    });
  }
});

client.login(process.env.DISCORDBOTTOKEN);
