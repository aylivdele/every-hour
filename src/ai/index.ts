import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs'
import { config } from '../configuration'
import OpenAI from 'openai'
import { EasyInputMessage } from 'openai/resources/responses/responses.mjs'
import { updateTokenStatistics } from '../statistics'

const openai = new OpenAI({
  apiKey: config.networkToken,
})

export function askAI(systemPrompt: string, userPrompt: string, ...history: string[]): Promise<string | null> {
  const messages: EasyInputMessage[] = [{ role: 'developer', content: systemPrompt }];
  if (history && history.length) {
    messages.push(...(history?.map((content, ind) => ({ role: (ind % 2 === 0 ? 'user' : 'assistant'), content })) as EasyInputMessage[]));
  }
  messages.push({ role: 'user', content: userPrompt })
  return openai.responses.create({
    model: config.networkModel || 'gpt-4o-mini',
    store: true,
    input: messages,
    reasoning: {effort: 'high'}
  }).then(
    (result) => {
      // logger.info('Answer of gpt-4o-mini: %s', JSON.stringify(result))
      updateTokenStatistics(result.usage?.input_tokens, result.usage?.output_tokens);
      return result.output_text;
    },
  )
}
