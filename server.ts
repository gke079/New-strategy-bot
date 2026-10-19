import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Set up Deriv WebSocket relay on /deriv-ws
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/deriv-ws') {
        wss.handleUpgrade(request, socket, head, (clientWs) => {
          wss.emit('connection', clientWs, request);
        });
      }
    } catch (err) {
      console.warn('Upgrade handling error:', err);
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs, req) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const appId = url.searchParams.get('app_id') || '1089';

      // Deriv clusters: red, ws, blue, green
      const derivEndpoints = [
        `wss://red.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`,
        `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`,
        `wss://blue.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`,
      ];

      let derivWs: WebSocket | null = null;
      let endpointIdx = 0;
      let isConnectedToDeriv = false;

      function connectToDeriv() {
        if (endpointIdx >= derivEndpoints.length) {
          endpointIdx = 0;
        }
        const targetUrl = derivEndpoints[endpointIdx++];
        try {
          derivWs = new WebSocket(targetUrl, {
            headers: {
              Origin: 'https://app.deriv.com',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });

          derivWs.on('open', () => {
            isConnectedToDeriv = true;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'deriv_proxy_open',
                  message: `Connected via Deriv Cloud Relay (App ID ${appId})`,
                  app_id: appId,
                })
              );
            }
          });

          derivWs.on('message', (data) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(data.toString());
            }
          });

          derivWs.on('error', (err) => {
            console.warn('Deriv relay backend connection error:', err.message);
          });

          derivWs.on('close', () => {
            if (isConnectedToDeriv && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'deriv_proxy_closed',
                  message: 'Deriv remote endpoint connection closed. Retrying...',
                })
              );
            }
            isConnectedToDeriv = false;
          });
        } catch (err: any) {
          console.warn('Failed to connect to Deriv from proxy:', err.message);
        }
      }

      connectToDeriv();

      clientWs.on('message', (message) => {
        try {
          if (derivWs && derivWs.readyState === WebSocket.OPEN) {
            derivWs.send(message.toString());
          }
        } catch (err: any) {
          console.warn('Proxy failed forwarding message to Deriv:', err.message);
        }
      });

      clientWs.on('close', () => {
        try {
          if (derivWs) {
            derivWs.close();
            derivWs = null;
          }
        } catch {}
      });
    } catch (err: any) {
      console.warn('WebSocket connection setup error in proxy:', err.message);
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    // Set up Vite middleware in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
