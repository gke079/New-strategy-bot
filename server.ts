import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Set up Vite middleware in development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const wss = new WebSocketServer({ server });

  wss.on('connection', (clientWs) => {
    let derivWs: WebSocket | null = null;

    const connectToDeriv = (symbol: string, appId: string = '1089', token?: string) => {
      if (derivWs) {
        try {
          derivWs.close();
        } catch {}
      }

      const derivUrl = `wss://ws.derivws.com/websockets/v3?app_id=${appId}`;
      derivWs = new WebSocket(derivUrl);

      derivWs.on('open', () => {
        clientWs.send(JSON.stringify({ type: 'status', status: 'connected' }));
        if (token) {
          derivWs?.send(JSON.stringify({ authorize: token }));
        }
        derivWs?.send(
          JSON.stringify({
            ticks_history: symbol,
            count: 300,
            end: 'latest',
            style: 'ticks',
          })
        );
        derivWs?.send(
          JSON.stringify({
            ticks: symbol,
            subscribe: 1,
          })
        );
      });

      derivWs.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          clientWs.send(JSON.stringify({ type: 'deriv_message', data: parsed }));
        } catch {}
      });

      derivWs.on('error', (err) => {
        clientWs.send(JSON.stringify({ type: 'status', status: 'error', message: err.message }));
      });

      derivWs.on('close', () => {
        clientWs.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
      });
    };

    clientWs.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());
        if (msg.action === 'subscribe') {
          connectToDeriv(msg.symbol || 'R_75', msg.appId || '1089', msg.token);
        } else if (msg.action === 'ping') {
          if (derivWs && derivWs.readyState === WebSocket.OPEN) {
            derivWs.send(JSON.stringify({ ping: 1 }));
          }
        }
      } catch {}
    });

    clientWs.on('close', () => {
      if (derivWs) {
        try {
          derivWs.close();
        } catch {}
      }
    });
  });

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
