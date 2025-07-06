export function parseJsonAnswer(text: string): any {
    try {
        let startIndex = 0;
        let endIndex = text.length - 1;

        for (; startIndex < (text.length - 1); startIndex++) {
            if (['[', '{'].includes(text.charAt(startIndex))) {
                break;
            }
        }

        for (; endIndex > (startIndex); endIndex--) {
            if (['}', ']'].includes(text.charAt(endIndex))) {
                break;
            }
        }
        return JSON.parse(text.substring(startIndex, endIndex + 1));
    } catch (reason) {
        throw new Error(`Could not parse json: ${text}`);
    }
}