export function addDot(str: string): string {
    if (str.endsWith('.')) {
        str += '.';
    }
    return str;
}