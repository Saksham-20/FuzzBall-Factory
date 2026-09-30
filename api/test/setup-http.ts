import http from 'node:http';

// supertest binds each app to a fresh ephemeral port per request. With Node's default keep-alive agent a pooled
// socket can outlive its server and be handed to a later request on a reused port: ECONNRESET, or another
// listener's reply (a stray 426). One connection per request removes the pooling.
http.globalAgent = new http.Agent({ keepAlive: false });
