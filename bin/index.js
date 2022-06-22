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
  initDB,
  selectThings,
  displayByRank,
  showHighestRanked,
  removeThingHandler,
} from "./backend.js";

const { activities, sheets } = await readDB();

const mainMenu = async function () {
  const change = function (type) {
    const singleVers = type === activities ? "activity" : "sheet";

    return {
      name: "value",
      type: "list",
      message: "What do you want to change?",
      choices: [
        `add new ${singleVers}`,
        `edit existing ${singleVers}`,
        `delete ${singleVers}`,
        "go back",
        "quit",
      ],
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
      await displayHandler();
      break;
    case "change activities":
      response = await inquirer.prompt(change("activities"));
      switch (response.value) {
        case "add new activity":
          console.log(activityManager());
          break;
        case "edit existing activity":
          console.log(pickActivityToEdit());
          break;
        case "delete activity":
          console.log(removeThingHandler("activities"));
          break;
        case "go back":
          mainMenu();
          break;
        case "quit":
          break;
      }
      break;
    case "change sheets":
      response = await inquirer.prompt(change("activities"));
      switch (response.value) {
        case "add new sheet":
          console.log(sheetManager());
          break;
        case "edit existing sheet":
          console.log(pickSheetToEdit());
          break;
        case "delete sheet":
          console.log(removeThingHandler("sheets"));
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
  .usage("Usage: $0 <command> [options]")
  .command("list", "Prints list of items")
  .option("reverse", {
    alias: "r",
    default: false,
    type: "boolean",
  })
  .command("init", "Initializes (developer)")
  .help("h")
  .alias("h", "help").argv;

switch (argv._[0]) {
  case "list":
    console.log(displaySheet(sheets[1]));
    break;
  case "init":
    console.log(await initDB());
    break;
  case "add":
    console.log(await addEditActivityHandler());
    break;
  case "edit":
    console.log(await editActivityHandler());
    break;
  case "activities":
    console.log({ activities });
    break;
  case "all":
    console.log(displayAll());
    break;
  case "rank":
    console.log(await rankingHandler());
    break;
  case "show-highest":
    console.log(await showHighestRanked());
    break;
  case "open":
    break;
  default:
    await mainMenu();
}
