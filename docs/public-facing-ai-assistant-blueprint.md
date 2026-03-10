# Public-Facing AI Assistant Blueprint

## 1. Product Definition

### Working Product Description
A cross-platform, ChatGPT-style assistant for a single institution, available on Web, iOS, Android, macOS, and Windows. The assistant supports authenticated users, private chat histories, streaming responses, file attachments, conversation search, user settings, and Retrieval-Augmented Generation (RAG) grounded in institution-approved documents.

### Primary Product Goals
- Provide a public-facing conversational interface for institutional information.
- Ensure responses are grounded in approved documents that serve as the system's single source of truth.
- Keep each user's chat history private.
- Support provider-agnostic AI orchestration from day one.
- Allow authorized personnel to upload and manage institutional knowledge documents.

### V1 Scope
- User authentication
- Private user chats
- Streaming AI responses
- Conversation history and search
- User attachments in chat
- Settings for profile, preferences, and model behavior where permitted
- RAG over approved institution documents
- Staff upload portal for `pdf` and `md` knowledge files
- Source citations in assistant answers

### V1 Non-Goals
- Multi-tenant support across multiple institutions
- Public anonymous access
- Team-shared chats
- Billing and subscriptions
- Voice input/output
- Fine-tuned institution-specific models
- On-device inference

## 2. User Roles

### User
- Sign in
- Create and manage private conversations
- Upload user-scoped chat attachments
- Search personal conversation history
- Ask questions over the institutional knowledge base
- View answer citations

### Staff
- All user permissions
- Upload knowledge documents
- Manage document metadata
- Review ingestion status
- Publish or unpublish knowledge documents

### Admin
- All staff permissions
- Manage users and roles
- Configure AI providers and model routing
- Monitor ingestion jobs and system health
- Manage retrieval settings and moderation policy

## 3. Recommended Stack

### Frontend
- `Flutter`
- Single codebase for `Web`, `iOS`, `Android`, `macOS`, and `Windows`

### Backend
- `FastAPI`
- Python is a practical choice because document ingestion, embeddings, and RAG pipelines are simpler to implement and maintain there

### Data and Infrastructure
- `PostgreSQL` for relational data
- `pgvector` for embeddings and semantic search
- `Redis` for caching, rate limits, background job coordination, and streaming state if needed
- `S3-compatible object storage` for uploaded files and processed artifacts

### Background Processing
- `Celery` or `RQ`
- Use workers for ingestion, parsing, chunking, embedding, and reindexing

### AI Provider Layer
- Internal provider abstraction with adapters for:
- `OpenAI`
- `OpenRouter`
- local `Ollama` or `vLLM` later

## 4. Architecture Overview

### Client Applications
One `Flutter` app with responsive layouts:
- Mobile layout for `iOS` and `Android`
- Desktop layout for `macOS` and `Windows`
- Browser layout for `Web`

Core frontend modules:
- Auth
- Chat
- Attachments
- Conversation search
- Settings
- Staff knowledge portal
- Admin panel

### API Layer
The API handles:
- authentication and sessions
- conversation CRUD
- message creation and retrieval
- streaming responses
- file upload metadata
- document ingestion orchestration
- search endpoints
- user and role management
- provider configuration

### Worker Layer
The worker pipeline handles:
- text extraction from `pdf`
- content ingestion from `md`
- chunking and cleaning
- embedding generation
- vector indexing
- document reprocessing when files change

### Retrieval and Generation Layer
The assistant flow should be:
1. receive user message
2. classify request type
3. retrieve relevant document chunks from approved knowledge sources
4. optionally merge user attachment context
5. call selected model provider
6. stream answer back to client
7. store answer, citations, and token usage

## 5. Source of Truth Model

The institutional knowledge base must be treated as the only authoritative retrieval source for institutional answers. That means:
- only approved staff-uploaded documents are indexed for institution RAG
- ingestion status must be explicit
- unpublished or failed documents are excluded from retrieval
- each answer should cite the source document and chunk span used
- admin tools should expose gaps, stale documents, and failed ingestion jobs

Recommended document states:
- `draft`
- `processing`
- `ready`
- `failed`
- `archived`

Only `ready` documents should be retrievable.

## 6. Privacy and Access Model

### Privacy Rules
- Chats are private per user.
- Users cannot access each other's conversations.
- User-uploaded chat attachments are private to the owning user and conversation unless explicitly re-shared later in a future version.
- Institution knowledge documents are centrally managed and retrievable by the assistant, not exposed as editable assets to regular users.

### Security Baseline
- Server-side auth with short-lived access tokens and refresh tokens
- Role-based access control for staff and admin actions
- Signed URLs for file upload/download
- Encrypted secrets management
- Audit logs for knowledge uploads, publish actions, and admin configuration changes

