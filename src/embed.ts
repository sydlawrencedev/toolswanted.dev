/**
 * Embeddings and vector search.
 *
 * Two models, on purpose:
 *  - Clusters use bge-large (1024 dims). Clustering is the core mechanic of
 *    the board, and it is worth the extra neurons to get a clean separation
 *    between "the same gap" and "a different gap".
 *  - The mirror of the MCP registry uses bge-small (384 dims). There are tens
 *    of thousands of servers to index, and cheapness matters more there.
 *
 * Clustering is done with embeddings, never with an LLM reading the wish text.
 * That is a safety decision as much as a latency one: no model ever sees
 * untrusted agent text during matching, so prompt injection cannot influence
 * which cluster a wish lands in.
 */

import type { Env } from "./types";
import * as budget from "./budget";

export const CLUSTER_MODEL = "@cf/baai/bge-large-en-v1.5";
export const CLUSTER_DIMS = 1024;
export const SERVER_MODEL = "@cf/baai/bge-small-en-v1.5";
export const SERVER_DIMS = 384;

/**
 * The neuron cost of one embedding, by model.
 *
 * Workers AI bills by the tokens the model processes. `bge-large` on a
 * short string is roughly a thousand neurons; `bge-small` a few hundred.
 * These are the figures the daily budget was built around, so an estimate
 * that is wrong in the right direction matters: too low and the board
 * overruns the platform limit, too high and it stops early.
 */
const CLUSTER_NEURONS = 1_000;
const SERVER_NEURONS = 300;

/**
 * BGE models are trained asymmetrically: the retrieval side gets an
 * instruction prefix, the document side does not. Without this, "read
 * planning PDFs" and "extract data from planning application PDFs" land far
 * closer together than they should.
 */
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

export const NS_CLUSTERS = "clusters";
export const NS_SERVERS = "servers";

type Metadata = Record<string, string | number | boolean>;

/**
 * Embed one string as a DOCUMENT (no instruction prefix).
 *
 * The embedding is charged to the daily budget before it is made. When
 * the budget is spent the call still goes through — the platform enforces
 * the real limit, and a board that stops accepting wishes because it ran
 * out of embedding budget is worse than one that tries. The charge is
 * what keeps the counter honest.
 */
export async function embed(
  env: Env,
  text: string,
  model: string = CLUSTER_MODEL
): Promise<number[]> {
  await budget.spendNeurons(env, model === SERVER_MODEL ? SERVER_NEURONS : CLUSTER_NEURONS);
  const res = await env.AI.run(model, { text: [text.slice(0, 500)] });
  const data = (res as { data?: number[][] }).data;
  if (!data || data.length === 0 || !data[0]) throw new Error("embedding failed");
  return data[0];
}

/** Embed one string as a QUERY (with the retrieval instruction prefix). */
export async function embedQuery(
  env: Env,
  text: string,
  model: string = CLUSTER_MODEL
): Promise<number[]> {
  await budget.spendNeurons(env, model === SERVER_MODEL ? SERVER_NEURONS : CLUSTER_NEURONS);
  const res = await env.AI.run(model, { text: [QUERY_PREFIX + text.slice(0, 500)] });
  const data = (res as { data?: number[][] }).data;
  if (!data || data.length === 0 || !data[0]) throw new Error("embedding failed");
  return data[0];
}

/**
 * Embed many strings in one call.
 *
 * Charged per string, because Workers AI bills per input.
 */
export async function embedBatch(
  env: Env,
  texts: string[],
  model: string = CLUSTER_MODEL
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const perText = model === SERVER_MODEL ? SERVER_NEURONS : CLUSTER_NEURONS;
  await budget.spendNeurons(env, perText * texts.length);
  const res = await env.AI.run(model, { text: texts.map((t) => t.slice(0, 500)) });
  const data = (res as { data?: number[][] }).data;
  return data ?? [];
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata?: Metadata;
}

/** Nearest cluster centroids. */
export async function queryClusters(
  env: Env,
  vector: number[],
  topK = 8
): Promise<VectorMatch[]> {
  const res = await env.VECTORS.query(vector, {
    topK,
    namespace: NS_CLUSTERS,
    returnMetadata: true,
  });
  return (res.matches ?? []) as VectorMatch[];
}

/** Nearest existing MCP servers, used to say "this already exists". */
export async function queryServers(
  env: Env,
  vector: number[],
  topK = 5
): Promise<VectorMatch[]> {
  const res = await env.SERVER_VECTORS.query(vector, {
    topK,
    namespace: NS_SERVERS,
    returnMetadata: true,
  });
  return (res.matches ?? []) as VectorMatch[];
}

/** Store (or replace) the centroid for a cluster. */
export async function upsertClusterVector(
  env: Env,
  id: string,
  vector: number[],
  metadata: Metadata
): Promise<void> {
  await env.VECTORS.upsert([{ id, values: vector, namespace: NS_CLUSTERS, metadata }]);
}

export async function upsertServerVectors(
  env: Env,
  items: Array<{ id: string; values: number[]; metadata: Metadata }>
): Promise<void> {
  if (items.length === 0) return;
  for (let i = 0; i < items.length; i += 50) {
    await env.SERVER_VECTORS.upsert(
      items.slice(i, i + 50).map((it) => ({ ...it, namespace: NS_SERVERS }))
    );
  }
}
