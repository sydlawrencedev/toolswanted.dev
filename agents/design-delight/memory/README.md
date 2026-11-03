# Memory

This directory belongs to this agent, in this project. It is not shared with the kit,
and it is not shared with any other project: two projects that install the same agent
keep separate memories.

The `para-memory-files` skill defines the memory system in full — the PARA structure
and the knowledge-graph format that hold durable facts, and where everything sits
relative to this agent's home directory. Load it before writing here.

## Two layers

- **Daily notes** — `memory/YYYY-MM-DD.md`, one file per day. A raw timeline of what
  happened, written as it happens.
- **Durable facts** — the facts worth keeping once the day is over. They are extracted
  from the daily notes and held in the knowledge graph.
