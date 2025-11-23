import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage, getSupabase, createDefaultReminders } from '@/lib/whatsapp'

// Verify WhatsApp connection with code
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { code } = await request.json()

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
    }

    // Find connection with matching code for this user
    const { data: connection, error: findError } = await getSupabase()
      .from('whatsapp_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('verification_code', code)
      .gt('verification_expires_at', new Date().toISOString())
      .single()

    if (findError || !connection) {
      return NextResponse.json(
        { error: 'Código inválido o expirado. Solicita un nuevo código.' },
        { status: 400 }
      )
    }

    // Mark as verified
    await getSupabase()
      .from('whatsapp_connections')
      .update({
        phone_verified: true,
        verification_code: null,
        verification_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)

    // Create default reminders
    try {
      await createDefaultReminders(connection.id)
    } catch (reminderError) {
      console.error('Error creating default reminders:', reminderError)
      // Don't fail the verification if reminders fail
    }

    // Send welcome message
    await sendWhatsAppMessage(
      connection.phone_number,
      '✅ *¡Cuenta vinculada exitosamente!*\n\n' +
      'Ahora recibirás recordatorios y podrás interactuar con tu journal desde aquí.\n\n' +
      '*Comandos disponibles:*\n' +
      '📝 /journal - Abrir journal\n' +
      '📊 /stats - Ver estadísticas\n' +
      '😊 /mood [1-5] - Registrar estado\n' +
      '📚 /estudiar - Iniciar estudio\n' +
      '💭 /nota [texto] - Nota rápida\n' +
      '🔥 /racha - Ver racha\n' +
      '❓ /ayuda - Ver todos los comandos\n\n' +
      '_También puedes escribir libremente y lo guardaré en tu journal_ 📝'
    )

    return NextResponse.json({
      success: true,
      message: 'WhatsApp verificado exitosamente',
      phoneNumber: connection.phone_number
    })
  } catch (error) {
    console.error('[WhatsApp Verify] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
