import { ClientOptions, configure, createClient } from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';
import { config } from './configuration';
import { handleAuth } from './handlers/auth';
import { Update } from 'tdlib-types';
import { logger } from './logger';
import { handleFolders } from './handlers/folders';
import { handleNewChat } from './handlers/newChat';
import { handleChatPosition } from './handlers/chatPostition';
import { handleChatAddedToList } from './handlers/chatAddedToList';
import { handleChatRemovedFromList } from './handlers/chatRemovedFromList';
import { handleConnectionState } from './handlers/connectionState';
import { postSummary } from './managedGroups';



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


if (config.postDebug && (startTime - Date.now()) > (1000 * 60 * 10)) {
  setTimeout(() => postSummary(true), 60 * 1000);
}