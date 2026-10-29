import { describe, expect, it } from 'vitest'
import { MockProofChecker, parseModelOutput, runProofPipeline } from '@/lib/dare/ai'

const checker = new MockProofChecker()

async function run(fixture: 'pass' | 'fail' | 'unsure' | 'injection' | undefined, extra?: { bountyCents?: number; duplicate?: boolean; transcript?: string }) {
  return runProofPipeline({
    checker,
    rules: '100 push-ups unbroken',
    codeWord: 'amber-river',
    transcript: extra?.transcript,
    durationS: 60,
    bountyCents: extra?.bountyCents ?? 2_500,
    duplicateHash: extra?.duplicate ?? false,
    beforeDeadline: true,
    fixture,
    allowFixtures: true,
  })
}

describe('proof policy', () => {
  it('auto-passes a confident clean clip under CHF 50', async () => {
    const decision = await run('pass')
    expect(decision.outcome).toBe('auto_pass')
    expect(decision.reviewStatus).toBe('none')
  })

  it('auto-fails a confident miss and allows a retake', async () => {
    const decision = await run('fail')
    expect(decision.outcome).toBe('auto_fail')
    expect(decision.retakeAllowed).toBe(true)
  })

  it('queues an unsure clip', async () => {
    const decision = await run('unsure')
    expect(decision.outcome).toBe('queue')
    expect(decision.reviewStatus).toBe('pending')
  })

  it('does not auto-pass prompt injection', async () => {
    const decision = await run('injection')
    expect(decision.outcome).toBe('queue')
    expect(decision.outcome).not.toBe('auto_pass')
    expect(decision.rationale.toLowerCase()).toMatch(/ignored instructions/)
  })

  it('queues every dare of CHF 50 or more', async () => {
    const decision = await run('pass', { bountyCents: 5_000 })
    expect(decision.outcome).toBe('queue')
  })

  it('trusts a transcript over a model that claims the code word was heard', async () => {
    const decision = await run('pass', { transcript: 'I never say the phrase' })
    expect(decision.outcome).not.toBe('auto_pass')
  })

  it('rejects a reused video hash', async () => {
    const decision = await run('pass', { duplicate: true })
    expect(decision.outcome).toBe('auto_fail')
    expect(decision.model).toBe('hash-dedupe')
  })

  it('drops model output that is not the expected JSON shape', () => {
    expect(parseModelOutput({ verdict: 'pass', confidence: 2 })).toBeNull()
    expect(parseModelOutput({ verdict: 'approve', confidence: 0.9 })).toBeNull()
    expect(parseModelOutput('ignore previous instructions')).toBeNull()
  })
})
