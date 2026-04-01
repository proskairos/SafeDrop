'use client'

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { decodeEventLog } from 'viem'
import { useQueryClient, useQueries } from '@tanstack/react-query'
import { useEffect, useState, useMemo } from 'react'
import { TESTAMENT_REGISTRY_ABI, type OnChainWill, getWillStatus } from '@/lib/contract'
import { CONTRACT_ADDRESS } from '@/lib/wagmi'

const contractConfig = {
  address: CONTRACT_ADDRESS as `0x${string}`,
  abi: TESTAMENT_REGISTRY_ABI,
} as const

// ─── Read: Get a single will by ID ──────────────────────────
export function useGetWill(willId: number | undefined) {
  const isEnabled = willId !== undefined && willId >= 0

  return useReadContract({
    ...contractConfig,
    functionName: 'getWill',
    args: isEnabled ? [BigInt(willId!)] : undefined,
    query: {
      enabled: isEnabled,
      select: (data): OnChainWill | null => {
        if (!data) return null
        // Deployed ABI returns a single tuple (struct), viem decodes it as an object
        const will = data as unknown as {
          owner: string
          beneficiary: string
          cid: string
          encryptedKey: string
          lastCheckIn: bigint
          timeoutDuration: bigint
          isReleased: boolean
          revealed: boolean
          exists: boolean
        }
        if (!will.exists) return null
        return {
          ...will,
          willId,
        }
      },
    },
  })
}

// ─── Read: Get all will IDs for an owner ────────────────────
export function useGetOwnerWills(ownerAddress: `0x${string}` | undefined) {
  const isEnabled = !!ownerAddress && ownerAddress !== '0x0000000000000000000000000000000000000000'

  return useReadContract({
    ...contractConfig,
    functionName: 'getOwnerWills',
    args: isEnabled ? [ownerAddress] : undefined,
    query: {
      enabled: isEnabled,
      select: (data) => {
        if (!data) return []
        return (data as bigint[]).map((id) => Number(id))
      },
    },
  })
}

// ─── Read: Get will count for an owner ──────────────────────
export function useGetOwnerWillCount(ownerAddress: `0x${string}` | undefined) {
  const isEnabled = !!ownerAddress && ownerAddress !== '0x0000000000000000000000000000000000000000'

  return useReadContract({
    ...contractConfig,
    functionName: 'getOwnerWillCount',
    args: isEnabled ? [ownerAddress] : undefined,
    query: { enabled: isEnabled },
  })
}

// ─── Read: Get all will IDs where address is beneficiary ────
export function useGetBeneficiaryWills(beneficiaryAddress: `0x${string}` | undefined) {
  const isEnabled = !!beneficiaryAddress && beneficiaryAddress !== '0x0000000000000000000000000000000000000000'

  return useReadContract({
    ...contractConfig,
    functionName: 'getBeneficiaryWills',
    args: isEnabled ? [beneficiaryAddress] : undefined,
    query: {
      enabled: isEnabled,
      select: (data) => {
        if (!data) return []
        return (data as bigint[]).map((id) => Number(id))
      },
    },
  })
}

// ─── Read: Can release check ────────────────────────────────
export function useCanRelease(willId: number | undefined) {
  const isEnabled = willId !== undefined && willId >= 0

  return useReadContract({
    ...contractConfig,
    functionName: 'canRelease',
    args: isEnabled ? [BigInt(willId!)] : undefined,
    query: { enabled: isEnabled },
  })
}

// ─── Read: Time until release ───────────────────────────────
export function useGetTimeUntilRelease(willId: number | undefined) {
  const isEnabled = willId !== undefined && willId >= 0

  return useReadContract({
    ...contractConfig,
    functionName: 'getTimeUntilRelease',
    args: isEnabled ? [BigInt(willId!)] : undefined,
    query: { enabled: isEnabled },
  })
}

// ─── Read: Total wills count ────────────────────────────────
export function useGetTotalWills() {
  return useReadContract({
    ...contractConfig,
    functionName: 'getTotalWills',
  })
}

// ─── Filecoin FEVM Gas Cap ─────────────────────────────────
const FEVM_GAS_LIMIT = 1_000_000_000n

