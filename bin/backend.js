"use strict";
import chalk from "chalk";
import inquirer from "inquirer";
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

class Activity {
  constructor(id, name, desc = "", color = "#000000", sheet = 0) {
    this.id = id;
    this.name = name;
    this.rank = 0;
    //starred is a way to display the item above all others
    this.starred = false;
    this.desc = desc;
    this.color = color;
    this.sheet = sheet;
  }
}

class Tag {
  constructor(id, name, color) {
    this.id = id;
    this.name = name;
    this.color = color;
  }
}

class Sheet {
  constructor(possibleId, name, color = "#000000") {
    if (typeof possibleId !== "number") {
      let { id, name, color } = possibleId;
      this.id = id;
      this.name = name;
      this.color = color;
    } else {
      this.id = possibleId;
      this.name = name;
      this.color = color;
    }
  }

  get activities() {
    let { activities } = db.data;
    console.log("sending activities!");

    return activities.filter((a) => a.sheet === this.id);
  }
}

const selectThings = async function (entityType, options = undefined) {
  let { activities, sheets } = await readDB();
  let list = [];
  let validationFunc = () => true;
  switch (entityType) {
    case "activities":
      list = activities;
      if (options.sheet) {
        list = options.sheet.activities;
      }
      break;
    case "sheets":
      list = await sheets;
      break;
    case "custom":
      list = options.choices;
      break;
  }

  console.log(sheets);
  console.log(list);
  list = list.map((l) => {
    return {
      name: l.name,
      value: l,
    };
  });

  console.log(list);

  let promptType = "checkbox";
  if (options.single) {
    promptType = "list";
  }

  if (options.limit) {
    validationFunc = async function (value) {
      if (value.length <= options.limit && value.length > 0) {
        return true;
      } else if (!(value.length <= options.limit)) {
        return `Please select ${options.limit} or less.`;
      } else {
        return "Please select at least one choice.";
      }
    };
  }

  let prompt = await inquirer.prompt({
    name: "value",
    type: promptType,
    message: `${options.message}`,
    choices: list,
    async validate(value) {
      return validationFunc(value);
    },
  });
  return prompt.value;
};

//from https://stackoverflow.com/questions/57908133/splitting-an-array-up-into-chunks-of-a-given-size-with-a-minimum-chunk-size
const chunk = (arr, size, min) => {
  const chunks = arr.reduce(
    (chunks, el, i) =>
      (i % size ? chunks[chunks.length - 1].push(el) : chunks.push([el])) &&
      chunks,
    []
  );
  const l = chunks.length;

  if (chunks[l - 1].length < min) chunks[l - 2].push(...chunks.pop());
  return chunks;
};

const displayActivity = function (sheet, activity) {
  const sheetColor = sheet.color;

  let returnStr = `${chalk.hex(sheetColor)(
    activity.rank > 0
      ? chalk.bold("(" + activity.rank + ")")
      : "( " + chalk.italic("unranked") + " )"
  )} ${chalk.hex(activity.color).bold(activity.name)}\n\t${chalk.italic(
    activity.desc
  )}\n`;

  return returnStr;
};

const displaySheet = function (sheet, reverse = false) {
  const unsortedActs = activities.filter((a) => a.sheet === sheet.id);
  const sheetActivities = unsortedActs.sort((a, b) => {
    if (reverse) {
      return b.rank - a.rank;
    }
    return a.rank - b.rank;
  });

  let returnStr = `\n${chalk.hex(sheet.color).bold(
    figlet.textSync(sheet.name, {
      font: "big",
      horizontalLayout: "default",
      verticalLayout: "default",
    })
  )}\n`;
  for (let activity of sheetActivities) {
    returnStr += `\n${displayActivity(activity)}`;
  }
  return returnStr;
};

const displayAll = function (grouped = true, reverse = false) {
  let returnStr = "";
  if (grouped) {
    for (let sheet of sheets) {
      returnStr += displaySheet(sheet, reverse);
    }
  } else {
    for (let activity of activities) {
      returnStr += displayActivity(activity);
    }
  }
  return returnStr;
};

const addActivity = async function (activity) {
  activities.push(activity);
  await db.write();
};

const editActivity = async function (id, name, rank, desc, color) {
  await db.read();

  let { activities, sheets } = db.data;
  sheets = sheets.map((s) => new Sheet(s));
  let i = activities.findIndex((p) => p.id == id);
  activities[i].name = name;
  activities[i].rank = rank;
  activities[i].desc = desc;
  activities[i].color = color;
  db.write();
};

