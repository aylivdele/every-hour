import { configure, createClient } from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';
import { config } from './configuration';
import { handleAuth } from './handlers/auth';
import { Update } from 'tdlib-types';
import { logger } from './logger';



configure({
  tdjson: getTdjson(),
});

export const client = createClient({
  apiId: config.tgApiId,
  apiHash: config.tgApiHash,
  databaseDirectory: config.tdDatabaseDir,
  filesDirectory: config.tdFilesDir,
});

client.on('update', (update: Update) => {
  if (update._ === 'updateAuthorizationState') {
    handleAuth(update);
  }
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
