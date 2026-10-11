# Spec Delta

## ADDED Requirements

### Requirement: Plugin chat context

A plugin with the `llm:context` capability SHALL be able to register a chat context. When a
context applies to the active diagram, the chat SHALL use its system prompt, hand it the model's
reply, show the reply text it returns, and send its retry text back to the model, at most 3
attempts per user message. Diagrams no context applies to SHALL keep the built-in chat.

#### Scenario: Retry on validation errors

- **GIVEN** a context whose first `handleReply` returns a retry and the second a reply
- **WHEN** the user sends a message
- **THEN** the model is called twice, the second time with its first reply and the retry text, and
  the thread shows the user message and the final reply
