#!/usr/bin/env node
"use strict";

import chalk from "chalk";
import inquirer from "inquirer";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import gradient from "gradient-string";
import chalkAnimation from "chalk-animation";
import figlet from "figlet";
import { createSpinner } from "nanospinner";
import { Console } from "console";
import {
  activityManager,
  pickActivityToEdit,
  pickSheetToEdit,
  sheetManager,
  displayHandler,
  rankingHandler,
  readDB,
  showHighestRanked,
  removeThingHandler,
} from "./backend.js";

const { activities, sheets } = await readDB();

const mainMenu = async function () {
  const change = function (type, list = []) {
    const singleVers = type === "activities" ? "activity" : "sheet";

    return {
      name: "value",
      type: "list",
      message: `What ${singleVers} do you want to change?`,
      choices: list,
    };
  };

  let prompt = await inquirer.prompt({
    name: "main",
    type: "list",
    message: "What do you want to do?",
    choices: ["list activities", "change activities", "change sheets", "quit"],
  });

  let response;
  switch (prompt.main) {
    case "quit":
      console.log(chalk.redBright("Byyye"));
      break;
    case "list activities":
      const result = await displayHandler();
      if (typeof result !== "undefined") {
        console.log(result);
      }

      break;
    case "change activities":
      response = await inquirer.prompt(
        change("activities", [
          `add new activity`,
          `rank activities`,
          `edit existing activity`,
          "delete activity",
          "go back",
          "quit",
        ])
      );
      switch (response.value) {
        case "add new activity":
          console.log(await activityManager());
          break;
        case "edit existing activity":
          console.log(await pickActivityToEdit());
          break;
        case "delete activity":
          console.log(await removeThingHandler("activities"));
          break;
        case "rank activities":
          console.log(await rankingHandler());
          break;
        case "go back":
          mainMenu();
          break;
        case "quit":
          break;
      }
      break;
    case "change sheets":
      response = await inquirer.prompt(
        change("sheets", [
          `add new sheet`,
          `edit existing sheet`,
          `delete sheet`,
          "go back",
          "quit",
        ])
      );
      switch (response.value) {
        case "add new sheet":
          console.log(await sheetManager());
          break;
        case "edit existing sheet":
          console.log(await pickSheetToEdit());
          break;
        case "delete sheet":
          console.log(await removeThingHandler("sheets"));
          break;
        case "go back":
          mainMenu();
          break;
        case "quit":
          break;
      }
      break;
    case "list":
      console.log(displayAll());
  }
};

let argv = yargs(hideBin(process.argv))
  .scriptName("delphea")
  .usage("$0 [command] [options]", "runs the delphea command")
  .command("list [sheet] [options]", "Prints list of items", {
    reverse: {
      alias: "r",
      default: false,
      type: "boolean",
      describe: "Reverses the order of the list(s)",
    },
    nogroup: {
      alias: "g",
      default: false,
      type: "boolean",
      describe: "Doesn't group by names",
    },
  })
  .command("add [options]", "add the activity or sheet", {
    sheet: {
      alias: "s",
      default: false,
      type: "boolean",
      describe: "add sheet",
    },
  })
  .command("remove [options]", "remove the activity or sheet", {
    sheet: {
      alias: "s",
      default: false,
      type: "boolean",
      describe: "add sheet",
    },
  })
  .command("rank <sheet>", "rank the sheet", (yargs) => {
    yargs.positional("sheet", {
      describe: "the sheet to rank",
      type: "string",
      demandOption: true,
    });
  })
  .alias("a", "add")
  .help("h")
  .alias("h", "help").argv;
console.log(argv);

switch (typeof argv.list) {
  case "string":
}
switch (typeof argv.add) {
}
switch (typeof argv.remove) {
}
switch (typeof argv.rank) {
}

export { mainMenu };