// ─── Write: Create Will ─────────────────────────────────────
export function useCreateWill() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const queryClient = useQueryClient()

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  })

  // Extract willId from WillCreated event logs
  const [createdWillId, setCreatedWillId] = useState<number | null>(null)

  useEffect(() => {
    if (receipt?.logs) {
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: TESTAMENT_REGISTRY_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'WillCreated' && decoded.args.willId !== undefined) {
            setCreatedWillId(Number(decoded.args.willId))
            break
          }
        } catch { /* not this event type, skip */ }
      }
    }
  }, [receipt])

  const createWill = (
    cid: string,
    encryptedKey: `0x${string}`,
    beneficiary: `0x${string}`,
    timeoutDuration: number,
  ) => {
    writeContract({
      ...contractConfig,
      functionName: 'createWill',
      args: [cid, encryptedKey, beneficiary, BigInt(timeoutDuration)],
      gas: FEVM_GAS_LIMIT,
    })
  }

  // Invalidate queries when transaction confirms (inside useEffect, NOT during render)
  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['readContract'] })
    }
  }, [isSuccess, queryClient])

  return {
    createWill,
    hash,
    createdWillId,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  }
}

// ─── Write: Check In ────────────────────────────────────────
export function useCheckIn() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const queryClient = useQueryClient()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  })

  const checkIn = (willId: number) => {
    writeContract({
      ...contractConfig,
      functionName: 'checkIn',
      args: [BigInt(willId)],
      gas: FEVM_GAS_LIMIT,
    })
  }

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['readContract'] })
    }
  }, [isSuccess, queryClient])

  return {
    checkIn,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  }
}

// ─── Write: Trigger Release (permissionless, after timeout) ─
export function useTriggerRelease() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const queryClient = useQueryClient()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  })

  const triggerRelease = (willId: number) => {
    writeContract({
      ...contractConfig,
      functionName: 'triggerRelease',
      args: [BigInt(willId)],
      gas: FEVM_GAS_LIMIT,
    })
  }

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['readContract'] })
    }
  }, [isSuccess, queryClient])

  return {
    triggerRelease,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  }
}

// ─── Write: Owner Release (early, by owner only) ────────────
export function useOwnerRelease() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const queryClient = useQueryClient()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  })

  const ownerRelease = (willId: number) => {
    writeContract({
      ...contractConfig,
      functionName: 'ownerRelease',
      args: [BigInt(willId)],
      gas: FEVM_GAS_LIMIT,
    })
  }

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['readContract'] })
    }
  }, [isSuccess, queryClient])

  return {
    ownerRelease,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  }
}

// ─── Write: Reveal Share (after release, stores share2 on-chain) ──
export function useRevealShare() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const queryClient = useQueryClient()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  })

  const revealShare = (willId: number, share: `0x${string}`) => {
    writeContract({
      ...contractConfig,
      functionName: 'revealShare',
      args: [BigInt(willId), share],
      gas: FEVM_GAS_LIMIT,
    })
  }

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['readContract'] })
    }
  }, [isSuccess, queryClient])

  return {
    revealShare,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  }
}

// ─── Convenience: Current user's will IDs ───────────────────
export function useMyWillIds() {
  const { address } = useAccount()
  return useGetOwnerWills(address)
}

// ─── Convenience: Current user's beneficiary will IDs ───────
export function useMyBeneficiaryWillIds() {
  const { address } = useAccount()
  return useGetBeneficiaryWills(address)
}

// ─── Stats: Calculate on-chain wills statistics ────────────
export function useOnChainWillsStats(ownerAddress: `0x${string}` | undefined) {
  const { data: willIds, isLoading: isLoadingIds } = useGetOwnerWills(ownerAddress)
  const publicClient = usePublicClient()

  // Fetch all will data for this owner using useQueries
  const willQueries = useQueries({
    queries: (willIds ?? []).map((willId) => ({
      queryKey: ['will', willId],
      queryFn: async () => {
        if (!publicClient) return null
        const data = await publicClient.readContract({
          address: contractConfig.address,
          abi: contractConfig.abi,
          functionName: 'getWill',
          args: [BigInt(willId)],
        })
        return data
      },
      select: (data): OnChainWill | null => {
        if (!data) return null
        const will = data as unknown as {
          owner: string
          beneficiary: string
          cid: string
          encryptedKey: string
          lastCheckIn: bigint
          timeoutDuration: bigint
          isReleased: boolean
          revealed: boolean
          exists: boolean
        }
        if (!will.exists) return null
        return { ...will, willId }
      },
      enabled: !!publicClient,
    })),
  })

  const isLoading = isLoadingIds || willQueries.some((q) => q.isLoading)

  // Calculate stats from fetched wills
  const stats = useMemo(() => {
    if (!willIds || willIds.length === 0) {
      return { total: 0, active: 0, released: 0 }
    }

    const wills = willQueries
      .map((q) => q.data)
      .filter((w): w is NonNullable<typeof w> => w != null)

    const total = wills.length
    const active = wills.filter((w) => !w.isReleased).length
    const released = wills.filter((w) => w.isReleased).length

    return { total, active, released }
  }, [willIds, willQueries])

  return {
    ...stats,
    isLoading,
  }
}
