import path from 'path';
import winston from 'winston';
import { config } from './configuration';

const pathToLogs = config.logDir ?? path.resolve( __dirname, '../logs');

const myFormat = winston.format.printf((args) => {
  return `${args.timestamp} ${args.level}: ${args.message}`;
});

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.splat(),   
    myFormat
  ),
  transports: [
    new winston.transports.File({ filename: path.resolve(pathToLogs, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.resolve(pathToLogs, 'combined.log') }),
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