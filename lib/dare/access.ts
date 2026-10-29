/** Mirrors the proofs SELECT policy: stranger reads are denied. */
export function canReadProof(actorId: string | null, args: {
  doerId: string
  creatorId: string
  dareDoerId: string | null
  funderIds: string[]
  isAdmin: boolean
}): boolean {
  if (!actorId) return false
  if (args.isAdmin) return true
  if (actorId === args.doerId) return true
  if (actorId === args.creatorId) return true
  if (actorId === args.dareDoerId) return true
  return args.funderIds.includes(actorId)
}

export function canWriteFunding(actorRole: 'anon' | 'authenticated' | 'service_role'): boolean {
  return actorRole === 'service_role'
}