## 7. Core Product Flows

### User Chat Flow
1. User signs in
2. User opens or creates a conversation
3. User sends a message, optionally with attachments
4. Backend retrieves relevant institutional knowledge
5. Model response streams to the client
6. Final answer is stored with citations and metadata

### Knowledge Upload Flow
1. Staff uploads `pdf` or `md`
2. Backend stores raw file and creates document record
3. Worker extracts text and normalizes content
4. System chunks and embeds content
5. Staff reviews metadata if needed
6. Document is published and becomes retrievable

### Search Flow
Support two separate scopes from the start:
- personal chat search
- institutional knowledge search

Do not mix these silently. The UI should make the search scope explicit.

## 8. Database Schema

### Core Tables

#### `users`
- `id`
- `email`
- `password_hash` or external auth identifier
- `display_name`
- `role`
- `status`
- `created_at`
- `updated_at`

#### `sessions`
- `id`
- `user_id`
- `refresh_token_hash`
- `expires_at`
- `created_at`
- `revoked_at`

#### `conversations`
- `id`
- `user_id`
- `title`
- `last_message_at`
- `created_at`
- `updated_at`
- `archived_at`

#### `messages`
- `id`
- `conversation_id`
- `user_id`
- `role`
- `content`
- `status`
- `provider_name`
- `model_name`
- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `latency_ms`
- `created_at`

#### `message_citations`
- `id`
- `message_id`
- `knowledge_chunk_id`
- `document_id`
- `score`
- `created_at`

#### `chat_attachments`
- `id`
- `conversation_id`
- `message_id`
- `user_id`
- `storage_key`
- `filename`
- `mime_type`
- `size_bytes`
- `created_at`

#### `knowledge_documents`
- `id`
- `title`
- `slug`
- `source_type`
- `language`
- `status`
- `visibility`
- `uploaded_by`
- `storage_key`
- `checksum`
- `published_at`
- `created_at`
- `updated_at`

#### `knowledge_document_versions`
- `id`
- `document_id`
- `version_number`
- `storage_key`
- `checksum`
- `created_at`
- `created_by`

#### `knowledge_chunks`
- `id`
- `document_id`
- `document_version_id`
- `chunk_index`
- `content`
- `token_count`
- `embedding`
- `metadata_json`
- `created_at`

#### `ingestion_jobs`
- `id`
- `document_id`
- `document_version_id`
- `status`
- `error_message`
- `started_at`
- `finished_at`
- `created_at`

#### `user_settings`
- `id`
- `user_id`
- `theme`
- `language`
- `streaming_enabled`
- `default_model_preference`
- `created_at`
- `updated_at`

#### `provider_configs`
- `id`
- `provider_name`
- `status`
- `base_url`
- `default_model`
- `is_enabled`
- `created_at`
- `updated_at`

#### `audit_logs`
- `id`
- `actor_user_id`
- `action`
- `target_type`
- `target_id`
- `metadata_json`
- `created_at`

## 9. API Surface

### Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### Conversations
- `GET /api/v1/conversations`
- `POST /api/v1/conversations`
- `GET /api/v1/conversations/{conversation_id}`
- `PATCH /api/v1/conversations/{conversation_id}`
- `DELETE /api/v1/conversations/{conversation_id}`

### Messages
- `GET /api/v1/conversations/{conversation_id}/messages`
- `POST /api/v1/conversations/{conversation_id}/messages`
- `GET /api/v1/conversations/{conversation_id}/stream`

The send message endpoint should support:
- plain chat
- chat with user attachments
- chat with institutional retrieval

### Chat Attachments
- `POST /api/v1/chat-attachments/upload-url`
- `POST /api/v1/chat-attachments/complete`
- `GET /api/v1/chat-attachments/{attachment_id}`
- `DELETE /api/v1/chat-attachments/{attachment_id}`

### Search
- `GET /api/v1/search/conversations?q=`
- `GET /api/v1/search/knowledge?q=`

### Knowledge Portal
- `GET /api/v1/knowledge/documents`
- `POST /api/v1/knowledge/documents`
- `GET /api/v1/knowledge/documents/{document_id}`
- `PATCH /api/v1/knowledge/documents/{document_id}`
- `POST /api/v1/knowledge/documents/{document_id}/publish`
- `POST /api/v1/knowledge/documents/{document_id}/archive`
- `POST /api/v1/knowledge/documents/{document_id}/reingest`

