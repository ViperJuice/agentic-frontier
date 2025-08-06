import { Response } from 'express';
import { SSEClient, SSEMessage } from '../types';
import { getCurrentTimestamp } from '../utils';

export class SSEService {
  private clients: Set<SSEClient>;

  constructor() {
    this.clients = new Set<SSEClient>();
  }

  /**
   * Add a new SSE client
   */
  addClient(res: Response): void {
    // Configure SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send initial connection message
    const connectMessage: SSEMessage = {
      type: 'connected',
      timestamp: getCurrentTimestamp()
    };
    res.write(`data: ${JSON.stringify(connectMessage)}\n\n`);
    
    // Add to clients set
    this.clients.add(res as SSEClient);
  }

  /**
   * Remove a client from the set
   */
  removeClient(res: Response): void {
    this.clients.delete(res as SSEClient);
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(data: any): void {
    const message = JSON.stringify(data);
    
    this.clients.forEach(client => {
      try {
        client.write(`data: ${message}\n\n`);
      } catch (error) {
        // Client disconnected, remove from set
        this.clients.delete(client);
      }
    });
  }

  /**
   * Broadcast an update event
   */
  broadcastUpdate(update: {
    type: string;
    [key: string]: any;
  }): void {
    this.broadcast({
      ...update,
      timestamp: getCurrentTimestamp()
    });
  }

  /**
   * Get count of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Send heartbeat to all clients
   */
  sendHeartbeat(): void {
    this.broadcast({
      type: 'heartbeat',
      timestamp: getCurrentTimestamp()
    });
  }
}