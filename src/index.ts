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
import { tts } from './ai';



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
  setInterval(postSummary, config.postInterval);
  postSummary();
}, startTime - Date.now());


if (config.postDebug) {
  logger.info('Sheduling force post');
  setTimeout(() => postAllInOneSummary(true, config.fromDate, config.toDate), 60 * 1000);
}

// tts(`Первая новость:
// Бастрыкин инициирует дело против судьи.
// Председатель Следственного комитета России Александр Бастрыкин подал ходатайство о возбуждении уголовного дела в отношении судьи Альберта Тришкина за причинение вреда здоровью средней тяжести. Это заявление стало темой обсуждения на повестке дня ВККС РФ.

// Вторая новость:
// Удар ВС РФ по украинским позициям.
// Вооруженные силы России произвели удар по пункту временной дислокации украинских войск в Чугуеве Харьковской области, по данным Министерства обороны России, в результате которого было уничтожено до 50 солдат ВСУ.

// Третья новость:
// ГД начнет рассматривать кандидатуру министра транспорта.
// Государственная Дума России готова незамедлительно рассмотреть кандидатуру на должность министра транспорта, как только она будет внесена. Ожидается, что утверждение назначенного кандидата пройдет в июле.

// Четвертая новость:
// В результате нападения роя пчел на людей в Франции пострадали 24 человека, трое из них были госпитализированы. Исследуется возможность запрета ульев в центре города после инцидента, который стал причиной изменения поведения пчел.`
// ).then(buffer => writeMp3(buffer, 'yandex_test.ogg'))
// .then(path => client.invoke({
//   _: 'sendMessage',
//   chat_id: config.debugChatId,
//   message_thread_id: config.debugThreadId,
//   input_message_content: {
//     _: 'inputMessageVoiceNote',
//     voice_note: {
//       _: 'inputFileLocal',
//       path,
//     },
//     caption: {
//       _: 'formattedText',
//       text: 'Дружелюбная Марина, 1.25x'
//     }
//   }
// }))
// .catch(reason => logger.error('Error', reason));