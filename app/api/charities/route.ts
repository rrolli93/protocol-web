import { json } from '@/lib/dare/http'
import { getRepo } from '@/lib/dare/runtime'

export async function GET() {
  const charities = await getRepo().listCharities()
  return json({ charities })
}
