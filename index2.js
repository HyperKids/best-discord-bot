require("dotenv").config();
const Discord = require("discord.js");
const client = new Discord.Client();

const prefix = "^";

client.on("ready", () => {
  client.user.setActivity("the BEST server!", { type: "WATCHING" });
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", (msg) => {
  if (msg.author.id != "720120584155168771" && msg.type == "DEFAULT") {
    if (msg.content.substring(0, 1) == prefix) {
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
          case "team":
            if (isCaptain || isPresident) {
              const teamroles = [
                { name: "overwatch", id: "756983144900591627" },
                { name: "dota", id: "779479223416389653" },
                { name: "ultimate", id: "779479212222054486" },
                { name: "hearthstone", id: "779479450412122193" },
                { name: "siege", id: "759829367311433800" },
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
                console.log(role);
                let membersWithRole = msg.guild.members.cache
                  .filter((member) => {
                    return member.roles.cache.find("id", roleid);
                  })
                  .map((member) => {
                    return member.user.username;
                  });
                console.log(membersWithRole);
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
        }
      });
    }
  }
  if (msg.content.toLowerCase().includes("<@720120584155168771>")) {
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

client.login(process.env.DISCORDBOTTOKEN);
