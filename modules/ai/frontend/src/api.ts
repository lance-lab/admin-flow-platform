import { request } from '../../../../apps/web/src/api/client';

export interface AiOverview {
  module: string;
  status: string;
  provider: string;
  model: string;
  capabilities: string[];
}

export interface AiChatResponse {
  id: string;
  provider: string;
  model: string;
  response: string;
  durationMs: number | null;
  createdAt: string;
}

export interface AiModelRun extends AiChatResponse {
  prompt: string;
  status: string;
}

export function getAiOverview() {
  return request<AiOverview>('/api/modules/ai/overview');
}

export function runAiChat(input: { prompt: string; systemPrompt?: string | null }) {
  return request<AiChatResponse>('/api/modules/ai/chat', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function listAiModelRuns() {
  return request<{ modelRuns: AiModelRun[] }>('/api/modules/ai/model-runs');
}
