import { updateChatPosition, updateNewChat } from "tdlib-types";
import { managedGroups } from "../service/summary";

export async function handleChatPosition(update: updateChatPosition) {
  // const chatId = update.chat_id;
  
  // if (update.position.list._ === 'chatListFolder') {
  //   const folderId = update.position.list.chat_folder_id;
  //   managedGroups.forEach(group => {
  //     if (group.id === folderId) {
  //       if (group.targetChatId === chatId) {
  //         if (!update.position.is_pinned) {
  //           const chat = group.targetChatId;
  //           group.targetChatId = undefined;
  //           if (!group.sourceChatIds.some(sc => sc === chatId)) {
  //             group.sourceChatIds.push(chat);
  //           }
  //         }
  //       } else {
  //         if (group.sourceChatIds.some(sc => sc === chatId) && update.position.is_pinned) {
  //           const index = group.sourceChatIds.findIndex(sc => sc === chatId);
  //           const chat = group.sourceChatIds.splice(index, 1)[0];
  //           group.targetChatId = chat;
  //         }
  //       }
  //     }
  //   });
  // }
}