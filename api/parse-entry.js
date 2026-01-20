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

  const systemPrompt = `You parse natural language baby tracking entries into structured JSON.

Return a JSON object with an "entries" array. Each entry is either a feed or sleep:

Feed entry:
{
  "type": "feed",
  "timestamp": "ISO 8601 datetime",
  "amount_oz": number or null,
  "duration_minutes": number or null
}

Sleep entry:
{
  "type": "sleep",
  "start_time": "ISO 8601 datetime",
  "end_time": "ISO 8601 datetime or null",
  "location": string or null
}

Parsing rules:
- "bf" or "nursing" or "nurse" or "breastfeed" = breastfeeding (use duration_minutes, amount_oz should be null)
- "bottle" or just "oz" without nursing mentioned = bottle (use amount_oz, duration_minutes should be null)
- For relative times like "3pm", use today's date: ${today}
- "30 min ago" means subtract from current time: ${now}
- One input can contain multiple entries (e.g., "bf 10 min and 4oz bottle")
- If both nursing and bottle in same session, create two separate feed entries with same timestamp
- "nap from 1-3pm" = sleep entry with start and end
- "nap started at 2pm" = sleep entry with start only (end_time: null)
- Location can be: "crib", "bassinet", "stroller", "car seat", "arms", or other string

Return ONLY valid JSON, no explanation or markdown.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
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
      return res.status(500).json({ error: 'Failed to parse entry' });
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse the JSON response from Claude
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', content);
      return res.status(500).json({ error: 'Failed to parse response' });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
