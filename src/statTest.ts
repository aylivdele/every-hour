// import { archiveStatistics, logStatistics, updateStatistics } from "./statistics";

import { getLocaleTimeIntervalString } from "./utils/date";

// let statistics = updateStatistics(['test', 'cluster1', 'cluster2']);

// statistics = updateStatistics(['cluster1', 'cluster3']);

// archiveStatistics();

// setTimeout(() => logStatistics(statistics), 10000);

//@ts-ignore
// import emojiUnicode from "emoji-unicode";

// console.log(emojiUnicode("₿"));
const fromDate = new Date(1755665700000);
const toDate = new Date(1755669300004);

console.log(getLocaleTimeIntervalString(fromDate, toDate));
console.log({
  from: fromDate.getHours().toString(),
  to: toDate.getHours().toString(),
});
