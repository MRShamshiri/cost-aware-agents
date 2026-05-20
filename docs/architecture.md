# Architecture

Cost-Aware Agents is split into small packages so projects can adopt only the pieces they need.

## Flow

1. Provider adapters return normalized model outputs and token usage.
2. Agent core records each model call and tool call in a trace.
3. Cost core estimates spend from config-driven pricing.
4. CLI and CI reports turn traces into JSON or Markdown.

## Design Rules

- Pricing is config-driven because provider prices change.
- Provider adapters normalize usage but do not hide provider-specific metadata.
- Budget failures are explicit results and can also become nonzero CLI exits.

