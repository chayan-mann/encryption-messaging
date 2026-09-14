const storage = require('./storage');

class WebSocketHandler {

    static handleConnection(socket, userId, publicKey){
        console.log(`🔌 New connection attempt: ${userId}`);

        // Register user in storage using the public key they provided
        storage.registerUser(userId, publicKey, socket);

        // Check for queued messages
        const queuedMessages = storage.getQueuedMessages(userId);
            if (queuedMessages.length > 0) {
            socket.send(JSON.stringify({
                type: 'queued_messages',
                count: queuedMessages.length,
                messages: queuedMessages.map(msg => ({
                from: msg.from,
                data: msg.data,
                timestamp: msg.timestamp
                }))
            }));
            console.log(`📮 Sent ${queuedMessages.length} queued messages to ${userId}`);
        }

        // Send welcome message
        socket.send(JSON.stringify({
            type: 'welcome',
            message: `Welcome ${userId}! You are connected.`,
            yourPublicKey: publicKey.substring(0, 50) + '...',
            connectedUsers: storage.listConnectedUsers()
        }));
    }

    static handleMessage(socket, userId, message){
        try{
            const data = JSON.parse(message);

            switch(data.type){

                case 'get_public_key':
                    this.handleGetPublicKey(socket, userId, data);
                    break;

                case 'send_message':
                    this.handleSendMessage(socket, userId, data);
                    break;

                case 'list_users':
                    this.handleListUsers(socket, userId);
                    break;

                case 'get_conversation_history':
                    this.handleGetConversationHistory(socket, userId, data);
                    break;

                case 'stats':
                    this.handleStats(socket, userId);
                    break;
                
                default:
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: `Unknown message type: ${data.type}`
                    }));
            }
        } catch (error){
            socket.send(JSON.stringify({
                type: 'error',
                message: `Error processing message: ${error.message}`
            }));
        }
    }

    /**
    * Get another user's public key
    */
    static handleGetPublicKey(socket, userId, data) {
        const targetUserId = data.targetUserId;

        if (!storage.userExists(targetUserId)) {
        socket.send(JSON.stringify({
            type: 'error',
            message: `User '${targetUserId}' not found or not online`
        }));
        return;
        }

        const publicKey = storage.getPublicKey(targetUserId);
        socket.send(JSON.stringify({
            type: 'public_key',
            userId: targetUserId,
            publicKey: publicKey,
            timestamp: new Date()
        }));

        console.log(`🔑 Sent public key of '${targetUserId}' to '${userId}'`);
    }

    /**
    * List all connected users
    */
    static handleListUsers(socket, userId) {
        const users = storage.listConnectedUsers();
        socket.send(JSON.stringify({
        type: 'user_list',
        users: users,
        count: users.length,
        yourId: userId
        }));
    }

    /**
    * Get conversation history between two users
    */
    static handleGetConversationHistory(socket, userId, data) {
        const otherUserId = data.otherUserId;
        const history = storage.getConversationHistory(userId, otherUserId);

        socket.send(JSON.stringify({
        type: 'conversation_history',
        between: [userId, otherUserId],
        messages: history.map(msg => ({
            from: msg.from,
            timestamp: msg.timestamp,
            delivered: msg.delivered,
            encryptedData: msg.data
        })),
        count: history.length
        }));
    }

    /**
    * Get system stats
    */
    static handleStats(socket, userId) {
        const stats = storage.getStats();
        socket.send(JSON.stringify({
        type: 'stats',
        data: stats
        }));
    }

    static handleDisconnect(userId) {
        storage.disconnectUser(userId);
    }

    /**
    * Send encrypted message to another user
    */

    static handleSendMessage(socket, userId, data){
        const recipientId = data.recipientId;
        const encryptedData = {
            encryptedMessage: data.encryptedMessage,
            encryptedAesKey: data.encryptedAesKey,
            signature: data.signature,
            iv: data.iv
        };

        if (!storage.userExists(recipientId)) {
            // User is offline, queue the message
            storage.queueMessage(userId, recipientId, encryptedData);
            socket.send(JSON.stringify({
                type: 'message_queued',
                message: `User '${recipientId}' is offline. Message will be delivered when they connect.`,
                recipientId: recipientId,
                timestamp: new Date()
            }));
            return;
        }

        // user is online, deliver directly
        const recipientUser = storage.getUser(recipientId);
        recipientUser.socket.send(JSON.stringify({
            type: 'message',
            from: userId,
            encryptedMessage: encryptedData.encryptedMessage,
            encryptedAesKey: encryptedData.encryptedAesKey,
            signature: encryptedData.signature,
            iv: encryptedData.iv,
            timestamp: new Date()
        }))

        // Also store in conversation history
        storage.queueMessage(userId, recipientId, encryptedData);

        // Send confirmation to sender
        socket.send(JSON.stringify({
            type: 'message_delivered',
            message: `Message delivered to '${recipientId}'`,
            recipientId: recipientId,
            timestamp: new Date()
        }));

        console.log(`💬 Message sent from '${userId}' to '${recipientId}'`);
    }
}

module.exports = WebSocketHandler;