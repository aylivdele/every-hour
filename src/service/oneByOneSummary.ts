import { askAI } from "../ai";
import { ClusterSummary } from "../ai/prompts/allInOne";
import { clusterPrompt } from "../ai/prompts/cluster";
import { dedublicationPrompt } from "../ai/prompts/deduplication";
import { summaryPrompt } from "../ai/prompts/summary";
import { parseJsonAnswer } from "../utils/json";
import { logger } from "../utils/logger";
import {
  loadClusterHistory,
  Post,
  PostCluster,
} from "../utils/post";



export type PostsRequestObject = {
  [key: string]: Array<Post>;
};

export async function getOneByOneSummary(
  messages: Post[],
  maxCountOfNews: number,
  force?: boolean
): Promise<ClusterSummary> {
  let aiAnswer = await askAI(
    clusterPrompt,
    JSON.stringify(
      messages.map((message) => ({ id: message.id, text: message.text }))
    ),
    !force
  );

  logger.info("Clusterization AI answer: %s", aiAnswer);
  if (!aiAnswer) {
    throw new Error("Empty answer from ai for clusterization");
  }
  let clusters: PostCluster = parseJsonAnswer(aiAnswer);
  const clustersWithText: PostsRequestObject = Object.fromEntries(
    Object.entries(clusters).map((entry) => {
      const posts = entry[1]
        .map((id) => messages.find((message) => message.id === id))
        .filter((message) => !!message);
      return [entry[0], posts];
    })
  );
  const clusterHistory = loadClusterHistory();

  const deduplicationAnswerRaw = await askAI(
    dedublicationPrompt,
    JSON.stringify({
      posts: clustersWithText,
      old_news: clusterHistory,
    }),
    !force
  );

  logger.info("Deduplication AI answer: %s", deduplicationAnswerRaw);
  if (!deduplicationAnswerRaw) {
    throw new Error("Empty answer from ai for dedublication");
  }
  const deduplicatedClustersIds: PostCluster = parseJsonAnswer(
    deduplicationAnswerRaw
  );

  const deduplicatedClusters: PostsRequestObject = Object.fromEntries(
    Object.entries(deduplicatedClustersIds).map(([cluster, ids]) => {
      const posts = ids
        .map((id) => messages.find((message) => message.id === id))
        .filter((message) => !!message);
      return [cluster, posts];
    })
  );

  const summaryRaw = await askAI(summaryPrompt(maxCountOfNews), JSON.stringify(deduplicatedClusters), !force);

  if (!summaryRaw) {
    throw new Error("Empty answer from ai for summary");
  }
  const clusterSummary: ClusterSummary = parseJsonAnswer(summaryRaw);

  return clusterSummary;
}
