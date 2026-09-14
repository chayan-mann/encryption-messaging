class Storage {
  constructor() {
    // Store user data: userId -> { publicKey, encryptionManager, socket, messageQueue }
    this.users = new Map();
    
    // Store conversations: "user1-user2" -> [messages]
    this.conversations = new Map();
  }

  /**
   * Register a new user
   */
  registerUser(userId, encryptionManager, socket) {
    this.users.set(userId, {
      userId,
      encryptionManager,
      publicKey: encryptionManager.getPublicKeyPEM(),
      socket,
      messageQueue: [],
      connectedAt: new Date()
    });
    console.log(`✓ User '${userId}' registered`);
  }

  /**
   * Get user by ID
   */
  getUser(userId) {
    return this.users.get(userId);
  }

  /**
   * Check if user exists
   */
  userExists(userId) {
    return this.users.has(userId);
  }

  /**
   * Get user's public key
   */
  getPublicKey(userId) {
    const user = this.users.get(userId);
    return user ? user.publicKey : null;
  }

  /**
   * Disconnect user
   */
  disconnectUser(userId) {
    this.users.delete(userId);
    console.log(`✗ User '${userId}' disconnected`);
  }

  /**
   * List all connected users
   */
  listConnectedUsers() {
    return Array.from(this.users.keys());
  }

  /**
   * Queue message if recipient is offline
   */
  queueMessage(fromUserId, toUserId, encryptedData) {
    const conversationKey = this.getConversationKey(fromUserId, toUserId);
    
    if (!this.conversations.has(conversationKey)) {
      this.conversations.set(conversationKey, []);
    }
    
    const message = {
      from: fromUserId,
      to: toUserId,
      data: encryptedData,
      timestamp: new Date(),
      delivered: false
    };
    
    this.conversations.get(conversationKey).push(message);
    console.log(`📦 Message queued from '${fromUserId}' to '${toUserId}'`);
  }

  /**
   * Get queued messages for user
   */
  getQueuedMessages(userId) {
    const messages = [];
    
    for (const [key, convo] of this.conversations.entries()) {
      const undelivered = convo.filter(
        msg => msg.to === userId && !msg.delivered
      );
      messages.push(...undelivered);
    }
    
    return messages;
  }

  /**
   * Mark message as delivered
   */
  markMessageDelivered(fromUserId, toUserId, messageTimestamp) {
    const conversationKey = this.getConversationKey(fromUserId, toUserId);
    const convo = this.conversations.get(conversationKey);
    
    if (convo) {
      const msg = convo.find(m => m.timestamp === messageTimestamp);
      if (msg) msg.delivered = true;
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(userId1, userId2) {
    const key = this.getConversationKey(userId1, userId2);
    return this.conversations.get(key) || [];
  }

  /**
   * Helper: Create consistent conversation key
   */
  getConversationKey(userId1, userId2) {
    const users = [userId1, userId2].sort();
    return `${users[0]}-${users[1]}`;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      connectedUsers: this.users.size,
      userList: this.listConnectedUsers(),
      conversations: this.conversations.size,
      totalMessages: Array.from(this.conversations.values())
        .reduce((sum, convo) => sum + convo.length, 0)
    };
  }
}

module.exports = new Storage();