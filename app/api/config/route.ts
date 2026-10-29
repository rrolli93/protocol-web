import { json } from '@/lib/dare/http'
import { publicConfig } from '@/lib/dare/runtime'

export async function GET() {
  return json(publicConfig())
}
