const WebSocket = require('ws');
const EncryptionManager = require('../src/encryption');

const SERVER_URL = 'ws://localhost:8080';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class TestClient {
  constructor(userId) {
    this.userId = userId;
    this.ws = null;
    this.encryptionManager = null;
    this.knownPublicKeys = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(SERVER_URL);

      this.ws.onopen = () => {
        console.log(`\n✅ ${this.userId} connected to server`);
        
        // Initialize encryption manager
        this.encryptionManager = new EncryptionManager(this.userId);
        
        // Register
        this.ws.send(JSON.stringify({
          type: 'register',
          userId: this.userId
        }));
        
        resolve();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };

      this.ws.onerror = (error) => {
        console.error(`❌ ${this.userId} error:`, error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log(`\n❌ ${this.userId} disconnected`);
      };
    });
  }

  handleMessage(data) {
    if (data.type === 'welcome') {
      console.log(`📬 ${this.userId}: ${data.message}`);
      console.log(`   Connected users: ${data.connectedUsers.join(', ')}`);
    } else if (data.type === 'public_key') {
      this.knownPublicKeys.set(data.userId, data.publicKey);
      console.log(`🔑 ${this.userId}: Received public key from ${data.userId}`);
    } else if (data.type === 'message') {
      this.receiveMessage(data);
    } else if (data.type === 'message_delivered') {
      console.log(`✉️ ${this.userId}: ${data.message}`);
    } else if (data.type === 'user_list') {
      console.log(`👥 ${this.userId}: Connected users:`, data.users);
    } else if (data.type === 'conversation_history') {
      console.log(`📜 ${this.userId}: Conversation history with ${data.between[1]}:`, data.count, 'messages');
    } else if (data.type === 'error') {
      console.error(`⚠️ ${this.userId}: Error -`, data.message);
    }
  }

  getPublicKey(userId) {
    return new Promise((resolve) => {
      const checkKey = setInterval(() => {
        if (this.knownPublicKeys.has(userId)) {
          clearInterval(checkKey);
          resolve(this.knownPublicKeys.get(userId));
        }
      }, 50);

      this.ws.send(JSON.stringify({
        type: 'get_public_key',
        targetUserId: userId
      }));

      // Timeout after 5 seconds
      setTimeout(() => clearInterval(checkKey), 5000);
    });
  }

  async sendMessage(recipientId, message) {
    const recipientPublicKey = await this.getPublicKey(recipientId);

    if (!recipientPublicKey) {
      console.error(`❌ ${this.userId}: Could not get public key for ${recipientId}`);
      return;
    }

    const encrypted = this.encryptionManager.encryptMessage(
      message,
      recipientPublicKey
    );

    this.ws.send(JSON.stringify({
      type: 'send_message',
      recipientId: recipientId,
      encryptedMessage: encrypted.encryptedMessage,
      encryptedAesKey: encrypted.encryptedAesKey,
      signature: encrypted.signature,
      iv: encrypted.iv
    }));

    console.log(`📤 ${this.userId} -> ${recipientId}: "${message}"`);
  }

  receiveMessage(messageData) {
    const senderPublicKey = this.knownPublicKeys.get(messageData.from);

    if (!senderPublicKey) {
      console.error(`❌ ${this.userId}: Don't have public key from ${messageData.from}`);
      return;
    }

    const decrypted = this.encryptionManager.decryptMessage(
      {
        encryptedMessage: messageData.encryptedMessage,
        encryptedAesKey: messageData.encryptedAesKey,
        signature: messageData.signature,
        iv: messageData.iv
      },
      senderPublicKey
    );

    console.log(`📥 ${this.userId} <- ${messageData.from}: "${decrypted}"`);
  }

  listUsers() {
    this.ws.send(JSON.stringify({
      type: 'list_users'
    }));
  }

  getConversationHistory(otherUserId) {
    this.ws.send(JSON.stringify({
      type: 'get_conversation_history',
      otherUserId: otherUserId
    }));
  }
}

async function runTests() {
  console.log('\n🧪 Starting encryption messaging tests...\n');

  try {
    // Create two test clients
    const alice = new TestClient('alice');
    const bob = new TestClient('bob');
    const charlie = new TestClient('charlie');

    // Connect both clients
    await alice.connect();
    await sleep(500);
    
    await bob.connect();
    await sleep(500);
    
    await charlie.connect();
    await sleep(500);

    // Test 1: List users
    console.log('\n--- Test 1: List Connected Users ---');
    alice.listUsers();
    await sleep(500);

    // Test 2: Alice sends message to Bob
    console.log('\n--- Test 2: Alice sends encrypted message to Bob ---');
    await alice.sendMessage('bob', 'Hello Bob! This message is encrypted.');
    await sleep(1000);

    // Test 3: Bob sends message to Alice
    console.log('\n--- Test 3: Bob sends encrypted message to Alice ---');
    await bob.sendMessage('alice', 'Hi Alice! I received your message securely.');
    await sleep(1000);

    // Test 4: Charlie sends to Bob
    console.log('\n--- Test 4: Charlie sends encrypted message to Bob ---');
    await charlie.sendMessage('bob', 'Hey Bob, encryption is cool!');
    await sleep(1000);

    // Test 5: Get conversation history
    console.log('\n--- Test 5: Get conversation history ---');
    alice.getConversationHistory('bob');
    await sleep(500);

    // Test 6: Send multiple messages
    console.log('\n--- Test 6: Multiple messages exchange ---');
    await alice.sendMessage('bob', 'First message');
    await sleep(300);
    await alice.sendMessage('bob', 'Second message');
    await sleep(300);
    await bob.sendMessage('alice', 'Got your messages!');
    await sleep(1000);

    // Test 7: List users again
    console.log('\n--- Test 7: Final user list ---');
    bob.listUsers();
    await sleep(500);

    console.log('\n✅ All tests completed!\n');

    // Keep connections alive
    setTimeout(() => {
      alice.ws.close();
      bob.ws.close();
      charlie.ws.close();
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTests();