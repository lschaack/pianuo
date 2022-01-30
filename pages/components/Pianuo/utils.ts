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
