import { updateChatFolders } from "tdlib-types";
import { managedGroups } from "../managedGroups";

export async function handleFolders(update: updateChatFolders) {
  const folders = update.chat_folders;
  folders.forEach(folder => managedGroups.push({ id: folder.id, title: folder.name.text.text }));  
}