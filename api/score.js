export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt } = req.body

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0,
      system: '你是華美光學科技股份有限公司的提案改善評審委員。請依照評分標準客觀評分，每項只能給3、5、10分之一，只回傳JSON不含其他文字。',
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  res.status(200).json(data)
}
