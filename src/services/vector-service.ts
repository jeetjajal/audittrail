import { PoolClient } from 'pg';

export interface MatchedIncident {
  incidentId: string;
  incidentNumber: string;
  title: string;
  severity: string;
  status: string;
  similarityScore: number;
  matchedChunk: string;
}

function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class VectorService {
  /**
   * Performs tenant-isolated semantic similarity search over 768-dimensional incident embeddings.
   * Automatically uses HNSW (<=>) when pgvector is present, and seamlessly falls back
   * to native REAL[] cosine calculation on Windows or standard PostgreSQL environments.
   * Resolves Defect AUD-06
   */
  public static async findSimilarIncidents(
    client: PoolClient,
    organizationId: string,
    queryEmbedding: number[],
    excludeIncidentId?: string,
    limit: number = 5,
    minSimilarity: number = 0.70
  ): Promise<MatchedIncident[]> {
    if (queryEmbedding.length !== 768) {
      throw new Error(`DIMENSION_MISMATCH: Expected 768-dimensional vector, got ${queryEmbedding.length}`);
    }

    // Check if pgvector extension type is available
    const typeCheck = await client.query("SELECT 1 FROM pg_type WHERE typname = 'vector' LIMIT 1;");
    const hasPgVector = typeCheck.rows.length > 0;

    if (hasPgVector) {
      const vectorString = `[${queryEmbedding.join(',')}]`;
      const query = `
        SELECT 
          i.id as incident_id,
          i.incident_number,
          i.title,
          i.severity,
          i.status,
          ie.chunk_text,
          ROUND((1 - (ie.embedding <=> $1::vector))::numeric, 4) as similarity_score
        FROM incident_embeddings ie
        JOIN incidents i ON ie.organization_id = i.organization_id AND ie.incident_id = i.id
        WHERE ie.organization_id = $2
          ${excludeIncidentId ? 'AND i.id != $3' : ''}
          AND (1 - (ie.embedding <=> $1::vector)) >= $4
        ORDER BY ie.embedding <=> $1::vector ASC
        LIMIT $5;
      `;

      const params = excludeIncidentId
        ? [vectorString, organizationId, excludeIncidentId, minSimilarity, limit]
        : [vectorString, organizationId, minSimilarity, limit];

      const sql = excludeIncidentId
        ? query
        : query.replace('$4', '$3').replace('$5', '$4');

      const result = await client.query(sql, params);

      return result.rows.map((row) => ({
        incidentId: row.incident_id,
        incidentNumber: row.incident_number,
        title: row.title,
        severity: row.severity,
        status: row.status,
        similarityScore: parseFloat(row.similarity_score),
        matchedChunk: row.chunk_text,
      }));
    } else {
      // Fallback REAL[] cosine similarity engine for Windows PostgreSQL
      let sql = `
        SELECT 
          i.id as incident_id,
          i.incident_number,
          i.title,
          i.severity,
          i.status,
          ie.chunk_text,
          ie.embedding
        FROM incident_embeddings ie
        JOIN incidents i ON ie.organization_id = i.organization_id AND ie.incident_id = i.id
        WHERE ie.organization_id = $1
      `;
      const params: unknown[] = [organizationId];

      if (excludeIncidentId) {
        params.push(excludeIncidentId);
        sql += ` AND i.id != $2`;
      }

      const res = await client.query(sql, params);

      const scored = res.rows.map((row) => {
        const rawEmb = Array.isArray(row.embedding)
          ? row.embedding.map(Number)
          : (typeof row.embedding === 'string'
              ? row.embedding.replace(/[{}]/g, '').split(',').map(Number)
              : []);
        const score = computeCosineSimilarity(queryEmbedding, rawEmb);
        return {
          incidentId: row.incident_id,
          incidentNumber: row.incident_number,
          title: row.title,
          severity: row.severity,
          status: row.status,
          similarityScore: Math.round(score * 10000) / 10000,
          matchedChunk: row.chunk_text,
        };
      });

      return scored
        .filter((item) => item.similarityScore >= minSimilarity)
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit);
    }
  }
}
