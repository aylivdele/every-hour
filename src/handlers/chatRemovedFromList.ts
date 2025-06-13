import { updateChatAddedToList, updateChatRemovedFromList, updateNewChat, updateNewMessage, updateUnreadMessageCount } from "tdlib-types";
import { managedGroups } from "../managedGroups";

export async function handleChatRemovedFromList(update: updateChatRemovedFromList) {
  const chatId = update.chat_id;

  if (update.chat_list._ === 'chatListFolder') {
    const folderId = update.chat_list.chat_folder_id;
    managedGroups.forEach(group => {
      if (group.folderId === folderId) {
         if (group.targetChatId === chatId) {
          group.targetChatId = undefined;
         } else {
          const index = group.sourceChatIds.findIndex(sci => sci === chatId);
          if (index > -1) {
            group.sourceChatIds.splice(index, 1);
          }
         }
      }
    });
  }
}