# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the UCUM TypeScript library project.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences.

## ADR Structure

Each ADR is a markdown file following the naming convention: `NNN-title-with-dashes.md`

Where NNN is a sequential number (001, 002, etc.).

## ADR Sections

1. **Title**: Short noun phrase
2. **Status**: Proposed, Accepted, Deprecated, or Superseded
3. **Context**: The issue motivating this decision
4. **Decision**: The change we're proposing or have agreed to implement
5. **Consequences**: What becomes easier or harder as a result
6. **Alternatives**: Other options considered

## Creating a New ADR

1. Copy `template.md` to a new file with the next number
2. Fill in all sections
3. Set status to "Proposed"
4. After team discussion, update status to "Accepted"

## Index

- [001 - Dimension Representation](001-dimension-representation.md) - Object vs Vector representation for dimensions