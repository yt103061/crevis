const AI_PROVIDER = process.env.AI_PROVIDER ?? 'gemini'

export async function generateEmbedding(text: string): Promise<number[]> {
  if (AI_PROVIDER === 'claude') {
    return generateEmbeddingViaGemini(text)
  }
  return generateEmbeddingViaGemini(text)
}

async function generateEmbeddingViaGemini(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY!
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
        outputDimensionality: 1536,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Embedding API error: ${err}`)
  }

  const data = await res.json()
  return data.embedding.values
}
