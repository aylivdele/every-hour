import path from "path"; 
import fs from 'fs';
import { logger } from "./logger";


const mp3Dir = path.join(path.dirname(require.main?.filename ?? __filename), '../db/mp3');

export function writeMp3(mp3: ArrayBuffer, name: string): string {
    if (!fs.existsSync(mp3Dir)) {
        fs.mkdirSync(mp3Dir, {recursive: true});
    }
    const file = path.join(mp3Dir, name);
    const buffer = Buffer.from(mp3);
    fs.writeFileSync(file, buffer);
    return file;
}

export async function clearMP3Dir() {
    try {
        if (!fs.existsSync(mp3Dir)) {
            await fs.promises.mkdir(mp3Dir, { recursive: true });
            return;
        }
        const files = await fs.promises.readdir(mp3Dir);

        for (const file of files) {
            const filePath = path.join(mp3Dir, file);
            const stats = await fs.promises.stat(filePath);

            if (stats.isFile()) {
                await fs.promises.unlink(filePath);
            } else if (stats.isDirectory()) {
                await fs.promises.rm(filePath, { recursive: true, force: true });
            }
        }
        logger.info(`Directory '${mp3Dir}' cleared successfully.`);
    } catch (err) {
        logger.error(`Error clearing directory '${mp3Dir}':`, err);
    }
}
