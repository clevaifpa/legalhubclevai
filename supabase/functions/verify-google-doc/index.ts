import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"



const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SHARED_FOLDER_ID = '1Ui7l9o9AQwtecrVLgc3JMp1lALs5QwAr'

const base64Url = (input: ArrayBuffer | string) => {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const getServiceAccountAccessToken = async () => {
    const rawKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
    if (!rawKey) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is missing')
    const key = JSON.parse(rawKey)
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = {
        iss: key.client_email,
        scope: 'https://www.googleapis.com/auth/drive.metadata.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    }
    const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`
    const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        Uint8Array.from(atob(key.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')), c => c.charCodeAt(0)),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
    )
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(unsignedToken))
    const jwt = `${unsignedToken}.${base64Url(signature)}`
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    })
    if (!tokenResponse.ok) throw new Error(`Google auth failed: ${tokenResponse.status}`)
    const tokenData = await tokenResponse.json()
    return tokenData.access_token as string
}

const getDriveFileMetadata = async (fileId: string, accessToken: string) => {
    const apiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,parents&supportsAllDrives=true`
    const response = await fetch(apiUrl, { headers: { Authorization: `Bearer ${accessToken}` } })

    if (!response.ok) {
        const body = await response.text()
        console.error(`Google API Error for ${fileId}: ${response.status} ${response.statusText} ${body}`)
        if (body.includes('SERVICE_DISABLED') || body.includes('accessNotConfigured') || body.includes('drive.googleapis.com')) {
            throw new Error('Google Drive API của tài khoản service đang chưa bật. Vui lòng liên hệ admin bật Drive API cho project service account rồi thử lại.')
        }
        throw new Error('Không thể kiểm tra file. Vui lòng đảm bảo file nằm trong folder chung hoặc liên hệ admin.')
    }

    return await response.json()
}

const isInsideSharedFolder = async (fileId: string, accessToken: string) => {
    const visited = new Set<string>()
    let queue = [fileId]

    while (queue.length > 0) {
        const currentId = queue.shift()!
        if (visited.has(currentId)) continue
        visited.add(currentId)

        const metadata = await getDriveFileMetadata(currentId, accessToken)
        const parents = Array.isArray(metadata?.parents) ? metadata.parents : []
        if (parents.includes(SHARED_FOLDER_ID)) return true
        queue = queue.concat(parents.filter((parentId: string) => parentId && !visited.has(parentId)))
    }

    return false
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
        const accessToken = await getServiceAccountAccessToken()

        // Folder membership is the only validation rule. Allow files inside subfolders by walking parent folders recursively.
        const isEditable = true
        const isInSharedFolder = await isInsideSharedFolder(fileId, accessToken)

        return new Response(
            JSON.stringify({ isEditable, isInSharedFolder }),
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
