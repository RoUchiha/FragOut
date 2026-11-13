import {createServer} from 'node:http';

const port = Number(process.argv[2] ?? '11447');
const model = 'qwen3-vl:2b-instruct';
const outfit = {
  summary: 'A white shirt and navy trousers.',
  garments: ['shirt', 'trousers'],
  colors: ['white', 'navy'],
  styleTags: ['casual'],
  formality: 'smart',
  palette: 'neutral',
  hasOutfit: true,
  uncertainty: [],
};
const bottle = {
  candidates: [{
    brand: 'Dior',
    name: 'Sauvage',
  }],
};

function send(response, status, data) {
  response.writeHead(status, {'Content-Type': 'application/json'});
  response.end(JSON.stringify(data));
}

createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/api/tags') {
    send(response, 200, {models: [{name: model}]});
    return;
  }
  if (request.method !== 'POST' || request.url !== '/api/chat') {
    send(response, 404, {});
    return;
  }
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) {
        send(response, 413, {});
        return;
      }
      chunks.push(chunk);
    }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (input.model !== model || !Array.isArray(input.messages)) {
      send(response, 400, {});
      return;
    }
    const result = input.messages[0]?.content?.includes('ONE fragrance bottle') ? bottle : outfit;
    send(response, 200, {message: {content: JSON.stringify(result)}});
  } catch {
    send(response, 400, {});
  }
}).listen(port, '127.0.0.1', () => console.log('Synthetic Qwen fixture ready.'));
