import { logger } from "./logger";
import { client } from ".";
import { config } from "./configuration";
import { askAI } from "./ai";
import fs from 'fs';
import path from "path";
import { message, textEntity$Input } from "tdlib-types";
import { checkPrompt, CheckRequest, CheckResult, clusterPrompt, getRetryClusterPrompt, Summary, summaryPrompt } from "./ai/prompts";
import { getDateIntervalString, toMskOffset } from "./utils/date";
import { mapMessageToPost, Post, PostCluster, SheduledPost } from "./utils/post";
import { parseJsonAnswer } from "./utils/json";

export interface Group {
  id: number;
  title: string;
}

export const managedGroups: Array<Group> = [];

const timeout = (time: number) => new Promise(resolve => setTimeout(resolve, time));

export const postSummary = async (force?: boolean) => {
  logger.info('Managed groups state: %s', JSON.stringify(managedGroups));

  const fiveMinutes = (1000 * 60 * 5);
  const startDate = new Date();
  const currentDate = toMskOffset(startDate);
  currentDate.setTime(currentDate.getTime() + fiveMinutes);

  let postInterval = config.postInterval;
  let maxCountOfNews = 5;

  if (!force) {
    if (currentDate.getHours() > 22 || currentDate.getHours() < 8) {
      logger.info('Skipping posting for a night');
      return;
    } else if (currentDate.getHours() === 8) {
      postInterval = 60 * 60 * 1000 * 9;
      maxCountOfNews = 8;
    }
  }
  
  let fromDateSeconds = Math.floor((Date.now() - postInterval) / 1000);

  const messages = await Promise.all(managedGroups.flatMap(async group => {
    if (!group.title.startsWith(config.parseFolderPrefix)) {
      return [];
    }
    const unreadMessages = await gatherUnreadMessages(fromDateSeconds, group.id, config.postCount);
    if (process.env.TEST) {
      fs.writeFileSync(path.resolve(process.cwd(), `posts_${group.id}.json`, ), JSON.stringify(unreadMessages));
    }

    return unreadMessages;
  })).then(result => result.flat());

  let checkRetries = 0;
  let clusters: PostCluster = {};
  let checkResult: CheckResult;
  const history: Array<string> = [];
  const postsString = JSON.stringify(messages.map(message => ({id: message.id, text: message.text})));

  while (checkRetries < config.checkRetries) {
    let aiAnswer = await askAI(clusterPrompt, postsString, ...history);

    if (!aiAnswer) {
      logger.error('Empty answer from ai for clusterization of %n messages', messages.length);
      return;
    }
    clusters = parseJsonAnswer(aiAnswer);
    const clustersWithText: CheckRequest = Object.fromEntries(Object.entries(clusters).map(entry => {
      const posts = entry[1].map(id => messages.find(message => message.id === id)).filter(message => !!message);
      return [entry[0], posts]
    }));
    const checkResultRaw = await askAI(checkPrompt, JSON.stringify(clustersWithText));
    if (!checkResultRaw) {
      logger.error('Empty answer from ai for clusterization check');
      return;
    }
    checkResult = parseJsonAnswer(checkResultRaw);
    if (!(checkResult.dublicates.length || checkResult.notNews.length || checkResult.wrongTopic.length)) {
      checkRetries = 100;
    } else {
      history.push(aiAnswer, getRetryClusterPrompt(checkResult));
    }
    checkRetries++;
  }

  const sheduledPosts: Array<SheduledPost> = [];

  fromDateSeconds = (fromDateSeconds * 1000) + fiveMinutes;

  for (const key in clusters) {
    const targetChatId = config.targetChats[key];
    if (targetChatId === undefined) {
      logger.warn('Target chat for "%s" not specified', key);
      continue;
    }
    const posts = messages.filter(msg => clusters[key].includes(msg.id)).map(message => ({id: message.id, text: message.text}));
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
      const {newSuccess, newSummaryRaw} = await askAI(summaryPrompt(maxCountOfNews), JSON.stringify(posts))
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
    const summaryArr: Array<Summary> = parseJsonAnswer(summaryRaw);

    let fromDate = toMskOffset(new Date(fromDateSeconds));

    let text = `🕐 Главное за ${ getDateIntervalString(fromDate, currentDate)}`;
    text = summaryArr.reduce((t, summary, index) => t + `\n${index + 1}. ${summary.emoji} ${summary.summary_short}`, `${text}\n\n🔹 Коротко:`);
    text += '\n\n📌 Подробности:';
    text = summaryArr.reduce((t, summary, index) => t + `\n\n${index + 1}. ${summary.emoji} ${summary.summary_detailed}`, text);

    const entities: Array<textEntity$Input> = summaryArr.flatMap(({id}) => {
      const post = messages.find(message => message.id === id);
      return post?.entities?.reduce((acc: Array<textEntity$Input>, entity) => {
        let index;
        let offset = 0;
        while ((index = text.indexOf(entity.text, offset)) > -1) {
          acc.push({_: 'textEntity', offset: index, length: entity.text.length, type: entity.type});
          offset = index + entity.text.length;
        }
        return acc;
      }, []) ?? [];
    })

    sheduledPosts.push({
      targetChatId,
      text,
      entities
    });
  }

  const publishDate = new Date(startDate);
  publishDate.setHours(publishDate.getHours() + 1, 0, 1, 1);
  
  setTimeout(async () => {
    for (const post of sheduledPosts) {
      await client.invoke({
        _: 'sendMessage',
        chat_id: post.targetChatId,
        input_message_content: {
          _: 'inputMessageText',
          text: {
            _: 'formattedText',
            text: post.text,
            entities: post.entities || undefined
          }
        }
      });
    }
  }, force ? 0 : (publishDate.getTime() - Date.now()));
};

async function loadChatHistory(chatId: number, fromDate: number, limitPerChat: number = 10) {
  // await client.invoke({
  //   _: 'openChat',
  //   chat_id: chatId
  // });

  const arr: Array<message> = [];
  let offset = 0;
  let reachedDate = false;
  let lastMessage: message | undefined;

  while (arr.length < limitPerChat) {
    const messages = await client.invoke({
      _: 'getChatHistory',
      chat_id: chatId,
      from_message_id: lastMessage?.id ?? 0,
      limit: limitPerChat - arr.length,
      offset: 0
    }).then(messages => {
      return messages.messages.filter(msg => !!msg?.id);
    });

    for (const msg of messages) {
      if (!!msg?.id) {
        if (msg.date > fromDate) {
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
      break;
    }
  }

  const posts: Array<Post> = arr.map(mapMessageToPost).filter(post => post !== undefined);
      
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

export async function gatherUnreadMessages(fromDate: number, folderId: number, limitPerChat?: number): Promise<Post[]> {
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

  const result: Array<Post> = [];

  for (const chat of chats) {
    result.push(...(await loadChatHistory(chat, fromDate, limitPerChat)));
  }
  return result;
}