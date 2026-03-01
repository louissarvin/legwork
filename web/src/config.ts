export const config = {
  appName: 'Legwork',
  appDescription: 'The reverse gig economy. AI agents hire humans, pay instantly in USDT.',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3700',

  links: {
    twitter: '',
    github: '',
    telegram: '',
    discord: '',
    docs: '',
  },

  contracts: {
    usdtSepolia: '0xd077a400968890eacc75cdc901f0356c943e4fdb',
    easAddress: '0xC2679fBD37d54388Ce493F1DB75320D236e1815e',
  },

  explorer: {
    baseUrl: 'https://sepolia.etherscan.io',
    tx: (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`,
    address: (addr: string) => `https://sepolia.etherscan.io/address/${addr}`,
    eas: (uid: string) => `https://sepolia.easscan.org/attestation/view/${uid}`,
  },

  platform: {
    feeBps: 500,
    usdtDecimals: 6,
    minTaskPayment: 1_000_000,
    maxTaskPayment: 1_000_000_000,
    network: 'sepolia',
    version: 'v2.0.4-stable',
  },

  features: {
    darkMode: true,
    smoothScroll: true,
  },
} as const

export type Config = typeof config
