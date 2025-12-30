import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = "force-dynamic";

export async function GET() {

  try {
    const { data, error } = await supabase
      .from('pickup_records')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { picker_name, quantity } = await request.json()

    if (!picker_name || !quantity) {
      return NextResponse.json({ error: 'Missing name or quantity' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pickup_records')
      .insert([{ picker_name, quantity }])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data[0])
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing record ID' }, { status: 400 })
    }

    const { error } = await supabase
      .from('pickup_records')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Record deleted successfully' })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
