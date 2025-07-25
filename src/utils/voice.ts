import path from "path"; 
import fs from 'fs';
import { logger } from "./logger";
//@ts-ignore
import audioconcat from 'audioconcat';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const voiceFilesDir = path.join(path.dirname(require.main?.filename ?? __filename), '../db/voice');

export function writeVoiceFile(voice: Buffer<ArrayBuffer>, name: string): string {
    if (!fs.existsSync(voiceFilesDir)) {
        fs.mkdirSync(voiceFilesDir, {recursive: true});
    }
    const file = path.join(voiceFilesDir, name);
    fs.writeFileSync(file, voice);
    return file;
}

export function clearVoiceDir() {
    try {
        if (!fs.existsSync(voiceFilesDir)) {
            fs.mkdirSync(voiceFilesDir, { recursive: true });
            return;
        }
        const files = fs.readdirSync(voiceFilesDir);

        for (const file of files) {
            const filePath = path.join(voiceFilesDir, file);
            const stats = fs.statSync(filePath);

            if (stats.isFile()) {
                fs.unlinkSync(filePath);
            } else if (stats.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
            }
        }
        logger.info(`Directory '${voiceFilesDir}' cleared successfully.`);
    } catch (err) {
        logger.error(`Error clearing directory '${voiceFilesDir}':`, err);
    }
}


/**
 * Объединяет несколько OGG Opus буферов в один аудиофайл
 * с помощью audioconcat и временных файлов
 */
export async function mergeOggBuffers(buffers: Buffer[]): Promise<Buffer> {
    const tempDir = os.tmpdir();
    const tempFiles: string[] = [];

    // Сохраняем буферы как временные файлы
    for (const buf of buffers) {
        const tmpFile = path.join(tempDir, `audio_${uuidv4()}.ogg`);
        await fs.promises.writeFile(tmpFile, buf);
        tempFiles.push(tmpFile);
    }

    const outputPath = path.join(tempDir, `merged_${uuidv4()}.ogg`);

    return new Promise<Buffer>((resolve, reject) => {
        audioconcat(tempFiles)
            .concat(outputPath)
            .on('start', (cmd: any) => {
                console.log('[FFmpeg] Start:', cmd);
            })
            .on('error', async (err: any, stdout: any, stderr: any) => {
                console.error('[FFmpeg] Error:', err);
                console.error('[FFmpeg] stderr:', stderr);
                await cleanup();
                reject(err);
            })
            .on('end', async () => {
                try {
                    const result = await fs.promises.readFile(outputPath);
                    await cleanup();
                    resolve(result);
                } catch (readErr) {
                    await cleanup();
                    reject(readErr);
                }
            });

        // Вспомогательная функция для удаления временных файлов
        async function cleanup() {
            for (const file of [...tempFiles, outputPath]) {
                try {
                    await fs.promises.unlink(file);
                } catch { }
            }
        }
    });
}
