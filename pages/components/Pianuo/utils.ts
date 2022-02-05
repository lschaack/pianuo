export const extendOnMessage = (
  ws: WebSocket,
  nextOnMessage: (this: WebSocket, ev: MessageEvent) => any
) => {
  const prevOnMessage = ws.onmessage;

  if (prevOnMessage) {
    ws.onmessage = event => {
      prevOnMessage.call(ws, event);
      nextOnMessage.call(ws, event);
    }
  } else {
    ws.onmessage = nextOnMessage;
  }
}

// from https://stackoverflow.com/a/10727155
export const generateSessionId = () => {
  const length = 4;
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';

  for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];

  return result;
}

export const isSessionId = (maybeModel: string) => /[A-z0-9]{4}/.test(maybeModel);