### Admin
- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/{user_id}/role`
- `GET /api/v1/admin/providers`
- `PATCH /api/v1/admin/providers/{provider_id}`
- `GET /api/v1/admin/ingestion-jobs`
- `GET /api/v1/admin/audit-logs`

## 10. Streaming Design

Use `SSE` first unless there is a hard requirement for bi-directional sockets. It is simpler for ChatGPT-style token streaming and easier to support consistently across Web and Flutter clients.

Recommended message lifecycle:
- user sends message
- backend persists pending user message
- backend creates assistant placeholder
- SSE stream emits tokens and state updates
- backend finalizes assistant message
- citations and usage metadata are attached at completion

Message statuses:
- `pending`
- `streaming`
- `completed`
- `failed`

## 11. RAG Design

### Ingestion Pipeline
1. upload raw file
2. validate type and size
3. extract text
4. normalize and clean content
5. split into chunks
6. compute embeddings
7. insert into `knowledge_chunks`
8. mark document `ready`

### Retrieval Pipeline
1. normalize query
2. embed query
3. retrieve top `k` chunks using vector search
4. optionally rerank top results
5. construct grounded prompt
6. generate answer with citations

### Prompting Rules
- instruct the assistant to answer from retrieved sources only for institutional questions
- if retrieval confidence is low, say the information is unavailable in approved documents
- do not invent policy details
- always return citations when answering from knowledge documents

## 12. Provider-Agnostic AI Layer

Create a stable internal interface such as:

```text
generate_chat_completion(request)
stream_chat_completion(request)
generate_embeddings(request)
list_models(provider)
health_check(provider)
```

Each provider adapter should map institution-level requests to provider-specific payloads. This prevents provider lock-in and keeps the rest of the backend unchanged when adding or replacing providers.

Suggested initial adapters:
- `openai`
- `openrouter`

Defer local model adapters until V2 unless there is a hard privacy requirement that demands them immediately.

## 13. Frontend Module Structure

### Recommended Monorepo

```text
project/
  apps/
    client_flutter/
    api/
    worker/
  packages/
    shared_contracts/
    ai_gateway/
  docs/
  infra/
```

### `apps/client_flutter/lib`

```text
lib/
  app/
  core/
    config/
    routing/
    auth/
    networking/
    storage/
    theme/
  features/
    auth/
    chat/
    conversations/
    search/
    attachments/
    knowledge_portal/
    admin/
    settings/
  shared/
    widgets/
    models/
    utils/
```

### UI Areas
- public sign-in and onboarding
- conversation sidebar
- main chat panel
- citation drawer
- attachment picker
- knowledge portal for staff
- provider and ingestion screens for admin

## 14. UX Requirements

### Chat Experience
- token streaming
- markdown rendering
- code block rendering
- copy action
- regenerate action
- citation chips
- clear loading and failure states

### Search Experience
- fast conversation search
- explicit toggle for chat search vs knowledge search
- result previews
- jump-to-message behavior for conversation search

### Knowledge Portal
- drag-and-drop uploads
- ingestion status badges
- metadata editing
- publish controls
- version history

## 15. Operational Requirements

### Observability
- structured logs
- request IDs
- model latency metrics
- ingestion success/failure metrics
- token usage tracking

### Moderation and Safety
- input size limits
- file type and file size enforcement
- abuse rate limiting for public-facing access
- prompt injection filtering for retrieved content

### Backups
- daily database backups
- object storage versioning for knowledge files

## 16. Delivery Phases

### Phase 1: Foundation
- monorepo setup
- auth
- database and migrations
- provider abstraction
- basic Flutter shell

### Phase 2: Core Chat
- conversations
- message persistence
- SSE streaming
- search over private chats
- settings

### Phase 3: Knowledge System
- staff document upload portal
- ingestion pipeline
- vector retrieval
- citation rendering

### Phase 4: Admin and Hardening
- admin provider controls
- audit logs
- observability
- rate limits
- packaging and deployment

## 17. Recommended First Build Order

1. Define the API contracts and database migrations.
2. Scaffold the backend with auth, conversations, and message models.
3. Implement streaming chat without RAG first.
4. Build the Flutter chat UI against the streaming API.
5. Add knowledge upload and ingestion.
6. Add retrieval and citations.
7. Add search, staff portal, and admin tools.

This order reduces moving parts and gives you a usable chat product before the document system is complete.

## 18. Open Decisions to Confirm Before Scaffolding

These do not block planning, but they should be locked before implementation:
- Auth method: email/password only, Google, Microsoft, or mixed
- End-user chat attachments: allowed file types and size limits
- Knowledge document languages: English only first, or multilingual from V1
- Citation style: inline chips, footnotes, or side panel
- Whether users can upload documents for ad hoc private document chat in V1

## 19. Immediate Next Deliverables

The next useful implementation artifacts should be:
- database schema as SQL migrations
- OpenAPI route contract
- backend project scaffold
- Flutter app scaffold
- local development `docker-compose` setup

Once you want to move from planning into implementation, start with:
- `apps/api`
- `apps/client_flutter`
- `infra/docker-compose.yml`

