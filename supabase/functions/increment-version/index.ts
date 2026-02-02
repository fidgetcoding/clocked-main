import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current version
    const { data: configData, error: fetchError } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'version')
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch version: ${fetchError.message}`)
    }

    // Parse and increment version
    const currentVersion = parseFloat(configData.value)
    const newVersion = (currentVersion + 0.01).toFixed(2)

    // Update version
    const { error: updateError } = await supabase
      .from('app_config')
      .update({ value: newVersion, updated_at: new Date().toISOString() })
      .eq('key', 'version')

    if (updateError) {
      throw new Error(`Failed to update version: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        previousVersion: currentVersion.toFixed(2),
        newVersion 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
