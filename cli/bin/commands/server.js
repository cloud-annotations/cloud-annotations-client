const { Command } = require("commander");

const command = new Command()
  .command("server")
  .description("TODO: description")
  .action(() => {
    console.log("...");
  });

module.exports = command;
