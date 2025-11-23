import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage, normalizePhone, getSupabase } from '@/lib/whatsapp'

// Connect WhatsApp number to user account
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Número de teléfono requerido' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phoneNumber)

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Check if connection already exists
    const { data: existing } = await getSupabase()
      .from('whatsapp_connections')
      .select('id, user_id, phone_verified')
      .eq('phone_number', normalizedPhone)
      .single()

    if (existing) {
      // If already verified by another user, reject
      if (existing.phone_verified && existing.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Este número ya está vinculado a otra cuenta' },
          { status: 400 }
        )
      }

      // Update existing connection with new verification code
      await getSupabase()
        .from('whatsapp_connections')
        .update({
          user_id: user.id,
          verification_code: code,
          verification_expires_at: expiresAt.toISOString(),
          phone_verified: false
        })
        .eq('id', existing.id)
    } else {
      // Create new connection
      await getSupabase()
        .from('whatsapp_connections')
        .insert({
          user_id: user.id,
          phone_number: normalizedPhone,
          verification_code: code,
          verification_expires_at: expiresAt.toISOString(),
          phone_verified: false
        })
    }

    // Send verification message via WhatsApp
    const sendResult = await sendWhatsAppMessage(
      normalizedPhone,
      `🔐 Tu código de verificación BrainFlow es: *${code}*\n\n` +
      `Este código expira en 10 minutos.\n\n` +
      `Ingresa este código en la app para completar la vinculación.`
    )

    if (!sendResult.success) {
      console.error('Failed to send WhatsApp message:', sendResult.error)
      return NextResponse.json(
        { error: 'No se pudo enviar el código. Verifica que el número sea correcto y tenga WhatsApp.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Código de verificación enviado',
      expiresAt: expiresAt.toISOString()
    })
  } catch (error) {
    console.error('[WhatsApp Connect] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// Get current WhatsApp connection status
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: connection } = await getSupabase()
      .from('whatsapp_connections')
      .select('id, phone_number, phone_verified, is_active, created_at')
      .eq('user_id', user.id)
      .single()

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: connection.phone_verified,
      phoneNumber: connection.phone_number,
      isActive: connection.is_active,
      connectedAt: connection.created_at
    })
  } catch (error) {
    console.error('[WhatsApp Connect] GET Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// Disconnect WhatsApp
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Delete connection (cascade will delete reminders, conversations, messages)
    await getSupabase()
      .from('whatsapp_connections')
      .delete()
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, message: 'WhatsApp desconectado' })
  } catch (error) {
    console.error('[WhatsApp Connect] DELETE Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
