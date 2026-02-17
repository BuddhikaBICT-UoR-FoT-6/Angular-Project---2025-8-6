// server/utils/analyticsStream.js

// ------------------------------
// State: active client connections
// ------------------------------

// Set to store active SSE client response objects (each `res` is one open connection)
const clients = new Set();

// Timer ID for the heartbeat interval (used so we only start one interval)
let heartbeatTimer = null;

// -----------------------------------------
// Helper: broadcast an SSE event to all clients
// -----------------------------------------
function broadcast(eventName, payload = {}) {
    // SSE payload must be a string; JSON is a common convention
    const data = JSON.stringify(payload);

    // Write the event to every connected client
    for (const res of clients) {
        try {
            // SSE format:
            // event: <name>
            // data: <string>
            // (blank line ends the message)
            res.write(`event: ${eventName}\ndata: ${data}\n\n`);
        } catch {
            // If the socket is closed or writing fails, remove the client
            clients.delete(res);
        }
    }
}

// ------------------------------------------------------
// Heartbeat: keep SSE connections alive through proxies
// ------------------------------------------------------
function startHeartbeat() {
    // Exit if heartbeat is already running
    if (heartbeatTimer) return;

    // Send a ping event every 25 seconds to all connected clients
    heartbeatTimer = setInterval(() => {
        for (const res of clients) {
            try {
                // Ping event helps prevent idle timeouts on some proxies/load balancers
                res.write(`event: ping\ndata: {}\n\n`);
            } catch {
                // Remove client if write fails (connection closed)
                clients.delete(res);
            }
        }
    }, 25000);
}

// ------------------------------------------------------
// Public: attach a new SSE client to the active client set
// ------------------------------------------------------
function attachSseClient(req, res) {
    // SSE requires a 200 response and specific headers
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // If behind proxy, this helps headers flush immediately (if supported)
    res.flushHeaders?.();

    // Track this client connection
    clients.add(res);

    // Ensure heartbeat is running so connections stay alive
    startHeartbeat();

    // Send an initial "hello" event so the client knows the stream is active
    res.write(
        `event: hello\ndata: ${JSON.stringify({
            ok: true,
            ts: new Date().toISOString(),
        })}\n\n`
    );

    // When the client disconnects, remove from the active set
    req.on("close", () => {
        clients.delete(res);
    });
}

// ------------------------------------------------------
// Public: notify clients that analytics data has changed
// ------------------------------------------------------
function broadcastAnalyticsUpdated(reason = "orders_changed") {
    // Broadcast a semantic event the frontend can listen for
    broadcast("analytics_updated", { reason, ts: new Date().toISOString() });
}

// -----------------------------------------
// Module exports
// -----------------------------------------
module.exports = {
    attachSseClient,
    broadcastAnalyticsUpdated,
};
