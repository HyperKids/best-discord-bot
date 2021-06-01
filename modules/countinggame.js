class CountingGame {
  constructor(configObj, client) {
    this.client = client;
    this.hardcore = configObj.hardcore ? true : false;
    this.dunceRoleID = configObj.dunceRoleID;
    client.channels.fetch(configObj.id).then((res) => {
      this.channel = res;
      this.init();
    });
  }
  init() {
    this.channel.messages.fetch({ limit: 2 }).then((m) => {
      // [...m] turns the map into an array, [x] grabs the xth element, [1] gets the message element from the spread as the messageID is index 0
      if (!this.isValidNumber(parseInt([...m][0][1].content.split(" ")[0]))) {
        [...m][0][1].delete({ timeout: 5000 }).then(() => this.init());
      } else {
        var ccounter = parseInt([...m][0][1].content.split(" ")[0]);
        var lcounter = parseInt([...m][1][1].content.split(" ")[0]);
        if (parseInt(ccounter) != parseInt(lcounter) + 1) {
          [...m][0][1].delete({ timeout: 5000 }).then(() => this.init());
        } else {
          this.counter = parseInt([...m][0][1].content);
          this.lastUser = [...m][0][1].author.id;
          console.log(
            "Last Counting Game Number: " +
              this.counter +
              " " +
              this.channel.name
          );
        }
      }
    });
  }
  newMessage(msg) {
    if (msg.type !== "DEFAULT") return msg.delete();
    var inputNum = parseInt(msg.content.split(" ")[0]);
    if (msg.content.indexOf("\n") !== -1) {
      msg.delete();
      msg.author.send(
        "Please do not have multiple lines in your message. Your deleted message: `" +
          msg.content +
          "`"
      );
    } else if (msg.content.length > 255) {
      msg.delete();
      msg.author.send(
        "Messages need to be less than 256 characters. Your deleted message: `" +
          sg.content +
          "`"
      );
    } else if (!this.isValidNumber(inputNum)) {
      msg.delete();
      msg.author.send(
        "Make sure the first word of your message is a number in " +
          msg.channel.name +
          "! Your deleted message: `" +
          msg.content +
          "`"
      );
    } else if (msg.author.id == this.lastUser) {
      msg.delete();
      msg.author.send(
        "Please do not send consecutive messages in " +
          msg.channel.name +
          ". Your deleted message: `" +
          msg.content +
          "`"
      );
    } else if (!this.isSequentialNumber(inputNum) && this.hardcore) {
      this.channel.messages.fetch({ limit: 2 }).then((m) => {
        var ccounter = parseInt(msg.content.split(" ")[0]);
        var lcounter = parseInt([...m][1][1].content.split(" ")[0]);
        msg.channel.send(
          "0 <@" +
            msg.author.id +
            "> broke the " +
            lcounter +
            " long chain by typing " +
            ccounter +
            "! Starting from the top."
        );
        msg.channel.guild.members.fetch(msg.author).then((GuildMember) => {
          GuildMember.roles.add(this.dunceRoleID);
          msg.author.send(
            "Oops! You broke the chain in " +
              msg.channel.name +
              ". You've been given a temporary rank that will go away in 24 hours."
          );
        });
      });
    } else if (!this.isSequentialNumber(inputNum)) {
      msg.delete();
    } else {
      this.lastUser = msg.author.id;
      this.counter = inputNum;
    }
  }

  isSequentialNumber(num) {
    return num == this.counter + 1 ? true : false;
  }

  isValidNumber(num) {
    // checks if num is a valid integer
    var regnum = /^\d+$/;
    var regnoleadingzeros = /^(0|[1-9][0-9]*)$/;
    return !isNaN(num) && regnum.test(num) && regnoleadingzeros.test(num);
  }
}

module.exports.CountingGame = CountingGame;
