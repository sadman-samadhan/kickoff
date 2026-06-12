/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import webpush from 'web-push'

export async function GET() {
  try {
    const keys = webpush.generateVAPIDKeys()
    return NextResponse.json(keys)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
