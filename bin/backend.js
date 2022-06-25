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
import { mainMenu } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use JSON file for storage
const file = join(__dirname, "db.json");
const adapter = new JSONFile(file);
const db = new Low(adapter);
await db.read();
if (db.data === null) {
  db.data = {
    activities: [],
    sheets: [
      {
        id: 0,
        listIndex: 0,
        name: "Default",
        color: "#000000",
      },
    ],
  };
  await db.write();
}

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
  constructor(
    possibleId,
    listIndex,
    name,
    desc = "",
    color = "#000000",
    sheetId = 0
  ) {
    if (typeof possibleId !== "number") {
      let { id, listIndex, name, desc, color, sheetId } = possibleId;
      this.id = id;
      this.listIndex = listIndex;
      this.name = name;
      this.rank = 0;
      //starred is a way to display the item above all others
      this.starred = false;
      this.desc = desc;
      this.color = color;
      this.sheetId = sheetId;
    } else {
      this.id = possibleId;
      this.listIndex = listIndex;
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
  constructor(possibleId, listIndex, name, color = "#000000") {
    if (typeof possibleId !== "number") {
      let { id, listIndex, name, color } = possibleId;
      this.id = id;
      this.listIndex = listIndex;
      this.name = name;
      this.color = color;
    } else {
      this.id = possibleId;
      this.listIndex = listIndex;
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
  const sheet = await getSheet(activity.sheetId);
  const sheetColor = sheet.color;

  let returnStr = `${chalk.hex(sheetColor)(
    activity.rank > 0
      ? chalk.bold("(" + activity.rank + ")")
      : displayRank
      ? "( " + chalk.italic("unranked") + " )"
      : ""
  )} ${chalk.hex(activity.color).bold(activity.name)} ${
    inlineSheetName ? chalk.hex(sheetColor)("<" + sheet.name + ">") : ""
  }${activity.desc !== "" ? chalk.italic("\n\t" + activity.desc) : ""}`;

  return returnStr;
};

const displaySheet = async function (sheet, reverse = false) {
  const unsorted = await getActivities(sheet.id);
  let sheetActivities = unsorted
    .filter((a) => a.sheetId === sheet.id)
    .filter((a) => a.rank !== 0)
    .sort((a, b) => {
      if (reverse) {
        return b.rank - a.rank;
      }
      return a.rank - b.rank;
    });
  const unranked = unsorted.filter((a) => a.rank === 0);
  sheetActivities.push(...unranked);

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
  await db.read();
  const { sheets, activities } = db.data;
  let returnStr = "";
  if (grouped) {
    for (let sheet of sheets) {
      const sheetActivities = await getActivities(sheet.id);
      if (sheetActivities.length > 0) {
        returnStr += await displaySheet(sheet, reverse);
      }
    }
  } else {
    for (let activity of activities) {
      returnStr += await displayActivity(activity, true, true);
    }
  }
  return returnStr;
};

const addEditActivity = async function (activity, editing = false) {
  await db.read();
  let activities = await db.data.activities;

  if (editing) {
    const i = await activity.listIndex;

    activity.rank = await activities[i].rank;
    activities[i] = activity;
  } else {
    activities.push(activity);
  }
  await db.write();
  await resetIndexValues();
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
      ids = await activities.map((a) => a.id);
      break;
    case "sheet":
      ids = await sheets.map((s) => s.id);
      break;
  }
  const highestId = ids?.length > 0 ? Math.max(...ids) : 0;

  //i is available to be changed if in another loop elsewhere, w/o needing to update list.
  return highestId + i;
};

const rankingProcess = async function (activitiesArr) {
  await db.read();
  let eliminated;
  let winners = [];

  //if it the list is over 5, split it into more managble chunks
  if (activitiesArr.length > 5) {
    let chunkedActivities = chunk(activitiesArr, 5, 2);
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
    const i = winners[0].listIndex;

    const acts = activities.filter((a) => a.sheetId === winners[0].sheetId);
    activities[i].rank = activities[i].rank = returnRank(acts) + 1;
    db.data.activities = activities;
    await db.write();
  } else {
    //if winners is is longer than 1, go back
    await rankingProcess(winners);
  }

  eliminated = activitiesArr.filter((x) => !winners.includes(x));

  if (eliminated.length === 1) {
    const i = eliminated[0].listIndex;

    const acts = activities.filter((a) => a.sheetId === eliminated[0].sheetId);
    activities[i].rank = returnRank(acts) + 1;
    db.data.activities = activities;
    await db.write();
  } else {
    await rankingProcess(eliminated);
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
  let filteredActivities = activities.filter((a) => a.sheetId === sheet.id);
  shuffleArray(filteredActivities);

  //reset everything to 0
  for (let activity of filteredActivities) {
    activity.rank = 0;
  }

  await rankingProcess(filteredActivities, sheet);

  await db.write();
  return "Ranking Finished!";
};
/**
 * @param  {} originalActivity=undefined
 * @return string
 */
const activityManager = async function (originalActivity = undefined) {
  if (originalActivity) {
    console.log(chalk.redBright("Editing activity!"));
  } else {
    console.log(chalk.redBright("Adding new Activity!"));
  }

  await db.read();
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
    default: await getSheet(originalActivity?.sheetId),
    single: true,
  });

  activityPrompt.id = originalActivity?.id
    ? originalActivity.id
    : returnNextId();
  activityPrompt.listIndex = originalActivity?.listIndex
    ? originalActivity.listIndex
    : db.data.activities.length;

  let newActivity = new Activity(
    await activityPrompt.id,
    await activityPrompt.listIndex,
    await activityPrompt.name,
    await activityPrompt.desc,
    await activityPrompt.color,
    await selectedSheet.id
  );

  let prompt = await inquirer.prompt({
    name: "value",
    type: "list",
    message: `Is this correct?
        ${await displayActivity(newActivity, false, true)}
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

  for (let rnk of rank) {
    returnStr += await displayByRank(sheet, rnk);
  }

  return returnStr;
};

const editSheets = async function (sheet, id) {
  let sheets = await db.data.sheets;

  if (id !== undefined) {
    const i = sheets.findIndex((s) => s.id === id);

    sheets[i] = sheet;
  } else {
    sheets.push(sheet);
  }
  await db.write();
};

const sheetManager = async function (originalSheet = undefined) {
  if (originalSheet) {
    console.log(chalk.redBright("Editing sheet!"));
  } else {
    console.log(chalk.redBright("Adding new sheet!"));
  }
  await db.read();
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
    db.data.sheets.length,
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
        await editSheets(newSheet, newSheet.id);
      } else {
        await editSheets(newSheet);
      }
      return chalk.redBright("pushed new item!");
    case "No - Redo":
      console.log(chalk.redBright("ok redoing"));
      activityManager(originalSheet);
  }
};

const pickSheetToEdit = async function () {
  const sheet = await selectThings("sheets", {
    message: "Select a sheet to edit.",
    single: true,
  });

  return await sheetManager(sheet);
};

const displayHandler = async function () {
  const nonEmptySheets = await getNonEmptySheets();
  const sheetToDisplay = await selectThings("custom", {
    message: "Select a sheet to display",
    single: true,
    choices: [
      { name: "All Activities", value: false },
      ...nonEmptySheets.map((s) => {
        return { name: s.name, value: s };
      }),
      { name: "go back", value: "go back" },
      { name: "quit", value: "quit" },
    ],
  });

  if (sheetToDisplay.value === false) {
    const grouped = await selectThings("custom", {
      message: "Should they be grouped?",
      single: true,
      choices: [
        { name: "yes", value: true },
        { name: "no", value: false },
      ],
    });
    return await displayAll(grouped.value);
  } else if (sheetToDisplay.value === "go back") {
    await mainMenu();
  } else if (sheetToDisplay === "quit") {
    process.exit();
  } else {
    return await displaySheet(sheetToDisplay.value);
  }
};

const removeThingHandler = async function (type) {
  await db.read();
  const typeList =
    type === "activities" ? await db.data.activities : await db.data.sheets;

  const thingToRemove = await selectThings(type, {
    message: `What ${
      type === "activities" ? "activity" : "sheet"
    } do you want to remove?`,
    single: true,
  });

  const verify = await inquirer.prompt({
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
      const i = thingToRemove.listIndex;
      db.data[type].splice(i, 1);
      await db.write();
      await resetIndexValues();
      return `Removed ${thingToRemove.name}`;
  }
};

const resetIndexValues = async function (type = "activities") {
  await db.read();
  let entities = type === "activities" ? db.data.activities : db.data.sheets;
  for (let i = 0; i < entities.length; i++) {
    entities[i].listIndex = i;
  }

  await db.write();
};

const getNonEmptySheets = async function () {
  await db.read();
  const sheets = db.data.sheets;
  let filteredSheets = [];
  for (let sheet of sheets) {
    let sheetActivities = await getActivities(sheet.id);
    if (sheetActivities.length > 0) {
      filteredSheets.push(sheet);
    }
  }
  return filteredSheets;
};

const getSheetByName = async function (sheetName) {
  await db.read();
  for (let sheet of sheets) {
    if (sheet.name.toLowerCase() === sheetName.toLowerCase()) {
      const sheetActivities = await getActivities(sheet.id);
      if (sheetActivities.length === 0) {
        console.log(chalk.redBright(`${sheetName} has no activities.`));
        process.exit(1);
      }
      return sheet;
    }
  }
  console.log(
    chalk.redBright(
      `Could not find sheet by the name ${sheetName}, is it spelled correctly?`
    )
  );
  process.exit(1);
};

export {
  activityManager,
  pickActivityToEdit,
  pickSheetToEdit,
  sheetManager,
  displayHandler,
  rankingHandler,
  readDB,
  showHighestRanked,
  removeThingHandler,
  getSheetByName,
  displaySheet,
};
