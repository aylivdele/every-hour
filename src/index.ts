import { ClientOptions, configure, createClient } from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';
import { config } from './configuration';
import { handleAuth } from './handlers/auth';
import { Update } from 'tdlib-types';
import { handleFolders } from './handlers/folders';
import { handleNewChat } from './handlers/newChat';
import { handleChatPosition } from './handlers/chatPostition';
import { handleChatAddedToList } from './handlers/chatAddedToList';
import { handleChatRemovedFromList } from './handlers/chatRemovedFromList';
import { handleConnectionState } from './handlers/connectionState';
import { postSummary } from './service/summary';
import { logger } from './utils/logger';
import { postAllInOneSummary } from './service/allInOneSummary';
import path from 'path';
import { handleUpdateFile, subscribeToFileUpdate } from './handlers/file';
import { writeVoiceFile } from './utils/voice';
import { tts, ttsOpenai, ttsYandex } from './ai';



configure({
  tdjson: getTdjson(),
});

const options: ClientOptions = {
  apiId: config.tgApiId,
  apiHash: config.tgApiHash,
};

if (config.tdDatabaseDir) {
  options.databaseDirectory = config.tdDatabaseDir;
}
if (config.tdFilesDir) {
  options.filesDirectory = config.tdFilesDir;
}

export const client = createClient(options);

let handlerQueue: Promise<any> = Promise.resolve();

const addHandlerToQueue = <T extends Update> (handler: (update: T) => Promise<any>, update: T) => {
  handlerQueue = handlerQueue.finally(async () => {
    logger.info('handler %s start: %s', update._, JSON.stringify(update));
    try {
      return await handler(update);
    } finally {
      return logger.info('handler %s end', update._);
    }
  })
}

client.on('update', async (update: Update) => {
  // logger.info(JSON.stringify(update));
  switch (update._) {
    case 'updateAuthorizationState':
      addHandlerToQueue(handleAuth, update);
      return;
    case 'updateChatFolders':
      addHandlerToQueue(handleFolders, update);
      return;
    // case 'updateNewChat':
    //   addHandlerToQueue(handleNewChat, update);
    //   return;
    // case 'updateChatPosition':
    //   addHandlerToQueue(handleChatPosition, update);
    //   return;
    // case 'updateChatAddedToList':
    //   addHandlerToQueue(handleChatAddedToList, update);
    //   return;
    // case 'updateChatRemovedFromList':
    //   addHandlerToQueue(handleChatRemovedFromList, update);
    //   return;
    case 'updateConnectionState':
      addHandlerToQueue(handleConnectionState, update);
      return;
    // case 'updateFile':
    //   addHandlerToQueue(handleUpdateFile, update);
    //   return;
  }
});

client.on('error', (error) => {
  logger.error('Error:', error);
});

const date = new Date();
date.setMinutes(55, 0, 0);
let startTime = date.getTime();
if (startTime < Date.now()) {
  startTime += 1000 * 60 * 60;
}

setTimeout(() => {
  setInterval(postAllInOneSummary, config.postInterval);
  postAllInOneSummary();
}, startTime - Date.now());


if (config.postDebug) {
  logger.info('Sheduling force post');
  setTimeout(() => postAllInOneSummary(true, config.fromDate, config.toDate), 60 * 1000);
}

(async () => {
  if (process.env.GEN_VOICES !== 'true') {
    return;
  }
  logger.info('generating voice');
  ttsOpenai(`Первая новость: ЦБ РФ снизил ключевую ставку до 18%. Банк России второй раз подряд понизил ключевую ставку сразу на два процентных пункта – с 20 % до 18 %, отметив ускоренное снижение инфляционного давления.

Вторая новость: ЦБ подтвердил прогноз снижения инфляции до 4 % в 2026. ЦБ заявил о более быстром, чем ожидалось, снижении инфляции, прогнозирует 6–7 % в 2025 году и возвращение к целевым 4 % в 2026 году, а также сохранит жесткую ДКП для достижения этой цели.

Третья новость. ЦБ понизил прогноз средней ключевой ставки на конец 2025. Регулятор ухудшил прогноз средней ключевой ставки на конец 2025 года с диапазона 19,5–21,5 % до 18,8–19,6 % годовых.

Четвертая новость. Глобальный индекс денежной массы M2 достиг исторического максимума. Показатель денежной массы M2 в мире обновил исторический рекорд, что отражает рост ликвидности на глобальных финансовых рынках.
`)
    .then(buffer => writeVoiceFile(buffer, `openai.ogg`))
    .then(path => logger.info('create new file %s', path))
    .catch(reason => logger.error('Could not create voice', reason));
})()
