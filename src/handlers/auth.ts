import { updateAuthorizationState } from "tdlib-types";
import { client } from "..";
import { config, reloadConfig } from "../configuration";
import { logger } from "../logger";

export async function handleAuth(update: updateAuthorizationState) {
  switch (update.authorization_state._) {
    case 'authorizationStateWaitPhoneNumber':
      client.invoke({
        _: 'setAuthenticationPhoneNumber',
        phone_number: config.tgPhoneNumber
      });
      break;

    case 'authorizationStateWaitCode':
      const callback = (code: string) => client.invoke({
        _: 'checkAuthenticationCode',
        code
      });
      const interval = setInterval(() => {
        reloadConfig();
        const code = config.tgPhoneCode;
        if (!code) {
          logger.info('Waiting for phone code...');
          return;
        }
          logger.info('Found phone code!');
        callback(code).catch(reason => logger.error("checkAuthenticationCode error", reason));
        clearInterval(interval);
      }, 3000);
      break;

    case 'authorizationStateWaitPassword':
      const pasCallback = (password: string) => client.invoke({
        _: 'checkAuthenticationPassword',
        password
      });
      const pasInterval = setInterval(() => {
        reloadConfig();
        const code = config.tgPassword;
        if (!code) {
          logger.info('Waiting for password...');
          return;
        }
          logger.info('Found password!');
        pasCallback(code).catch(reason => logger.error("checkAuthenticationPassword error", reason));
        clearInterval(pasInterval);
      }, 3000);
      break;
    case 'authorizationStateReady':
      logger.info('Logged and ready!')
      break;
    case 'authorizationStateLoggingOut':
      break;
    case 'authorizationStateClosing':
      break;
    case 'authorizationStateClosed':
      break;
  }
}