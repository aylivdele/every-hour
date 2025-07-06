export function removeFromArray<T>(arr: Array<T>, elements: Array<T>) {
    for (const element of elements) {
        const index = arr.indexOf(element);
        if (index > -1) {
            arr.splice(index, 1);
        }
    }
}