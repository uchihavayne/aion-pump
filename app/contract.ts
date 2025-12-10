// app/contract.ts

// BURAYA YENİ DEPLOY ETTİĞİN ADRESİ YAPIŞTIR:
export const CONTRACT_ADDRESS = "0x1CdF04d7E171B861463564Faf927519AaF78CE50"; 

export const CONTRACT_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "symbol", "type": "string"},
      {"internalType": "string", "name": "description", "type": "string"}, // Yeni
      {"internalType": "string", "name": "twitter", "type": "string"},     // Yeni
      {"internalType": "string", "name": "telegram", "type": "string"},    // Yeni
      {"internalType": "string", "name": "website", "type": "string"}      // Yeni
    ],
    "name": "createToken",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "tokenMetadata", // Yeni Okuma Fonksiyonu
    "outputs": [
      {"internalType": "string", "name": "description", "type": "string"},
      {"internalType": "string", "name": "twitter", "type": "string"},
      {"internalType": "string", "name": "telegram", "type": "string"},
      {"internalType": "string", "name": "website", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // ... (Diğer standart fonksiyonlar aynı kalabilir ama createToken ve tokenMetadata kritik)
  {
    "inputs": [{"internalType": "address", "name": "tokenAddr", "type": "address"}],
    "name": "buy",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "tokenAddr", "type": "address"},
      {"internalType": "uint256", "name": "tokenAmount", "type": "uint256"}
    ],
    "name": "sell",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "sales",
    "outputs": [
      {"internalType": "address", "name": "creator", "type": "address"},
      {"internalType": "uint256", "name": "collateral", "type": "uint256"},
      {"internalType": "bool", "name": "migrated", "type": "bool"},
      {"internalType": "uint256", "name": "tokensSold", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllTokens",
    "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "tokenAddress", "type": "address"}],
    "name": "name",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "tokenAddress", "type": "address"}],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
