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

await db.read();

let { activities, tags, sheets } = db.data;

class Activity {
  constructor(id, name, desc = "", color = "#000000", tags = [], sheet = 0) {
    this.id = id;
    this.name = name;
    this.rank = 0;
    //starred is a way to display the item above all others
    this.starred = false;
    this.desc = desc;
    this.color = color;
    this.tags = tags;
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
  constructor(id, name, color = "#000000") {
    this.id = id;
    this.name = name;
    this.color = color;
  }

  get activities() {
    console.log(activities);
    console.log(activities.filter((a) => a.sheet === this.id));
    return activities.filter((a) => a.sheet === this.id);
  }
}
sheets = sheets.map((s) => new Sheet({ ...s }));
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

const displayActivity = function (activity) {
  const sheetColor = sheets.find((s) => s.id === activity.sheet).color;

  let returnStr = `${chalk.hex(sheetColor)(
    activity.rank > 0
      ? chalk.bold("(" + activity.rank + ")")
      : "( " + chalk.italic("unranked") + " )"
  )} ${chalk.hex(activity.color).bold(activity.name)}\n\t${chalk.italic(
    activity.desc
  )}\n\t`;
  let formattedTags = [];
  for (let tagId of activity.tags) {
    let tag = tags.find((t) => t.id === tagId);
    formattedTags.push(`${chalk.bgHex(tag.color).bold(" " + tag.name + " ")}`);
  }

  return returnStr + formattedTags.join(", ");
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

const editActivity = function (id, name, rank, desc, color, tags) {
  let i = activities.findIndex((p) => p.id == id);
  activities[i].name = name;
  activities[i].rank = rank;
  activities[i].desc = desc;
  activities[i].color = color;
  activities[i].tags = tags;
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

const rankingLogic = async function (activitiesArr) {
  let eliminated;
  let winners = [];

  if (activitiesArr.length > 5) {
    let chunkedActivities = chunk(activitiesArr, 5, 2);
    for (let chunk of chunkedActivities) {
      let result = await rankingPrompt(chunk);
      winners.push(...result);
    }
  } else {
    winners = await rankingPrompt(activitiesArr);
  }

  if (winners.length === 1) {
    activities.find((p) => p.id === winners[0].id).rank =
      Math.max(...activities.map((p) => p.rank)) + 1;
  } else {
    await rankingLogic(winners);
  }

  eliminated = activitiesArr.filter((x) => !winners.includes(x));

  // console.log(eliminated);

  if (eliminated.length >= 2) {
    await rankingLogic(eliminated);
  } else {
    eliminated[0].rank = Math.max(...activitiesArr.map((p) => p.rank)) + 1;
  }
};

const rankingPrompt = async function (activitiesArr) {
  const pickLimit = activitiesArr.length - 1;

  let formattedList = activitiesArr.map((p) => {
    return { name: p.name, value: p };
  });

  let prompt = await inquirer.prompt({
    name: "value",
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
  //console.log(await prompt.value);
  return await prompt.value;
};

const rankingHandler = async function (sheet, tags = null) {
  let selectedActivities = activities.filter((a) => a.sheet === sheet.id);
  if (tags != null) {
    selectedActivities = selectedActivities.filter((sp) =>
      sp.tags.some((t) => tags.includes(t))
    );
  }
  selectedActivities.sort(() => Math.random() - 0.5).slice(0, 5);

  for (let activity of selectedActivities) {
    activity.rank = 0;
  }

  await rankingLogic(selectedActivities);
  console.log(chalk.bgRedBright("finished"));
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
        name: "tags",
        type: "checkbox",
        message: "Tags?",
        choices: tagListBuilder(),
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
      activityPrompt.tags,
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
  db.data.tags = [
    new Tag(1, "Emulation", "#AA2FA6"),
    new Tag(2, "PC", "#0244EB"),
    new Tag(3, "Modern Console", "#D4152A"),
    new Tag(4, "RPG", "#3b5998"),
  ];
  db.data.sheets = [
    new Sheet(0, "Default", "#000000"),
    new Sheet(1, "Games", "#C069B4"),
    new Sheet(2, "Projects", "#E0AF97"),
    new Sheet(3, "Books", "#918280"),
  ];
  console.log({ activities, tags, sheets });
  await db.write();
};

const readDB = async function () {
  await db.read();
  const { activities, tags, sheets } = db.data;
  return { activities, tags, sheets };
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
};
