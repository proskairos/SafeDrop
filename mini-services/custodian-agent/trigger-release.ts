#!/usr/bin/env bun
// Script to trigger release for a will
// Usage: bun run trigger-release.ts <willId> <ownerPrivateKey>

import { createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const CONTRACT_ADDRESS = '0x06f14713198eA009fC98246164159e41C7Ec3A0B' as `0x${string}`

const filecoinCalibration = defineChain({
  id: 314159,
  name: 'Filecoin Calibration',
  nativeCurrency: { name: 'Filecoin', symbol: 'tFIL', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://api.calibration.node.glif.io/rpc/v1'] },
  },
})

// Minimal ABI for ownerRelease
const ABI = [
  {
    type: 'function',
    name: 'ownerRelease',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error('Usage: bun run trigger-release.ts <willId> <ownerPrivateKey>')
    console.error('Example: bun run trigger-release.ts 2 0x...')
    process.exit(1)
  }

  const willId = BigInt(args[0])
  const privateKey = args[1]

  // Normalize private key
  const normalizedKey = privateKey.startsWith('0x') ? privateKey.toLowerCase() : `0x${privateKey.toLowerCase()}`
  const account = privateKeyToAccount(normalizedKey as `0x${string}`)

  console.log(`Will ID: ${willId}`)
  console.log(`Owner Address: ${account.address}`)
  console.log(`Contract: ${CONTRACT_ADDRESS}`)
  console.log('')

  const wallet = createWalletClient({
    chain: filecoinCalibration,
    transport: http(),
    account,
  })

  try {
    console.log('Sending ownerRelease transaction...')
    const hash = await wallet.writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'ownerRelease',
      args: [willId],
    })

    console.log(`Transaction submitted: ${hash}`)
    console.log('Waiting for confirmation...')

    // Wait for transaction receipt
    const { createPublicClient } = await import('viem')
    const publicClient = createPublicClient({
      chain: filecoinCalibration,
      transport: http(),
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 })

    if (receipt.status === 'success') {
      console.log('')
      console.log('✅ Release successful!')
      console.log(`   Will #${willId} has been released`)
      console.log(`   Transaction: ${hash}`)
      console.log(`   Block: ${receipt.blockNumber}`)
    } else {
      console.log('')
      console.log('❌ Transaction reverted')
      console.log(`   Transaction: ${hash}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
