import { logger } from "./logger";
import { client } from ".";
import { config } from "./configuration";
import { askAI } from "./ai";
import fs from 'fs';
import path from "path";
import { chat, message } from "tdlib-types";
import { clusterPrompt, Summary, summaryPrompt } from "./ai/prompts";

export interface Group {
  id: number;
  title: string;
}

interface Post {
  id: number;
  text: string;
}

interface PostCluster {
  [key: string]: Array<number>;
}

export const managedGroups: Array<Group> = [];

const timeout = (time: number) => new Promise(resolve => setTimeout(resolve, time));

const postSummary = async () => {
  logger.info('Managed groups state: %s', JSON.stringify(managedGroups));
  const messages = await Promise.all(managedGroups.flatMap(async group => {
    if (!group.title.startsWith(config.parseFolderPrefix)) {
      return [];
    }
    const unreadMessages = await gatherUnreadMessages(group.id, config.postCount);
    if (process.env.TEST) {
      fs.writeFileSync(path.resolve(process.cwd(), `posts_${group.id}.json`, ), JSON.stringify(unreadMessages));
    }

    return unreadMessages;
  })).then(result => result.flat());
  
  const aiAnswer = await askAI(clusterPrompt, JSON.stringify(messages));

  if (!aiAnswer) {
    logger.error('Empty answer from ai for clusterization of %n messages', messages.length);
    return;
  }
  const clusters: PostCluster = JSON.parse(aiAnswer);

  for (const key in clusters) {
    const targetChatId = config.targetChats[key];
    if (targetChatId === undefined) {
      logger.warn('Target chat for "%s" not specified', key);
      continue;
    }
    const posts = messages.filter(msg => clusters[key].includes(msg.id)).map(msg => msg.text);
    let summaryRaw = null;
    let success = false;
    let retries = 0;

    if (posts.length === 0) {
      continue;
    }

    while (!success && retries < 5) {
      if (retries > 0) {
        logger.info('Retrying summary request in 1 minute');
        await timeout(60 * 1000);
      }
      const {newSuccess, newSummaryRaw} = await askAI(summaryPrompt, JSON.stringify(posts))
        .then(answer => ({newSummaryRaw: answer, newSuccess: true}))
        .catch(async reason => {
          logger.error('Error on summary ai request', reason);
          return ({ newSummaryRaw: null, newSuccess: false });
        })
        .finally(() => retries++);
      success = newSuccess;
      summaryRaw = newSummaryRaw;
    }

    if (!summaryRaw) {
      logger.error('Empty answer from ai for summary of %n posts', posts.length);
      continue;
    }
    const summaryArr: Array<Summary> = JSON.parse(summaryRaw);

    let text = summaryArr.reduce((t, summary, index) => t + `\n${index + 1}. ${summary.emoji} ${summary.summary_short}.`, '🔹 Коротко:');
    text += '\n\n📌 Подробности:';
    text = summaryArr.reduce((t, summary, index) => t + `\n\n${index + 1}. ${summary.emoji} ${summary.summary_detailed}.`, text);
    await client.invoke({
      _: 'sendMessage',
      chat_id: targetChatId,
      input_message_content: {
        _: 'inputMessageText',
        text: {
          _: 'formattedText',
          text,
        }
      }
    });
  }
  
  
};

const interval = setInterval(postSummary, config.postInterval);
if (config.postInterval > (1000 * 60 * 10)) {
  setTimeout(postSummary, 60 * 1000);
}

// setTimeout(() => {
//   managedGroups.forEach(folder => {
//     logger.info('Manager folder: %s', JSON.stringify(folder));
//     if (folder.title.toLowerCase() === 'наши') {
//         client.invoke({
//           _: 'getChats',
//           chat_list: {
//             _: 'chatListFolder',
//             chat_folder_id: folder.id,
//           },
//           limit: 20
//         }).then(chats => Promise.all(chats.chat_ids.map(chat_id => client.invoke({
//           _: 'getChat',
//           chat_id
//         }).then(chat => ({title: chat.title, id: chat.id})))).then(chats => logger.info('Our chats: %s', JSON.stringify(chats))));
//       }
//     });
// }, 60 * 1000);

async function loadChatHistory(chatId: number, toDate: number, limitPerChat: number = 10) {
  // await client.invoke({
  //   _: 'openChat',
  //   chat_id: chatId
  // });

  const arr: Array<message> = [];
  let offset = 0;
  let reachedDate = false;
  let lastMessage: message | undefined;

  while (arr.length < limitPerChat) {
    logger.info('Loading messages for chat "%d" from message "%d"', chatId, lastMessage?.id ?? 0);
    const messages = await client.invoke({
      _: 'getChatHistory',
      chat_id: chatId,
      from_message_id: lastMessage?.id ?? 0,
      limit: limitPerChat - arr.length,
      offset: 0
    }).then(messages => {
      logger.info('Loaded %d/%d messages for %d: %s', messages.messages.length, messages.total_count, chatId, messages.messages.map(msg => msg?.id).join(','));
      return messages.messages.filter(msg => !!msg?.id);
    });

    for (const msg of messages) {
      if (!!msg?.id) {
        if (msg.date > toDate) {
          if (!arr.some(am => am.id === msg.id)) {
            arr.push(msg);   
          }
        } else {
          reachedDate = true;
        }
      }
      if (!lastMessage || msg!.date < (lastMessage?.date || Number.MAX_SAFE_INTEGER) || msg!.id < lastMessage?.id) {
        lastMessage = msg!;
      }
    }
    if (reachedDate) {
      logger.info('Reached date for %d, saved %d/%d messages', chatId, arr.length, messages.length);
      break;
    }
  }
  logger.info('Exit cycle for %d with %d messages',chatId, arr.length);

  const posts: Array<Post> = arr.map((msg) => {
    if (msg?.content._ === 'messageText') {
      return {text: msg.content.text.text, id: msg.id};
    }
    if (msg?.content._ === 'messagePhoto') {
      return {text: msg.content.caption.text, id: msg.id};
    }
    if (msg?.content._ === 'messageVideo') {
      return {text: msg.content.caption.text, id: msg.id};
    }
    return undefined;
  }).filter(post => post !== undefined);
      
  await client.invoke({
    _: 'viewMessages',
    chat_id: chatId,
    message_ids: arr.map(msg => msg?.id).filter(id => id != undefined),
    source: {
      _: 'messageSourceChatHistory',
    },
    force_read: true,
  });

  return posts;
}

export async function gatherUnreadMessages(folderId: number, limitPerChat?: number): Promise<Post[]> {
  const toDate = Math.floor((Date.now() - 3600000) / 1000);

  const chats = await client.invoke({
    _: 'getChats',
    chat_list: {
      _: 'chatListFolder',
      chat_folder_id: folderId,
    },
    limit: 50
  }).then(chats => (chats.chat_ids));

  if (!chats) {
    return Promise.reject(`Folder with id=${folderId} not found`);
  }

  return await Promise.all([
    ...chats.map(chatId => loadChatHistory(chatId, toDate, limitPerChat))
  ]).then(messages => messages.flat());
}