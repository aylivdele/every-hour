import path from 'path';
import winston from 'winston';
import { config } from '../configuration';

const pathToLogs = config.logDir ?? path.join(path.dirname(require.main?.filename ?? __filename), '../logs');

const myFormat = winston.format.printf((args) => {
  const text = `${args.timestamp} ${args.level}: ${args.message}`;
  if (args.stack) {
    return `${ text }\n${ args.stack }`
  }
  return text;
});

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.splat(),   
    winston.format.errors({ stack: true }),
    myFormat
  ),
  handleExceptions: true,
  transports: [
    new winston.transports.File({ filename: path.resolve(pathToLogs, 'error.log'), level: 'error', maxFiles: 3, maxsize: 20 * 1024 * 1024, zippedArchive: true }),
    new winston.transports.File({ filename: path.resolve(pathToLogs, 'combined.log'), maxFiles: 3, maxsize: 20 * 1024 * 1024, zippedArchive: true }),
  ],
});

logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.splat(),
      myFormat
    ),
}));

logger.info('Logs are saved to %s', pathToLogs);