import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs'
import { config } from '../configuration'
import OpenAI from 'openai'
import { EasyInputMessage } from 'openai/resources/responses/responses.mjs'
import { updateTokenStatistics } from '../statistics'
import { logger } from '../utils/logger'

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

export function tts(instructions: string, text: string) {
  return openai.audio.speech.create({
    model: config.aiTtsModel,
    voice: config.aiVoice,
    input: text,
    instructions: instructions,
  });
}
