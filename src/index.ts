import { ClientOptions, configure, createClient } from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';
import { config } from './configuration';
import { handleAuth } from './handlers/auth';
import { Update } from 'tdlib-types';
import { logger } from './logger';
import { handleFolders } from './handlers/folders';
import { handleNewChat } from './handlers/newChat';



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

client.on('update', (update: Update) => {
  logger.info('Update: %s', update._);

  switch (update._) {
    case 'updateAuthorizationState':
      return handleAuth(update);
    case 'updateChatFolders':
      return handleFolders(update);
    case 'updateNewChat':
      return handleNewChat(update);
  }
  //TODO: updateChatAddedToList 
  // updateChatRemovedFromList 
  // updateChatPosition
  // updateUnreadMessageCount
});

client.on('error', (error) => {
  logger.error('Error:', error);
});


async function sendMessage(chatId: number, text: string) {
  try {
    const result = await client.invoke({
      _: 'sendMessage',
      chat_id: chatId,
      input_message_content: {
        _: 'inputMessageText',
        text: {
          _: 'formattedText',
          text: text,
        },
      },
    });
    console.log('Message sent successfully:', result);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}
