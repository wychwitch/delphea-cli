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

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use JSON file for storage
const file = join(__dirname, "db.json");
const adapter = new JSONFile(file);
const db = new Low(adapter);
await db.read();
let { activities, sheets } = db.data;

const getSheet = async function (sheetId) {
  await db.read();
  let { sheets } = db.data;
  return sheets.find((s) => s.id === sheetId);
};

const getActivities = async function (sheetId) {
  await db.read();
  let { activities } = db.data;

  return activities.filter((a) => a.sheetId === sheetId);
};

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

  get sheet() {
    return getSheet(this.sheetId);
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
    return getActivities(this.id);
  }
}
sheets = sheets.map((s) => new Sheet(s));
activities = activities.map((a) => new Activity(a));

const selectThings = async function (
  entityType,
  options = { message: "select the thing" }
) {
  let list = [];
  let validationFunc = () => true;
  let promptType = "checkbox";

  if (options?.prepend) {
    list.push(...options.prepend);
  }

  switch (entityType) {
    case "activities":
      list.push(...activities);
      if (await options.sheetId) {
        list.push(...options.getSheet().activities);
      }
      break;
    case "sheets":
      list.push(...sheets);
      break;
    case "custom":
      list.push(...options.choices);
      break;
  }

  //formats the list for the prompt
  list = list.map((l) => {
    return {
      name: l.name,
      value: l,
    };
  });

  //if options.single is declared and set to a truthy value
  if (options.single) {
    promptType = "list";
  }

  //if there's a limit, make the validation function test for it
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

const displayActivity = async function (
  activity,
  displayRank = true,
  inlineSheetName = false
) {
  const sheet = await activity.sheet;
  const sheetColor = sheet.color;

  let returnStr = `${chalk.hex(sheetColor)(
    activity.rank > 0
      ? chalk.bold("(" + activity.rank + ")")
      : displayRank
      ? "( " + chalk.italic("unranked") + " )"
      : ""
  )} ${chalk.hex(activity.color).bold(activity.name)} ${
    inlineSheetName ? chalk.hex(sheetColor)("<" + sheet.name + ">") : ""
  }
  \n\t${chalk.italic(activity.desc)}\n`;

  return returnStr;
};

const displaySheet = async function (sheet, reverse = false) {
  const unsorted = await sheet.activities;
  const sheetActivities = unsorted
    .filter((a) => a.sheetId === sheet.id)
    .sort((a, b) => {
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
    returnStr += `\n${await displayActivity(activity)}`;
  }
  return returnStr;
};

const displayAll = async function (grouped = true, reverse = false) {
  const { sheets, activities } = await readDB();
  let returnStr = "";
  if (grouped) {
    for (let sheet of sheets) {
      if ((await sheet.activities.length) > 0) {
        returnStr += displaySheet(sheet, reverse);
      }
    }
  } else {
    for (let activity of activities) {
      returnStr += displayActivity(activity, true, true);
    }
  }
  return returnStr;
};

const addEditActivity = async function (activity, id = undefined) {
  let { activities } = await db.data.activities.map((a) => new Activity(a));

  if (id !== undefined) {
    const i = activities.findIndex((a) => a.id === id);

    activity.rank = activities[i].rank;
    activities[i] = activity;
  } else {
    activities.push(activity);
  }
  await db.write();
};

const pickActivityToEdit = async function () {
  const activity = await selectThings("activities", {
    message: "Select activity to edit",
    single: true,
  });
  return await activityManager(activity);
};

const displayByRank = async function (sheet, rank) {
  return displayActivity(
    sheet,
    sheet.activities.find((a) => a.rank == rank)
  );
};

const returnRank = function (activitiesArr, max = true, repeat = 1) {
  const ranks = activitiesArr.map((a) => a.rank);
  let returnstr;

  if (max) {
    //return the lowest ranked ranks going up per loop
    returnstr = Math.max(...ranks);
  } else {
    //return the highest ranked ranks going down per loop
    returnstr = Math.min(...ranks);
  }
  return returnstr;
};

const returnNextId = async function (type = "activity", i = 1) {
  const { activities, sheets } = await db.data;

  let ids;
  switch (type) {
    case "activity":
      ids = activities.map((a) => a.id);
      break;
    case "sheet":
      ids = activities.map((s) => s.id);
      break;
  }

  //i is available to be changed if in another loop elsewhere, w/o needing to update list.
  return Math.max(...ids) + i;
};

const rankingProcess = async function (activitiesArr) {
  let eliminated;
  let winners = [];

  //if it the list is over 5, split it into more managble chunks
  console.log(`arrs length: ${activitiesArr.length}`);
  if (activitiesArr.length > 5) {
    let chunkedActivities = chunk(activitiesArr, 5, 2);
    console.log({ chunkedActivities });
    for (let chunk of chunkedActivities) {
      //custom will not use the global activities or sheets, and instead use the choices arr
      let result = await selectThings("custom", {
        choices: chunk,
        limit: chunk.length - 1,
        message: "Select your favorites.",
      });

      //push winners to the winners array
      winners.push(...result);
    }
  } else {
    //otherwise just assign the choices directly to the winners arr
    winners = await selectThings("custom", {
      choices: activitiesArr,
      limit: activitiesArr.length - 1,
      message: "Select your favorites.",
    });
  }

  if (winners.length === 1) {
    const i = activities.findIndex((a) => a.id === winners[0].id);
    const acts = await getActivities(winners[0].sheetId);
    const ranks = acts.map((a) => a.rank);
    activities[i].rank = Math.max(...ranks) + 1;
  } else {
    //if winners is is longer than 1, go back
    await rankingProcess(winners);
  }

  eliminated = activitiesArr.filter((x) => !winners.includes(x));

  if (eliminated.length >= 2) {
    await rankingProcess(eliminated);
  } else {
    const i = activities.findIndex((a) => a.id === eliminated[0].id);
    const acts = await getActivities(eliminated[0].sheetId);
    const ranks = acts.map((a) => a.rank);
    activities[i].rank = Math.max(...ranks) + 1;
  }
};

const rankingHandler = async function (sheet = undefined) {
  if (sheet === undefined) {
    sheet = await selectThings("sheets", {
      single: true,
      message: "Please select sheet to rank.",
    });
  }
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  //Randomized activities
  let activities = await sheet.activities;
  shuffleArray(activities);

  //reset everything to 0
  for (let activity of activities) {
    activity.rank = 0;
  }

  await rankingProcess(activities, sheet);

  await db.write();
  return "Ranking Finished!";
};
/**
 * @param  {} originalActivity=undefined
 * @return string
 */
const activityManager = async function (originalActivity = undefined) {
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

  activityPrompt.id = originalActivity?.id
    ? originalActivity.id
    : returnNextId();

  let newActivity = new Activity(
    await activityPrompt.id,
    await activityPrompt.name,
    await activityPrompt.desc,
    await activityPrompt.color,
    await selectedSheet.id
  );

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
      activityManager(originalActivity);
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

/**
 * @returns {{Activity[], Sheet[]}}
 */
const readDB = async function () {
  await db.read();
  let { activities, sheets } = db.data;
  sheets = sheets.map((s) => new Sheet(s));
  activities = activities.map((a) => new Activity(a));
  return { activities, sheets };
};

/**
 * @param {number} num amount of activities to return, default 3
 * @returns {string} {num} of the highest ranked in a sheet
 */
const showHighestRanked = async function (num = 3) {
  let returnStr = "";
  const sheet = await selectThings("sheets", {
    message: "Select sheet",
    single: true,
  });
  const rank = returnRank(sheet.activities, false, num);
  console.log({ rank });

  for (let rnk of rank) {
    returnStr += await displayByRank(sheet, rnk);
  }

  return returnStr;
};

const editSheets = async function (sheet, id) {
  let { sheets } = await db.data.sheets.map((s) => new Sheet(s));

  if (id !== undefined) {
    const i = sheets.findIndex((s) => s.id === id);

    sheets[i] = sheet;
  } else {
    sheets.push(sheet);
  }
  await db.write();
};

const sheetManager = async function (originalSheet = undefined) {
  let sheetPrompt = await inquirer.prompt([
    {
      name: "name",
      type: "input",
      message: "Name?",
      default: originalSheet?.name ? originalSheet.name : "",
      async validate(value) {
        if (value.length > 0) {
          return true;
        }
        return `Please enter a name.`;
      },
    },
    {
      name: "color",
      type: "input",
      message: "Color?",
      default: originalSheet?.color ? originalSheet.color : "#FFFFFF",
    },
  ]);

  sheetPrompt.id = originalSheet?.id ? originalSheet.id : returnNextId("sheet");

  let newSheet = new Sheet(
    await sheetPrompt.id,
    await sheetPrompt.name,
    await sheetPrompt.color
  );

  let prompt = await inquirer.prompt({
    name: "value",
    type: "list",
    message: `Is this correct?
        ${chalk.hex(newSheet.color)(newSheet.name)}
      `,
    choices: ["Yes", "No - Redo", "No - Go Back"],
  });

  switch (prompt.value) {
    case "No - Go Back":
      return chalk.redBright("Byyye");
    case "Yes":
      if (originalSheet) {
        await editSheets(newActivity, newActivity.id);
      } else {
        await editSheets(newActivity);
      }
      return chalk.redBright("pushed new item!");
    case "No - Redo":
      console.log(chalk.redBright("ok redoing"));
      activityManager(originalSheet);
  }
};

const pickSheetToEdit = async function () {
  const sheet = selectThings("sheet", {
    message: "Select a sheet to edit.",
    single: true,
  });

  return await sheetManager(sheet);
};

const displayHandler = async function () {
  const sheetToDisplay = await selectThings("sheets", {
    message: "Select a sheet to display",
    single: true,
    prepend: [{ name: "All Activities", value: false }],
  });

  if (sheetToDisplay === false) {
    const grouped = await selectThings("custom", {
      message: "Should they be grouped?",
      single: true,
      choices: [
        { name: "yes", value: true },
        { name: "no", value: false },
      ],
    });
    console.log(await displayAll(grouped));
  } else {
    console.log({ sheetToDisplay });
    console.log(await displaySheet(sheetToDisplay));
  }
};

const removeThingHandler = async function (type) {
  const typeList =
    type === "activities"
      ? await db.data.activities.map((a) => new Activity(a))
      : await db.data.sheets.map((s) => new Sheet(s));

  const thingToRemove = selectThings(type, {
    message: `What ${type} do you want to remove?`,
    single: true,
  });

  const verify = inquirer.prompt({
    name: "value",
    type: "list",
    message: `Are you sure you want to remove ${thingToRemove.name}?`,
    default: "No - redo",
    choices: ["No - redo", "No - quit", "Yes"],
  });

  switch (verify.value) {
    case "No - redo":
      return removeThingHandler(type);
    case "No - quit":
      return "Quitting!";
    case "Yes":
      const i = typeList.findIndex((x) => x.id === thingToRemove.id);
      db.data[type].splice(i, 1);
      await db.write();
      return `Removed ${thingToRemove.name}`;
  }
};

export {
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
};
