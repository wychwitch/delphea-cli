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
  constructor(id, name, desc = "", color = "#000000", tags = []) {
    this.id = id;
    this.name = name;
    this.rank = 0;
    //starred is a way to display the item above all others
    this.starred = false;
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
  let returnStr = `${chalk.hex(page.color).bold(page.name)} \t (${
    page.rank > -1 ? chalk.bold(page.rank) : chalk.italic("unranked")
  })
      ${chalk.italic(page.desc)}
      `;
  let formattedTags = [];
  for (let tagId of page.tags) {
    const tag = tags.find((t) => (t.id = tagId));
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

const addPage = async function (page) {
  pages.push(page);
  await db.write();
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
        addPage(newPage);
        console.log(chalk.redBright("pushed new item!"));
        whileLoop = false;
        break;
      case "No - Redo":
        console.log(chalk.redBright("ok redoing"));
    }
  }
};

const pickerLogic = async function (pagesArr) {
  const pickLimit = pagesArr.length - 1;
  let eliminated;
  let formattedList = pagesArr.map((p) => {
    return { name: p.name, value: p };
  });

  let prompt = await inquirer.prompt({
    name: "main",
    type: "checkbox",
    message: "Select your favorites.",
    choices: formattedList,
    async validate(value) {
      if (value.length <= pickLimit) {
        return true;
      }
      return `Please select less than ${pickLimit}`;
    },
  });

  if (prompt.value.length == 1) {
    prompt.value.rank = Math.max(...pages.map((p) => p.rank)) + 1;
  } else {
    pickerLogic(prompt.value);
  }
  eliminated = pagesArr.filter((x) => !prompt.value.includes(x));
  if (eliminated >= 2) {
    pickerLogic(eliminated);
  } else {
    prompt.value.rank = Math.max(...pages.map((p) => p.rank)) + 1;
  }
};

const picker = function (restart = false, tags = null) {
  let whileLoop = true;
  let selectedPages = [...pages];
  if (tags != null) {
    selectedPages = selectedPages.filter((sp) =>
      sp.tags.some((t) => tags.includes(t))
    );
  }
  selectedPages.sort(() => Math.random() - 0.5).slice(0, 5);

  if (restart) {
    for (let page of selectedPages) {
      page.rank = -1;
    }
  }

  while (whileLoop) {
    let batch1 = selectedPages.slice();
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
    db.data.pages = [
      new Page(1, "Final Fantasy VI", "", "#1da1f2", [1, 2, 4]),
      new Page(2, "Undertale", "", "#8ac76b", [2, 4]),
      new Page(3, "Persona 5 Royal", "", "#c76b6b", [3, 4]),
      new Page(4, "Mario", "", "#8ac76b", [2, 4]),
      new Page(5, "Zelda", "", "#c76b6b", [3, 4]),
      new Page(6, "Pikmin", "", "#8ac76b", [2, 4]),
      new Page(7, "Kirby", "", "#c76b6b", [3, 4]),
      new Page(8, "Deltarune", "", "#c76b6b", [3, 4]),
      new Page(9, "Baten Kaitos", "", "#8ac76b", [2, 4]),
      new Page(10, "13 sentinels", "", "#c76b6b", [3, 4]),
    ];
    db.data.tags = [
      new Tag(1, "Emulation", "#AA2FA6"),
      new Tag(2, "PC", "#0244EB"),
      new Tag(3, "Modern Console", "#D4152A"),
      new Tag(4, "RPG", "#3b5998"),
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
