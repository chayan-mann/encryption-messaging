For each message:
1. Generate a random symmetric key (AES-256)
2. Encrypt message with AES-256 (fast)
3. Encrypt the AES key with recipient's RSA public key (slow but key is tiny)
4. Send both encrypted message + encrypted key

Recipient:
1. Decrypt the AES key with their RSA private key
2. Decrypt message with AES key