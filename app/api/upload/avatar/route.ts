import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const admin = createAdminClient()

    // 1. Check Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse FormData
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 3. Upload using Admin Client (Bypasses Storage RLS)
    const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.jpg`
    const { error: uploadError } = await admin.storage
      .from('avatars')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
      console.error('Admin upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // 4. Get Public URL
    const { data: { publicUrl } } = admin.storage
      .from('avatars')
      .getPublicUrl(fileName)

    return NextResponse.json({ url: publicUrl })
  } catch (err: unknown) {
    const error = err as Error
    console.error('Server upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
