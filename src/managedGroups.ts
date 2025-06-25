import { logger } from "./logger";
import { client } from ".";
import { config } from "./configuration";
import { askAI } from "./ai";
import { systemPrompt } from "./ai/prompts";
import fs from 'fs';
import path from "path";
import { chat, message } from "tdlib-types";

export interface Group {
  id: number;
  title: string;
}

interface Post {
  text: string;
  video?: boolean;
  photo?: boolean;
}

interface GroupWithNews {
  title: string;
  posts: Array<Post>;
}

interface Posts {
  targetChat: number;
  groups: Array<GroupWithNews>;
}

export const managedGroups: Array<Group> = [];

const postSummary = () => {
  logger.info('Managed groups state: %s', JSON.stringify(managedGroups));
  managedGroups.forEach(async group => {
    const unreadMessages = await gatherUnreadMessages(group.id, config.postCount);

    if (!unreadMessages || unreadMessages.groups.flatMap(gr => gr.posts).length === 0) {
      logger.info('No new messages for group %s', group.id);
      return;
    }

    if (process.env.TEST) {
      fs.writeFileSync(path.resolve(process.cwd(), `posts_${group.id}.json`, ), JSON.stringify(unreadMessages.groups));
      return;
    }
    const aiAnswer = await askAI(systemPrompt, JSON.stringify(unreadMessages));

    if (!aiAnswer) {
      logger.error('Empty answer from ai for group %d', group.id);
      return;
    }
    if (config.postDebug) {
      logger.info('Ai answer for group %d: %s', group.id, aiAnswer);
    } else {
      await client.invoke({
        _: 'sendMessage',
        chat_id: group.targetChatId,
        input_message_content: {
          _: 'inputMessageText',
          text: {
            _: 'formattedText',
            text: aiAnswer,
          }
        }
      });
    }
    
  });
};

const interval = setInterval(postSummary, config.postInterval);
if (config.postInterval > (1000 * 60 * 10)) {
  setTimeout(postSummary, 60 * 1000);
}

async function loadChatHistory(chat: chat, toDate: number, limitPerChat: number = 10) {
  await client.invoke({
    _: 'openChat',
    chat_id: chat.id
  });

  const arr: Array<message> = [];
  let offset = 0;
  let reachedDate = false;

  while (arr.length < limitPerChat) {
    const messages = await client.invoke({
      _: 'getChatHistory',
      chat_id: chat.id,
      limit: limitPerChat,
      offset
    }).then(messages => {
      offset += messages.messages.length;
      return messages.messages.filter(msg => !!msg?.id);
    });

    for (const msg of messages) {
      if (!!msg?.id) {
        if (msg.date > toDate) {
          arr.push(msg);   
        } else {
          reachedDate = true;
        }
      }
    }
    if (reachedDate) {
      break;
    }
  }

  const posts: Array<Post> = arr.map((msg) => {
    if (msg?.content._ === 'messageText') {
      return {text: msg.content.text.text};
    }
    if (msg?.content._ === 'messagePhoto') {
      return {text: msg.content.caption.text, photo: true};
    }
    if (msg?.content._ === 'messageVideo') {
      return {text: msg.content.caption.text, video: true};
    }
    return undefined;
  }).filter(post => post !== undefined);
      
  await client.invoke({
    _: 'viewMessages',
    chat_id: chat.id,
    message_ids: arr.map(msg => msg?.id).filter(id => id != undefined),
    source: {
      _: 'messageSourceChatHistory',
    },
    force_read: true,
  });

  return {title: chat.title, posts};
}

export async function gatherUnreadMessages(folderId: number, limitPerChat?: number): Promise<Posts | undefined> {
  const toDate = Date.now() - 3600000;

  const chats = await client.invoke({
    _: 'getChats',
    chat_list: {
      _: 'chatListFolder',
      chat_folder_id: folderId,
    },
    limit: 20
  }).then(chats => (chats.chat_ids));

  if (!chats) {
    return Promise.reject(`Folder with id=${folderId} not found`);
  }

  return await Promise.all([
    ...chats.map(chatId => client.invoke({
      _: 'getChat',
      chat_id: chatId,
    }))
  ]).then(async chat_infos => {
    const targetChat = chat_infos.find(chat => chat.positions.some(pos => pos.list._ === 'chatListFolder' && pos.list.chat_folder_id === folderId && pos.is_pinned));
    if (!targetChat) {
      logger.info('Could not find target chat for folder=%n', folderId);
      return undefined;
    }
    const groups = await Promise.all(
      chat_infos.filter(chat => chat.id !== targetChat.id).map(chat => loadChatHistory(chat, toDate, limitPerChat))
    );

    return {targetChat: targetChat.id, groups};
  });
  
}