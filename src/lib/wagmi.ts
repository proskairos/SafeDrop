import { http, createConfig } from 'wagmi'
import { defineChain } from 'viem'
import { injected } from 'wagmi/connectors'

// ─── Filecoin Calibration Testnet ────────────────────────────────────
export const filecoinCalibration = defineChain({
  id: 314159,
  name: 'Filecoin Calibration',
  nativeCurrency: {
    name: 'Filecoin',
    symbol: 'tFIL',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://api.calibration.node.glif.io/rpc/v1'],
    },
    public: {
      http: ['https://api.calibration.node.glif.io/rpc/v1'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Filscan',
      url: 'https://calibration.filscan.io/en',
    },
  },
})

// ─── Contract Address ────────────────────────────────────────────────
// Deploy this contract to Filecoin Calibration Testnet and set the address here.
// You can also set it via NEXT_PUBLIC_CONTRACT_ADDRESS env variable.
export const CONTRACT_ADDRESS = '0x06f14713198eA009fC98246164159e41C7Ec3A0B'

// ─── Wagmi Config ────────────────────────────────────────────────────
export const config = createConfig({
  chains: [filecoinCalibration],
  connectors: [
    injected(),
  ],
  transports: {
    [filecoinCalibration.id]: http(),
  },
})

// ─── Chain Metadata ──────────────────────────────────────────────────
export const CHAIN_META = {
  name: 'Filecoin Calibration',
  id: 314159,
  symbol: 'tFIL',
  explorer: 'https://calibration.filscan.io/en',
  faucet: 'https://faucet.calibration.fildev.network/',
}
