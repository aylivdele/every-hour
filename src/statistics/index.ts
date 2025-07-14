import { existsSync, fstatSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "fs";
import path from "path";
import { logger } from "../utils/logger";
import { client } from "..";
import { config } from "../configuration";

export interface Statistics {
    intervals: number;
    clusters: {[cluster: string]: {
        posts: number;
        news: number;
    }};
    inputTokens: number;
    outputTokens: number;
}

const statisticsDir = path.join(path.dirname(require.main?.filename ?? __filename), '../db');
const statisticsFile = path.join(statisticsDir, 'statistics.json');

export function updateClusterStatistics(news: {[cluster: string]: number}, intervals: number = 0): Statistics {
    const statistics = loadStatistics();
    for (const cluster in news) {
        const clusterObj = statistics.clusters[cluster] ?? {posts: 0, news: 0};
        statistics.clusters[cluster] = clusterObj;
        clusterObj.posts = clusterObj.posts + 1;
        clusterObj.news = clusterObj.news + news[cluster];
    }
    statistics.intervals += intervals;
    saveStatistics(statistics);
    return statistics;
}

export function updateTokenStatistics(inputTokens: number = 0, outputTokens: number = 0): Statistics {
    const statistics = loadStatistics();
    statistics.inputTokens += inputTokens;
    statistics.outputTokens += outputTokens;
    saveStatistics(statistics);
    return statistics;
}

export function saveStatistics(statistics: Statistics) {
    if (!existsSync(statisticsDir)) {
        mkdirSync(statisticsDir, {recursive: true});
    }
    writeFileSync(statisticsFile, JSON.stringify(statistics));
}

export function loadStatistics(): Statistics {
    try {
        const file = readFileSync(statisticsFile);
        if (file.length) {
            return JSON.parse(file.toString());
        }
    } catch (error) {
        logger.error('Could not load statistics file', error);
    }
    return {intervals: 0, clusters: {}, inputTokens: 0, outputTokens: 0};
}

export async function logStatistics(statistics: Statistics) {
    logger.info('Statistics: %s', JSON.stringify(statistics));
    if (config.debugChatId) {
        await client.invoke({
        _: 'sendMessage',
        chat_id: config.debugChatId,
        message_thread_id: config.debugThreadId,
        input_message_content: {
            _: 'inputMessageText',
            text: {
            _: 'formattedText',
            text: `Статистика за день.
Количество запусков: ${statistics.intervals}
Входных токенов: ${statistics.inputTokens}
Выходных токенов: ${statistics.outputTokens}
Постов(новостей) по темам:
${Object.entries(statistics.clusters).map(([cluster, count]) => `- ${cluster}: ${count.posts}(${count.news})`).join('\n')}`
            }
        }
        });
    }
}

export function archiveStatistics() {
    const date = new Date();
    try {
        renameSync(statisticsFile, path.join(path.dirname(statisticsFile), `statistics_${date.getDate()}-${date.getMonth()}-${date.getFullYear()}.json`));
    } catch (error) {
        logger.error('Could not archive statistics', error);
    }
}