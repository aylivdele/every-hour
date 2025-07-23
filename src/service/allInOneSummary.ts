import path from "path";
import { textEntity$Input } from "tdlib-types";
import { askAI, tts } from "../ai";
import { instructionsNews } from "../ai/prompts/tts";
import { updateClusterStatistics, logStatistics, archiveStatistics } from "../statistics";
import { toMskOffset, getDateIntervalString, getNumberString } from "../utils/date";
import { parseJsonAnswer } from "../utils/json";
import { logger } from "../utils/logger";
import { clearMP3Dir, writeMp3 } from "../utils/mp3";
import { managedGroups, gatherUnreadMessages } from "./summary";
import { config } from "../configuration";
import fs from 'fs';
import { client } from "..";
import { allInOnePrompt, ClusterSummary } from "../ai/prompts/allInOne";
import { shedulePost } from "./sheduledPosts";

export const postAllInOneSummary = async (force?: boolean, fromDate?: number, toDate?: number) => {
  
  try {
    logger.info('Managed groups state: %s', JSON.stringify(managedGroups));

    const fiveMinutes = (1000 * 60 * 5);
    const startDate = new Date(force ? (toDate ?? Date.now()) : Date.now());
    const currentDate = toMskOffset(startDate);
    currentDate.setTime(currentDate.getTime() + fiveMinutes);

    const publishDate = new Date(startDate);
    publishDate.setHours(publishDate.getHours() + 1, 0, 1, 1);


    let postInterval = config.postInterval;
    let maxCountOfNews = 5;
    let isLastForToday = false;

    if (!force) {
      if (currentDate.getHours() > 22 || currentDate.getHours() < 8) {
        logger.info('Skipping posting for a night');
        return;
      } else if (currentDate.getHours() === 8) {
        postInterval = 60 * 60 * 1000 * 9;
        maxCountOfNews = 8;
      } else if (currentDate.getHours() === 22) {
        isLastForToday = true;
      }
    }
    const from = startDate.getTime() - postInterval;
    let fromDateSeconds = Math.floor((force ? (fromDate ?? from) : from) / 1000);
    
    logger.info('From date: %d, to date: %d', fromDateSeconds * 1000, startDate.getTime());
    
    const messages = await Promise.all(managedGroups.flatMap(async group => {
      if (!group.title.startsWith(config.parseFolderPrefix)) {
        return [];
      }
      const unreadMessages = await gatherUnreadMessages(fromDateSeconds, group.id, config.postCount, toDate ? Math.floor(toDate / 1000) : undefined);
      if (process.env.TEST) {
        fs.writeFileSync(path.resolve(process.cwd(), `posts_${group.id}.json`, ), JSON.stringify(unreadMessages));
      }

      return unreadMessages;
    })).then(result => result.flat());

    let aiAnswer = await askAI(allInOnePrompt(maxCountOfNews), JSON.stringify(messages.map(message => ({id: message.id, text: message.text}))), !force);

    logger.info('All in one AI answer: %s', aiAnswer);
    if (!aiAnswer) {
      logger.error('Empty answer from ai for "all in one" of %n messages', messages.length);
      return;
    }
    let summaryClusters: ClusterSummary = parseJsonAnswer(aiAnswer);
    clearMP3Dir();

    for (const key in summaryClusters) {
      try {
        
        const targetChatId = config.targetChats[key];
        if (targetChatId === undefined) {
            logger.warn('Target chat for "%s" not specified', key);
            continue;
        }
        const summaryArr = summaryClusters[key];
        if (summaryArr.length === 0) {
            continue;
        }
        
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
        });


        let mp3: string | undefined = undefined;
        if (force && summaryArr.length) {
            const ttsText = summaryArr.map((summary, index) => `${getNumberString(index + 1)} новость: ${summary.summary_short} ${summary.summary_detailed}`).join('\n\n');
            const mp3File = await (tts(instructionsNews, ttsText).then(response => response.arrayBuffer()));
            mp3 = writeMp3(mp3File, `${key}_${Date.now()}.mp3`);
        }

        shedulePost({
          cluster: key,
          targetChatId,
          text,
          entities,
          mp3,
          date: publishDate.getTime(),
        });
      } catch (error) {
        logger.error(`Error for ${key} cluster`, error);
        if (config.debugChatId) {
          await client.invoke({
            _: 'sendMessage',
            chat_id: config.debugChatId,
            message_thread_id: config.debugThreadId,
            input_message_content: {
              _: 'inputMessageText',
              text: {
                _: 'formattedText',
                text: `Ошибка создания выжимки для ${key}: ${error}`
              }
            }
          });
        }
      }
    }

    if (config.debugChatId && !force) {
      await client.invoke({
        _: 'sendMessage',
        chat_id: config.debugChatId,
        message_thread_id: config.debugThreadId,
        input_message_content: {
          _: 'inputMessageText',
          text: {
            _: 'formattedText',
            text: `Собрано ${messages.length} постов;

Результат полного цикла за один запрос(кол-во новостей): ${Object.entries(summaryClusters).map(([cluster, posts]) => `${cluster}: ${posts}`).join(', ')};

Запланирована отправка выжимки для ${ Object.values(summaryClusters).filter(news => news.length > 0).length } каналов через ${(publishDate.getTime() - Date.now()) / 1000} секунд.`
          }
        }
      });
    }
    if (!force) {
        const statistics = updateClusterStatistics(Object.fromEntries(Object.entries(summaryClusters).map(([cluster, posts]) => ([cluster, posts.length]))), 1);
      if (isLastForToday) {
        await logStatistics(statistics);
        archiveStatistics();
      }
    } 
  } catch (error) {
    logger.error('PostSummary error: ', error);
    if (config.debugChatId) {
      await client.invoke({
        _: 'sendMessage',
        chat_id: config.debugChatId,
        message_thread_id: config.debugThreadId,
        input_message_content: {
          _: 'inputMessageText',
          text: {
            _: 'formattedText',
            text: `Критическая ошибка: ${error}`
          }
        }
      });
    }
    throw error;
  } 
};