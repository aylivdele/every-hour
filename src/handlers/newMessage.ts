// import { updateNewChat, updateNewMessage, updateUnreadMessageCount } from "tdlib-types";
// import { managedGroups } from "../managedGroups";

// export async function handleNewMessage(update: updateNewMessage) {
//   const message = update.message;

//   managedGroups.forEach(group => {
//       if (group.targetChat?.id === message.chat_id) {
//         group.targetChat.unreadCount = (group.targetChat.unreadCount ?? 0) + 1;
//       } else {
//         group.sourceChats.forEach(sourceChat => {
//           if (sourceChat.id === message.chat_id) {
//             sourceChat.unreadCount = (sourceChat.unreadCount ?? 0) + 1;
//           }
//         })
//       }
//   });
// }