const editActivityHandler = async function () {
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

const sheetListBuilder = function () {
  let choices = [];
  for (let sheet of sheets) {
    choices.push({
      name: ` ${chalk.bgHex(sheet.color)(sheet.name)} `,
      value: sheet.id,
    });
  }
  return choices;
};

const displayByRank = async function (sheet, rank) {
  console.log(sheet.activities.find((a) => a.rank == rank));
  return displayActivity(
    sheet,
    sheet.activities.find((a) => a.rank == rank)
  );
};

const returnRank = function (activitiesArr, max = true, repeat = 1) {
  console.log("++++++++++++++++++++++++++");
  const ranks = activitiesArr.filter((a) => a.rank !== 0).map((a) => a.rank);
  console.log(ranks);
  let returnArr = [];

  for (let i = 0; i < repeat; i++) {
    if (max) {
      returnArr.push(Math.max(...ranks) - i);
    } else {
      returnArr.push(Math.min(...ranks) + i);
    }
  }
  return returnArr;
};

const rankingProcess = async function (activitiesArr, sheet) {
  let eliminated;
  let winners = [];

  if (activitiesArr.length > 5) {
    let chunkedActivities = chunk(activitiesArr, 5, 2);
    for (let chunk of chunkedActivities) {
      let result = await selectThings("custom", {
        choices: chunk,
        limit: chunk.length - 1,
        message: "Select your favorites.",
      });
      winners.push(...result);
    }
  } else {
    winners = await await selectThings("custom", {
      choices: activitiesArr,
      limit: activitiesArr.length - 1,
      message: "Select your favorites.",
    });
  }

  if (winners.length === 1) {
    //activities.find((p) => p.id === winners[0].id).rank =
    winners[0].rank = returnRank(sheet.activities) + 1;
  } else {
    await rankingProcess(winners, sheet);
  }

  eliminated = activitiesArr.filter((x) => !winners.includes(x));

  if (eliminated.length >= 2) {
    await rankingProcess(eliminated, sheet);
  } else {
    eliminated[0].rank = returnRank(sheet.activities) + 1;
  }
};

const rankingHandler = async function (sheet) {
  console.log({ sheet });
  if (sheet === undefined) {
    sheet = await selectThings("sheets", {
      single: true,
      message: "Please select sheet to rank.",
    });
  }
  console.log({ sheet });

  let selectedActivities = sheet.activities;

  selectedActivities.sort(() => Math.random() - 0.5).slice(0, 5);

  for (let activity of selectedActivities) {
    activity.rank = 0;
  }

  await rankingProcess(selectedActivities, sheet);
  console.log(db.data.activities);

  await db.write();
  return "Picker picked!!";
};

const addActivityHandler = async function () {
  let whileLoop = true;
  const id = Math.max(...activities.map((p) => p.id));
  while (whileLoop) {
    let activityPrompt = await inquirer.prompt([
      {
        name: "name",
        type: "input",
        message: "Name?",
        async validate(value) {
          if (value.length > 0) {
            return true;
          }
          return `Please enter a name.`;
        },
      },
      {
        name: "desc",
        type: "input",
        message: "Description?",
      },
      {
        name: "color",
        type: "input",
        message: "Color?",
        default: "#FFFFFF",
      },
      {
        name: "sheet",
        type: "list",
        message: "Sheet?",
        choices: sheetListBuilder(),
      },
      {
        name: "starred",
        type: "confirm",
        message: "Star?",
        default: false,
      },
    ]);

    let newActivity = new Activity(
      id,
      activityPrompt.name,
      activityPrompt.desc,
      activityPrompt.color,
      activityPrompt.sheet
    );

    let prompt = await inquirer.prompt({
      name: "value",
      type: "list",
      message: `Is this correct?
        ${displayActivity(newActivity)}
      `,
      choices: ["Yes", "No - Redo", "No - Go Back"],
    });
    switch (prompt.value) {
      case "No - Go Back":
        console.log(chalk.redBright("Byyye"));
        whileLoop = false;
        break;
      case "Yes":
        addActivity(newActivity);
        console.log(chalk.redBright("pushed new item!"));
        whileLoop = false;
        break;
      case "No - Redo":
        console.log(chalk.redBright("ok redoing"));
    }
  }
};

const initDB = async function () {
  db.data.activities = [
    new Activity(1, "Final Fantasy VI", "", "#1da1f2", [1, 2, 4], 1),
    new Activity(2, "Undertale", "", "#8ac76b", [2, 4], 1),
    new Activity(3, "Persona 5 Royal", "", "#c76b6b", [3, 4], 1),
    new Activity(4, "Mario", "", "#8ac76b", [2, 4], 1),
    new Activity(5, "Zelda", "", "#c76b6b", [3, 4], 1),
    new Activity(6, "Pikmin", "", "#8ac76b", [2, 4], 1),
    new Activity(7, "Kirby", "", "#c76b6b", [3, 4], 1),
    new Activity(8, "Deltarune", "", "#c76b6b", [3, 4], 1),
    new Activity(9, "Baten Kaitos", "", "#8ac76b", [2, 4], 1),
    new Activity(10, "13 sentinels", "", "#c76b6b", [3, 4], 1),

    new Activity(1, "Finish Delpeha", "", "#c76b6b", [], 2),
    new Activity(2, "FInish Udemy", "", "#c76b6b", [3, 4], 2),
    new Activity(3, "Write", "", "#8ac76b", [2, 4], 2),
    new Activity(4, "Bookbind", "", "#c76b6b", [3, 4], 2),

    new Activity(7, "Nona the Ninth", "", "#c76b6b", [3, 4], 3),
    new Activity(8, "Dune", "", "#c76b6b", [3, 4], 3),
    new Activity(9, "Berserk", "", "#8ac76b", [2, 4], 3),
    new Activity(10, "Ella Minnow Pea", "", "#c76b6b", [3, 4], 3),
  ];
  db.data.sheets = [
    new Sheet(0, "Default", "#000000"),
    new Sheet(1, "Games", "#C069B4"),
    new Sheet(2, "Projects", "#E0AF97"),
    new Sheet(3, "Books", "#918280"),
  ];
  await db.write();
};

const readDB = async function () {
  await db.read();
  let { activities, sheets } = db.data;
  sheets = sheets.map((s) => new Sheet(s));
  return { activities, sheets };
};

const showHighest = async function () {
  let returnStr = "";
  const sheet = await selectThings("sheets", {
    message: "Select sheet",
    single: true,
  });
  const rank = returnRank(sheet.activities, false, 3);
  console.log({ rank });

  for (let rnk of rank) {
    returnStr += await displayByRank(sheet, rnk);
  }

  return returnStr;
};

const addSheetHandler = function () {};

const addTagHandler = function () {};
const displayHandler = function () {};

export {
  addActivityHandler,
  addSheetHandler,
  addTagHandler,
  displayHandler,
  rankingHandler,
  readDB,
  initDB,
  selectThings,
  displayByRank,
  showHighest,
};
