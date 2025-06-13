import { updateChatFolders } from "tdlib-types";
import { managedGroups } from "../managedGroups";
import { logger } from "../logger";

export async function handleFolders(update: updateChatFolders) {
  const folders = update.chat_folders;
  folders.forEach(folder => managedGroups.push({ folderId: folder.id, sourceChatIds: [] }));  
}