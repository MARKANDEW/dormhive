const clients = new Set();

export function subscribeToDataChanges(response, clientId = '') {
  const client = { response, clientId };
  clients.add(client);
  return () => clients.delete(client);
}

export function publishDataChange({ resource, sourceId = '' } = {}) {
  const payload = JSON.stringify({ resource, sourceId, occurredAt: new Date().toISOString() });
  for (const client of clients) {
    if (sourceId && client.clientId === sourceId) continue;
    if (client.response.destroyed || client.response.writableEnded) {
      clients.delete(client);
      continue;
    }
    client.response.write(`event: data-changed\ndata: ${payload}\n\n`);
  }
}

export function connectedClientCount() {
  return clients.size;
}