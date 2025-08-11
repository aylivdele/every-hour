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

function getDateString(date: Date) {
  return date.toLocaleString("ru", { day: '2-digit' });
}

function getHourString(date: Date) {
  switch (date.getHours().toString()) {
    case "08":
      return "восьми";
    case "09":
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
    if (fromDate.getMonth() !== toDate.getMonth()) {
      return `с ${getDateString(fromDate)} ${getMonthString(
        fromDate, 'long'
      )} до ${getDateString(toDate)} ${getMonthString(toDate, 'long')}`;
    }
    return `с ${fromDate.getDate()} до ${toDate.getDate()} ${getMonthString(
      toDate,
      "long"
    )}`;
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
