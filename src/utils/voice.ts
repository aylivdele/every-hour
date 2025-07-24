import path from "path"; 
import fs from 'fs';
import { logger } from "./logger";


const voiceFilesDir = path.join(path.dirname(require.main?.filename ?? __filename), '../db/voice');

export function writeVoiceFile(voice: ArrayBuffer, name: string): string {
    if (!fs.existsSync(voiceFilesDir)) {
        fs.mkdirSync(voiceFilesDir, {recursive: true});
    }
    const file = path.join(voiceFilesDir, name);
    const buffer = Buffer.from(voice);
    fs.writeFileSync(file, buffer);
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
