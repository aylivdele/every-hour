import { updateChatFolders } from "tdlib-types";
import { client } from "..";
import { logger } from "../logger";
import { managedGroups } from "../managedGroups";

export async function handleFolders(update: updateChatFolders) {
  const folders = update.chat_folders;
  folders.forEach(folder => managedGroups.push({ folder: { title: folder.name.text.text, id: folder.id }, sourceChats: [] }));
}