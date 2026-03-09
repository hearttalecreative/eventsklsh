---
name: universal-context-anchor
description: Establishes a permanent context discovery system for agents in any project or workspace.
---

# Universal Context Anchor Skill

Use this skill to ensure that all future AI agents working on a project (regardless of the model or platform) can immediately discover and respect the project's global and local context.

## Activation Steps

### 1. Root & Parent Mapping
List the directory contents of the current root and the parent directory. Identify documents that define the "Spirit" and "Rules" of the project (Design, Architecture, Business Logic).

### 2. Implementation
- **Create `PROJECT_MAP.md`** at the highest relevant level of the workspace. This acts as a table of contents for the project's brain.
- **Create `AGENT_GUIDE.md`** in the root of each specific codebase (the sub-project). This file links the code to the `PROJECT_MAP.md`.
- **Update `README.md`**: Inject a pointer at the very top so agents discover the guide immediately.

### 3. Pointer Syntax
Inject this at the top of the local `README.md`:

```markdown
> [!IMPORTANT]
> **FOR AI AGENTS:** To understand the global context and mandatory rules for this project, you MUST read the [AGENT_GUIDE.md](./AGENT_GUIDE.md) and the [PROJECT_MAP.md](../PROJECT_MAP.md) (or specify location).
```

## Best Practices
- **Absolute Paths**: When linking to files in different levels, use paths that are clear for an agent to follow.
- **Recursive Discovery**: Set instructions that force the agent to explore.
