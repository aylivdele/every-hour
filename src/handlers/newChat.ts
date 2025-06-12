import { updateNewChat } from "tdlib-types";
import { managedGroups } from "../managedGroups";

export async function handleNewChat(update: updateNewChat) {
  const chat = update.chat;
  const folders = chat.chat_lists.filter(list => list._ === 'chatListFolder').map(list => list.chat_folder_id);

  chat.positions.forEach(position => {
    if (position.list._ === 'chatListFolder') {
      const folderId = position.list.chat_folder_id;
      
      managedGroups.forEach(group => {
        if (group.folder.id === folderId) {
          let existingChat = position.is_pinned
            ? group.targetChat
            : group.sourceChats.find(_chat => _chat.id === chat.id);

          if (!existingChat) {
            existingChat = {
              id: chat.id,
              title: chat.title,
              unreadCount: chat.unread_count,
            };
            if (position.is_pinned) {
              group.targetChat = existingChat;
            } else {
              group.sourceChats.push(existingChat);
            }
          } else {
            existingChat.title = chat.title;
            existingChat.unreadCount = chat.unread_count;
          }
        }
      });
    }
  });
}