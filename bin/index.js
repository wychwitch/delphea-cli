#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import gradient from "gradient-string";
import chalkAnimation from "chalk-animation";
import figlet from "figlet";
import { createSpinner } from "nanospinner";
import { join, dirname } from "path";
import { Low, JSONFile } from "lowdb";
import { fileURLToPath } from "url";
import { Console } from "console";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use JSON file for storage
const file = join(__dirname, "db.json");
const adapter = new JSONFile(file);
const db = new Low(adapter);

await db.read();

db.data ||= { pages: [], tags: [] };

const { pages, tags } = db.data;

class Page {
  constructor(id, name, rank, desc, color, tags) {
    this.id = id;
    this.name = name;
    this.rank = rank;
    this.desc = desc;
    this.color = color;
    this.tags = tags;
  }
}

class Tag {
  constructor(id, name, color) {
    this.id = id;
    this.name = name;
    this.color = color;
  }
}

const displayPage = function (page, index = -1) {
  let returnStr = `${chalk.hex(page.color).bold(page.name)} \t (${chalk.bold(
    index
  )})
      ${chalk.italic(page.desc)}
      `;
  let formattedTags = [];
  for (let tagId of page.tags) {
    const tag = tags[tagId - 1];
    formattedTags.push(`${chalk.bgHex(tag.color).bold(" " + tag.name + " ")}`);
  }

  return returnStr + formattedTags.join(", ");
};

const displayAll = function (reverse = false) {
  const sorted = pages.sort((a, b) => {
    if (reverse) {
      return b.rank - a.rank;
    }
    return a.rank - b.rank;
  });
  let i = 1;
  let y = 1;
  let returnStr = "";
  if (reverse) {
    i = pages.length;
    y = -1;
  }
  for (let page of sorted) {
    returnStr += `\n${displayPage(page, i)}`;
    i += y;
  }
  return returnStr;
};

const addPage = function (id, name, rank, desc, color, tags) {
  pages.push(new Page(id, name, rank, desc, color, tags));
  db.write();
};

const editPage = function (id, name, rank, desc, color, tags) {
  let i = pages.findIndex((p) => p.id == id);
  pages[i].name = name;
  pages[i].rank = rank;
  pages[i].desc = desc;
  pages[i].color = color;
  pages[i].tags = tags;
  db.write();
};

const editPageHandler = async function () {
  let name = await inquirer.prompt({
    name: "",
    type: "list",
    message: "What do you want to do?",
    choices: ["list", "quit"],
  });

  switch (prompt.main) {
    case "quit":
      console.log(chalk.redBright("Byyye"));
      whileLoop = false;
      break;
    case "list":
      console.log(displayAll());
  }
};

const tagListBuilder = function () {
  let choices = [];
  for (let tag of tags) {
    choices.push({
      name: ` ${chalk.bgHex(tag.color)(tag.name)} `,
      value: tag.id,
    });
  }
  return choices;
};

const addPageHandler = async function () {
  let whileLoop = true;
  const id = Math.max(...pages.map((p) => p.id));
  while (whileLoop) {
    let nameP = await inquirer.prompt({
      name: "value",
      type: "input",
      message: "Name?",
    });
    let rankP = await inquirer.prompt({
      name: "value",
      type: "number",
      message: "Rank?",
    });
    let descP = await inquirer.prompt({
      name: "value",
      type: "input",
      message: "Description?",
    });
    let colorP = await inquirer.prompt({
      name: "value",
      type: "input",
      message: "Color?",
    });
    let tagsP = await inquirer.prompt({
      name: "value",
      type: "checkbox",
      message: "Tags?",
      choices: tagListBuilder(),
    });
    let newPage = new Page(
      id,
      nameP.value,
      rankP.value,
      descP.value,
      colorP.value,
      tagsP.value
    );

    let prompt = await inquirer.prompt({
      name: "value",
      type: "list",
      message: `Is this correct?
        ${displayPage(newPage)}
      `,
      choices: ["Yes", "No - Redo", "No - Go Back"],
    });
    switch (prompt.value) {
      case "No - Go Back":
        console.log(chalk.redBright("Byyye"));
        whileLoop = false;
        break;
      case "Yes":
        pages.push(newPage);
        db.write();
        console.log(chalk.redBright("YES pushed new item"));
        whileLoop = false;
        break;
      case "No - Redo":
        console.log(chalk.redBright("ok redoing"));
    }
  }
};

const picker = function (tags = null) {
  let whileLoop = true;
  let selectedPages = pages;
  if (tags != null) {
    selectedPages = selectedPages.filter((sp) =>
      sp.tags.some((t) => tags.includes(t))
    );
  }

  while (whileLoop) {
    console.log("o");
    break;
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

const display = async function () {
  let whileLoop = true;
  while (whileLoop) {
    let prompt = await inquirer.prompt({
      name: "main",
      type: "list",
      message: "What do you want to do?",
      choices: ["list", "add new page", "quit"],
    });

    switch (prompt.main) {
      case "quit":
        console.log(chalk.redBright("Byyye"));
        whileLoop = false;
        break;
      case "add new page":
        addPageHandler();
        whileLoop = false;
        break;
      case "list":
        console.log(displayAll());
    }
  }
};

switch (argv._[0]) {
  case "list":
    if (argv.r) {
      console.log(displayAll(true));
    } else {
      console.log(displayAll());
    }
    break;
  case "init":
    db.data.pages = [test, best, rest];
    db.data.tags = [
      new Tag(1, "Project", "#AA2FA6"),
      new Tag(2, "Game", "#0244EB"),
      new Tag(3, "Study", "#D4152A"),
    ];
    console.log(pages);
    console.log(tags);
    await db.write();
    break;
  case "pages":
    console.log({ pages });
    console.log(pages[0].tags.map((t) => tags[t].name));
    break;
  case "open":
    break;
  default:
    await display();
}

// displayList();

// console.log(chalk.italic(prompt.prompt));
