import { updateChatAddedToList, updateNewChat, updateNewMessage, updateUnreadMessageCount } from "tdlib-types";
import { managedGroups } from "../service/summary";

export async function handleChatAddedToList(update: updateChatAddedToList) {
  // const chatId = update.chat_id;

  // if (update.chat_list._ === 'chatListFolder') {
  //   const folderId = update.chat_list.chat_folder_id;
  //   managedGroups.forEach(group => {
  //     if (group.id === folderId && group.targetChatId !== chatId && !group.sourceChatIds.some(sci => sci === chatId)) {
  //       group.sourceChatIds.push(chatId);
  //     }
  //   });
  // }
}