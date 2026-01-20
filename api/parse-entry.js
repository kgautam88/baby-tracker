export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "text" field' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const systemPrompt = `You parse baby tracking entries into JSON. TODAY'S DATE IS ${today}.

Return {"entries": [...]} where each entry is:

Feed: {"type": "feed", "timestamp": "${today}T{HH}:{MM}:00", "amount_oz": number|null, "duration_minutes": number|null}
Sleep: {"type": "sleep", "start_time": "${today}T{HH}:{MM}:00", "end_time": "..." or null, "location": string|null}

Rules:
- "bf"/"nursing"/"nurse" = breastfeeding → use duration_minutes only
- "bottle"/"oz" = bottle → use amount_oz only
- "3pm" → "${today}T15:00:00" (use 24hr format, NO "Z" suffix)
- Multiple items = multiple entries with same timestamp
- Return ONLY valid JSON.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: text
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API error:', errorData);
      return res.status(500).json({
        error: 'API error',
        details: errorData.error?.message || JSON.stringify(errorData)
      });
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse the JSON response from Claude
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', content);
      return res.status(500).json({
        error: 'Parse error',
        details: content.substring(0, 200)
      });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    return res.status(500).json({
      error: 'Internal error',
      details: error.message
    });
  }
}
