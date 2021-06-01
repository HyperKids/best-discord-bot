class CountingGame {
  constructor(configObj, client) {
    this.client = client;
    this.hardcore = configObj.hardcore ? true : false;
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
            "Last Counting Game Number: " + this.counter + " " + this.channel.name
          );
        }
      }
    });
  }
  newNumber() {}

  isValidNumber(num) {
    // checks if num is a valid integer
    var regnum = /^\d+$/;
    var regnoleadingzeros = /^(0|[1-9][0-9]*)$/;
    return !isNaN(num) && regnum.test(num) && regnoleadingzeros.test(num);
  }
}

module.exports.CountingGame = CountingGame;
