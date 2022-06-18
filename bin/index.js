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
  addActivityHandler,
  addSheetHandler,
  addTagHandler,
  displayHandler,
  rankingHandler,
  readDB,
  initDB,
} from "./backend.js";

const { activities, tags, sheets } = await readDB();

const mainMenu = async function () {
  let whileLoop = true;
  while (whileLoop) {
    let prompt = await inquirer.prompt({
      name: "main",
      type: "list",
      message: "What do you want to do?",
      choices: [
        "list",
        "add new activity",
        "add new sheet",
        "add new tag",
        "quit",
      ],
    });

    switch (prompt.main) {
      case "quit":
        console.log(chalk.redBright("Byyye"));
        whileLoop = false;
        break;
      case "add new activity":
        addActivityHandler();
        whileLoop = false;
        break;
      case "add new sheet":
        addSheetHandler();
        whileLoop = false;
        break;
      case "add new tag":
        addTagHandler();
        whileLoop = false;
        break;
      case "list":
        console.log(displayAll());
    }
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
    break;
  case "activities":
    console.log({ activities });
    console.log(activities[0].tags.map((t) => tags[t].name));
    break;
  case "all":
    console.log(displayAll());
    break;
  case "rank":
    console.log(await rankingHandler(sheets[1]));
  case "open":
    break;
  default:
    await mainMenu();
}
