import { updateNewChat } from "tdlib-types";
import { handleChatPosition } from "./chatPostition";

export async function handleNewChat(update: updateNewChat) {
  const chat = update.chat;

  chat.positions.forEach(position => handleChatPosition({
    _: 'updateChatPosition',
    position,
    chat_id: chat.id,
  }));
}