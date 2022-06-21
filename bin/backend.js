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
  constructor(possibleId, name, desc = "", color = "#000000", sheetId = 0) {
    if (typeof possibleId !== "number") {
      let { id, name, desc, color, sheetId } = possibleId;
      this.id = id;
      this.name = name;
      this.rank = 0;
      //starred is a way to display the item above all others
      this.starred = false;
      this.desc = desc;
      this.color = color;
      this.sheetId = sheetId;
    } else {
      this.id = possibleId;
      this.name = name;
      this.rank = 0;
      //starred is a way to display the item above all others
      this.starred = false;
      this.desc = desc;
      this.color = color;
      this.sheetId = sheetId;
    }
  }
  async getSheet() {
    const { sheets } = await readDB();
    return sheets.find((s) => s.id === this.sheetId);
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

  async getActivities() {
    let { activities } = await readDB();
    console.log({ activities });
    console.log(this.name, ": sending activities!");

    return activities.filter((a) => a.sheetId === this.id);
  }
}

const selectThings = async function (entityType, options = undefined) {
  let { activities, sheets } = await readDB();
  let list = [];
  let validationFunc = () => true;
  switch (entityType) {
    case "activities":
      list = activities;
      if (await options.sheetId) {
        list = await options.getSheet().activities;
      }
      break;
    case "sheets":
      list = await sheets;
      break;
    case "custom":
      list = options.choices;
      break;
  }

  console.log();
  console.log(options);
  list = list.map((l) => {
    return {
      name: l.name,
      value: l,
    };
  });

  console.log(list);

  let promptType = "checkbox";
  if (options.single === true) {
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

const displayActivity = async function (activity) {
  console.log(`activity: ${activity}`);
  console.log(`activity: ${await activity.getSheet()}`);
  const sheet = await activity.getSheet();
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
  const unsortedActs = sheet.activities.filter((a) => a.sheetId === sheet.id);
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

const addEditActivity = async function (activity, id = undefined) {
  const { activities } = await db.data;
  if (id !== undefined) {
    console.log("id isnot  undefined");
    const i = activities.findIndex((a) => a.id === id);
    console.log("found activity", activities[i]);
    console.log("passed activity", activity);
    activity.rank = activities[i].rank;
    activities[i] = activity;
  } else {
    console.log("id is undefined");
    activities.push(activity);
  }
  console.log(activity);
  await db.write();
};

const editActivityHandler = async function () {
  const activity = await selectThings("activities", {
    message: "Select activity to edit",
    single: true,
  });
  console.log("returned Activity", activity);
  return await addEditActivityHandler(activity);
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

const returnNextId = async function () {
  const { activities } = await readDB();
  console.log("activities");
  console.log("++++++nextid++++++++++++++++++++");
  const ids = activities.map((a) => a.id);

  console.log("ids", ids);

  return Math.max(...ids) + 1;
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

  await db.write();
  return "Picker picked!!";
};

const addEditActivityHandler = async function (originalActivity = undefined) {
  let activityPrompt = await inquirer.prompt([
    {
      name: "name",
      type: "input",
      message: "Name?",
      default: originalActivity?.name ? originalActivity.name : "",
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
      default: originalActivity?.desc ? originalActivity.desc : "",
    },
    {
      name: "color",
      type: "input",
      message: "Color?",
      default: originalActivity?.color ? originalActivity.color : "#FFFFFF",
    },
    {
      name: "starred",
      type: "confirm",
      message: "Star?",
      default: originalActivity?.starred ? originalActivity.starred : false,
    },
  ]);

  let selectedSheet = await selectThings("sheets", {
    message: "Select a sheet to add the activity to",
    default: originalActivity?.getSheet()
      ? originalActivity.getSheet()
      : undefined,
    single: true,
  });
  console.log("activity prompt", activityPrompt);

  activityPrompt.id = originalActivity?.id
    ? originalActivity.id
    : returnNextId(await selectedSheet.getActivities());

  let newActivity = new Activity(
    await activityPrompt.id,
    await activityPrompt.name,
    await activityPrompt.desc,
    await activityPrompt.color,
    await selectedSheet.id
  );

  console.log("12", newActivity);

  let prompt = await inquirer.prompt({
    name: "value",
    type: "list",
    message: `Is this correct?
        ${await displayActivity(newActivity)}
      `,
    choices: ["Yes", "No - Redo", "No - Go Back"],
  });
  switch (prompt.value) {
    case "No - Go Back":
      return chalk.redBright("Byyye");
    case "Yes":
      if (originalActivity) {
        await addEditActivity(newActivity, newActivity.id);
      } else {
        await addEditActivity(newActivity);
      }
      return chalk.redBright("pushed new item!");
    case "No - Redo":
      console.log(chalk.redBright("ok redoing"));
      addEditActivityHandler(originalActivity);
  }
};

const initDB = async function () {
  db.data.activities = [
    new Activity(1, "Final Fantasy VI", "", "#1da1f2", 1),
    new Activity(2, "Undertale", "", "#8ac76b", 1),
    new Activity(3, "Persona 5 Royal", "", "#c76b6b", 1),
    new Activity(4, "Mario", "", "#8ac76b", 1),
    new Activity(5, "Zelda", "", "#c76b6b", 1),
    new Activity(6, "Pikmin", "", "#8ac76b", 1),
    new Activity(7, "Kirby", "", "#c76b6b", 1),
    new Activity(8, "Deltarune", "", "#c76b6b", 1),
    new Activity(9, "Baten Kaitos", "", "#8ac76b", 1),
    new Activity(10, "13 sentinels", "", "#c76b6b", 1),

    new Activity(11, "Finish Delpeha", "", "#c76b6b", 2),
    new Activity(12, "FInish Udemy", "", "#c76b6b", 2),
    new Activity(13, "Write", "", "#8ac76b", 2),
    new Activity(14, "Bookbind", "", "#c76b6b", 2),

    new Activity(15, "Nona the Ninth", "", "#c76b6b", 3),
    new Activity(16, "Dune", "", "#c76b6b", 3),
    new Activity(17, "Berserk", "", "#8ac76b", 3),
    new Activity(18, "Ella Minnow Pea", "", "#c76b6b", 3),
  ];
  db.data.sheets = [
    new Sheet(0, "Default", "#000000"),
    new Sheet(1, "Games", "#C069B4"),
    new Sheet(2, "Projects", "#E0AF97"),
    new Sheet(3, "Books", "#918280"),
  ];
  await db.write();
  return "initialized db";
};

const readDB = async function () {
  await db.read();
  let { activities, sheets } = db.data;
  sheets = sheets.map((s) => new Sheet(s));
  activities = activities.map((a) => new Activity(a));
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
  addEditActivityHandler,
  editActivityHandler,
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
