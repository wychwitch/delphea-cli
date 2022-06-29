#!/usr/bin/env node
"use strict";

import chalk from "chalk";
import inquirer from "inquirer";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
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
  displaySheet,
  getSheetByName,
} from "./backend.js";

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
  .command("$0 [command] [option]", "Runs the command", (yargs) => {
    yargs
      .positional("command", {
        describe: "Commands to run.",
        choices: [
          "list",
          "l",
          "add",
          "a",
          "delete",
          "d",
          "edit",
          "e",
          "rank",
          "r",
          "top",
          "t",
        ],
      })
      .positional("option", {
        describe: "Option for the [command]",
        type: "string",
      });
  })
  .option("reverse", {
    alias: "r",
    boolean: true,
    default: false,
    describe: "Reverses list",
  })
  .option("sheet", {
    alias: "s",
    boolean: true,
    default: false,
    describe: "Makes command process on sheets",
  })
  .option("nogroup", {
    alias: "g",
    boolean: true,
    default: false,
    describe: "Disables grouping",
  })
  .help("h").argv;

console.log(argv);

switch (argv.command) {
  case "l":
  case "list":
    if (argv.option) {
      console.log(await displaySheet(await getSheetByName(argv.option)));
    } else {
      console.log(await displayHandler());
    }
    break;
  case "a":
  case "add":
    if (argv.sheet) {
      console.log(await sheetManager());
    } else {
      console.log(await activityManager());
    }
    break;
  case "d":
  case "delete":
    const delType = argv.sheet ? "sheets" : "activities";
    console.log(await removeThingHandler(delType));
    break;
  case "e":
  case "edit":
    console.log(
      argv.sheet ? await pickSheetToEdit() : await pickActivityToEdit()
    );
    break;
  case "r":
  case "rank":
    console.log(
      argv.option
        ? await rankingHandler(getSheetByName(argv.option))
        : await rankingHandler()
    );
  case "t":
  case "top":
    console.log(await showHighestRanked(5));
    break;
}

export { mainMenu };
