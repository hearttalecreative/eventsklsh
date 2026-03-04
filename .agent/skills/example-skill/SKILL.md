---
name: Example Skill
description: A template and example demonstrating how to structure custom skills for Antigravity.
---

# Example Skill Instructions

This is the main instructions file for your skill. You can define specific commands, rules, or workflows here that the agent will use when this skill is invoked.

## Directory Structure

A complete skill folder can include:
- `SKILL.md` (Required): You are here. This contains the YAML frontmatter (name, description) and detailed markdown instructions.
- `scripts/`: Helper scripts and utilities that extend your capabilities.
- `examples/`: Reference implementations and usage patterns.
- `resources/`: Additional files, templates, or assets the skill may reference.

## Usage

When you need the agent to perform a specific, repeatable set of complex tasks, you can add instructions and related files in a new folder under `.agent/skills/`. The agent will read the `SKILL.md` file to understand how to execute the skill.
