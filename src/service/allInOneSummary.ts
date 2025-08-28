import { askAI } from "../ai";
import { parseJsonAnswer } from "../utils/json";
import { logger } from "../utils/logger";
import {
  allInOnePrompt,
  ClusterSummary,
} from "../ai/prompts/allInOne";
import {
  loadClusterHistory,
  Post,
  saveClusterHistory,
} from "../utils/post";

export async function getAllInOneSummary(
  messages: Post[],
  maxCountOfNews: number,
  force?: boolean
): Promise<ClusterSummary> {
  const clusterHistory = loadClusterHistory();

  let aiAnswer = await askAI(
    allInOnePrompt(maxCountOfNews),
    JSON.stringify({
      other_posts: messages.map((message) => ({
        id: message.id,
        text: message.text,
      })),
      our_posts: clusterHistory,
    }),
    !force
  );

  logger.info("All in one AI answer: %s", aiAnswer);
  if (!aiAnswer) {
    logger.error(
      'Empty answer from ai for "all in one" of %n messages',
      messages.length
    );
    throw new Error("Empty AI answer");
  }
  let summaryClusters: ClusterSummary = parseJsonAnswer(aiAnswer);

  return summaryClusters;
}
