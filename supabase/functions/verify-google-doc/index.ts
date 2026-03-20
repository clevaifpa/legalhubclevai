import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { url } = await req.json()

        if (!url) {
            return new Response(
                JSON.stringify({ error: 'Missing url parameter' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // Extract file ID from Google Docs URL
        // Examples: 
        // https://docs.google.com/document/d/1ABC.DEF/edit
        // https://docs.google.com/spreadsheets/d/123_456/edit
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)\//)

        if (!match || !match[1]) {
            return new Response(
                JSON.stringify({ isEditable: false, error: 'Invalid Google URL format' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        const fileId = match[1]
        const apiKey = Deno.env.get('GOOGLE_API_KEY')

        if (!apiKey) {
            console.error('GOOGLE_API_KEY environment variable is missing')
            // Fallback: If no API key configured, allow passing to not block users from testing
            return new Response(
                JSON.stringify({ isEditable: true, warning: 'GOOGLE_API_KEY missing, bypassing strict check' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // Call Google Drive API to check permissions
        const apiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=capabilities(canEdit)&key=${apiKey}`
        const response = await fetch(apiUrl)

        if (!response.ok) {
            console.error(`Google API Error: ${response.status} ${response.statusText}`)
            // Missing permissions or restricted file usually results in 403 or 404
            return new Response(
                JSON.stringify({ isEditable: false, error: 'File is restricted or does not exist publicly with edit access' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        const data = await response.json()

        // Check if user has edit capabilities
        const isEditable = !!data?.capabilities?.canEdit

        return new Response(
            JSON.stringify({ isEditable }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error: any) {
        console.error('Error in verify-google-doc function:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
