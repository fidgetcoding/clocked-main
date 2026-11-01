// An OpenAI-compatible provider that never calls a real model. The prompt picks how it behaves,
// so the tests can drive every failure path in generate-workout.
import http from 'node:http';

const workout = {
  name: 'Fake AI Heavy Bag',
  rounds: 3,
  roundDuration: 180,
  restDuration: 60,
  difficulty: 'beginner',
  combos: [['1', '2'], ['1', '2', '3']],
  phases: [
    {
      name: 'Rounds',
      phaseType: 'circuit',
      section: 'grind',
      repeats: 3,
      segments: [
        { name: 'Bag Work', type: 'active', segmentType: 'combo', duration: 180 },
        { name: 'Rest', type: 'rest', segmentType: 'rest', duration: 60 },
      ],
      combos: [['1', '2'], ['1', '2', '3']],
    },
  ],
  tags: ['boxing'],
  megasetRepeats: 1,
  hasWarmup: false,
  hasCooldown: false,
  parsedRounds: true,
  parsedDurations: true,
  parsedCombos: true,
  hasMultipleBlocks: false,
};

const completion = (content) => JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] });
let requests = [];

http
  .createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const json = (status, payload) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(payload);
      };

      if (req.url === '/requests') return json(200, JSON.stringify(requests));
      if (req.url === '/reset') {
        requests = [];
        return json(200, '{}');
      }

      const parsed = body ? JSON.parse(body) : {};
      const userMessage = parsed.messages?.find((m) => m.role === 'user')?.content ?? '';
      requests.push({
        method: req.method,
        path: req.url,
        authorization: req.headers.authorization,
        model: parsed.model,
        maxTokens: parsed.max_tokens,
        userMessage,
      });

      if (userMessage.includes('[fake:http500]')) return json(500, '{"error":"provider down"}');
      if (userMessage.includes('[fake:drop]')) return req.socket.destroy();
      if (userMessage.includes('[fake:hang]')) return;
      if (userMessage.includes('[fake:badbody]')) return json(200, '<html>Bad gateway</html>');
      if (userMessage.includes('[fake:null]')) return json(200, completion('null'));
      if (userMessage.includes('[fake:empty]')) return json(200, completion(''));
      if (userMessage.includes('[fake:notjson]')) return json(200, completion('Sure! Here is a workout you might like.'));
      if (userMessage.includes('[fake:invalid]')) return json(200, completion(JSON.stringify({ name: 'No phases at all' })));
      if (userMessage.includes('[fake:fenced]')) return json(200, completion('```json\n' + JSON.stringify(workout) + '\n```'));
      return json(200, completion(JSON.stringify(workout)));
    });
  })
  .listen(8080, () => console.log('fake-ai up'));
