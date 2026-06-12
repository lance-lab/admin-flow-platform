# AI Server Integration

Admin Flow keeps the AI runtime separate from the server stack.

## Project Layout

- `modules/ai/backend` contains the AI API, worker, scheduler entrypoints, and model client code.
- `modules/ai/frontend` contains the Admin Flow AI workspace UI.
- `modules/ai/infra/postgres` contains the `ai` schema and module seed SQL.
- `laptop-compose.yml` is for the laptop GPU/model runtime.
- `docker-compose.yml` is for the server app stack.

## Runtime Shape

```text
web-app -> api -> ai-api -> laptop Ollama -> GPU
worker  -> ai-api/laptop Ollama for async AI jobs
```

The server does not talk to the GPU directly. It calls the laptop Ollama HTTP API or an OpenAI-compatible proxy.

## Default Server Services

- `web-app`: React Admin Flow UI.
- `api`: Gateway API, auth, module routing.
- `postgres`: shared Admin Flow database.
- `redis`: queue/cache foundation for workers.
- `ai-api`: AI module API.
- `worker`: placeholder worker process for queued AI jobs.
- `scheduler`: placeholder scheduler process for recurring AI jobs.
- `file-storage`: MinIO object storage for documents and exports.

## AI Environment

Direct Ollama:

```env
AI_PROVIDER=ollama
AI_BASE_URL=http://host.docker.internal:11434
AI_MODEL=gemma3:4b
```

OpenAI-compatible proxy:

```env
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://host.docker.internal:4000/v1
AI_API_KEY=sk-local-dev
AI_MODEL=ollama-default
```

Do not expose Ollama publicly. Use LAN, Tailscale, WireGuard, or another private route.
