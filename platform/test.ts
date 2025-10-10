(async () => {
  const OPENAI_API_KEY =
    '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';

  try {
    const res = await fetch(
      'http://localhost:9000/v1/openai/1ac58244-b592-4f36-a99b-06347f3b1881/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Get my recent emails' }],
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`Erro ${res.status}: ${text}`);
      return;
    }

    const data = await res.json();
    console.log(data.choices[0].message.content);
  } catch (error) {
    console.error('Erro ao conectar:', error.message);
    console.log(
      '\n⚠️  Certifique-se de que o servidor está rodando em http://localhost:9000'
    );
    console.log('   Execute: pnpm dev  ou  tilt up');
  }
})();
