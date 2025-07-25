import { config } from '../configuration'
import OpenAI from 'openai'
import { EasyInputMessage } from 'openai/resources/responses/responses.mjs'
import { updateTokenStatistics } from '../statistics'
import { logger } from '../utils/logger'
import FormData from 'form-data';
import axios from 'axios';
import { instructionsNews } from './prompts/tts'
import { mergeOggBuffers, writeVoiceFile } from '../utils/voice'

const openai = new OpenAI({
  apiKey: config.networkToken,
})

export function askAI(systemPrompt: string, userPrompt: string, saveStats?: boolean, ...history: string[]): Promise<string | null> {
  const messages: EasyInputMessage[] = [{ role: 'developer', content: systemPrompt }];
  if (history && history.length) {
    messages.push(...(history?.map((content, ind) => ({ role: (ind % 2 === 0 ? 'user' : 'assistant'), content })) as EasyInputMessage[]));
  }
  messages.push({ role: 'user', content: userPrompt })
  return openai.responses.create({
    model: config.networkModel || 'gpt-4o-mini',
    store: true,
    input: messages,
    reasoning: {effort: 'medium'}
  }).then(
    (result) => {
      // logger.info('Answer of gpt-4o-mini: %s', JSON.stringify(result))
      if (saveStats) {
        updateTokenStatistics(result.usage?.input_tokens, result.usage?.output_tokens);
      } else {
        logger.info('Usage stats: %s', JSON.stringify(result.usage));
      }
      return result.output_text;
    },
  )
}

export function ttsOpenai(text: string): Promise<Buffer<ArrayBuffer>> {
  return openai.audio.speech.create({
    model: "tts-1-hd",
    voice: config.aiVoice,
    input: text,
    instructions: instructionsNews,
    response_format: "mp3",
  }).then(response => response.arrayBuffer())
  .then(buffer => Buffer.from(buffer));
}

type v3Response = {
  result: {
    audioChunk: {
      data: string;
    }
    textChunk: {
      text: string;
    },
    startMs: string;
    lengthMs: string;
  }
}

export function ttsYandex(text: string): Promise<Buffer<ArrayBuffer>> {
  let url;
  let data;

  let headers: {[key: string]: any} = {
    Authorization: `Api-Key ${config.yaApiKey}`,
  };

  if (config.aiTtsApiVersion === 'v1') {
    url = 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize';
    data = new FormData();

    data.append('voice', config.aiVoice);
    data.append('text', text);
    data.append('lang', 'ru-RU');
    if (config.aiTtsSpeed) {
      data.append('speed', config.aiTtsSpeed);
    }
    if (config.aiTtsEmotion) {
      data.append('emotion', config.aiTtsEmotion);
    }
    headers = {...headers, ...data.getHeaders()};

    // formData.append('format', 'mp3');

  } else if (config.aiTtsApiVersion === 'v3') {
    url = 'https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis';
    headers = { 'Content-Type': 'application/json', ...headers };

    const hints: any[] = [{
      voice: config.aiVoice
    }];
    if (config.aiTtsSpeed) {
      hints.push({ speed: config.aiTtsSpeed });
    }
    if (config.aiTtsEmotion) {
      hints.push({ role: config.aiTtsEmotion });
    }
    
    data = {
      hints: hints,
      unsafeMode: true,
      text: text,
      outputAudioSpec: {
        containerAudio: {
          containerAudioType: "OGG_OPUS"
        }
      }
    }; 
  } else {
    throw new Error('Wrong yandex tts api version');
  }

  return axios
    .post(url, data, {
      headers,
      responseType: 'arraybuffer'
    })
    .then(response => response.data)
    .then(data => {
      if (config.aiTtsApiVersion === 'v3') {
        return parseChunkedResponse(new String(data));
      }
      return Buffer.from(data);
    });
}

export function tts(text: string): Promise<Buffer<ArrayBuffer>> {
  if (config.aiTtsProvider === 'openai') {
    return ttsOpenai(text);
  }
  if (config.aiTtsProvider === 'yandex') {
    return ttsYandex(text);
  }
  throw new Error('Unknown ai tts provider');
}

function parseChunkedResponse(data: String) {
  const chunks: string[] = data
  .split('\n').filter(chunk => !!chunk);

  const parsedChunks = chunks.map(chunk => Buffer.from(
    (JSON.parse(chunk) as v3Response).result.audioChunk.data, 
    'base64'
  ));
  const date = Date.now();
  // parsedChunks.forEach((chunk, index) => writeVoiceFile(chunk, `chunk_${index}_${date}.ogg`));
  return mergeOggBuffers(parsedChunks);
}