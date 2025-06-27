import { updateConnectionState, updateNewChat } from "tdlib-types";
import { handleChatPosition } from "./chatPostition";
import { gatherUnreadMessages, managedGroups } from "../managedGroups";
import { client } from "..";

export async function handleConnectionState(update: updateConnectionState) {
  // if (update.state._ === 'connectionStateReady') {
  //   return Promise.all([
  //     ...managedGroups.map(group => client.invoke({
  //       _: 'getChats',
  //       chat_list: {
  //         _: 'chatListFolder',
  //         chat_folder_id: group.id,
  //       },
  //       limit: 100,
  //     }).then(chatIds => Promise.all([...chatIds.chat_ids.map(chat_id => {
  //       if (group.targetChatId === chat_id || group.sourceChatIds.some(sc => sc === chat_id)) {
  //         return Promise.resolve();
  //       }
  //       return client.invoke({
  //         _: 'getChat',
  //         chat_id,
  //       }).then(chat => {
  //         chat.positions.forEach(position => 
  //           handleChatPosition({
  //             _: 'updateChatPosition',
  //             position,
  //             chat_id: chat.id,
  //           })
  //         );
  //         return Promise.resolve();
  //       });
  //     })])))
  //   ]);
  // }
  // return Promise.resolve();
}