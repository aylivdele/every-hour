import { logger } from "../utils/logger";
import { client } from "..";
import { config } from "../configuration";
import fs from "fs";
import path from "path";
import { message } from "tdlib-types";
import { toMskOffset } from "../utils/date";
import { mapMessageToPost, Post, saveClusterHistory } from "../utils/post";

import {
  archiveStatistics,
  logStatistics,
  updateClusterStatistics,
} from "../statistics";
import { getOneByOneSummary } from "./oneByOneSummary";
import { getAllInOneSummary } from "./allInOneSummary";
import { prepareAndShedule } from "./sheduledPosts";

export interface Group {
  id: number;
  title: string;
}

export const managedGroups: Array<Group> = [];

export const postSummary = async (
  force?: boolean,
  fromDate?: number,
  toDate?: number
) => {
  try {
    logger.info("Managed groups state: %s", JSON.stringify(managedGroups));

    const fiveMinutes = 1000 * 60 * 5;
    const startDate = new Date(force ? toDate ?? Date.now() : Date.now());
    const currentDate = toMskOffset(startDate);
    currentDate.setTime(currentDate.getTime() + fiveMinutes);

    const publishDate = new Date(startDate);
    publishDate.setHours(publishDate.getHours() + 1, 0, 1, 1);

    let postInterval = config.postInterval;
    let maxCountOfNews = 5;
    let isLastForToday = false;

    if (!force) {
      if (currentDate.getHours() > 22 || currentDate.getHours() < 8) {
        logger.info("Skipping posting for a night");
        return;
      } else if (currentDate.getHours() === 8) {
        postInterval = 60 * 60 * 1000 * 9;
        maxCountOfNews = 8;
      } else if (currentDate.getHours() === 22) {
        isLastForToday = true;
      }
    }
    const from = startDate.getTime() - postInterval;
    let fromDateSeconds = Math.floor((force ? fromDate ?? from : from) / 1000);

    logger.info(
      "From date: %d, to date: %d",
      fromDateSeconds * 1000,
      startDate.getTime()
    );

    const messages = await Promise.all(
      managedGroups.flatMap(async (group) => {
        if (!group.title.startsWith(config.parseFolderPrefix)) {
          return [];
        }
        const unreadMessages = await gatherUnreadMessages(
          fromDateSeconds,
          group.id,
          config.postCount,
          toDate ? Math.floor(toDate / 1000) : undefined
        );
        if (process.env.TEST) {
          fs.writeFileSync(
            path.resolve(process.cwd(), `posts_${group.id}.json`),
            JSON.stringify(unreadMessages)
          );
        }

        return unreadMessages;
      })
    ).then((result) => result.flat());

    // const clusterSummary = await getAllInOneSummary(
    //   messages,
    //   maxCountOfNews,
    //   force
    // );

    const clusterSummary = await getOneByOneSummary(
      messages,
      maxCountOfNews,
      force
    );

    saveClusterHistory(clusterSummary);

    prepareAndShedule({
      summaryClusters: clusterSummary,
      fromDateSeconds,
      messages,
      currentDate,
      publishDate,
    });

    if (config.debugChatId && !force) {
      await client.invoke({
        _: "sendMessage",
        chat_id: config.debugChatId,
        message_thread_id: config.debugThreadId,
        input_message_content: {
          _: "inputMessageText",
          text: {
            _: "formattedText",
            text: `Собрано ${messages.length} постов;

Кол-во новостей по темам:
${Object.entries(
              clusterSummary
            )
              .map(([cluster, news]) => `${cluster}: ${news.length}`)
              .join("\n")};

Запланирована отправка выжимки для ${
              Object.values(clusterSummary).filter((news) => news.length > 0)
                .length
            } каналов через ${
              (publishDate.getTime() - Date.now()) / 1000
            } секунд.`,
          },
        },
      });
    }
    if (!force) {
      const statistics = updateClusterStatistics(
        Object.fromEntries(
          Object.entries(clusterSummary)
            .map(([cluster, posts]) => [cluster, posts.length])
            .filter(([_, length]) => length)
        ),
        1
      );
      if (isLastForToday) {
        await logStatistics(statistics);
        archiveStatistics();
      }
    }
  } catch (error) {
    logger.error("PostSummary error: ", error);
    if (config.debugChatId) {
      await client.invoke({
        _: "sendMessage",
        chat_id: config.debugChatId,
        message_thread_id: config.debugThreadId,
        input_message_content: {
          _: "inputMessageText",
          text: {
            _: "formattedText",
            text: `Критическая ошибка: ${error}`,
          },
        },
      });
    }
    throw error;
  }
};

async function loadChatHistory(
  chatId: number,
  fromDate: number,
  limitPerChat: number = 10,
  toDate?: number
) {
  // await client.invoke({
  //   _: 'openChat',
  //   chat_id: chatId
  // });

  const arr: Array<message> = [];
  let offset = 0;
  let reachedDate = false;
  let lastMessage: message | undefined;

  while (arr.length < limitPerChat) {
    const messages = await client
      .invoke({
        _: "getChatHistory",
        chat_id: chatId,
        from_message_id: lastMessage?.id ?? 0,
        limit: limitPerChat - arr.length,
        offset: 0,
      })
      .then((messages) => {
        return messages.messages.filter((msg) => !!msg?.id);
      });

    for (const msg of messages) {
      if (!!msg?.id) {
        if (msg.date > fromDate && (!toDate || toDate > msg.date)) {
          if (!arr.some((am) => am.id === msg.id)) {
            arr.push(msg);
          }
        } else {
          if (msg.date <= fromDate) {
            reachedDate = true;
          }
        }
      }
      if (
        !lastMessage ||
        msg!.date < (lastMessage?.date || Number.MAX_SAFE_INTEGER) ||
        msg!.id < lastMessage?.id
      ) {
        lastMessage = msg!;
      }
    }
    if (reachedDate) {
      break;
    }
  }

  const posts: Array<Post> = arr
    .map(mapMessageToPost)
    .filter((post) => post !== undefined);

  await client.invoke({
    _: "viewMessages",
    chat_id: chatId,
    message_ids: arr.map((msg) => msg?.id).filter((id) => id != undefined),
    source: {
      _: "messageSourceChatHistory",
    },
    force_read: true,
  });

  return posts;
}

export async function gatherUnreadMessages(
  fromDate: number,
  folderId: number,
  limitPerChat?: number,
  toDate?: number
): Promise<Post[]> {
  const chats = await client
    .invoke({
      _: "getChats",
      chat_list: {
        _: "chatListFolder",
        chat_folder_id: folderId,
      },
      limit: 50,
    })
    .then((chats) => chats.chat_ids);

  if (!chats) {
    return Promise.reject(`Folder with id=${folderId} not found`);
  }

  const result: Array<Post> = [];

  for (const chat of chats) {
    result.push(
      ...(await loadChatHistory(chat, fromDate, limitPerChat, toDate))
    );
  }
  return result;
}
