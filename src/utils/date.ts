function getMonthString(
  date: Date,
  length: Intl.DateTimeFormatOptions["month"] = "short"
) {
  if (length === "long") {
    switch (date.getMonth()) {
      case 0:
        return "января";
      case 1:
        return "февраля";
      case 2:
        return "марта";
      case 3:
        return "апреля";
      case 4:
        return "мая";
      case 5:
        return "июня";
      case 6:
        return "июля";
      case 7:
        return "августа";
      case 8:
        return "сентября";
      case 9:
        return "октября";
      case 10:
        return "ноября";
      case 11:
        return "декабря";
    }
  }
  switch (date.getMonth()) {
    case 2:
      return "марта";
    case 4:
      return "мая";
    case 5:
      return "июня";
    case 6:
      return "июля";
  }
  return date.toLocaleString("ru", { month: length });
}

function ordinalDay(day: number, form: "gen" | "accN"): string {
  if (day < 1 || day > 31) throw new RangeError("day must be 1..31");

  const ones: Record<number, { gen: string; accN: string }> = {
    1: { gen: "первого",        accN: "первое" },
    2: { gen: "второго",        accN: "второе" },
    3: { gen: "третьего",       accN: "третье" },
    4: { gen: "четвёртого",     accN: "четвёртое" },
    5: { gen: "пятого",         accN: "пятое" },
    6: { gen: "шестого",        accN: "шестое" },
    7: { gen: "седьмого",       accN: "седьмое" },
    8: { gen: "восьмого",       accN: "восьмое" },
    9: { gen: "девятого",       accN: "девятое" },
  };

  const teens: Record<number, { gen: string; accN: string }> = {
    10: { gen: "десятого",        accN: "десятое" },
    11: { gen: "одиннадцатого",   accN: "одиннадцатое" },
    12: { gen: "двенадцатого",    accN: "двенадцатое" },
    13: { gen: "тринадцатого",    accN: "тринадцатое" },
    14: { gen: "четырнадцатого",  accN: "четырнадцатое" },
    15: { gen: "пятнадцатого",    accN: "пятнадцатое" },
    16: { gen: "шестнадцатого",   accN: "шестнадцатое" },
    17: { gen: "семнадцатого",    accN: "семнадцатое" },
    18: { gen: "восемнадцатого",  accN: "восемнадцатое" },
    19: { gen: "девятнадцатого",  accN: "девятнадцатое" },
  };

  const tensWhole: Record<number, { gen: string; accN: string }> = {
    20: { gen: "двадцатого",  accN: "двадцатое" },
    30: { gen: "тридцатого",  accN: "тридцатое" },
  };

  const tensWord: Record<number, string> = {
    20: "двадцать",
    30: "тридцать",
  };

  if (day <= 9) return ones[day][form];
  if (day >= 10 && day <= 19) return teens[day][form];
  if (day % 10 === 0) return tensWhole[day][form];

  const t = Math.floor(day / 10) * 10; // 20 или 30
  const o = day % 10;
  return `${tensWord[t]} ${ones[o][form]}`;
}

function monthGenitive(monthIndex: number): string {
  const months = [
    "января","февраля","марта","апреля","мая","июня",
    "июля","августа","сентября","октября","ноября","декабря"
  ];
  return months[monthIndex];
}

export function formatRange(start: Date, end: Date): string {
  if (end < start) [start, end] = [end, start];

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  const startStr = ordinalDay(start.getDate(), "gen");
  const endStr   = ordinalDay(end.getDate(),   "accN");

  if (sameMonth) {
    return `с ${startStr} по ${endStr} ${monthGenitive(start.getMonth())}`;
  } else {
    return `с ${startStr} ${monthGenitive(start.getMonth())} по ${endStr} ${monthGenitive(end.getMonth())}`;
  }
}


function getHourString(date: Date) {
  switch (date.getHours().toString()) {
    case "8":
      return "восьми";
    case "9":
      return "девяти";
    case "10":
      return "десяти";
    case "11":
      return "одинадцати";
    case "12":
      return "двенадцати";
    case "13":
      return "тринадцати";
    case "14":
      return "четырнадцати";
    case "15":
      return "пятнадцати";
    case "16":
      return "шестнадцати";
    case "17":
      return "семнадцати";
    case "18":
      return "восемнадцати";
    case "19":
      return "девятнадцати";
    case "20":
      return "двадцати";
    case "21":
      return "двадцати одного";
    case "22":
      return "двадцати двух";
  }
  return '';
}

export function getDateIntervalString(fromDate: Date, toDate: Date) {
  if (toDate.getHours() === 8) {
    return `ночь ${toDate.getDate()} ${getMonthString(toDate)}`;
  }
  return `${fromDate.getDate().toString().padStart(2, "0")} ${getMonthString(
    fromDate
  )} ${fromDate.getHours().toString().padStart(2, "0")}:${fromDate
    .getMinutes()
    .toString()
    .padStart(2, "0")} - ${toDate
    .getHours()
    .toString()
    .padStart(2, "0")}:${toDate.getMinutes().toString().padStart(2, "0")}`;
}

export function getDateTitleIntervalString(fromDate: Date, toDate: Date) {
  if (toDate.getHours() === 8) {
    return "ночь";
  }
  return `${toDate.getDate()} ${getMonthString(toDate, "long")}`;
}

export function getLocaleTimeIntervalString(fromDate: Date, toDate: Date) {
  if (toDate.getHours() === 8) {
    return formatRange(fromDate, toDate);
  }
  return `с ${getHourString(fromDate)} до ${getHourString(toDate)}`;
}


export function getTimeIntervalString(fromDate: Date, toDate: Date) {
  if (toDate.getHours() === 8) {
    if (fromDate.getMonth() !== toDate.getMonth()) {
      return `${fromDate.getDate()} ${getMonthString(
        fromDate
      )} - ${toDate.getDate()} ${getMonthString(toDate)}`;
    }
    return `${fromDate.getDate()} - ${toDate.getDate()} ${getMonthString(
      toDate,
      "long"
    )}`;
  }
  return `${fromDate.getHours().toString().padStart(2, "0")}:${fromDate
    .getMinutes()
    .toString()
    .padStart(2, "0")} - ${toDate
    .getHours()
    .toString()
    .padStart(2, "0")}:${toDate.getMinutes().toString().padStart(2, "0")}`;
}

export function toMskOffset(date: Date) {
  return new Date(
    date.getTime() + date.getTimezoneOffset() * 60000 + 3 * 60 * 60 * 1000
  );
}

export function getNumberString(n: number): string {
  switch (n) {
    case 1:
      return "Первая";
    case 2:
      return "Вторая";
    case 3:
      return "Третья";
    case 4:
      return "Четвертая";
    case 5:
      return "Пятая";
  }
  return "";
}
