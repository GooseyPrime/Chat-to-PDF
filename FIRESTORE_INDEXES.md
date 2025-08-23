# Firestore Indexes Required

This application requires specific Firestore indexes to function properly. The indexes must be created in the Firebase Console.

## Required Indexes

### 1. SubscriptionHistory Collection Index

**Collection:** `subscriptionHistory`
**Fields:**
- `status` (Ascending)
- `userId` (Ascending) 
- `createdAt` (Descending)

**Create URL:** 
```
https://console.firebase.google.com/v1/r/project/chat-transcript-converter/firestore/indexes?create_composite=CmVwcm9qZWN0cy9jaGF0LXRyYW5zY3JpcHQtY29udmVydGVyL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9zdWJzY3JpcHRpb25IaXN0b3J5L2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGgoKBnVzZXJJZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI
```

### 2. PDFRecords Collection Index

**Collection:** `pdfRecords`
**Fields:**
- `userId` (Ascending)
- `createdAt` (Descending)

**Create URL:**
```
https://console.firebase.google.com/v1/r/project/chat-transcript-converter/firestore/indexes?create_composite=Clxwcm9qZWN0cy9jaGF0LXRyYW5zY3JpcHQtY29udmVydGVyL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wZGZSZWNvcmRzL2luZGV4ZXMvXxABGgoKBnVzZXJJZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI
```

## How to Create Indexes

1. **Go to Firebase Console**: [https://console.firebase.google.com](https://console.firebase.google.com)
2. **Select your project**: `chat-transcript-converter`
3. **Navigate to Firestore Database**
4. **Click on "Indexes" tab**
5. **Click "Create Index"**
6. **Enter the following details for each index:**

### For SubscriptionHistory Index:
- Collection ID: `subscriptionHistory`
- Field 1: `status` → Ascending
- Field 2: `userId` → Ascending  
- Field 3: `createdAt` → Descending

### For PDFRecords Index:
- Collection ID: `pdfRecords`
- Field 1: `userId` → Ascending
- Field 2: `createdAt` → Descending

## Alternative: Click the Direct Links

The error messages in the logs contain direct links to create the indexes. You can click these links from the error logs:

1. **SubscriptionHistory Index**: [Direct Link](https://console.firebase.google.com/v1/r/project/chat-transcript-converter/firestore/indexes?create_composite=CmVwcm9qZWN0cy9jaGF0LXRyYW5zY3JpcHQtY29udmVydGVyL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9zdWJzY3JpcHRpb25IaXN0b3J5L2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGgoKBnVzZXJJZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI)

2. **PDFRecords Index**: [Direct Link](https://console.firebase.google.com/v1/r/project/chat-transcript-converter/firestore/indexes?create_composite=Clxwcm9qZWN0cy9jaGF0LXRyYW5zY3JpcHQtY29udmVydGVyL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wZGZSZWNvcmRzL2luZGV4ZXMvXxABGgoKBnVzZXJJZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI)

## Index Creation Time

- Index creation typically takes 5-10 minutes
- The application will start working properly once indexes are built
- You can monitor index build progress in the Firebase Console

## Troubleshooting

If you see errors like:
```
Error: 9 FAILED_PRECONDITION: The query requires an index
```

This means the indexes haven't been created yet or are still building. Create the indexes using the steps above and wait for them to complete.