# Reading Output Contract v3

Recommended JSON:
{
  "answer": "Direct 2-4 sentence answer to the question",
  "overview": "Central thesis and spread movement",
  "positions": [
    {
      "positionId": "...",
      "positionName": "...",
      "cardId": "...",
      "orientation": "upright|reversed",
      "interpretation": "Card-in-position, connected to question"
    }
  ],
  "connections": [
    {"cards":["id1","id2"],"relationship":"reinforce|qualify|contrast|sequence|redirect","interpretation":"..."}
  ],
  "guidance": "Specific guidance derived from spread tension",
  "closing": "Calibrated reflection, not a repeated summary",
  "confidenceNotes": ["Optional uncertainty where symbolism cannot establish fact"]
}

Do not return chain-of-thought. `connections` contains concise conclusions only.
