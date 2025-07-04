import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs'
import { config } from '../configuration'
import { logger } from '../logger'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: config.networkToken,
})

export function askAI(systemPrompt: string, userPrompt: string, ...history: string[]): Promise<string | null> {
  const messages: ChatCompletionMessageParam[] = [{ role: 'developer', content: systemPrompt }]
  if (history && history.length) {
    messages.push(...(history?.map((content, ind) => ({ role: (ind % 2 === 0 ? 'user' : 'assistant'), content })) as ChatCompletionMessageParam[]))
  }
  messages.push({ role: 'user', content: userPrompt })
  return openai.chat.completions.create({
    model: config.networkModel || 'gpt-4o-mini',
    store: true,
    messages,
  }).then(
    (result) => {
      logger.info('Answer of gpt-4o-mini: %s', JSON.stringify(result))
      return result.choices[0].message.content
    },
  )
}
