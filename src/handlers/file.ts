import { updateFile } from "tdlib-types";
import { logger } from "../utils/logger";
import { client } from "..";
import { config } from "../configuration";

type Subscriber = (path: string, id: number) => boolean;

const subscribers: Array<Subscriber> = [];

export async function handleUpdateFile(update: updateFile) {
    const {id, local, remote} = update.file;
    if (!remote.is_uploading_active && !remote.is_uploading_completed && local.downloaded_size === remote.uploaded_size) {
        for (let i = 0; i < subscribers.length; i++) {
            const result = subscribers[i](local.path, id);
            if (result) {
                subscribers.splice(i, 1);
            }
        }
    }
}

export function subscribeToFileUpdate(subscriber: Subscriber) {
    subscribers.push(subscriber);
}