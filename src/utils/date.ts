function getMonthString(date: Date) {
    switch (date.getMonth()) {
        case 2: return 'марта';
        case 4: return 'мая';
        case 5: return 'июня';
        case 6: return 'июля';
    }
    return date.toLocaleString('ru', {month: 'short'});
}

export function getDateIntervalString(fromDate: Date, toDate: Date) {
    if (toDate.getHours() === 8) {
        return `ночь ${ toDate.getDate() } ${ getMonthString(toDate) }`;
    }
    return `${fromDate.getDate().toString().padStart(2, '0')} ${getMonthString(fromDate)} ${fromDate.getHours().toString().padStart(2, '0')}:${fromDate.getMinutes().toString().padStart(2, '0')} - ${toDate.getHours().toString().padStart(2, '0')}:${toDate.getMinutes().toString().padStart(2, '0')}`;
}

export function toMskOffset(date: Date) {
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000 + (3 * 60 * 60 * 1000));
}

export function getNumberString(n: number): string {
    switch (n) {
        case 1:
            return 'Первая';
        case 2:
            return 'Вторая';
        case 3:
            return 'Третья';
        case 4:
            return 'Четвертая';
        case 5:
            return 'Пятая';
    }
    return '';
}