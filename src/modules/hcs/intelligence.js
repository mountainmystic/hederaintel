// hcs/intelligence.js - Claude claude-sonnet-4-20250514 analysis engine
import Anthropic from "@anthropic-ai/sdk";

let anthropic;

function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

export async function analyzeMessages(messages, query) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured on server");
  }

  const messagesText = messages
    .map((m) => `[${m.sequence_number}] ${m.content}`)
    .join("\n");

  let response;
  try {
    const client = getAnthropic();
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: `You are an AI analyst for Hedera blockchain data.
Analyze HCS topic messages and answer the user query.
Respond with JSON only (no markdown): { "summary": "...", "anomalies": "...", "recommended_action": "...", "relevant_messages": [{"sequence_number": 0, "content": "...", "relevance_score": 0.0}] }
relevance_score is 0.0-1.0. Only include messages with score > 0.5.`,
      messages: [
        {
          role: "user",
          content: `Query: ${query}\n\nMessages:\n${messagesText || "(no messages yet)"}`,
        },
      ],
    });
  } catch (err) {
    const detail = err?.status ? `Anthropic ${err.status}: ${err.message}` : err.message;
    throw new Error(`AI analysis failed — ${detail}`);
  }

  const text = response.content[0].text.replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}

export async function deepAnalyze(messages, analysisType) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured on server");
  }

  const messagesText = messages
    .map((m) => `[${m.sequence_number}] ${m.content}`)
    .join("\n");

  const prompts = {
    anomaly_detection: "Detect unusual patterns, outliers, or suspicious activity.",
    trend_analysis: "Identify trends, patterns, and changes over time.",
    entity_extraction: "Extract key entities, actors, and relationships.",
    risk_assessment: "Assess risks, vulnerabilities, and concerns.",
  };

  let response;
  try {
    const client = getAnthropic();
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: `You are a deep analyst for Hedera blockchain data.
${prompts[analysisType]}
Respond with JSON only (no markdown): { "executive_summary": "...", "findings": [], "risk_level": "low|medium|high", "recommendations": [] }`,
      messages: [
        {
          role: "user",
          content: `Analyze these HCS messages:\n${messagesText || "(no messages yet)"}`,
        },
      ],
    });
  } catch (err) {
    const detail = err?.status ? `Anthropic ${err.status}: ${err.message}` : err.message;
    throw new Error(`AI analysis failed — ${detail}`);
  }

  const text = response.content[0].text.replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}
